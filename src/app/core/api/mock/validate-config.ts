import { FieldMessage, LoadConfig, Meta, ValidationResult } from '../../models/load-config.model';
import { classify } from '../../utils/derive';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const COLUMN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validateConfig(
  config: LoadConfig,
  others: readonly LoadConfig[],
  meta: Meta,
): ValidationResult {
  const errors: FieldMessage[] = [];
  const warnings: FieldMessage[] = [];

  if (!config.id?.trim()) {
    errors.push({ field: 'id', message: 'id is required' });
  } else if (config.id.length > 200 || !ID_PATTERN.test(config.id)) {
    errors.push({
      field: 'id',
      message: "id must be 1-200 characters of letters, digits, '_', '.', ':' or '-'",
    });
  }
  if (!config.publisherName?.trim()) {
    errors.push({ field: 'publisherName', message: 'publisherName is required' });
  }
  if (!meta.modes.includes(config.mode)) {
    errors.push({ field: 'mode', message: 'mode must be APPEND, INCREMENTAL, or OVERWRITE' });
  }

  const orgType = config.organization?.type ?? '';
  if (orgType !== 'advertiser' && orgType !== 'publisher') {
    errors.push({
      field: 'organization.type',
      message: 'organization.type must be advertiser or publisher',
    });
  }

  const preprocess = config.patterns?.preprocess ?? '';
  const ingest = config.patterns?.ingest ?? '';
  if (!preprocess.trim() && !ingest.trim()) {
    errors.push({
      field: 'patterns',
      message: 'at least one of patterns.preprocess or patterns.ingest is required',
    });
  }
  checkPattern(errors, warnings, 'patterns.preprocess', preprocess);
  checkPattern(errors, warnings, 'patterns.ingest', ingest);

  if (!config.destination?.projectId?.trim()) {
    errors.push({ field: 'destination.projectId', message: 'destination.projectId is required' });
  }
  if (!config.destination?.datasetId?.trim()) {
    errors.push({ field: 'destination.datasetId', message: 'destination.datasetId is required' });
  }
  if (!config.destination?.tableId?.trim()) {
    errors.push({ field: 'destination.tableId', message: 'destination.tableId is required' });
  }

  const sourceFormat = config.bqParams?.sourceFormat;
  if (!meta.sourceFormats.some((format) => format.value === sourceFormat)) {
    errors.push({
      field: 'bqParams.sourceFormat',
      message: 'sourceFormat must be 0 (CSV) or 1 (JSON)',
    });
  }
  if (config.bqParams?.fieldDelimiter === '\\t') {
    warnings.push({
      field: 'bqParams.fieldDelimiter',
      message: 'delimiter is the two-character text \\t; store a real tab character',
    });
  }

  const project = config.notification?.projectId?.trim() ?? '';
  const topic = config.notification?.topicId?.trim() ?? '';
  if (Boolean(project) !== Boolean(topic)) {
    errors.push({
      field: 'notification',
      message: 'notification.projectId and notification.topicId must both be set',
    });
  }

  const allowedTypes = new Set(meta.mappingTypes.map((type) => type.value));
  let hasPrimaryKey = false;
  for (const [column, mapping] of Object.entries(config.mappings ?? {})) {
    if (!column.trim()) {
      errors.push({ field: 'mappings', message: 'mapping column name is required' });
    } else if (!COLUMN_NAME.test(column)) {
      warnings.push({
        field: `mappings.${column}`,
        message: 'column name is not a plain BigQuery identifier',
      });
    }
    if (!mapping?.src?.trim()) {
      errors.push({ field: `mappings.${column}.src`, message: 'src is required' });
    }
    if (!allowedTypes.has(mapping?.type)) {
      errors.push({
        field: `mappings.${column}.type`,
        message:
          'type must be 0 RENAME, 1 SQL, 2 PREFIX_PATTERN, 3 CUSTOM, 4 EXTRA_FIELDS, 5 MISSING_MAPPINGS, or 6 ARRAY',
      });
    }
    if (mapping?.primaryKey) {
      hasPrimaryKey = true;
    }
  }

  if (config.mode === 'INCREMENTAL' && !hasPrimaryKey) {
    warnings.push({
      field: 'mappings',
      message: 'INCREMENTAL loads need a mapping with primaryKey set',
    });
  }

  const derived = classify(config);
  if (!derived.partnerType) {
    errors.push({
      field: 'partnerType',
      message:
        'partnerType cannot be derived; set organization.type to publisher or advertiser, or use a dataset id that contains publishers or advertisers',
    });
  }
  if (!derived.importType) {
    errors.push({
      field: 'importType',
      message:
        'importType cannot be derived; end the document id with :optin, :optout, :blacklists, :customers, :stores, or :sales, or use a known destination.tableId',
    });
  }

  const fromId = classify({ id: config.id }).importType;
  const fromTable = classify({ destination: { tableId: config.destination?.tableId } }).importType;
  if (fromId && fromTable && fromId !== fromTable) {
    warnings.push({
      field: 'importType',
      message: `document id implies ${fromId} but destination.tableId implies ${fromTable}; the id wins, and the loader does not read importType`,
    });
  }

  for (const other of others) {
    if (other.id === config.id) {
      continue;
    }
    const left = [preprocess, ingest].filter(Boolean);
    const right = [other.patterns.preprocess, other.patterns.ingest].filter(Boolean);
    if (left.some((pattern) => right.includes(pattern))) {
      warnings.push({
        field: 'patterns',
        message: `overlaps config ${other.id}; the loader keeps the first match in document id order`,
      });
    }
  }

  return { errors, warnings };
}

function checkPattern(
  errors: FieldMessage[],
  warnings: FieldMessage[],
  field: string,
  pattern: string,
): void {
  if (!pattern.trim()) {
    return;
  }
  try {
    new RegExp(pattern);
  } catch (error) {
    errors.push({ field, message: `must be a valid regex: ${String(error)}` });
    return;
  }
  if (!pattern.startsWith('^') || !pattern.endsWith('$')) {
    warnings.push({
      field,
      message: 'regex is unanchored; anchor it with ^ and $ so it cannot match a longer path',
    });
  }
}
