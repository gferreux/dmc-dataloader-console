import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { ValidationResult } from '../core/models/load-config.model';

@Component({
  selector: 'dmc-validation-panel',
  imports: [MatButton],
  templateUrl: './validation-panel.html',
  styleUrl: './validation-panel.scss',
})
export class ValidationPanel {
  readonly result = input<ValidationResult | null>(null);
  readonly allowSaveAnyway = input(false);
  readonly saveAnyway = output<void>();
}
