import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaskManager } from './task-manager/task-manager';
import { PromoAngular } from './promo-angular/promo-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TaskManager, PromoAngular, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  condition = false;
  changeCondition(event: MouseEvent) {
    if (this.condition === true) {
      this.condition = false;
    } else {
      this.condition = true;
    }
  }
  protected title = 'live-task-manager';
  protected description =
    'A simple task manager application built with Angular.';
  protected author = 'Your Name';
  protected year = new Date().getFullYear();
}
