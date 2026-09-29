import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';

export interface DeleteDialogData {
  id: string;
  publisherName: string;
  deactivated: boolean;
}

export type DeleteDialogResult = 'delete' | 'deactivate' | undefined;

@Component({
  selector: 'dmc-delete-config-dialog',
  imports: [MatDialogModule, MatButton, MatIcon],
  templateUrl: './delete-config-dialog.html',
  styleUrl: './delete-config-dialog.scss',
})
export class DeleteConfigDialog {
  readonly data = inject<DeleteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DeleteConfigDialog, DeleteDialogResult>);

  close(result?: DeleteDialogResult): void {
    this.dialogRef.close(result);
  }
}
