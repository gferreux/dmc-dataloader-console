import { ImportType, LoadConfig, PartnerType } from '../models/load-config.model';

export const IMPORT_TYPES: readonly ImportType[] = [
  'optin',
  'optout',
  'blacklists',
  'customers',
  'stores',
  'sales',
];

const IMPORTS_BY_PARTNER: Record<PartnerType, readonly ImportType[]> = {
  publisher: ['optin', 'optout'],
  advertiser: ['blacklists', 'customers', 'stores', 'sales'],
};

export interface Classifiable {
  id?: string;
  organization?: { type?: string };
  destination?: { datasetId?: string; tableId?: string };
}

/**
 * Same derivation as dmc-dataloader-api Classify.
 * organization.type wins when it is publisher or advertiser. `referential` does not.
 * importType prefers the last colon segment of the id, then the table id.
 * `profiles` is publisher opt-in.
 */
export function classify(config: Classifiable): {
  partnerType?: PartnerType;
  importType?: ImportType;
} {
  const importType = importFromId(config.id) ?? importFromTable(config.destination?.tableId);
  let partnerType = partnerFromOrganization(config.organization?.type);
  if (!partnerType) {
    partnerType = partnerFromDataset(config.destination?.datasetId);
  }
  if (!partnerType && importType) {
    partnerType = partnerForImport(importType);
  }
  return { partnerType, importType };
}

export function withDerived(config: LoadConfig): LoadConfig {
  const derived = classify(config);
  return {
    ...config,
    partnerType: config.partnerType || derived.partnerType,
    importType: config.importType || derived.importType,
  };
}

export function destinationLabel(config: Pick<LoadConfig, 'destination'>): string {
  const { projectId, datasetId, tableId } = config.destination;
  return [projectId, datasetId, tableId].filter(Boolean).join('.');
}

export function isImportType(value: string): value is ImportType {
  return (IMPORT_TYPES as readonly string[]).includes(value);
}

function partnerFromOrganization(type: string | undefined): PartnerType | undefined {
  if (type === 'publisher' || type === 'advertiser') {
    return type;
  }
  return undefined;
}

function partnerFromDataset(datasetId: string | undefined): PartnerType | undefined {
  const lowered = datasetId?.toLowerCase() ?? '';
  const publisher = lowered.includes('publisher');
  const advertiser = lowered.includes('advertiser');
  if (publisher && advertiser) {
    return undefined;
  }
  if (publisher) {
    return 'publisher';
  }
  if (advertiser) {
    return 'advertiser';
  }
  return undefined;
}

function importFromId(id: string | undefined): ImportType | undefined {
  const last = id?.split(':').pop()?.toLowerCase();
  return last && isImportType(last) ? last : undefined;
}

function importFromTable(tableId: string | undefined): ImportType | undefined {
  switch (tableId?.toLowerCase()) {
    case 'profiles':
    case 'profile':
    case 'optin':
      return 'optin';
    case 'optout':
      return 'optout';
    case 'blacklists':
    case 'blacklist':
      return 'blacklists';
    case 'customers':
    case 'customer':
      return 'customers';
    case 'stores':
    case 'store':
      return 'stores';
    case 'sales':
    case 'sale':
      return 'sales';
    default:
      return undefined;
  }
}

function partnerForImport(importType: ImportType): PartnerType | undefined {
  for (const partner of Object.keys(IMPORTS_BY_PARTNER) as PartnerType[]) {
    if (IMPORTS_BY_PARTNER[partner].includes(importType)) {
      return partner;
    }
  }
  return undefined;
}
