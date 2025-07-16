import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  effect,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-task-manager',
  // standalone: true, // Removed per best practices
  imports: [CommonModule, DragDropModule],
  templateUrl: './task-manager.html',
  styleUrls: ['./task-manager.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'task-manager-root',
  },
})
export class TaskManager {
  // Signals for state management
  tasks = signal<Task[]>([]);
  filter = signal<'all' | 'active' | 'completed'>('all');
  newTask = signal('');
  editingId = signal<string | null>(null);
  editingText = signal('');

  // References to inputs
  newTaskInput = viewChild<ElementRef>('newTaskInput');
  editInput = viewChild<ElementRef>('editInput');

  // Derived state
  remainingCount = computed(
    () => this.tasks().filter((task) => !task.completed).length
  );
  filteredTasks = computed<Task[]>(() => {
    const filter = this.filter();
    return this.tasks().filter(
      (task) =>
        filter === 'all' ||
        (filter === 'completed' && task.completed) ||
        (filter === 'active' && !task.completed)
    );
  });
  progress = computed(() => {
    const total = this.tasks().length;
    const completed = total - this.remainingCount();
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  });

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Effect for saving to localStorage (browser only)
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        localStorage.setItem('tasks', JSON.stringify(this.tasks()));
      });
    }
    // Load tasks from localStorage (browser only)
    if (isPlatformBrowser(this.platformId)) {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) this.tasks.set(JSON.parse(savedTasks));
    }
  }

  // Add new task
  addTask(): void {
    const taskText = this.newTask().trim();
    if (taskText) {
      this.tasks.update((tasks) => [
        ...tasks,
        {
          id: Date.now().toString(),
          text: taskText,
          completed: false,
        },
      ]);
      this.newTask.set('');
      setTimeout(() => {
        const input = this.newTaskInput();
        if (input) input.nativeElement.focus();
      }, 0);
    }
  }

  // Toggle task completion
  toggleTask(id: string): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  // Remove task with animation
  removeTask(id: string): void {
    const taskElement = document.querySelector(`[data-task-id="${id}"]`);
    if (taskElement) {
      taskElement.classList.add('deleting');
      setTimeout(() => {
        this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
      }, 500);
    } else {
      this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
    }
  }

  // Start editing
  startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingText.set(task.text);
    setTimeout(() => {
      const input = this.editInput();
      if (input) input.nativeElement.focus();
    }, 0);
  }

  // Save edit
  saveEdit(id: string): void {
    const newText = this.editingText().trim();
    if (newText) {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
    }
    this.editingId.set(null);
  }

  // Clear all completed tasks
  clearCompleted(): void {
    const completedTasks = this.tasks().filter((task) => task.completed);
    completedTasks.forEach((task) => this.removeTask(task.id));
  }

  drop(event: CdkDragDrop<Task[]>) {
    const current = this.filteredTasks();
    moveItemInArray(current, event.previousIndex, event.currentIndex);
    // Změna pořadí v původním poli podle filtrovaného pořadí
    const ids = current.map((t) => t.id);
    this.tasks.update((tasks) => {
      // zachováme úkoly, které nejsou ve filtru, a přidáme filtrované v novém pořadí
      const filtered = tasks.filter((t) => ids.includes(t.id));
      const rest = tasks.filter((t) => !ids.includes(t.id));
      return [...current, ...rest];
    });
  }
}
