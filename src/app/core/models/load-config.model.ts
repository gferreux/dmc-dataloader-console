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
}

/** Body sent to POST, PUT, and validate. Read-only and derived fields stay off the wire. */
export type LoadConfigWrite = Omit<
  LoadConfig,
  'createTime' | 'updateTime' | 'partnerType' | 'importType'
>;

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

export interface ImportTemplate {
  partnerType: PartnerType;
  importType: ImportType;
  label: string;
  columns: TemplateColumn[];
  defaults: LoadConfigWrite;
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
