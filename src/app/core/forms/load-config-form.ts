import { AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

import { BQ_TYPE_CODE } from '../api/mock/catalog';
import {
  ColumnMapping,
  ImportTemplate,
  ImportType,
  LoadConfig,
  LoadConfigWrite,
  LoadMode,
  PartnerType,
  TemplateColumn,
} from '../models/load-config.model';
import { isSingleCharacter } from '../utils/delimiter';

export interface MappingFormControls {
  uid: FormControl<string>;
  column: FormControl<string>;
  src: FormControl<string>;
  type: FormControl<number>;
  primaryKey: FormControl<boolean>;
  isPartitionKey: FormControl<boolean>;
  useInDeleteFilter: FormControl<boolean>;
  isRequiredPartitionFilter: FormControl<boolean>;
  required: FormControl<boolean>;
  formatHint: FormControl<string>;
}

export type MappingFormGroup = FormGroup<MappingFormControls>;

export interface LoadConfigFormControls {
  id: FormControl<string>;
  publisherName: FormControl<string>;
  mode: FormControl<LoadMode>;
  deactivated: FormControl<boolean>;
  incremental: FormControl<boolean>;
  partnerType: FormControl<PartnerType | ''>;
  importType: FormControl<ImportType | ''>;
  preprocess: FormControl<string>;
  ingest: FormControl<string>;
  projectId: FormControl<string>;
  datasetId: FormControl<string>;
  tableId: FormControl<string>;
  organizationId: FormControl<string>;
  organizationAccount: FormControl<string>;
  organizationType: FormControl<string>;
  notificationProjectId: FormControl<string>;
  notificationTopicId: FormControl<string>;
  fieldDelimiter: FormControl<string>;
  skipLeadingRows: FormControl<number | string>;
  nullMarker: FormControl<string>;
  quote: FormControl<string>;
  sourceFormat: FormControl<string>;
  mappings: FormArray<MappingFormGroup>;
}

export type LoadConfigForm = FormGroup<LoadConfigFormControls>;

export interface MappingDraft {
  column: string;
  src: string;
  type: number;
  primaryKey?: boolean;
  isPartitionKey?: boolean;
  useInDeleteFilter?: boolean;
  isRequiredPartitionFilter?: boolean;
  required?: boolean;
  formatHint?: string;
}

function requiredText(): ValidatorFn {
  return Validators.required;
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
    column: new FormControl(draft?.column ?? '', { nonNullable: true, validators: [Validators.required] }),
    src: new FormControl(draft?.src ?? '', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl(draft?.type ?? BQ_TYPE_CODE['STRING'], { nonNullable: true, validators: [Validators.required] }),
    primaryKey: new FormControl(Boolean(draft?.primaryKey), { nonNullable: true }),
    isPartitionKey: new FormControl(Boolean(draft?.isPartitionKey), { nonNullable: true }),
    useInDeleteFilter: new FormControl(Boolean(draft?.useInDeleteFilter), { nonNullable: true }),
    isRequiredPartitionFilter: new FormControl(Boolean(draft?.isRequiredPartitionFilter), {
      nonNullable: true,
    }),
    required: new FormControl(Boolean(draft?.required), { nonNullable: true }),
    formatHint: new FormControl(draft?.formatHint ?? '', { nonNullable: true }),
  });
}

