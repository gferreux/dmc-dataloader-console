export type LoadMode = 'APPEND' | 'INCREMENTAL' | 'OVERWRITE';
export type PartnerType = 'publisher' | 'advertiser';
export type ImportType = 'optin' | 'optout' | 'blacklists' | 'customers' | 'stores' | 'sales';

/** Domain mapping type from dmc-dataloader-api. Not a BigQuery column type. */
export const MAPPING_TYPE_RENAME = 0;
export const MAPPING_TYPE_SQL = 1;

export interface Patterns {
  preprocess: string;
  ingest: string;
}

export interface Destination {
  projectId: string;
  datasetId: string;
  tableId: string;
}

export interface Organization {
  id: string;
  account: string | null;
  type: string;
}

export interface Notification {
  projectId: string;
  topicId: string;
}

export interface BqParams {
  fieldDelimiter: string;
  skipLeadingRows: number;
  nullMarker: string | null;
  quote: string;
  /** 0 is CSV. 1 is JSON. */
  sourceFormat: number;
}

export interface ColumnMapping {
  src: string;
  type: number;
  primaryKey?: boolean;
  useInDeleteFilter?: boolean;
  isRequiredPartitionFilter?: boolean;
}

export interface LoadConfig {
  id: string;
  publisherName: string;
  mode: LoadMode;
  patterns: Patterns;
  destination: Destination;
  organization: Organization;
  notification: Notification;
  bqParams: BqParams;
  mappings: Record<string, ColumnMapping>;
  createTime?: string;
  updateTime?: string;
  partnerType?: PartnerType;
  importType?: ImportType;
  /**
   * Read-only. Present on GET when the id or patterns follow the convention.
   * Values are slugs. Legacy documents omit all four.
   */
  kind?: PartnerType;
  organizationName?: string;
  nestedName?: string;
  fileType?: ImportType;
}

/**
 * Create body, and the update body when the document id is `{org}:{nested}:{fileType}`.
 * Plumbing (id, patterns, destination, notification, organization, publisherName) stays off the wire.
 */
export interface LoadConfigWrite {
  kind: PartnerType;
  organizationName: string;
  nestedName: string;
  fileType: ImportType;
  mode: LoadMode;
  bqParams: BqParams;
  mappings: Record<string, ColumnMapping>;
}

/** Update body for a legacy document. The server keeps stored plumbing. */
export interface LoadConfigLegacyWrite {
  mode: LoadMode;
  bqParams: BqParams;
  mappings: Record<string, ColumnMapping>;
}

export type LoadConfigUpdate = LoadConfigWrite | LoadConfigLegacyWrite;

export function isIdentityWrite(body: LoadConfigUpdate): body is LoadConfigWrite {
  return (
    'kind' in body &&
    'organizationName' in body &&
    'nestedName' in body &&
    'fileType' in body &&
    Boolean(body.kind) &&
    Boolean(body.organizationName?.trim()) &&
    Boolean(body.nestedName?.trim()) &&
    Boolean(body.fileType)
  );
}

/** Autocomplete row. `id` is omitted for publisher bases. */
export interface NamedRef {
  id?: string;
  name: string;
  slug: string;
}

export interface OrganizationSummary extends NamedRef {
  id: string;
}

export interface NestedSummary extends NamedRef {
  id?: string;
}

export interface DeriveRequest {
  kind: PartnerType;
  organizationName: string;
  nestedName: string;
  fileType: ImportType;
}

export interface DeriveResult {
  id: string;
  publisherName: string;
  patterns: Patterns;
  notification: Notification;
  destination: Destination;
  organization: Organization;
  warnings: FieldMessage[];
}

export interface ListQuery {
  partnerType?: string;
  importType?: string;
  q?: string;
}

export interface FieldMessage {
  field: string;
  message: string;
}

export interface ValidationResult {
  errors: FieldMessage[];
  warnings: FieldMessage[];
}

export interface TestPatternRequest {
  pattern: string;
  path: string;
}

export interface TestPatternResult {
  matches: boolean;
  matchingConfigId: string | null;
}

export interface TemplateColumn {
  name: string;
  bqType: string;
  required: boolean;
  description?: string;
  formatHint?: string;
}

/** Starter document from GET /templates. The form only copies mode, bqParams, and mappings. */
export interface TemplateDefaults {
  mode: LoadMode;
  bqParams: BqParams;
  mappings: Record<string, ColumnMapping>;
  id?: string;
  publisherName?: string;
  patterns?: Patterns;
  destination?: Destination;
  organization?: Organization;
  notification?: Notification;
}

export interface ImportTemplate {
  partnerType: PartnerType;
  importType: ImportType;
  label: string;
  columns: TemplateColumn[];
  defaults: TemplateDefaults;
}

export interface MappingTypeOption {
  value: number;
  label: string;
}

export interface SourceFormatOption {
  value: number;
  label: string;
}

export interface Meta {
  modes: LoadMode[];
  mappingTypes: MappingTypeOption[];
  sourceFormats: SourceFormatOption[];
  partnerTypes: PartnerType[];
  importTypes: Record<PartnerType, ImportType[]>;
}

export interface SignedInUser {
  email: string;
  id: string;
}

export interface ListResponse {
  items: LoadConfig[];
}

export interface TemplateListResponse {
  items: ImportTemplate[];
}
