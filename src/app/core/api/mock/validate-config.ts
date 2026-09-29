import {
  FieldMessage,
  ImportTemplate,
  LoadConfig,
  LoadConfigWrite,
  Meta,
  ValidationResult,
} from '../../models/load-config.model';
import { inferImportType, inferPartnerType } from '../../utils/derive';
import { isSingleCharacter } from '../../utils/delimiter';
import { findTemplate } from './catalog';

export function validateConfig(
  config: LoadConfigWrite,
  others: readonly LoadConfig[],
  meta: Meta,
  templates: readonly ImportTemplate[],
): ValidationResult {
  const errors: FieldMessage[] = [];
  const warnings: FieldMessage[] = [];

  requireText(errors, 'id', config.id, 'Id is required.');
  requireText(errors, 'publisherName', config.publisherName, 'Publisher name is required.');
  if (config.id && !/^\S+$/.test(config.id)) {
    errors.push({ field: 'id', message: 'Id cannot contain whitespace.' });
  } else if (config.id && config.id.split(':').length !== 3) {
    warnings.push({
      field: 'id',
      message: 'Id does not look like publisher:account:import (three colon-separated parts).',
    });
  }

  if (!meta.modes.includes(config.mode)) {
    errors.push({ field: 'mode', message: 'Mode must be APPEND, INCREMENTAL or OVERWRITE.' });
  }
  if (config.mode === 'INCREMENTAL' && !config.incremental) {
    warnings.push({
      field: 'incremental',
      message: 'Mode is INCREMENTAL but the incremental flag is off.',
    });
  }
  if (config.mode !== 'INCREMENTAL' && config.incremental) {
    warnings.push({
      field: 'incremental',
      message: 'The incremental flag is on while mode is not INCREMENTAL.',
    });
  }

  checkPattern(errors, warnings, 'patterns.preprocess', config.patterns?.preprocess);
  checkPattern(errors, warnings, 'patterns.ingest', config.patterns?.ingest);

  requireText(errors, 'destination.projectId', config.destination?.projectId, 'Project id is required.');
  requireText(errors, 'destination.datasetId', config.destination?.datasetId, 'Dataset id is required.');
  requireText(errors, 'destination.tableId', config.destination?.tableId, 'Table id is required.');
  requireText(errors, 'organization.id', config.organization?.id, 'Organization id is required.');
  requireText(errors, 'organization.account', config.organization?.account, 'Organization account is required.');
  requireText(errors, 'organization.type', config.organization?.type, 'Organization type is required.');
  requireText(errors, 'notification.projectId', config.notification?.projectId, 'Notification project is required.');
  requireText(errors, 'notification.topicId', config.notification?.topicId, 'Notification topic is required.');

  const delimiter = config.bqParams?.fieldDelimiter ?? '';
  if (!isSingleCharacter(delimiter)) {
    errors.push({
      field: 'bqParams.fieldDelimiter',
      message: 'Field delimiter must be a single character. Choose Tab for a real tab, not the text \\t.',
    });
  }
  const skipLeadingRows = config.bqParams?.skipLeadingRows;
  if (!Number.isInteger(skipLeadingRows) || (skipLeadingRows ?? -1) < 0) {
    errors.push({
      field: 'bqParams.skipLeadingRows',
      message: 'Skip leading rows must be a non-negative integer.',
    });
  }
  if (Array.from(config.bqParams?.quote ?? '').length > 1) {
    errors.push({ field: 'bqParams.quote', message: 'Quote must be empty or a single character.' });
  }
  if (!meta.sourceFormats.includes(config.bqParams?.sourceFormat)) {
    errors.push({ field: 'bqParams.sourceFormat', message: 'Source format is not supported.' });
  }

  const entries = Object.entries(config.mappings ?? {});
  if (!entries.length) {
    errors.push({ field: 'mappings', message: 'At least one column mapping is required.' });
  }
  const allowedTypes = new Set(meta.mappingTypes.map((type) => type.value));
  for (const [column, mapping] of entries) {
    if (!column.trim()) {
      errors.push({ field: 'mappings', message: 'A mapping is missing its target column name.' });
    }
    if (!mapping?.src?.trim()) {
      errors.push({ field: `mappings.${column}.src`, message: `Source for ${column} is required.` });
    }
    if (!allowedTypes.has(mapping?.type)) {
      errors.push({
        field: `mappings.${column}.type`,
        message: `Type for ${column} is not a known mapping type.`,
      });
    }
  }

  const partnerType = inferPartnerType(config);
  const importType = inferImportType(config);
  const template = findTemplate(templates, partnerType, importType);
  if (template) {
    for (const column of template.columns) {
      if (!column.required) {
        continue;
      }
      const mapping = config.mappings?.[column.name];
      if (!mapping?.src?.trim()) {
        errors.push({
          field: `mappings.${column.name}.src`,
          message: `Required column ${column.name} is missing a source.`,
        });
      }
    }
  }

  if (!config.deactivated && config.patterns?.ingest) {
    for (const other of others) {
      if (other.deactivated || other.id === config.id) {
        continue;
      }
      if (other.patterns.ingest === config.patterns.ingest) {
        warnings.push({
          field: 'patterns.ingest',
          message: `Ingest pattern is the same as active config ${other.id}. The loader uses the first match.`,
        });
      }
      const sameTable =
        other.destination.projectId === config.destination?.projectId &&
        other.destination.datasetId === config.destination?.datasetId &&
        other.destination.tableId === config.destination?.tableId;
      if (sameTable) {
        warnings.push({
          field: 'destination.tableId',
          message: `Active config ${other.id} already writes to this table.`,
        });
      }
    }
  }

  return { errors, warnings };
}

function requireText(
  errors: FieldMessage[],
  field: string,
  value: string | undefined,
  message: string,
): void {
  if (!value?.trim()) {
    errors.push({ field, message });
  }
}

function checkPattern(
  errors: FieldMessage[],
  warnings: FieldMessage[],
  field: string,
  pattern: string | undefined,
): void {
  if (!pattern?.trim()) {
    errors.push({ field, message: 'Pattern is required.' });
    return;
  }
  try {
    new RegExp(pattern);
  } catch {
    errors.push({ field, message: 'Pattern is not a valid regular expression.' });
    return;
  }
  if (!pattern.startsWith('^') || !pattern.endsWith('$')) {
    warnings.push({
      field,
      message: 'Regex is not fully anchored (it should start with ^ and end with $).',
    });
  }
}
