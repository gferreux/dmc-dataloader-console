import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import {
  ColumnMapping,
  ImportTemplate,
  LoadConfig,
  LoadConfigLegacyWrite,
  LoadConfigWrite,
  LoadMode,
  MAPPING_TYPE_RENAME,
  PartnerType,
  ImportType,
  TemplateColumn,
} from '../models/load-config.model';
import { isSingleCharacter } from '../utils/delimiter';

export interface MappingFormControls {
  uid: FormControl<string>;
  column: FormControl<string>;
  src: FormControl<string>;
  type: FormControl<number>;
  primaryKey: FormControl<boolean>;
  useInDeleteFilter: FormControl<boolean>;
  isRequiredPartitionFilter: FormControl<boolean>;
  required: FormControl<boolean>;
  formatHint: FormControl<string>;
  bqType: FormControl<string>;
}

export type MappingFormGroup = FormGroup<MappingFormControls>;

export interface LoadConfigFormControls {
  mode: FormControl<LoadMode>;
  fieldDelimiter: FormControl<string>;
  skipLeadingRows: FormControl<number | string>;
  nullMarker: FormControl<string>;
  quote: FormControl<string>;
  sourceFormat: FormControl<number>;
  mappings: FormArray<MappingFormGroup>;
}

export type LoadConfigForm = FormGroup<LoadConfigFormControls>;

export interface IdentityInput {
  kind: PartnerType;
  organizationName: string;
  nestedName: string;
  fileType: ImportType;
}

export interface MappingDraft {
  column: string;
  src: string;
  type: number;
  primaryKey?: boolean;
  useInDeleteFilter?: boolean;
  isRequiredPartitionFilter?: boolean;
  required?: boolean;
  formatHint?: string;
  bqType?: string;
}

function singleCharacter(control: AbstractControl): ValidationErrors | null {
  return isSingleCharacter(String(control.value ?? '')) ? null : { singleCharacter: true };
}

function nonNegativeInt(control: AbstractControl): ValidationErrors | null {
  const value = Number(control.value);
  return Number.isInteger(value) && value >= 0 ? null : { nonNegativeInt: true };
}

function quoteChar(control: AbstractControl): ValidationErrors | null {
  return Array.from(String(control.value ?? '')).length <= 1 ? null : { quoteChar: true };
}

