import { ImportType, LoadConfig, PartnerType } from '../models/load-config.model';

export const IMPORT_TYPES: readonly ImportType[] = [
  'optin',
  'optout',
  'blacklists',
  'customers',
  'stores',
  'sales',
];

export function inferPartnerType(
  config: Pick<LoadConfig, 'destination'>,
): PartnerType | undefined {
  const dataset = config.destination.datasetId.toLowerCase();
  if (dataset.includes('advertiser')) {
    return 'advertiser';
  }
  if (dataset.includes('publisher')) {
    return 'publisher';
  }
  return undefined;
}

export function inferImportType(
  config: Pick<LoadConfig, 'destination' | 'id'>,
): ImportType | undefined {
  const table = config.destination.tableId.toLowerCase();
  if (isImportType(table)) {
    return table;
  }
  if (table === 'profiles') {
    return 'optin';
  }
  const tail = config.id.split(':').pop()?.toLowerCase();
  return tail && isImportType(tail) ? tail : undefined;
}

export function withDerived(config: LoadConfig): LoadConfig {
  return {
    ...config,
    partnerType: config.partnerType ?? inferPartnerType(config),
    importType: config.importType ?? inferImportType(config),
  };
}

export function destinationLabel(config: Pick<LoadConfig, 'destination'>): string {
  const { projectId, datasetId, tableId } = config.destination;
  return [projectId, datasetId, tableId].filter(Boolean).join('.');
}

export function isImportType(value: string): value is ImportType {
  return (IMPORT_TYPES as readonly string[]).includes(value);
}
