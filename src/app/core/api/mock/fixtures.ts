import {
  ColumnMapping,
  DeriveRequest,
  LoadConfig,
  MAPPING_TYPE_SQL,
} from '../../models/load-config.model';
import { TAB_DELIMITER } from '../../utils/delimiter';
import { withDerived } from '../../utils/derive';
import { deriveLoadConfig, presented } from '../../utils/plumbing';
import { TEMPLATES } from './catalog';
import { ORGANIZATIONS } from './organizations';

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

const created = '2026-02-02T09:00:00.000Z';
const updated = '2026-04-18T14:30:00.000Z';

const csv = {
  fieldDelimiter: ',',
  skipLeadingRows: 1,
  nullMarker: null,
  quote: '"',
  sourceFormat: 0,
} as const;

function convention(
  input: DeriveRequest,
  extra: Pick<LoadConfig, 'mode' | 'bqParams' | 'mappings' | 'createTime' | 'updateTime'>,
): LoadConfig {
  const outcome = deriveLoadConfig(input, ORGANIZATIONS);
  if (!outcome.ok) {
    throw new Error(outcome.issues.map((issue) => issue.message).join('; '));
  }
  const { warnings: _warnings, ...derived } = outcome.result;
  return presented(withDerived({ ...derived, ...extra }));
}

/**
 * Small fictional fixtures. Convention documents use the same plumbing as derive.
 * `legacy_sample_stores` keeps a pre-convention id. Its organization type is
 * `advertiser` so a legacy save is accepted. A stored `referential` type is
 * readable and rejected on write.
 */
export const FIXTURES: LoadConfig[] = [
  convention(
    {
      kind: 'publisher',
      organizationName: 'Demo Retail',
      nestedName: 'Demo',
      fileType: 'optin',
    },
    {
      mode: 'APPEND',
      bqParams: { ...csv },
      mappings: mappingsFromTemplate('optin', 'publisher', {
        id: { src: 'SUBSTR(email, 1, 8)', type: MAPPING_TYPE_SQL, primaryKey: true },
      }),
      createTime: created,
      updateTime: updated,
    },
  ),
  convention(
    {
      kind: 'publisher',
      organizationName: 'Demo Retail',
      nestedName: 'Demo',
      fileType: 'optout',
    },
    {
      mode: 'OVERWRITE',
      bqParams: { ...csv },
      mappings: mappingsFromTemplate('optout', 'publisher', {
        sha256_mobile_phone: { primaryKey: true },
      }),
      createTime: created,
      updateTime: updated,
    },
  ),
  convention(
    {
      kind: 'advertiser',
      organizationName: 'Sample Brand',
      nestedName: 'Sample',
      fileType: 'sales',
    },
    {
      mode: 'INCREMENTAL',
      bqParams: { ...csv },
      mappings: mappingsFromTemplate('sales', 'advertiser', {
        order_id: { primaryKey: true },
      }),
      createTime: '2026-03-01T08:00:00.000Z',
      updateTime: '2026-05-02T11:12:00.000Z',
    },
  ),
  convention(
    {
      kind: 'advertiser',
      organizationName: 'Sample Brand',
      nestedName: 'Sample',
      fileType: 'blacklists',
    },
    {
      mode: 'OVERWRITE',
      bqParams: { ...csv },
      mappings: mappingsFromTemplate('blacklists', 'advertiser', {
        sha256_mobile_phone: { primaryKey: true },
      }),
      createTime: created,
      updateTime: updated,
    },
  ),
  convention(
    {
      kind: 'advertiser',
      organizationName: 'Sample Brand',
      nestedName: 'Sample',
      fileType: 'stores',
    },
    {
      mode: 'APPEND',
      bqParams: { ...csv },
      mappings: mappingsFromTemplate('stores', 'advertiser', {
        id: { primaryKey: true },
      }),
      createTime: '2026-01-15T10:00:00.000Z',
      updateTime: '2026-01-20T10:00:00.000Z',
    },
  ),
  withDerived({
    id: 'legacy_sample_stores',
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
    organization: { id: 'org_sample_brand', account: null, type: 'advertiser' },
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
    createTime: '2025-11-02T10:00:00.000Z',
    updateTime: '2025-12-01T10:00:00.000Z',
  }),
];