export function createMappingGroup(draft?: Partial<MappingDraft>): MappingFormGroup {
  return new FormGroup<MappingFormControls>({
    uid: new FormControl(crypto.randomUUID(), { nonNullable: true }),
    column: new FormControl(draft?.column ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    src: new FormControl(draft?.src ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    type: new FormControl(draft?.type ?? MAPPING_TYPE_RENAME, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    primaryKey: new FormControl(Boolean(draft?.primaryKey), { nonNullable: true }),
    useInDeleteFilter: new FormControl(Boolean(draft?.useInDeleteFilter), { nonNullable: true }),
    isRequiredPartitionFilter: new FormControl(Boolean(draft?.isRequiredPartitionFilter), {
      nonNullable: true,
    }),
    required: new FormControl(Boolean(draft?.required), { nonNullable: true }),
    formatHint: new FormControl(draft?.formatHint ?? '', { nonNullable: true }),
    bqType: new FormControl(draft?.bqType ?? '', { nonNullable: true }),
  });
}

export function createLoadConfigForm(config?: LoadConfig): LoadConfigForm {
  return new FormGroup<LoadConfigFormControls>({
    mode: new FormControl(config?.mode ?? 'APPEND', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fieldDelimiter: new FormControl(config?.bqParams.fieldDelimiter ?? ',', {
      nonNullable: true,
      validators: [singleCharacter],
    }),
    skipLeadingRows: new FormControl<number | string>(config?.bqParams.skipLeadingRows ?? 1, {
      nonNullable: true,
      validators: [nonNegativeInt],
    }),
    nullMarker: new FormControl(config?.bqParams.nullMarker ?? '', { nonNullable: true }),
    quote: new FormControl(config?.bqParams.quote ?? '"', {
      nonNullable: true,
      validators: [quoteChar],
    }),
    sourceFormat: new FormControl(config?.bqParams.sourceFormat ?? 0, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    mappings: new FormArray<MappingFormGroup>([]),
  });
}

export function draftFromColumn(column: TemplateColumn, src?: string): MappingDraft {
  return {
    column: column.name,
    src: src ?? column.name,
    type: MAPPING_TYPE_RENAME,
    required: column.required,
    formatHint: column.formatHint ?? '',
    bqType: column.bqType,
  };
}

export function draftsFromTemplate(template: ImportTemplate): MappingDraft[] {
  return template.columns.map((column) => draftFromColumn(column));
}

export function draftsFromConfig(config: LoadConfig, template?: ImportTemplate): MappingDraft[] {
  const columns = new Map((template?.columns ?? []).map((column) => [column.name, column]));
  const drafts: MappingDraft[] = Object.entries(config.mappings).map(([name, mapping]) => {
    const column = columns.get(name);
    return {
      column: name,
      src: mapping.src,
      type: mapping.type,
      primaryKey: mapping.primaryKey,
      useInDeleteFilter: mapping.useInDeleteFilter,
      isRequiredPartitionFilter: mapping.isRequiredPartitionFilter,
      required: column?.required ?? false,
      formatHint: column?.formatHint ?? '',
      bqType: column?.bqType ?? '',
    };
  });
  for (const column of template?.columns ?? []) {
    if (column.required && !config.mappings[column.name]) {
      drafts.push(draftFromColumn(column, ''));
    }
  }
  return drafts;
}

export function setMappings(form: LoadConfigForm, drafts: readonly MappingDraft[]): void {
  const array = form.controls.mappings;
  array.clear();
  for (const draft of drafts) {
    array.push(createMappingGroup(draft));
  }
}

export function applyTemplate(form: LoadConfigForm, template: ImportTemplate): void {
  const defaults = template.defaults;
  form.patchValue({
    mode: defaults.mode,
    fieldDelimiter: defaults.bqParams.fieldDelimiter,
    skipLeadingRows: defaults.bqParams.skipLeadingRows,
    nullMarker: defaults.bqParams.nullMarker ?? '',
    quote: defaults.bqParams.quote,
    sourceFormat: defaults.bqParams.sourceFormat,
  });
  setMappings(form, draftsFromTemplate(template));
}

export function duplicateColumns(form: LoadConfigForm): string[] {
  const names = form.controls.mappings.controls
    .map((group) => group.controls.column.value.trim())
    .filter(Boolean);
  return [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readPayload(
  form: LoadConfigForm,
): Pick<LoadConfigWrite, 'mode' | 'bqParams' | 'mappings'> {
  const value = form.getRawValue();
  const mappings: Record<string, ColumnMapping> = {};
  for (const row of value.mappings) {
    const column = row.column.trim();
    if (!column || mappings[column]) {
      continue;
    }
    mappings[column] = {
      src: row.src,
      type: Number(row.type),
      primaryKey: row.primaryKey,
      useInDeleteFilter: row.useInDeleteFilter,
      isRequiredPartitionFilter: row.isRequiredPartitionFilter,
    };
  }
  return {
    mode: value.mode,
    bqParams: {
      fieldDelimiter: value.fieldDelimiter,
      skipLeadingRows: Number(value.skipLeadingRows),
      nullMarker: nullableText(value.nullMarker),
      quote: value.quote,
      sourceFormat: Number(value.sourceFormat),
    },
    mappings,
  };
}

export function toWriteModel(form: LoadConfigForm, identity: IdentityInput): LoadConfigWrite {
  return {
    kind: identity.kind,
    organizationName: identity.organizationName.trim(),
    nestedName: identity.nestedName.trim(),
    fileType: identity.fileType,
    ...readPayload(form),
  };
}

export function toLegacyWrite(form: LoadConfigForm): LoadConfigLegacyWrite {
  return readPayload(form);
}
