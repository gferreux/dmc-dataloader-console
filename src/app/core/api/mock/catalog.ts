import {
  BqParams,
  ImportTemplate,
  ImportType,
  MappingTypeOption,
  Meta,
  PartnerType,
  SourceFormatOption,
  TemplateColumn,
  TemplateDefaults,
} from '../../models/load-config.model';

/** Labels match GET /api/v1/meta. Values are the domain iota, not BigQuery types. */
export const MAPPING_TYPES: MappingTypeOption[] = [
  { value: 0, label: 'RENAME' },
  { value: 1, label: 'SQL' },
  { value: 2, label: 'PREFIX_PATTERN' },
  { value: 3, label: 'CUSTOM' },
  { value: 4, label: 'EXTRA_FIELDS' },
  { value: 5, label: 'MISSING_MAPPINGS' },
  { value: 6, label: 'ARRAY' },
];

export const SOURCE_FORMATS: SourceFormatOption[] = [
  { value: 0, label: 'CSV' },
  { value: 1, label: 'JSON' },
];

export const META: Meta = {
  modes: ['APPEND', 'INCREMENTAL', 'OVERWRITE'],
  mappingTypes: MAPPING_TYPES,
  sourceFormats: SOURCE_FORMATS,
  partnerTypes: ['publisher', 'advertiser'],
  importTypes: {
    publisher: ['optin', 'optout'],
    advertiser: ['blacklists', 'customers', 'stores', 'sales'],
  },
};

const PHONE = 'Preferred +33612345678. Also 0612345678 or 612345678 with a default dial code.';
const OPTIN = '0/1 or true/false.';
const GENDER = 'M/F or m./mr/mme/mlle/mll.';
const DATE = 'YYYY-MM-DD preferred. Also YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY.';
const JSON_HINT = 'JSON object of extra key/values used for reporting drilldown.';
const TAGS = 'Comma-separated tags.';

const PUBLISHER_DATASET = 'dkp_dmc_publishers_raw_eu_dev';
const ADVERTISER_DATASET = 'dkp_dmc_advertisers_raw_eu_dev';
const SUGGESTED_INGEST = '^REPLACE_BUCKET/REPLACE_PREFIX/.*\\.csv$';

function column(
  name: string,
  bqType = 'STRING',
  required = false,
  description = '',
  formatHint = '',
): TemplateColumn {
  return { name, bqType, required, description, formatHint };
}

const profileColumns: TemplateColumn[] = [
  column('email', 'STRING', false, 'Email address.'),
  column('land_phone', 'STRING', false, 'Landline phone.'),
  column('mobile_phone', 'STRING', true, 'Mobile phone.', PHONE),
  column('id', 'STRING', false, 'Contact identifier.'),
  column('optin_email', 'STRING', false, 'Email opt-in flag.', OPTIN),
  column('optin_sms', 'STRING', true, 'SMS opt-in flag.', OPTIN),
  column('title', 'STRING', false, 'Honorific title.'),
  column('gender', 'STRING', false, 'Gender.', GENDER),
  column('last_name', 'STRING', false, 'Last name.'),
  column('first_name', 'STRING', false, 'First name.'),
  column('birth_date', 'DATE', false, 'Birth date.', DATE),
  column(
    'address_1',
    'STRING',
    false,
    'Street address line. Add address_3 and further lines as extra STRING mappings.',
  ),
  column('address_2', 'STRING', false, 'Second street address line.'),
  column('city', 'STRING', false, 'City.'),
  column('zip_code', 'STRING', false, 'Postal code.'),
  column('last_activity_date', 'DATE', false, 'Last activity date.', DATE),
  column('collect_date', 'DATE', true, 'Date the contact was collected.', DATE),
  column('collect_url', 'STRING', true, 'URL where the contact was collected.'),
  column('user_ip', 'STRING', false, 'Collector IP address.'),
];

const sha256Column = column(
  'sha256_mobile_phone',
  'STRING',
  true,
  'SHA-256 hash of the mobile phone.',
);

const csvParams: BqParams = {
  fieldDelimiter: ',',
  skipLeadingRows: 1,
  nullMarker: null,
  quote: '"',
  sourceFormat: 0,
};

