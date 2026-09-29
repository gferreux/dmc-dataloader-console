export type LoadMode = 'APPEND' | 'INCREMENTAL' | 'OVERWRITE';
export type PartnerType = 'publisher' | 'advertiser';
export type ImportType = 'optin' | 'optout' | 'blacklists' | 'customers' | 'stores' | 'sales';

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
  account: string;
  type: string;
}

export interface Notification {
  projectId: string;
  topicId: string;
}

export interface BqParams {
  fieldDelimiter: string;
  skipLeadingRows: number;
  nullMarker: string;
  quote: string;
  sourceFormat: string;
}

export interface ColumnMapping {
  src: string;
  type: number;
  primaryKey?: boolean;
  isPartitionKey?: boolean;
  useInDeleteFilter?: boolean;
  isRequiredPartitionFilter?: boolean;
}

export interface LoadConfig {
  id: string;
  publisherName: string;
  mode: LoadMode;
  deactivated: boolean;
  incremental?: boolean;
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

/** Body sent to POST and PUT. Derived and audit fields stay server-owned. */
export type LoadConfigWrite = Omit<
  LoadConfig,
  'createTime' | 'updateTime' | 'partnerType' | 'importType'
>;

export interface ListQuery {
  partnerType?: string;
  importType?: string;
  q?: string;
  includeDeactivated?: boolean;
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

export interface TemplateDefaults {
  mode: LoadMode;
  destination: Destination;
  bqParams: BqParams;
  patterns: Patterns;
  notification: Notification;
  organization: Pick<Organization, 'type'>;
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

export interface Meta {
  modes: LoadMode[];
  mappingTypes: MappingTypeOption[];
  sourceFormats: string[];
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
