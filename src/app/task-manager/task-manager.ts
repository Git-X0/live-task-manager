import {
  Component,
  signal,
  computed,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Definice rozhraní pro úkol
interface Task {
  id: number;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: `./task-manager.html`,
  styles: [
    `
      .completed {
        text-decoration: line-through;
        color: #777;
      }
      ul {
        list-style-type: none;
        padding: 0;
      }
      li {
        display: flex;
        align-items: center;
        margin: 8px 0;
      }
      button {
        margin-left: 10px;
        cursor: pointer;
      }
      .filters button {
        margin-right: 5px;
      }
      input[type='text'] {
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-right: 5px;
      }
    `,
  ],
})
export class TaskManager {
  // Signály pro správu stavu
  tasks = signal<Task[]>([
    { id: 1, text: 'Naučit se Angular', completed: false },
    { id: 2, text: 'Udělat kvíz', completed: true },
  ]);

  filter = signal<'all' | 'active' | 'completed'>('all');
  newTask = '';
  editingId = signal<number | null>(null);
  editingText = '';

  // Reference na inputy
  newTaskInput = viewChild<ElementRef>('newTaskInput');
  editInput = viewChild<ElementRef>('editInput');

  // Počet nekompletních úkolů
  remainingCount = computed(
    () => this.tasks().filter((task) => !task.completed).length
  );

  // Filtrované úkoly
  filteredTasks = computed<Task[]>(() => {
    const filter = this.filter();
    return this.tasks().filter(
      (task) =>
        filter === 'all' ||
        (filter === 'completed' && task.completed) ||
        (filter === 'active' && !task.completed)
    );
  });

  // Přidání nového úkolu
  addTask(): void {
    const taskText = this.newTask.trim();
    if (taskText) {
      this.tasks.update((tasks) => [
        ...tasks,
        { id: Date.now(), text: taskText, completed: false },
      ]);
      this.newTask = '';
      // Focus na input po přidání
      setTimeout(() => {
        const input = this.newTaskInput();
        if (input) input.nativeElement.focus();
      }, 0);
    }
  }

  // Přepnutí stavu úkolu
  toggleTask(id: number): void {
    this.tasks.update((tasks) =>
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  // Odstranění úkolu
  removeTask(id: number): void {
    this.tasks.update((tasks) => tasks.filter((task) => task.id !== id));
  }

  // Spuštění editace
  startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editingText = task.text;
    // Focus na edit input
    setTimeout(() => {
      const input = this.editInput();
      if (input) input.nativeElement.focus();
    }, 0);
  }

  // Uložení editace
  saveEdit(id: number): void {
    const newText = this.editingText.trim();
    if (newText) {
      this.tasks.update((tasks) =>
        tasks.map((task) =>
          task.id === id ? { ...task, text: newText } : task
        )
      );
    } else {
      // Pokud je text prázdný, smaž úkol
      this.removeTask(id);
    }
    this.editingId.set(null);
  }

  // Smazání všech splněných úkolů
  clearCompleted(): void {
    this.tasks.update((tasks) => tasks.filter((task) => !task.completed));
  }
}
