import { Component, effect, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger, MatOption } from '@angular/material/autocomplete';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { NamedRef } from '../../core/models/load-config.model';

@Component({
  selector: 'dmc-name-field',
  imports: [
    ReactiveFormsModule,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
  ],
  templateUrl: './name-field.html',
  styleUrl: './name-field.scss',
})
export class NameField {
  readonly label = input.required<string>();
  readonly value = input('');
  readonly options = input<readonly NamedRef[]>([]);
  readonly error = input<string | null>(null);
  readonly hint = input('');
  readonly testId = input('');

  readonly valueChange = output<string>();
  readonly control = new FormControl('', { nonNullable: true });
  readonly query = signal('');

  constructor() {
    effect(() => {
      const next = this.value();
      const error = this.error();
      if (next !== this.control.value) {
        this.control.setValue(next, { emitEvent: false });
        this.query.set(next);
      }
      // setValue drops errors that were applied with setErrors, so reapply after it.
      this.applyServerError(error);
      queueMicrotask(() => this.applyServerError(this.error()));
    });

    this.control.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.query.set(value);
      const error = this.error();
      if (error) {
        this.control.setErrors({ server: error });
      }
      if (value !== this.value()) {
        this.valueChange.emit(value);
      }
    });
  }

  private applyServerError(error: string | null): void {
    if (error) {
      this.control.setErrors({ server: error });
      this.control.markAsTouched();
      return;
    }
    if (this.control.hasError('server')) {
      this.control.setErrors(null);
    }
  }

  filtered(): NamedRef[] {
    const term = this.query().trim().toLowerCase();
    const options = this.options();
    if (!term) {
      return [...options];
    }
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(term) || option.slug.toLowerCase().includes(term),
    );
  }
}