function defaults(
  partnerType: PartnerType,
  datasetId: string,
  tableId: string,
  columns: TemplateColumn[],
): TemplateDefaults {
  const mappings: TemplateDefaults['mappings'] = {};
  for (const column of columns) {
    mappings[column.name] = { src: column.name, type: 0 };
  }
  return {
    id: '',
    publisherName: '',
    mode: 'APPEND',
    patterns: { preprocess: '', ingest: SUGGESTED_INGEST },
    destination: { projectId: 'demo-dmc-eu', datasetId, tableId },
    organization: { id: '', account: null, type: partnerType },
    notification: { projectId: '', topicId: '' },
    bqParams: { ...csvParams },
    mappings,
  };
}

function template(
  partnerType: PartnerType,
  importType: ImportType,
  label: string,
  tableId: string,
  columns: TemplateColumn[],
): ImportTemplate {
  const datasetId = partnerType === 'publisher' ? PUBLISHER_DATASET : ADVERTISER_DATASET;
  return {
    partnerType,
    importType,
    label,
    columns,
    defaults: defaults(partnerType, datasetId, tableId, columns),
  };
}

export const TEMPLATES: ImportTemplate[] = [
  template('publisher', 'optin', 'Publisher opt-in (Bases)', 'profiles', profileColumns),
  template('publisher', 'optout', 'Publisher opt-out', 'optout', [sha256Column]),
  template('advertiser', 'blacklists', 'Advertiser blacklists', 'blacklists', [sha256Column]),
  template('advertiser', 'customers', 'Advertiser customers', 'customers', [
    ...profileColumns,
    column('country', 'STRING', false, 'Country code.', 'Default FR.'),
    column(
      'additional_fields',
      'JSON',
      false,
      'Extra key/values for reporting drilldown.',
      JSON_HINT,
    ),
  ]),
  template('advertiser', 'stores', 'Advertiser stores', 'stores', [
    column('id', 'STRING', true, 'Store identifier.'),
    column('name', 'STRING', true, 'Store name.'),
    column('address', 'STRING', true, 'Street address.'),
    column('zip_code', 'STRING', true, 'Postal code.'),
    column('city', 'STRING', true, 'City.'),
    column(
      'country',
      'STRING',
      false,
      'Country code. Use FR when the file has no country.',
      'Default FR.',
    ),
    column('longitude', 'FLOAT', false, 'Longitude in decimal degrees.'),
    column('latitude', 'FLOAT', false, 'Latitude in decimal degrees.'),
    column('website', 'STRING', false, 'Store website.'),
    column('email', 'STRING', false, 'Store email.'),
    column('phone_number', 'STRING', false, 'Store phone number.'),
    column('tags', 'STRING', false, 'Store tags.', TAGS),
    column(
      'additional_fields',
      'JSON',
      false,
      'Extra key/values for reporting drilldown.',
      JSON_HINT,
    ),
  ]),
  template('advertiser', 'sales', 'Advertiser sales', 'sales', [
    column('order_ts', 'TIMESTAMP', true, 'Order timestamp.', DATE),
    column('order_id', 'STRING', false, 'Order identifier.'),
    column('external_customer_id', 'STRING', false, 'Customer id in the advertiser system.'),
    column('external_customer_name', 'STRING', false, 'Customer name in the advertiser system.'),
    column('mobile_phone', 'STRING', true, 'Mobile phone, clear or hashed.', PHONE),
    column('land_phone', 'STRING', false, 'Landline phone.'),
    column('email', 'STRING', false, 'Email address.'),
    column('sales_channel', 'STRING', false, 'Sales channel.'),
    column('store_id', 'STRING', true, 'Store identifier.'),
    column('store_name', 'STRING', false, 'Store name.'),
    column('price_before_tax', 'FLOAT', true, 'Order price before tax.'),
    column('price_with_tax', 'FLOAT', false, 'Order price with tax.'),
    column('item_id', 'STRING', false, 'Item identifier.'),
    column('item_name', 'STRING', false, 'Item name.'),
    column('item_description', 'STRING', false, 'Item description.'),
    column('item_category', 'STRING', false, 'Item category.'),
    column('item_quantity', 'INTEGER', false, 'Item quantity.'),
    column('item_price', 'FLOAT', false, 'Item price.'),
    column(
      'additional_fields',
      'JSON',
      false,
      'Extra key/values for reporting drilldown.',
      JSON_HINT,
    ),
  ]),
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
