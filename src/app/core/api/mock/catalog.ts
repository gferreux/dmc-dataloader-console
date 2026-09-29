import {
  BqParams,
  ImportTemplate,
  ImportType,
  MappingTypeOption,
  Meta,
  PartnerType,
  TemplateColumn,
} from '../../models/load-config.model';

/**
 * Assumed BigQuery type codes until the API publishes /meta.
 * The UI renders labels from the payload and never hard-codes them in templates.
 */
export const MAPPING_TYPES: MappingTypeOption[] = [
  { value: 1, label: 'STRING' },
  { value: 2, label: 'INTEGER' },
  { value: 3, label: 'FLOAT' },
  { value: 4, label: 'BOOLEAN' },
  { value: 5, label: 'DATE' },
  { value: 6, label: 'TIMESTAMP' },
  { value: 7, label: 'NUMERIC' },
  { value: 8, label: 'BYTES' },
];

export const BQ_TYPE_CODE: Record<string, number> = Object.fromEntries(
  MAPPING_TYPES.map((type) => [type.label, type.value]),
);

export const META: Meta = {
  modes: ['APPEND', 'INCREMENTAL', 'OVERWRITE'],
  mappingTypes: MAPPING_TYPES,
  sourceFormats: ['CSV'],
  partnerTypes: ['publisher', 'advertiser'],
  importTypes: {
    publisher: ['optin', 'optout'],
    advertiser: ['blacklists', 'customers', 'stores', 'sales'],
  },
};

const PHONE = '+33612345678 preferred';
const OPTIN = '0 or 1';
const GENDER = 'M or F';
const DATE = 'YYYY-MM-DD';
const TIMESTAMP = 'ISO-8601 timestamp';

function column(
  name: string,
  bqType = 'STRING',
  required = false,
  formatHint?: string,
  description?: string,
): TemplateColumn {
  return { name, bqType, required, formatHint, description };
}

const profileColumns: TemplateColumn[] = [
  column('email'),
  column('land_phone', 'STRING', false, PHONE),
  column('mobile_phone', 'STRING', true, PHONE),
  column('id'),
  column('optin_email', 'STRING', false, OPTIN),
  column('optin_sms', 'STRING', true, OPTIN),
  column('title'),
  column('gender', 'STRING', false, GENDER),
  column('last_name'),
  column('first_name'),
  column('birth_date', 'DATE', false, DATE),
  column('address_1'),
  column('address_2'),
  column('city'),
  column('zip_code'),
  column('last_activity_date', 'DATE', false, DATE),
  column('collect_date', 'DATE', true, DATE),
  column('collect_url', 'STRING', true),
  column('user_ip'),
];

const PUBLISHER_DATASET = 'dkp_dmc_publishers_raw_eu_dev';
const ADVERTISER_DATASET = 'dkp_dmc_advertisers_raw_eu_dev';

const csvParams: BqParams = {
  fieldDelimiter: ',',
  skipLeadingRows: 1,
  nullMarker: '',
  quote: '"',
  sourceFormat: 'CSV',
};

function template(
  partnerType: PartnerType,
  importType: ImportType,
  label: string,
  tableId: string,
  columns: TemplateColumn[],
  mode: ImportTemplate['defaults']['mode'] = 'APPEND',
): ImportTemplate {
  const datasetId = partnerType === 'publisher' ? PUBLISHER_DATASET : ADVERTISER_DATASET;
  return {
    partnerType,
    importType,
    label,
    columns,
    defaults: {
      mode,
      destination: { projectId: 'demo-dmc-eu', datasetId, tableId },
      bqParams: { ...csvParams },
      patterns: {
        preprocess: `^demo-bucket/${partnerType}/${importType}/pre/.*\\.csv$`,
        ingest: `^demo-bucket/${partnerType}/${importType}/.*\\.csv$`,
      },
      notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
      organization: { type: partnerType },
    },
  };
}

export const TEMPLATES: ImportTemplate[] = [
  template('publisher', 'optin', 'Publisher opt-in', 'profiles', profileColumns),
  template(
    'publisher',
    'optout',
    'Publisher opt-out',
    'optouts',
    [column('sha256_mobile_phone', 'STRING', true, 'Lowercase hex SHA-256')],
    'OVERWRITE',
  ),
  template(
    'advertiser',
    'blacklists',
    'Advertiser blacklists',
    'blacklists',
    [column('sha256_mobile_phone', 'STRING', true, 'Lowercase hex SHA-256')],
    'OVERWRITE',
  ),
  template('advertiser', 'customers', 'Advertiser customers', 'customers', [
    ...profileColumns,
    column('country', 'STRING', false, 'Default FR'),
    column('additional_fields'),
  ]),
  template('advertiser', 'stores', 'Advertiser stores', 'stores', [
    column('id', 'STRING', true),
    column('name', 'STRING', true),
    column('address', 'STRING', true),
    column('zip_code', 'STRING', true),
    column('city', 'STRING', true),
    column('country', 'STRING', false, 'Default FR'),
    column('longitude'),
    column('latitude'),
    column('website'),
    column('email'),
    column('phone_number', 'STRING', false, PHONE),
    column('tags'),
    column('additional_fields'),
  ]),
  template(
    'advertiser',
    'sales',
    'Advertiser sales',
    'sales',
    [
      column('order_ts', 'TIMESTAMP', true, TIMESTAMP),
      column('order_id'),
      column('external_customer_id'),
      column('external_customer_name'),
      column('mobile_phone', 'STRING', true, PHONE),
      column('land_phone', 'STRING', false, PHONE),
      column('email'),
      column('sales_channel'),
      column('store_id', 'STRING', true),
      column('store_name'),
      column('price_before_tax', 'FLOAT', true),
      column('price_with_tax', 'FLOAT'),
      column('item_id'),
      column('item_name'),
      column('item_description'),
      column('item_category'),
      column('item_quantity', 'INTEGER'),
      column('item_price', 'FLOAT'),
      column('additional_fields'),
    ],
    'INCREMENTAL',
  ),
];

export function findTemplate(
  templates: readonly ImportTemplate[],
  partnerType: string | undefined,
  importType: string | undefined,
): ImportTemplate | undefined {
  return templates.find(
    (item) => item.partnerType === partnerType && item.importType === importType,
  );
}