export function createLoadConfigForm(config?: LoadConfig): LoadConfigForm {
  const form = new FormGroup<LoadConfigFormControls>({
    id: new FormControl(config?.id ?? '', { nonNullable: true, validators: [requiredText()] }),
    publisherName: new FormControl(config?.publisherName ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    mode: new FormControl(config?.mode ?? 'APPEND', { nonNullable: true, validators: [Validators.required] }),
    deactivated: new FormControl(config?.deactivated ?? false, { nonNullable: true }),
    incremental: new FormControl(config?.incremental ?? false, { nonNullable: true }),
    partnerType: new FormControl(config?.partnerType ?? '', { nonNullable: true }),
    importType: new FormControl(config?.importType ?? '', { nonNullable: true }),
    preprocess: new FormControl(config?.patterns.preprocess ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    ingest: new FormControl(config?.patterns.ingest ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    projectId: new FormControl(config?.destination.projectId ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    datasetId: new FormControl(config?.destination.datasetId ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    tableId: new FormControl(config?.destination.tableId ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    organizationId: new FormControl(config?.organization.id ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    organizationAccount: new FormControl(config?.organization.account ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    organizationType: new FormControl(config?.organization.type ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    notificationProjectId: new FormControl(config?.notification.projectId ?? '', {
      nonNullable: true,
      validators: [requiredText()],
    }),
    notificationTopicId: new FormControl(config?.notification.topicId ?? '', {
      nonNullable: true,
      validators: [requiredText()],
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
    quote: new FormControl(config?.bqParams.quote ?? '"', { nonNullable: true, validators: [quoteChar] }),
    sourceFormat: new FormControl(config?.bqParams.sourceFormat ?? 'CSV', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    mappings: new FormArray<MappingFormGroup>([]),
  });
  return form;
}

export function draftFromColumn(column: TemplateColumn, src?: string): MappingDraft {
  const defaultSrc = column.formatHint === 'Default FR' ? "'FR'" : column.name;
  return {
    column: column.name,
    src: src ?? defaultSrc,
    type: BQ_TYPE_CODE[column.bqType] ?? BQ_TYPE_CODE['STRING'],
    required: column.required,
    formatHint: column.formatHint ?? '',
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
      isPartitionKey: mapping.isPartitionKey,
      useInDeleteFilter: mapping.useInDeleteFilter,
      isRequiredPartitionFilter: mapping.isRequiredPartitionFilter,
      required: column?.required ?? false,
      formatHint: column?.formatHint ?? '',
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
    partnerType: template.partnerType,
    importType: template.importType,
    mode: defaults.mode,
    incremental: defaults.mode === 'INCREMENTAL',
    deactivated: false,
    preprocess: defaults.patterns.preprocess,
    ingest: defaults.patterns.ingest,
    projectId: defaults.destination.projectId,
    datasetId: defaults.destination.datasetId,
    tableId: defaults.destination.tableId,
    organizationType: defaults.organization.type,
    notificationProjectId: defaults.notification.projectId,
    notificationTopicId: defaults.notification.topicId,
    fieldDelimiter: defaults.bqParams.fieldDelimiter,
    skipLeadingRows: defaults.bqParams.skipLeadingRows,
    nullMarker: defaults.bqParams.nullMarker,
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

export function toWriteModel(form: LoadConfigForm): LoadConfigWrite {
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
      primaryKey: row.primaryKey || undefined,
      isPartitionKey: row.isPartitionKey || undefined,
      useInDeleteFilter: row.useInDeleteFilter || undefined,
      isRequiredPartitionFilter: row.isRequiredPartitionFilter || undefined,
    };
  }
  return {
    id: value.id.trim(),
    publisherName: value.publisherName.trim(),
    mode: value.mode,
    deactivated: value.deactivated,
    incremental: value.incremental,
    patterns: { preprocess: value.preprocess.trim(), ingest: value.ingest.trim() },
    destination: {
      projectId: value.projectId.trim(),
      datasetId: value.datasetId.trim(),
      tableId: value.tableId.trim(),
    },
    organization: {
      id: value.organizationId.trim(),
      account: value.organizationAccount.trim(),
      type: value.organizationType.trim(),
    },
    notification: {
      projectId: value.notificationProjectId.trim(),
      topicId: value.notificationTopicId.trim(),
    },
    bqParams: {
      fieldDelimiter: value.fieldDelimiter,
      skipLeadingRows: Number(value.skipLeadingRows),
      nullMarker: value.nullMarker,
      quote: value.quote,
      sourceFormat: value.sourceFormat,
    },
    mappings,
  };
}

export function toWriteModelFromConfig(config: LoadConfig): LoadConfigWrite {
  return {
    id: config.id,
    publisherName: config.publisherName,
    mode: config.mode,
    deactivated: config.deactivated,
    incremental: config.incremental,
    patterns: structuredClone(config.patterns),
    destination: structuredClone(config.destination),
    organization: structuredClone(config.organization),
    notification: structuredClone(config.notification),
    bqParams: structuredClone(config.bqParams),
    mappings: structuredClone(config.mappings),
  };
}

export function suggestConfigId(publisherName: string, account: string, importType: string): string {
  const slug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  return `${slug(publisherName) || 'publisher'}:${slug(account) || 'account'}:${importType || 'import'}`;
}
