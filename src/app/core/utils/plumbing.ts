import {
  DeriveRequest,
  DeriveResult,
  FieldMessage,
  ImportType,
  LoadConfig,
  PartnerType,
} from '../models/load-config.model';
import { isImportType } from './derive';
import { slugify } from './slug';

export const NOTIFICATION_PROJECT_ID = 'dmc-curated-inventory-dev-e6da';
export const NOTIFICATION_TOPIC_ID = 'dkp-dmc-data-loader-notifications-dev';

const ADVERTISER_DESTINATION_PROJECT = 'dmc-raw-advertisers-dev-27c7';
const PUBLISHER_DESTINATION_PROJECT = 'dmc-raw-publishers-dev-c69c';
const ADVERTISER_DATASET = 'dkp_dmc_advertisers_raw_eu_dev';
const PUBLISHER_DATASET = 'dkp_dmc_publishers_raw_eu_dev';

/** Extension group from derive_config.go. The dot in `tar.gz` is escaped. */
const EXT_PATTERN = '[.](csv|zip|gz|gzip|tgz|tar\\.gz|7z)';
const TS_PATTERN = '[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z';

const CONVENTION_ID =
  /^([a-z0-9_]+):([a-z0-9_]+):(optin|optout|blacklists|customers|stores|sales)$/i;

export interface DirectoryNested {
  id: string;
  name: string;
  slug: string;
}

export interface DirectoryOrg {
  id: string;
  name: string;
  slug: string;
  type: PartnerType;
  accounts: DirectoryNested[];
  bases: DirectoryNested[];
}

export interface ParsedIdentity {
  kind: PartnerType;
  organizationName: string;
  nestedName: string;
  fileType: ImportType;
}

export type DeriveOutcome =
  { ok: true; result: DeriveResult } | { ok: false; issues: FieldMessage[] };

type KnownConfig = Pick<LoadConfig, 'id' | 'patterns'> & {
  organization?: LoadConfig['organization'];
};

const PUBLISHER_FILES: readonly ImportType[] = ['optin', 'optout'];
const ADVERTISER_FILES: readonly ImportType[] = ['blacklists', 'customers', 'stores', 'sales'];

export function fileTypesFor(kind: PartnerType): readonly ImportType[] {
  return kind === 'publisher' ? PUBLISHER_FILES : ADVERTISER_FILES;
}

export function partnerForFileType(fileType: ImportType): PartnerType {
  return PUBLISHER_FILES.includes(fileType) ? 'publisher' : 'advertiser';
}

export function isFileTypeForKind(kind: PartnerType, fileType: string): fileType is ImportType {
  return (fileTypesFor(kind) as readonly string[]).includes(fileType);
}

/** `{org}:{nested}:{fileType}` where org and nested are slugs. */
export function parseConventionId(
  id: string,
): { orgSlug: string; nestedSlug: string; fileType: ImportType } | null {
  const match = id.trim().match(CONVENTION_ID);
  if (!match) {
    return null;
  }
  return {
    orgSlug: match[1].toLowerCase(),
    nestedSlug: match[2].toLowerCase(),
    fileType: match[3].toLowerCase() as ImportType,
  };
}

/**
 * Reads kind and the three slugs the way the API's ParseIdentity does.
 * The document id wins when it is `org:nested:fileType`. Otherwise the last
 * matching path in preprocess, then ingest, is used.
 */
export function parseIdentity(config: KnownConfig): ParsedIdentity | null {
  const fromId = parseConventionId(config.id ?? '');
  const parts = fromId
    ? {
        org: fromId.orgSlug,
        nested: fromId.nestedSlug,
        fileType: fromId.fileType,
      }
    : pathIdentity(config.patterns);
  if (!parts) {
    return null;
  }
  return identityFor(config.organization?.type, parts.org, parts.nested, parts.fileType);
}

/** True when a GET payload carries the four read-only convention fields. */
export function hasConventionIdentity(
  config: Pick<LoadConfig, 'kind' | 'organizationName' | 'nestedName' | 'fileType'>,
): config is LoadConfig & ParsedIdentity {
  return Boolean(config.kind && config.organizationName && config.nestedName && config.fileType);
}

