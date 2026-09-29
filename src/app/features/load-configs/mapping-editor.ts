import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, effect, input, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';

import { createMappingGroup, MappingFormGroup } from '../../core/forms/load-config-form';
import { MappingTypeOption } from '../../core/models/load-config.model';
import { BQ_TYPE_CODE } from '../../core/api/mock/catalog';
import { HeaderSuggestion, suggestHeaderMatches } from '../../core/utils/header-match';

@Component({
  selector: 'dmc-mapping-editor',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatInput,
    MatCheckbox,
    MatTooltip,
  ],
  templateUrl: './mapping-editor.html',
  styleUrl: './mapping-editor.scss',
})
export class MappingEditor {
  readonly mappings = input.required<import('../../core/forms/load-config-form').LoadConfigForm['controls']['mappings']>();
  readonly mappingTypes = input.required<MappingTypeOption[]>();
  readonly fieldDelimiter = input(',');

  readonly rows = signal<MappingFormGroup[]>([]);
  readonly headerLine = signal('');
  readonly suggestions = signal<HeaderSuggestion[]>([]);

  constructor() {
    effect((onCleanup) => {
      const array = this.mappings();
      const sync = () => this.rows.set([...array.controls]);
      sync();
      const subscription = array.valueChanges.subscribe(sync);
      onCleanup(() => subscription.unsubscribe());
    });
  }

  addRow(): void {
    this.mappings().push(createMappingGroup({ type: BQ_TYPE_CODE['STRING'] }));
  }

  remove(index: number): void {
    this.mappings().removeAt(index);
  }

  move(index: number, delta: number): void {
    const next = index + delta;
    const array = this.mappings();
    if (next < 0 || next >= array.length) {
      return;
    }
    const control = array.at(index);
    array.removeAt(index);
    array.insert(next, control);
  }

  drop(event: CdkDragDrop<MappingFormGroup[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const array = this.mappings();
    const control = array.at(event.previousIndex);
    array.removeAt(event.previousIndex);
    array.insert(event.currentIndex, control);
  }

  onHeaderInput(value: string): void {
    this.headerLine.set(value);
    this.suggestions.set(
      suggestHeaderMatches(
        this.mappings().controls.map((group) => ({
          column: group.controls.column.value,
          src: group.controls.src.value,
        })),
        value,
        this.fieldDelimiter(),
      ),
    );
  }

  applySuggestions(): void {
    const suggestions = this.suggestions();
    for (const group of this.mappings().controls) {
      const match = suggestions.find((item) => item.column === group.controls.column.value);
      if (match) {
        group.controls.src.setValue(match.src);
        group.controls.src.markAsDirty();
      }
    }
    this.headerLine.set('');
    this.suggestions.set([]);
  }

  duplicateNames(): string[] {
    const names = this.rows()
      .map((row) => row.controls.column.value.trim())
      .filter(Boolean);
    return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  }
}
