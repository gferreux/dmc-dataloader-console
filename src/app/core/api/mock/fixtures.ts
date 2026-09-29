import {
  ColumnMapping,
  LoadConfig,
  LoadConfigWrite,
  MAPPING_TYPE_SQL,
} from '../../models/load-config.model';
import { TAB_DELIMITER } from '../../utils/delimiter';
import { withDerived } from '../../utils/derive';
import { TEMPLATES } from './catalog';

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
    result[column.name] = {
      src: column.name,
      type: 0,
      ...overrides[column.name],
    };
  }
  return result;
}

function config(partial: LoadConfigWrite & Pick<LoadConfig, 'createTime' | 'updateTime'>): LoadConfig {
  return withDerived(partial);
}

const created = '2026-02-02T09:00:00.000Z';
const updated = '2026-04-18T14:30:00.000Z';

const csv = {
  fieldDelimiter: ',',
  skipLeadingRows: 1,
  nullMarker: null,
  quote: '"',
  sourceFormat: 0,
} as const;

/**
 * Small fictional fixtures. Dataset names follow the documented dev convention
 * so partner type can be derived. They are not a dump of production configs.
 */
export const FIXTURES: LoadConfig[] = [
  config({
    id: 'demo_retail:demo:optin',
    publisherName: 'Demo Retail',
    mode: 'APPEND',
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
    bqParams: { ...csv },
    mappings: mappingsFromTemplate('optin', 'publisher', {
      id: { src: 'SUBSTR(email, 1, 8)', type: MAPPING_TYPE_SQL, primaryKey: true },
    }),
    createTime: created,
    updateTime: updated,
  }),
  config({
    id: 'demo_retail:demo:optout',
    publisherName: 'Demo Retail',
    mode: 'OVERWRITE',
    patterns: {
      preprocess: '^demo-bucket/publisher/optout/pre/.*\\.csv$',
      ingest: '^demo-bucket/publisher/optout/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_publishers_raw_eu_dev',
      tableId: 'optout',
    },
    organization: { id: 'org_demo_retail', account: 'demo', type: 'publisher' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: { ...csv },
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
    bqParams: { ...csv },
    mappings: mappingsFromTemplate('sales', 'advertiser', {
      order_id: { primaryKey: true },
    }),
    createTime: '2026-03-01T08:00:00.000Z',
    updateTime: '2026-05-02T11:12:00.000Z',
  }),
  config({
    id: 'sample_brand:sample:blacklists',
    publisherName: 'Sample Brand',
    mode: 'OVERWRITE',
    patterns: {
      preprocess: '^demo-bucket/advertiser/blacklists/pre/.*\\.csv$',
      ingest: '^demo-bucket/advertiser/blacklists/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'blacklists',
    },
    organization: { id: 'org_sample_brand', account: null, type: 'advertiser' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: { ...csv },
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
    patterns: {
      preprocess: '^demo-bucket/advertiser/stores/pre/.*\\.csv$',
      ingest: '^demo-bucket/advertiser/stores/.*\\.csv$',
    },
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'stores',
    },
    organization: { id: 'org_sample_brand', account: null, type: 'referential' },
    notification: { projectId: 'demo-dmc-eu', topicId: 'demo-load-events' },
    bqParams: {
      fieldDelimiter: TAB_DELIMITER,
      skipLeadingRows: 1,
      nullMarker: null,
      quote: '"',
      sourceFormat: 0,
    },
    mappings: mappingsFromTemplate('stores', 'advertiser', {
      id: { primaryKey: true },
    }),
    createTime: '2026-01-15T10:00:00.000Z',
    updateTime: '2026-01-20T10:00:00.000Z',
  }),
];
