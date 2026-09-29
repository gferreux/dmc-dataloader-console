import { Component, computed, effect, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect, MatSelectChange } from '@angular/material/select';

import { LoadConfigForm } from '../../core/forms/load-config-form';
import { Meta } from '../../core/models/load-config.model';
import {
  CUSTOM_DELIMITER,
  DELIMITER_PRESETS,
  TAB_DELIMITER,
  delimiterPreset,
} from '../../core/utils/delimiter';
import { MappingEditor } from './mapping-editor';

@Component({
  selector: 'dmc-config-form',
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MappingEditor,
  ],
  templateUrl: './config-form.html',
  styleUrl: './config-form.scss',
})
export class ConfigForm {
  readonly form = input.required<LoadConfigForm>();
  readonly meta = input.required<Meta>();
  readonly createTime = input<string | null>(null);
  readonly updateTime = input<string | null>(null);

  readonly presets = DELIMITER_PRESETS;
  readonly tabDelimiter = TAB_DELIMITER;
  readonly customDelimiter = CUSTOM_DELIMITER;
  readonly delimiterValue = signal(',');
  readonly preset = computed(() => delimiterPreset(this.delimiterValue()));

  constructor() {
    effect((onCleanup) => {
      const form = this.form();
      this.delimiterValue.set(form.controls.fieldDelimiter.value);
      const subscription = form.controls.fieldDelimiter.valueChanges.subscribe((value) => {
        this.delimiterValue.set(value);
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  chooseDelimiter(event: MatSelectChange): void {
    const value = String(event.value);
    if (value === CUSTOM_DELIMITER) {
      if (delimiterPreset(this.delimiterValue()) !== CUSTOM_DELIMITER) {
        this.form().controls.fieldDelimiter.setValue('');
      }
      return;
    }
    this.form().controls.fieldDelimiter.setValue(value);
  }

  setCustomDelimiter(value: string): void {
    this.form().controls.fieldDelimiter.setValue(value);
  }
}
