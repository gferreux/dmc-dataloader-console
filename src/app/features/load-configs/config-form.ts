import { Component, computed, effect, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect, MatSelectChange } from '@angular/material/select';

import { LoadConfigForm, organizationTypeOptions, suggestConfigId } from '../../core/forms/load-config-form';
import { Meta } from '../../core/models/load-config.model';
import { CUSTOM_DELIMITER, DELIMITER_PRESETS, TAB_DELIMITER, delimiterPreset } from '../../core/utils/delimiter';
import { MappingEditor } from './mapping-editor';
import { PatternTester } from './pattern-tester';

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
    MatButton,
    MappingEditor,
    PatternTester,
  ],
  templateUrl: './config-form.html',
  styleUrl: './config-form.scss',
})
export class ConfigForm {
  readonly form = input.required<LoadConfigForm>();
  readonly meta = input.required<Meta>();
  readonly lockId = input(false);
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
      const id = form.controls.id;
      if (this.lockId()) {
        id.disable({ emitEvent: false });
      } else {
        id.enable({ emitEvent: false });
      }
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

  organizationTypes(): string[] {
    return organizationTypeOptions(this.form().controls.organizationType.value);
  }

  legacyOrganizationType(): boolean {
    const value = this.form().controls.organizationType.value;
    return Boolean(value) && value !== 'advertiser' && value !== 'publisher';
  }

  suggestId(): void {
    const form = this.form();
    form.controls.id.setValue(
      suggestConfigId(
        form.controls.publisherName.value,
        form.controls.organizationAccount.value,
        form.controls.importType.value,
      ),
    );
    form.controls.id.markAsDirty();
  }
}
