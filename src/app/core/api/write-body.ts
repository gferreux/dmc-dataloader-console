import {
  BqParams,
  ColumnMapping,
  DeriveResult,
  LoadConfig,
  LoadConfigLegacyWrite,
  LoadConfigUpdate,
  LoadConfigWrite,
  isIdentityWrite,
} from '../models/load-config.model';

export function sanitizeMappings(
  mappings: Record<string, ColumnMapping> | undefined,
): Record<string, ColumnMapping> {
  const cleaned: Record<string, ColumnMapping> = {};
  for (const [name, mapping] of Object.entries(mappings ?? {})) {
    const column: ColumnMapping = { src: mapping.src, type: mapping.type };
    if (mapping.primaryKey !== undefined) {
      column.primaryKey = mapping.primaryKey;
    }
    if (mapping.useInDeleteFilter !== undefined) {
      column.useInDeleteFilter = mapping.useInDeleteFilter;
    }
    if (mapping.isRequiredPartitionFilter !== undefined) {
      column.isRequiredPartitionFilter = mapping.isRequiredPartitionFilter;
    }
    cleaned[name] = column;
  }
  return cleaned;
}

export function sanitizeBqParams(params: BqParams | undefined): BqParams {
  const marker = params?.nullMarker ?? null;
  return {
    fieldDelimiter: params?.fieldDelimiter ?? '',
    skipLeadingRows: Number(params?.skipLeadingRows ?? 0),
    nullMarker: typeof marker === 'string' && marker.trim() === '' ? null : marker,
    quote: params?.quote ?? '',
    sourceFormat: Number(params?.sourceFormat),
  };
}

/** JSON sent to create and update. Derived plumbing stays off the wire. */
export function toWriteBody(body: LoadConfigUpdate): LoadConfigWrite | LoadConfigLegacyWrite {
  const base = {
    mode: body.mode,
    bqParams: sanitizeBqParams(body.bqParams),
    mappings: sanitizeMappings(body.mappings),
  };
  if (!isIdentityWrite(body)) {
    return base;
  }
  return {
    kind: body.kind,
    organizationName: body.organizationName.trim(),
    nestedName: body.nestedName.trim(),
    fileType: body.fileType,
    ...base,
  };
}

/** JSON sent to validate. The route takes a full LoadConfig, not the write body. */
export function toDocumentBody(config: LoadConfig): LoadConfig {
  return {
    id: config.id,
    publisherName: config.publisherName,
    mode: config.mode,
    patterns: {
      preprocess: config.patterns?.preprocess ?? '',
      ingest: config.patterns?.ingest ?? '',
    },
    destination: { ...config.destination },
    organization: {
      id: config.organization?.id ?? '',
      account: config.organization?.account ?? null,
      type: config.organization?.type ?? '',
    },
    notification: {
      projectId: config.notification?.projectId ?? '',
      topicId: config.notification?.topicId ?? '',
    },
    bqParams: sanitizeBqParams(config.bqParams),
    mappings: sanitizeMappings(config.mappings),
  };
}

export function materialize(derived: DeriveResult, body: LoadConfigWrite): LoadConfig {
  return {
    id: derived.id,
    publisherName: derived.publisherName,
    mode: body.mode,
    patterns: { ...derived.patterns },
    destination: { ...derived.destination },
    organization: { ...derived.organization },
    notification: { ...derived.notification },
    bqParams: sanitizeBqParams(body.bqParams),
    mappings: sanitizeMappings(body.mappings),
  };
}

export function isLegacyWrite(body: LoadConfigUpdate): body is LoadConfigLegacyWrite {
  return !isIdentityWrite(body);
}