/**
 * GET attaches kind, organizationName, nestedName, and fileType when the
 * document follows the convention. Legacy documents omit them.
 */
export function presented(config: LoadConfig): LoadConfig {
  const next: LoadConfig = { ...config };
  delete next.kind;
  delete next.organizationName;
  delete next.nestedName;
  delete next.fileType;
  const parsed = parseIdentity(config);
  if (!parsed) {
    return next;
  }
  return { ...next, ...parsed };
}

export function sameIdentity(
  left: {
    kind: string;
    organizationName: string;
    nestedName: string;
    fileType: string;
  },
  right: {
    kind: string;
    organizationName: string;
    nestedName: string;
    fileType: string;
  },
): boolean {
  if (
    left.kind.toLowerCase() !== right.kind.toLowerCase() ||
    left.fileType.toLowerCase() !== right.fileType.toLowerCase()
  ) {
    return false;
  }
  const leftOrg = slugify(left.organizationName);
  const rightOrg = slugify(right.organizationName);
  const leftNested = slugify(left.nestedName);
  const rightNested = slugify(right.nestedName);
  if (!leftOrg || !rightOrg || !leftNested || !rightNested) {
    return false;
  }
  return leftOrg === rightOrg && leftNested === rightNested;
}

export function deriveViewFromConfig(config: LoadConfig): DeriveResult {
  return {
    id: config.id,
    publisherName: config.publisherName,
    patterns: {
      preprocess: config.patterns?.preprocess ?? '',
      ingest: config.patterns?.ingest ?? '',
    },
    notification: {
      projectId: config.notification?.projectId ?? '',
      topicId: config.notification?.topicId ?? '',
    },
    destination: { ...config.destination },
    organization: {
      id: config.organization?.id ?? '',
      account: config.organization?.account ?? null,
      type: config.organization?.type ?? '',
    },
    warnings: [],
  };
}

/**
 * Same rules as POST /api/v1/load-configs/derive.
 * Patterns are anchored (`^`…`$`) and `tar.gz` is escaped, matching BuildDerived.
 * A stored document with the derived id produces an `id` warning, including
 * when that document is the one being previewed.
 */
export function deriveLoadConfig(
  input: DeriveRequest,
  organizations: readonly DirectoryOrg[],
  others: readonly KnownConfig[] = [],
): DeriveOutcome {
  const issues = identityIssues(input);
  if (issues.length) {
    return { ok: false, issues };
  }

  const kind = input.kind;
  const fileType = input.fileType;
  const organizationName = input.organizationName.trim();
  const nestedName = input.nestedName.trim();
  const orgSlug = slugify(organizationName);
  const nestedSlug = slugify(nestedName);
  const resolved = resolveOrganization(
    kind,
    organizationName,
    nestedName,
    orgSlug,
    nestedSlug,
    organizations,
    others,
  );
  if (!resolved.ok) {
    return resolved;
  }

  const bucket = kind === 'advertiser' ? 'advertisers' : 'publishers';
  const rawBucket = `dkp-dmc-${bucket}-raw-euw1-dev`;
  const stagingBucket = `dkp-dmc-${bucket}-staging-euw1-dev`;
  const preprocess = preprocessPattern(rawBucket, orgSlug, nestedSlug, fileType);
  const ingest = ingestPattern(stagingBucket, orgSlug, nestedSlug, fileType);
  const id = `${orgSlug}:${nestedSlug}:${fileType}`;
  const tableId = kind === 'publisher' ? (fileType === 'optin' ? 'profiles' : 'optout') : fileType;
  const destination =
    kind === 'advertiser'
      ? {
          projectId: ADVERTISER_DESTINATION_PROJECT,
          datasetId: ADVERTISER_DATASET,
          tableId,
        }
      : {
          projectId: PUBLISHER_DESTINATION_PROJECT,
          datasetId: PUBLISHER_DATASET,
          tableId,
        };

  const warnings = collectWarnings(id, { preprocess, ingest }, others);
  if (resolved.warning) {
    warnings.push(resolved.warning);
  }

  return {
    ok: true,
    result: {
      id,
      publisherName: id,
      patterns: { preprocess, ingest },
      notification: {
        projectId: NOTIFICATION_PROJECT_ID,
        topicId: NOTIFICATION_TOPIC_ID,
      },
      destination,
      organization: resolved.organization,
      warnings,
    },
  };
}

