/* =====================================================
   TASKS APP — app.js
   Features: add, display, complete, delete, edit,
             filter, localStorage, drag-and-drop
   Data key: "tasks" in localStorage
   ===================================================== */

'use strict';

/* =====================================================
   STATE
   ===================================================== */

let tasks        = [];
let activeFilter = 'all';   // 'all' | 'active' | 'completed'

/* Drag state */
let dragSrcId    = null;
let touchDragId  = null;
let touchClone   = null;

/* =====================================================
   STORAGE
   ===================================================== */

function loadTasks() {
  try {
    const raw = localStorage.getItem('tasks');
    tasks = raw ? JSON.parse(raw) : [];
    /* Ensure every task has all required fields */
    tasks = tasks.map(t => ({
      id:        t.id        ?? crypto.randomUUID(),
      title:     t.title     ?? '',
      completed: t.completed ?? false,
      createdAt: t.createdAt ?? Date.now(),
      category:  t.category  ?? '',
      dueDate:   t.dueDate   ?? ''
    })).filter(t => t.title.trim() !== '');
  } catch {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

/* =====================================================
   TASK OPERATIONS
   ===================================================== */

function addTask(title, category, dueDate) {
  const trimmed = title.trim();
  if (!trimmed) return false;

  const task = {
    id:        crypto.randomUUID(),
    title:     trimmed,
    completed: false,
    createdAt: Date.now(),
    category:  category.trim(),
    dueDate:   dueDate
  };

  tasks.unshift(task);  // newest first
  saveTasks();
  return true;
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
}

function updateTaskTitle(id, newTitle) {
  const trimmed = newTitle.trim();
  if (!trimmed) return false;
  const task = tasks.find(t => t.id === id);
  if (!task) return false;
  task.title = trimmed;
  saveTasks();
  return true;
}

function reorderTasks(fromId, toId) {
  if (fromId === toId) return;
  const fromIdx = tasks.findIndex(t => t.id === fromId);
  const toIdx   = tasks.findIndex(t => t.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = tasks.splice(fromIdx, 1);
  tasks.splice(toIdx, 0, moved);
  saveTasks();
}

/* =====================================================
   FILTERS
   ===================================================== */

function getFilteredTasks() {
  switch (activeFilter) {
    case 'active':    return tasks.filter(t => !t.completed);
    case 'completed': return tasks.filter(t =>  t.completed);
    default:          return tasks;
  }
}

/* =====================================================
   DATE HELPERS
   ===================================================== */

function formatDate(isoString) {
  if (!isoString) return '';
  const [y, m, d] = isoString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(isoString) {
  if (!isoString) return false;
  const [y, m, d] = isoString.split('-').map(Number);
  const due  = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/* =====================================================
   RENDER
   ===================================================== */

function render() {
  const listEl  = document.getElementById('task-list');
  const emptyEl = document.getElementById('empty-state');
  const countEl = document.getElementById('task-count');

  const filtered = getFilteredTasks();

  /* Count label */
  const activeCount = tasks.filter(t => !t.completed).length;
  countEl.textContent = activeCount === 0
    ? 'all done'
    : `${activeCount} remaining`;

  /* Empty state */
  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.hidden   = false;
    return;
  }
  emptyEl.hidden = true;

  /* Diff — only rebuild items that changed */
  const existingIds = [...listEl.querySelectorAll('.task-item')].map(el => el.dataset.id);
  const newIds      = filtered.map(t => t.id);

  /* If order or set changed, full re-render; otherwise patch in place */
  const needsFullRebuild = existingIds.join(',') !== newIds.join(',');

  if (needsFullRebuild) {
    listEl.innerHTML = '';
    filtered.forEach(task => {
      listEl.appendChild(buildTaskElement(task));
    });
  } else {
    /* Update existing elements (completed toggle, title edits) */
    filtered.forEach(task => {
      const el = listEl.querySelector(`[data-id="${task.id}"]`);
      if (!el) return;
      patchTaskElement(el, task);
    });
  }
}

function buildTaskElement(task) {
  const li = document.createElement('li');
  li.className   = 'task-item' + (task.completed ? ' completed' : '');
  li.dataset.id  = task.id;
  li.draggable   = true;

  li.innerHTML = `
    <div class="drag-handle" aria-hidden="true" title="Drag to reorder">
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
        <circle cx="4" cy="4"  r="1.5" fill="currentColor"/>
        <circle cx="8" cy="4"  r="1.5" fill="currentColor"/>
        <circle cx="4" cy="8"  r="1.5" fill="currentColor"/>
        <circle cx="8" cy="8"  r="1.5" fill="currentColor"/>
        <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
      </svg>
    </div>

    <button class="task-checkbox" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}" data-action="toggle">
      ${task.completed ? '✓' : ''}
    </button>

    <div class="task-body">
      <span class="task-title">${escapeHtml(task.title)}</span>
      ${buildMetaHtml(task)}
    </div>

    <div class="task-actions">
      <button class="action-btn action-btn--edit"   data-action="edit"   aria-label="Edit task"   title="Edit">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M9.5 1.5L11.5 3.5L4.5 10.5H2.5V8.5L9.5 1.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="action-btn action-btn--delete" data-action="delete" aria-label="Delete task" title="Delete">
        <svg width="12" height="13" viewBox="0 0 12 13" fill="none">
          <path d="M1 3H11M4.5 3V2H7.5V3M2 3L2.5 11H9.5L10 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;

  attachTaskListeners(li, task);
  attachDragListeners(li);
  attachTouchListeners(li);
  return li;
}

function patchTaskElement(el, task) {
  const wasCompleted = el.classList.contains('completed');
  if (wasCompleted !== task.completed) {
    el.classList.toggle('completed', task.completed);
    const cb = el.querySelector('[data-action="toggle"]');
    if (cb) {
      cb.textContent  = task.completed ? '✓' : '';
      cb.setAttribute('aria-label', task.completed ? 'Mark incomplete' : 'Mark complete');
    }
    const title = el.querySelector('.task-title');
    if (title) title.textContent = task.title;
  }
}

function buildMetaHtml(task) {
  if (!task.category && !task.dueDate) return '';
  const catHtml = task.category
    ? `<span class="task-category">${escapeHtml(task.category)}</span>`
    : '';
  const dueHtml = task.dueDate
    ? `<span class="task-due ${isOverdue(task.dueDate) && !task.completed ? 'overdue' : ''}">
         ${isOverdue(task.dueDate) && !task.completed ? '⚠ ' : ''}${formatDate(task.dueDate)}
       </span>`
    : '';
  return `<div class="task-meta">${catHtml}${dueHtml}</div>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =====================================================
   TASK ELEMENT LISTENERS
   ===================================================== */

function attachTaskListeners(li, task) {
  li.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'toggle') {
      toggleTask(task.id);
      render();
    }

    if (action === 'delete') {
      li.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      li.style.opacity    = '0';
      li.style.transform  = 'translateX(12px)';
      setTimeout(() => {
        deleteTask(task.id);
        render();
      }, 150);
    }

    if (action === 'edit') {
      startInlineEdit(li, task);
    }
  });

  /* Double-click title to edit */
  const titleEl = li.querySelector('.task-title');
  if (titleEl) {
    titleEl.addEventListener('dblclick', () => startInlineEdit(li, task));
  }
}

/* =====================================================
   INLINE EDITING
   ===================================================== */

function startInlineEdit(li, task) {
  const titleEl = li.querySelector('.task-title');
  if (!titleEl || li.querySelector('.task-edit-input')) return; // already editing

  const input   = document.createElement('input');
  input.type    = 'text';
  input.className = 'task-edit-input';
  input.value   = task.title;
  input.maxLength = 200;

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  /* Prevent drag while editing */
  li.draggable = false;

  function commit() {
    const ok = updateTaskTitle(task.id, input.value);
    li.draggable = true;
    if (ok) {
      render();
    } else {
      /* Empty — restore original */
      input.replaceWith(titleEl);
    }
  }

  input.addEventListener('blur',    commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') {
      input.removeEventListener('blur', commit);
      li.draggable = true;
      input.replaceWith(titleEl);
    }
  });
}

