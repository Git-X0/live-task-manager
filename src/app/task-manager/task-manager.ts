import {
  Component,
  OnInit,
  computed,
  effect,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Task {
  id: string;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-manager.html',
  styleUrl: './task-manager.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block min-h-screen bg-gradient-to-br from-[#6e8efb] to-[#a777e3] p-5 font-[Poppins]',
  },
})
export class TaskManagerComponent implements OnInit {
  // Dependency injection
  private readonly platformId = inject(PLATFORM_ID);

  // State signals
  readonly tasks = signal<Task[]>([]);
  readonly filter = signal<'all' | 'active' | 'completed'>('all');
  readonly editingId = signal<string | null>(null);
  readonly editingText = signal('');

  // Form controls
  readonly newTaskControl = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });

  // Template references
  readonly newTaskInput = viewChild<ElementRef>('newTaskInput');
  readonly editInput = viewChild<ElementRef>('editInput');

  // Computed values
  readonly remainingCount = computed(
    () => this.tasks().filter((task) => !task.completed).length
  );

  readonly progress = computed(() => {
    const total = this.tasks().length;
    return total > 0
      ? Math.round(((total - this.remainingCount()) / total) * 100)
      : 0;
  });

  readonly filteredTasks = computed(() => {
    const filter = this.filter();
    return this.tasks().filter(
      (task) =>
        filter === 'all' ||
        (filter === 'completed' && task.completed) ||
        (filter === 'active' && !task.completed)
    );
  });

  constructor() {
    // Auto-save to localStorage
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        localStorage.setItem('tasks', JSON.stringify(this.tasks()));
      });
    }

    // Clear completed tasks handler
    this.newTaskControl.valueChanges.pipe(takeUntilDestroyed()).subscribe();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) this.tasks.set(JSON.parse(savedTasks));
    }
  }

  getTaskClasses(task: Task) {
    return {
      completed: task.completed,
    };
  }

  addTask(): void {
    const taskText = this.newTaskControl.value.trim();
    if (!taskText || this.newTaskControl.invalid) return;

    this.tasks.update((tasks) => [
      ...tasks,
      {
        id: Date.now().toString(),
        text: taskText,
        completed: false,
      },
    ]);

    this.newTaskControl.reset();
    setTimeout(() => this.newTaskInput()?.nativeElement.focus(), 0);
  }

  toggleTask(id: string): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

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

  startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingText.set(task.text);
    setTimeout(() => this.editInput()?.nativeElement.focus(), 0);
  }

  saveEdit(id: string): void {
    const newText = this.editingText().trim();
    if (!newText) {
      this.removeTask(id);
    } else {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
    }
    this.editingId.set(null);
  }

  clearCompleted(): void {
    this.tasks.update((tasks) => tasks.filter((task) => !task.completed));
  }
}
