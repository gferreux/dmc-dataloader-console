import { Component, inject, input, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { toApiException } from '../../core/api/api-error';
import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import { TestPatternResult } from '../../core/models/load-config.model';

@Component({
  selector: 'dmc-pattern-tester',
  imports: [FormsModule, MatButton, MatFormField, MatLabel, MatInput],
  templateUrl: './pattern-tester.html',
  styleUrl: './pattern-tester.scss',
})
export class PatternTester {
  private readonly api = inject(LOAD_CONFIG_API);
  readonly ingest = input.required<FormControl<string>>();
  readonly preprocess = input.required<FormControl<string>>();

  pattern = '';
  path = 'demo-bucket/publisher/optin/sample.csv';
  readonly result = signal<TestPatternResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly running = signal(false);

  use(kind: 'ingest' | 'preprocess'): void {
    this.pattern = kind === 'ingest' ? this.ingest().value : this.preprocess().value;
  }

  run(): void {
    this.running.set(true);
    this.error.set(null);
    this.api.testPattern({ pattern: this.pattern, path: this.path }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.running.set(false);
      },
      error: (error) => {
        this.result.set(null);
        this.error.set(toApiException(error).message);
        this.running.set(false);
      },
    });
  }
}