function identityIssues(input: DeriveRequest): FieldMessage[] {
  const issues: FieldMessage[] = [];
  const kind = input.kind?.toLowerCase() ?? '';
  if (kind !== 'advertiser' && kind !== 'publisher') {
    issues.push({ field: 'kind', message: 'kind must be advertiser or publisher' });
  }
  if (!slugify(input.organizationName ?? '')) {
    issues.push({
      field: 'organizationName',
      message: 'organization name is empty after slug normalization',
    });
  }
  if (!slugify(input.nestedName ?? '')) {
    issues.push({
      field: 'nestedName',
      message: 'nested name is empty after slug normalization',
    });
  }
  const fileType = input.fileType?.toLowerCase() ?? '';
  if (!fileType) {
    issues.push({ field: 'fileType', message: 'file type is required' });
  } else if (
    (kind === 'advertiser' || kind === 'publisher') &&
    !isFileTypeForKind(kind, fileType)
  ) {
    issues.push({
      field: 'fileType',
      message: 'file type is not valid for the organization kind',
    });
  } else if (!isImportType(fileType)) {
    issues.push({ field: 'fileType', message: 'file type is not a known import kind' });
  }
  return issues;
}

function resolveOrganization(
  kind: PartnerType,
  organizationName: string,
  nestedName: string,
  orgSlug: string,
  nestedSlug: string,
  organizations: readonly DirectoryOrg[],
  others: readonly KnownConfig[],
):
  | { ok: true; organization: DeriveResult['organization']; warning?: FieldMessage }
  | { ok: false; issues: FieldMessage[] } {
  const org = organizations.find((item) => item.type === kind && slugify(item.name) === orgSlug);
  if (org) {
    if (kind === 'publisher') {
      return {
        ok: true,
        organization: { id: org.id, account: '', type: 'publisher' },
      };
    }
    const account = org.accounts.find((item) => slugify(item.name) === nestedSlug);
    if (!account) {
      return { ok: false, issues: [accountNotFound(nestedName, organizationName)] };
    }
    return {
      ok: true,
      organization: { id: org.id, account: account.id, type: 'advertiser' },
    };
  }

  const match = fallbackMatch(others, kind, orgSlug, nestedSlug);
  if (!match.orgFound) {
    return { ok: false, issues: [organizationNotFound(organizationName, kind)] };
  }
  if (kind === 'advertiser' && (!match.exact || !match.accountId)) {
    return { ok: false, issues: [accountNotFound(nestedName, organizationName)] };
  }
  const warning: FieldMessage = {
    field: 'organization.id',
    message:
      'organization was not in the directory; reused organization id from an existing load config',
  };
  if (kind === 'publisher') {
    return {
      ok: true,
      warning,
      organization: { id: match.orgId, account: '', type: 'publisher' },
    };
  }
  return {
    ok: true,
    warning,
    organization: { id: match.orgId, account: match.accountId, type: 'advertiser' },
  };
}

function fallbackMatch(
  configs: readonly KnownConfig[],
  kind: PartnerType,
  orgSlug: string,
  nestedSlug: string,
): { orgId: string; accountId: string; orgFound: boolean; exact: boolean } {
  const match = { orgId: '', accountId: '', orgFound: false, exact: false };
  const sorted = [...configs].sort((left, right) => left.id.localeCompare(right.id));
  for (const config of sorted) {
    const ident = fallbackIdentity(config);
    if (
      !ident ||
      ident.kind !== kind ||
      ident.organizationName !== orgSlug ||
      !config.organization?.id
    ) {
      continue;
    }
    if (!match.orgFound) {
      match.orgFound = true;
      match.orgId = config.organization.id;
    }
    if (ident.nestedName !== nestedSlug) {
      continue;
    }
    if (!match.exact) {
      match.exact = true;
      match.orgId = config.organization.id;
    }
    if (config.organization.id !== match.orgId) {
      continue;
    }
    const account = (config.organization.account ?? '').trim();
    if (account && !match.accountId) {
      match.accountId = account;
    }
  }
  return match;
}

