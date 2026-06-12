import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { onValue, orderByChild, push, query, ref, remove, set, update } from 'firebase/database';
import { database, isFirebaseReady } from './firebase';

const QUADRANTS = [
  {
    id: 2,
    title: '중요하지만 급하지 않은 일',
    label: '중요함',
    tone: 'mint',
  },
  {
    id: 1,
    title: '중요하고 급한 일',
    label: '먼저 하기',
    tone: 'peach',
  },
  {
    id: 3,
    title: '급하지도 중요하지도 않은 일',
    label: '나중에',
    tone: 'gray',
  },
  {
    id: 4,
    title: '급하지만 중요하지 않은 일',
    label: '위임/빠르게',
    tone: 'blue',
  },
];

const DEFAULT_QUADRANT = 1;

function TodoCard({ todo, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo.id,
    data: { todo },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <article
      ref={setNodeRef}
      className={`todo-card ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <p>{todo.title}</p>
      <button
        className="icon-button menu-button"
        type="button"
        aria-label="더보기"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
        }}
      >
        ⋮
      </button>
      {menuOpen && (
        <div className="card-menu" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => onEdit(todo)}>
            수정
          </button>
          <button type="button" onClick={() => onDelete(todo)}>
            삭제
          </button>
        </div>
      )}
    </article>
  );
}

function Quadrant({ quadrant, todos, onEdit, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id: String(quadrant.id) });

  return (
    <section ref={setNodeRef} className={`quadrant ${quadrant.tone} ${isOver ? 'is-over' : ''}`}>
      <div className="quadrant-header">
        <span>{quadrant.label}</span>
        <strong>{quadrant.title}</strong>
      </div>
      <div className="card-list">
        {todos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function Modal({ title, children }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function AddPage({ onBack }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = title.trim();

    if (!trimmed || !database) {
      return;
    }

    setSaving(true);
    const todoRef = push(ref(database, 'todo'));
    await set(todoRef, {
      title: trimmed,
      quadrant: DEFAULT_QUADRANT,
      createdAt: Date.now(),
    });
    setSaving(false);
    onBack();
  }

  return (
    <main className="app-shell add-shell">
      <button className="back-button" type="button" onClick={onBack}>
        ←
      </button>
      <section className="add-panel">
        <h1>새 할 일 추가</h1>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            maxLength={80}
            placeholder="해야 할 일을 입력하세요"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={!title.trim() || saving || !isFirebaseReady}>
            ● 추가하기
          </button>
        </form>
        {!isFirebaseReady && <p className="setup-note">Firebase 환경변수를 먼저 설정해주세요.</p>}
      </section>
    </main>
  );
}

function App() {
  const [page, setPage] = useState('home');
  const [todos, setTodos] = useState([]);
  const [activeTodo, setActiveTodo] = useState(null);
  const [editingTodo, setEditingTodo] = useState(null);
  const [deletingTodo, setDeletingTodo] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    if (!database) {
      return undefined;
    }

    const todoQuery = query(ref(database, 'todo'), orderByChild('createdAt'));
    return onValue(todoQuery, (snapshot) => {
      const value = snapshot.val() || {};
      const nextTodos = Object.entries(value).map(([id, todo]) => ({
        id,
        title: todo.title || '',
        quadrant: Number(todo.quadrant) || DEFAULT_QUADRANT,
        createdAt: todo.createdAt || 0,
      }));
      setTodos(nextTodos);
    });
  }, []);

  const groupedTodos = useMemo(() => {
    return QUADRANTS.reduce((groups, quadrant) => {
      groups[quadrant.id] = todos.filter((todo) => todo.quadrant === quadrant.id);
      return groups;
    }, {});
  }, [todos]);

  function handleDragStart(event) {
    setActiveTodo(event.active.data.current?.todo || null);
  }

  async function handleDragEnd(event) {
    const targetQuadrant = Number(event.over?.id);
    const todo = event.active.data.current?.todo;
    setActiveTodo(null);

    if (!todo || !targetQuadrant || todo.quadrant === targetQuadrant || !database) {
      return;
    }

    await update(ref(database, `todo/${todo.id}`), { quadrant: targetQuadrant });
  }

  function openEdit(todo) {
    setEditingTodo(todo);
    setEditTitle(todo.title);
  }

  async function saveEdit(event) {
    event.preventDefault();
    const trimmed = editTitle.trim();

    if (!editingTodo || !trimmed || !database) {
      return;
    }

    await update(ref(database, `todo/${editingTodo.id}`), { title: trimmed });
    setEditingTodo(null);
    setEditTitle('');
  }

  async function confirmDelete() {
    if (!deletingTodo || !database) {
      return;
    }

    await remove(ref(database, `todo/${deletingTodo.id}`));
    setDeletingTodo(null);
  }

  if (page === 'add') {
    return <AddPage onBack={() => setPage('home')} />;
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>오늘 뭐부터?</h1>
        <p>오늘 해야 할 일을 정리해보세요.</p>
      </header>

      {!isFirebaseReady && (
        <div className="setup-banner">
          Firebase 설정이 필요합니다. `.env.example`을 참고해 `.env` 또는 Vercel 환경변수를 입력하세요.
        </div>
      )}

      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTodo(null)}
      >
        <section className="matrix" aria-label="우선순위 사분면">
          <div className="axis-y">중요함</div>
          <div className="axis-x">급함</div>
          {QUADRANTS.map((quadrant) => (
            <Quadrant
              key={quadrant.id}
              quadrant={quadrant}
              todos={groupedTodos[quadrant.id] || []}
              onEdit={openEdit}
              onDelete={setDeletingTodo}
            />
          ))}
        </section>
        <DragOverlay>{activeTodo ? <article className="todo-card drag-overlay">{activeTodo.title}</article> : null}</DragOverlay>
      </DndContext>

      <button className="fab" type="button" aria-label="새 할 일 추가" onClick={() => setPage('add')}>
        +
      </button>

      {editingTodo && (
        <Modal title="할 일 수정">
          <form className="modal-form" onSubmit={saveEdit}>
            <input value={editTitle} maxLength={80} onChange={(event) => setEditTitle(event.target.value)} />
            <div className="modal-actions">
              <button type="button" onClick={() => setEditingTodo(null)}>
                취소
              </button>
              <button className="primary-button compact" type="submit" disabled={!editTitle.trim()}>
                저장
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingTodo && (
        <Modal title="정말 삭제하시겠습니까?">
          <p className="delete-title">{deletingTodo.title}</p>
          <div className="modal-actions">
            <button type="button" onClick={() => setDeletingTodo(null)}>
              취소
            </button>
            <button className="danger-button" type="button" onClick={confirmDelete}>
              삭제
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default App;
