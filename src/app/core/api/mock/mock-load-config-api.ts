import { Observable, of, throwError } from 'rxjs';

import { ApiException } from '../api-error';
import { LoadConfigApi } from '../load-config-api';
import { materialize, sanitizeBqParams, sanitizeMappings } from '../write-body';
import {
  DeriveRequest,
  DeriveResult,
  ListQuery,
  ListResponse,
  LoadConfig,
  LoadConfigUpdate,
  LoadConfigWrite,
  Meta,
  NestedSummary,
  OrganizationSummary,
  PartnerType,
  TemplateListResponse,
  TestPatternRequest,
  TestPatternResult,
  ValidationResult,
  isIdentityWrite,
} from '../../models/load-config.model';
import { withDerived } from '../../utils/derive';
import { slugify } from '../../utils/slug';
import { deriveLoadConfig, parseIdentity, presented, sameIdentity } from '../../utils/plumbing';
import { META, TEMPLATES } from './catalog';
import { FIXTURES } from './fixtures';
import { ORGANIZATIONS } from './organizations';
import { validateConfig } from './validate-config';

export class MockLoadConfigApi implements LoadConfigApi {
  private configs: LoadConfig[];

  constructor(seed: readonly LoadConfig[] = FIXTURES) {
    this.configs = structuredClone(seed).map((item) => withDerived(item));
  }

  list(query: ListQuery): Observable<ListResponse> {
    let items = this.configs.map((item) => this.view(item));
    if (query.partnerType) {
      items = items.filter((item) => item.partnerType === query.partnerType);
    }
    if (query.importType) {
      items = items.filter((item) => item.importType === query.importType);
    }
    const term = query.q?.trim().toLowerCase();
    if (term) {
      items = items.filter((item) => {
        const table = `${item.destination.datasetId}.${item.destination.tableId}`.toLowerCase();
        return (
          item.id.toLowerCase().includes(term) ||
          item.publisherName.toLowerCase().includes(term) ||
          table.includes(term) ||
          item.destination.tableId.toLowerCase().includes(term)
        );
      });
    }
    items.sort((left, right) => left.id.localeCompare(right.id));
    return of({ items });
  }

  get(id: string): Observable<LoadConfig> {
    const found = this.configs.find((item) => item.id === id);
    if (!found) {
      return this.fail(404, 'not_found', `Config ${id} was not found.`);
    }
    return of(this.view(found));
  }

  create(body: LoadConfigWrite): Observable<LoadConfig> {
    const derived = this.requireDerived(body);
    if (derived instanceof ApiException) {
      return throwError(() => derived);
    }
    if (this.configs.some((item) => item.id === derived.id)) {
      return this.fail(409, 'conflict', `Config ${derived.id} already exists.`);
    }
    const created = withDerived({
      ...materialize(derived, body),
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    });
    const validation = validateConfig(created, this.configs, META);
    if (validation.errors.length) {
      return this.fail(422, 'validation_error', validation.errors[0].message, validation.errors);
    }
    this.configs = [...this.configs, created];
    return of(this.view(created));
  }

  update(id: string, body: LoadConfigUpdate): Observable<LoadConfig> {
    const index = this.configs.findIndex((item) => item.id === id);
    if (index < 0) {
      return this.fail(404, 'not_found', `Config ${id} was not found.`);
    }
    const current = this.configs[index];
    const updated = this.nextDocument(current, body);
    if (updated instanceof ApiException) {
      return throwError(() => updated);
    }
    const others = this.configs.filter((item) => item.id !== id);
    const validation = validateConfig(updated, others, META);
    if (validation.errors.length) {
      return this.fail(422, 'validation_error', validation.errors[0].message, validation.errors);
    }
    this.configs = [...others.filter((item) => item.id !== updated.id), updated];
    return of(this.view(updated));
  }

  delete(id: string): Observable<void> {
    if (!this.configs.some((item) => item.id === id)) {
      return this.fail(404, 'not_found', `Config ${id} was not found.`);
    }
    this.configs = this.configs.filter((item) => item.id !== id);
    return of(undefined);
  }

  validate(body: LoadConfig): Observable<ValidationResult> {
    return of(validateConfig(body, this.configs, META));
  }

  derive(body: DeriveRequest): Observable<DeriveResult> {
    const outcome = deriveLoadConfig(body, ORGANIZATIONS, this.configs);
    if (!outcome.ok) {
      const message = outcome.issues[0]?.message ?? 'Validation failed';
      return this.fail(422, 'validation_error', message, outcome.issues);
    }
    return of(outcome.result);
  }