function fallbackIdentity(config: KnownConfig): ParsedIdentity | null {
  const fromPath = pathIdentity(config.patterns);
  if (fromPath) {
    const kind = partnerOverride(config.organization?.type, fromPath.fileType);
    if (!kind || !isFileTypeForKind(kind, fromPath.fileType)) {
      return null;
    }
    return {
      kind,
      organizationName: fromPath.org,
      nestedName: fromPath.nested,
      fileType: fromPath.fileType,
    };
  }
  return parseIdentity(config);
}

function partnerOverride(type: string | undefined, fileType: ImportType): PartnerType | null {
  if (type === 'publisher' || type === 'advertiser') {
    return type;
  }
  return partnerForFileType(fileType);
}

function organizationNotFound(name: string, kind: string): FieldMessage {
  return {
    field: 'organizationName',
    message: `organization ${quote(name)} (${kind}) was not found`,
  };
}

function accountNotFound(account: string, organization: string): FieldMessage {
  return {
    field: 'nestedName',
    message: `account ${quote(account)} was not found for organization ${quote(organization)}`,
  };
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function collectWarnings(
  id: string,
  patterns: { preprocess: string; ingest: string },
  others: readonly KnownConfig[],
): FieldMessage[] {
  const warnings: FieldMessage[] = [];
  for (const other of others) {
    if (other.id === id) {
      continue;
    }
    const right = [other.patterns?.preprocess, other.patterns?.ingest].filter(
      (pattern): pattern is string => Boolean(pattern),
    );
    if ([patterns.preprocess, patterns.ingest].some((pattern) => right.includes(pattern))) {
      warnings.push({
        field: 'patterns',
        message: `overlaps config ${other.id}; the loader keeps the first match in document id order`,
      });
    }
  }
  if (others.some((other) => other.id === id)) {
    warnings.push({ field: 'id', message: 'a load config with this id already exists' });
  }
  return warnings;
}

function preprocessPattern(
  bucket: string,
  orgSlug: string,
  nestedSlug: string,
  fileType: string,
): string {
  const prefix = `${bucket}/${orgSlug}/${nestedSlug}/${fileType}/`;
  return '^' + quoteMeta(prefix) + '.+' + EXT_PATTERN + '$';
}

function ingestPattern(
  bucket: string,
  orgSlug: string,
  nestedSlug: string,
  fileType: string,
): string {
  const head = `${bucket}/data/`;
  const tail = `/${orgSlug}/${nestedSlug}/${fileType}/`;
  return `^${quoteMeta(head)}${TS_PATTERN}${quoteMeta(tail)}.+$`;
}

function quoteMeta(value: string): string {
  return value.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
}

function pathIdentity(
  patterns: { preprocess?: string; ingest?: string } | undefined,
): { org: string; nested: string; fileType: ImportType } | null {
  return lastPathMatch(patterns?.preprocess ?? '') ?? lastPathMatch(patterns?.ingest ?? '');
}

function lastPathMatch(
  pattern: string,
): { org: string; nested: string; fileType: ImportType } | null {
  const expression =
    /(?:^|\/)([a-z0-9_]+)\/([a-z0-9_]+)\/(optin|optout|blacklists|customers|stores|sales)(?:\/|$)/gi;
  const matches = [...pattern.matchAll(expression)];
  if (!matches.length) {
    return null;
  }
  const last = matches[matches.length - 1];
  const fileType = last[3].toLowerCase();
  if (!isImportType(fileType)) {
    return null;
  }
  return { org: last[1].toLowerCase(), nested: last[2].toLowerCase(), fileType };
}

function identityFor(
  orgType: string | undefined,
  org: string,
  nested: string,
  fileType: ImportType,
): ParsedIdentity | null {
  const kind = partnerOverride(orgType, fileType);
  if (!kind || !isFileTypeForKind(kind, fileType)) {
    return null;
  }
  return { kind, organizationName: org, nestedName: nested, fileType };
}
