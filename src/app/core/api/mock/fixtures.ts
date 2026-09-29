import { ColumnMapping, LoadConfig, LoadConfigWrite } from '../../models/load-config.model';
import { TAB_DELIMITER } from '../../utils/delimiter';
import { withDerived } from '../../utils/derive';
import { BQ_TYPE_CODE, TEMPLATES } from './catalog';

function mapping(
  src: string,
  bqType: string,
  flags: Partial<ColumnMapping> = {},
): ColumnMapping {
  return { src, type: BQ_TYPE_CODE[bqType] ?? BQ_TYPE_CODE['STRING'], ...flags };
}

function mappingsFromTemplate(
  importType: string,
  partnerType: string,
  overrides: Record<string, Partial<ColumnMapping>> = {},
): Record<string, ColumnMapping> {
  const template = TEMPLATES.find(
    (item) => item.partnerType === partnerType && item.importType === importType,
  );
  const result: Record<string, ColumnMapping> = {};
  for (const column of template?.columns ?? []) {
    const src = column.formatHint === 'Default FR' ? "'FR'" : column.name;
    result[column.name] = mapping(src, column.bqType, overrides[column.name]);
  }
  return result;
}

function config(partial: LoadConfigWrite & Pick<LoadConfig, 'createTime' | 'updateTime'>): LoadConfig {
  return withDerived({ ...partial, partnerType: undefined, importType: undefined });
}

const created = '2026-02-02T09:00:00.000Z';
const updated = '2026-04-18T14:30:00.000Z';

/**
 * Small fictional fixtures. Dataset names follow the documented dev convention
 * so partner type can be derived. They are not a dump of production configs.
 */
export const FIXTURES: LoadConfig[] = [
  config({
    id: 'demo_retail:demo:optin',
    publisherName: 'Demo Retail',
    mode: 'APPEND',
    deactivated: false,
    incremental: false,
    patterns: {
      preprocess: '^demo-bucket/publisher/optin/pre/.*\\.csv$',
      ingest: '^demo-bucket/publisher/optin/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_publishers_raw_eu_dev',
      tableId: 'profiles',
    },
    organization: { id: 'org_demo_retail', account: 'demo', type: 'publisher' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: {
      fieldDelimiter: ',',
      skipLeadingRows: 1,
      nullMarker: '',
      quote: '"',
      sourceFormat: 'CSV',
    },
    mappings: mappingsFromTemplate('optin', 'publisher', {
      id: { src: 'SUBSTR(email, 1, 8)', primaryKey: true },
    }),
    createTime: created,
    updateTime: updated,
  }),
  config({
    id: 'demo_retail:demo:optout',
    publisherName: 'Demo Retail',
    mode: 'OVERWRITE',
    deactivated: false,
    incremental: false,
    patterns: {
      preprocess: '^demo-bucket/publisher/optout/pre/.*\\.csv$',
      ingest: '^demo-bucket/publisher/optout/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_publishers_raw_eu_dev',
      tableId: 'optouts',
    },
    organization: { id: 'org_demo_retail', account: 'demo', type: 'publisher' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: {
      fieldDelimiter: ',',
      skipLeadingRows: 1,
      nullMarker: '',
      quote: '"',
      sourceFormat: 'CSV',
    },
    mappings: mappingsFromTemplate('optout', 'publisher', {
      sha256_mobile_phone: { primaryKey: true },
    }),
    createTime: created,
    updateTime: updated,
  }),
  config({
    id: 'sample_brand:sample:sales',
    publisherName: 'Sample Brand',
    mode: 'INCREMENTAL',
    deactivated: false,
    incremental: true,
    patterns: {
      preprocess: '^demo-bucket/advertiser/sales/pre/.*\\.csv$',
      ingest: '^demo-bucket/advertiser/sales/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'sales',
    },
    organization: { id: 'org_sample_brand', account: 'sample', type: 'advertiser' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: {
      fieldDelimiter: ',',
      skipLeadingRows: 1,
      nullMarker: '',
      quote: '"',
      sourceFormat: 'CSV',
    },
    mappings: mappingsFromTemplate('sales', 'advertiser', {
      order_id: { primaryKey: true },
      order_ts: { isPartitionKey: true },
    }),
    createTime: '2026-03-01T08:00:00.000Z',
    updateTime: '2026-05-02T11:12:00.000Z',
  }),
  config({
    id: 'sample_brand:sample:blacklists',
    publisherName: 'Sample Brand',
    mode: 'OVERWRITE',
    deactivated: false,
    incremental: false,
    patterns: {
      preprocess: '^demo-bucket/advertiser/blacklists/pre/.*\\.csv$',
      ingest: '^demo-bucket/advertiser/blacklists/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'blacklists',
    },
    organization: { id: 'org_sample_brand', account: 'sample', type: 'advertiser' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: {
      fieldDelimiter: ',',
      skipLeadingRows: 1,
      nullMarker: '',
      quote: '"',
      sourceFormat: 'CSV',
    },
    mappings: mappingsFromTemplate('blacklists', 'advertiser', {
      sha256_mobile_phone: { primaryKey: true },
    }),
    createTime: created,
    updateTime: updated,
  }),
  config({
    id: 'sample_brand:sample:stores',
    publisherName: 'Sample Brand',
    mode: 'APPEND',
    deactivated: true,
    incremental: false,
    patterns: {
      preprocess: '^demo-bucket/advertiser/stores/pre/.*\\.csv$',
      ingest: '^demo-bucket/advertiser/stores/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'stores',
    },
    organization: { id: 'org_sample_brand', account: 'sample', type: 'advertiser' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: {
      fieldDelimiter: TAB_DELIMITER,
      skipLeadingRows: 1,
      nullMarker: '',
      quote: '"',
      sourceFormat: 'CSV',
    },
    mappings: mappingsFromTemplate('stores', 'advertiser', {
      id: { primaryKey: true },
    }),
    createTime: '2026-01-15T10:00:00.000Z',
    updateTime: '2026-01-20T10:00:00.000Z',
  }),
];