  organizations(type: PartnerType): Observable<OrganizationSummary[]> {
    if (type !== 'advertiser' && type !== 'publisher') {
      return this.fail(400, 'bad_request', 'type must be advertiser or publisher');
    }
    return of(
      ORGANIZATIONS.filter((org) => org.type === type).map(({ id, name, slug }) => ({
        id,
        name,
        slug,
      })),
    );
  }

  accounts(organizationId: string): Observable<NestedSummary[]> {
    const org = ORGANIZATIONS.find((item) => item.id === organizationId);
    return of(
      org ? org.accounts.map((item) => ({ id: item.id, name: item.name, slug: item.slug })) : [],
    );
  }

  bases(slug: string): Observable<NestedSummary[]> {
    return of(basesFromConfigs(this.configs, slug));
  }

  testPattern(body: TestPatternRequest): Observable<TestPatternResult> {
    const pattern = body.pattern?.trim() ?? '';
    if (!pattern) {
      return this.fail(422, 'validation_error', 'pattern is required');
    }
    let matches = false;
    try {
      matches = new RegExp(pattern).test(body.path);
    } catch {
      return this.fail(422, 'validation_error', 'pattern is not a valid regex');
    }
    const matching = [...this.configs]
      .sort((left, right) => left.id.localeCompare(right.id))
      .find(
        (item) =>
          matchesPattern(item.patterns.ingest, body.path) ||
          matchesPattern(item.patterns.preprocess, body.path),
      );
    return of({ matches, matchingConfigId: matching?.id ?? null });
  }

  templates(): Observable<TemplateListResponse> {
    return of({ items: structuredClone(TEMPLATES) });
  }

  meta(): Observable<Meta> {
    return of(structuredClone(META));
  }

  private requireDerived(body: LoadConfigWrite): DeriveResult | ApiException {
    const outcome = deriveLoadConfig(body, ORGANIZATIONS, this.configs);
    if (!outcome.ok) {
      return new ApiException(
        422,
        'validation_error',
        outcome.issues[0]?.message ?? 'Validation failed',
        outcome.issues,
      );
    }
    return outcome.result;
  }

  private view(config: LoadConfig): LoadConfig {
    return presented(withDerived(structuredClone(config)));
  }

  private nextDocument(current: LoadConfig, body: LoadConfigUpdate): LoadConfig | ApiException {
    const now = new Date().toISOString();
    const kept = withDerived({
      ...structuredClone(current),
      mode: body.mode,
      bqParams: sanitizeBqParams(body.bqParams),
      mappings: sanitizeMappings(body.mappings),
      updateTime: now,
    });
    if (!isIdentityWrite(body)) {
      return kept;
    }
    const parsed = parseIdentity(current);
    if (parsed && sameIdentity(parsed, body)) {
      return kept;
    }
    const derived = this.requireDerived(body);
    if (derived instanceof ApiException) {
      return derived;
    }
    if (this.configs.some((item) => item.id === derived.id && item.id !== current.id)) {
      return new ApiException(409, 'conflict', 'load config already exists');
    }
    return withDerived({
      id: derived.id,
      publisherName: derived.publisherName,
      patterns: derived.patterns,
      destination: derived.destination,
      organization: derived.organization,
      notification: derived.notification,
      mode: body.mode,
      bqParams: sanitizeBqParams(body.bqParams),
      mappings: sanitizeMappings(body.mappings),
      createTime: current.createTime,
      updateTime: now,
    });
  }

  private fail(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ): Observable<never> {
    return throwError(() => new ApiException(status, code, message, details));
  }
}

function basesFromConfigs(configs: readonly LoadConfig[], slug: string): NestedSummary[] {
  const wanted = slugify(slug);
  if (!wanted) {
    return [];
  }
  const seen = new Map<string, NestedSummary>();
  for (const config of configs) {
    const ident = parseIdentity(config);
    if (!ident || ident.kind !== 'publisher' || ident.organizationName !== wanted) {
      continue;
    }
    if (config.organization?.type === 'advertiser') {
      continue;
    }
    if (!seen.has(ident.nestedName)) {
      seen.set(ident.nestedName, { name: ident.nestedName, slug: ident.nestedName });
    }
  }
  return [...seen.values()].sort((left, right) => left.slug.localeCompare(right.slug));
}

function matchesPattern(pattern: string, path: string): boolean {
  try {
    return new RegExp(pattern).test(path);
  } catch {
    return false;
  }
}