/* =====================================================
   DRAG AND DROP — Desktop (HTML5 DnD API)
   ===================================================== */

function attachDragListeners(li) {
  li.addEventListener('dragstart', e => {
    dragSrcId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcId);
  });

  li.addEventListener('dragend', () => {
    dragSrcId = null;
    li.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
  });

  li.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (li.dataset.id !== dragSrcId) {
      document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
      li.classList.add('drag-over');
    }
  });

  li.addEventListener('dragleave', e => {
    /* Only remove if leaving the element itself, not a child */
    if (!li.contains(e.relatedTarget)) {
      li.classList.remove('drag-over');
    }
  });

  li.addEventListener('drop', e => {
    e.preventDefault();
    li.classList.remove('drag-over');
    const toId = li.dataset.id;
    if (dragSrcId && toId && dragSrcId !== toId) {
      reorderTasks(dragSrcId, toId);
      render();
    }
  });
}

/* =====================================================
   DRAG AND DROP — Mobile (Touch events)
   ===================================================== */

function attachTouchListeners(li) {
  let startY = 0;
  let startX = 0;
  let longPressTimer = null;
  let isDragging = false;

  li.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    startY = touch.clientY;
    startX = touch.clientX;

    /* Long-press to initiate drag (300ms) */
    longPressTimer = setTimeout(() => {
      isDragging  = true;
      touchDragId = li.dataset.id;
      li.classList.add('dragging');

      /* Visual clone that follows the finger */
      touchClone = li.cloneNode(true);
      touchClone.style.cssText = `
        position: fixed;
        left: ${li.getBoundingClientRect().left}px;
        top:  ${li.getBoundingClientRect().top}px;
        width: ${li.offsetWidth}px;
        opacity: 0.85;
        pointer-events: none;
        z-index: 999;
        transform: scale(1.02);
        box-shadow: 0 12px 40px rgba(0,0,0,0.6);
        transition: none;
      `;
      document.body.appendChild(touchClone);
    }, 300);
  }, { passive: true });

  li.addEventListener('touchmove', e => {
    const touch   = e.touches[0];
    const movedY  = Math.abs(touch.clientY - startY);
    const movedX  = Math.abs(touch.clientX - startX);

    /* Cancel long-press if finger moved before it fired */
    if (!isDragging && (movedY > 8 || movedX > 8)) {
      clearTimeout(longPressTimer);
      return;
    }

    if (!isDragging) return;
    e.preventDefault();

    /* Move clone */
    if (touchClone) {
      touchClone.style.top  = `${touch.clientY - li.offsetHeight / 2}px`;
      touchClone.style.left = `${touch.clientX - li.offsetWidth  / 2}px`;
    }

    /* Highlight target */
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.task-item');
    if (target && target.dataset.id !== touchDragId) {
      target.classList.add('drag-over');
    }
  }, { passive: false });

  li.addEventListener('touchend', e => {
    clearTimeout(longPressTimer);
    if (!isDragging) return;

    const touch  = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.task-item');

    /* Cleanup */
    li.classList.remove('dragging');
    if (touchClone) { touchClone.remove(); touchClone = null; }
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));

    if (target && target.dataset.id && target.dataset.id !== touchDragId) {
      reorderTasks(touchDragId, target.dataset.id);
      render();
    }

    isDragging  = false;
    touchDragId = null;
  });

  li.addEventListener('touchcancel', () => {
    clearTimeout(longPressTimer);
    isDragging  = false;
    touchDragId = null;
    li.classList.remove('dragging');
    if (touchClone) { touchClone.remove(); touchClone = null; }
  });
}

/* =====================================================
   UI SETUP
   ===================================================== */

function setTodayDate() {
  const el = document.getElementById('today');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  el.setAttribute('datetime', new Date().toISOString().split('T')[0]);
}

function setupAddForm() {
  const addBtn   = document.getElementById('add-btn');
  const taskInput = document.getElementById('task-input');

  function submit() {
    const title    = taskInput.value;
    const category = document.getElementById('category-input').value;
    const dueDate  = document.getElementById('due-date-input').value;

    if (addTask(title, category, dueDate)) {
      taskInput.value = '';
      document.getElementById('category-input').value  = '';
      document.getElementById('due-date-input').value  = '';
      taskInput.focus();
      render();

      /* Brief pulse on the list to confirm */
      const list = document.getElementById('task-list');
      list.style.transition = 'none';
    }
  }

  addBtn.addEventListener('click', submit);
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
}

function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });
}

/* =====================================================
   BOOT
   ===================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  loadTasks();
  setupAddForm();
  setupFilters();
  render();
});
