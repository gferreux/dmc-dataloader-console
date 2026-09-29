import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class Notify {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.snackBar.open(message, undefined, { duration: 3500, panelClass: 'dmc-snackbar' });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 7000, panelClass: 'dmc-snackbar' });
  }
}
