import { Observable, of, throwError } from 'rxjs';

import { ApiException } from '../api-error';
import { LoadConfigApi } from '../load-config-api';
import {
  ListQuery,
  ListResponse,
  LoadConfig,
  LoadConfigWrite,
  Meta,
  TemplateListResponse,
  TestPatternRequest,
  TestPatternResult,
  ValidationResult,
} from '../../models/load-config.model';
import { withDerived } from '../../utils/derive';
import { META, TEMPLATES } from './catalog';
import { FIXTURES } from './fixtures';
import { validateConfig } from './validate-config';

export class MockLoadConfigApi implements LoadConfigApi {
  private configs: LoadConfig[];

  constructor(seed: readonly LoadConfig[] = FIXTURES) {
    this.configs = structuredClone(seed).map((item) => withDerived(item));
  }

  list(query: ListQuery): Observable<ListResponse> {
    let items = this.configs.map((item) => withDerived(structuredClone(item)));
    if (!query.includeDeactivated) {
      items = items.filter((item) => !item.deactivated);
    }
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
    return of({ items });
  }

  get(id: string): Observable<LoadConfig> {
    const found = this.configs.find((item) => item.id === id);
    if (!found) {
      return this.fail(404, 'not_found', `Config ${id} was not found.`);
    }
    return of(withDerived(structuredClone(found)));
  }

  create(body: LoadConfigWrite): Observable<LoadConfig> {
    if (this.configs.some((item) => item.id === body.id)) {
      return this.fail(409, 'conflict', `Config ${body.id} already exists.`);
    }
    const validation = this.validationFor(body);
    if (validation.errors.length) {
      return this.fail(422, 'validation_error', validation.errors[0].message, validation);
    }
    const now = new Date().toISOString();
    const created = withDerived({ ...structuredClone(body), createTime: now, updateTime: now });
    this.configs = [...this.configs, created];
    return of(structuredClone(created));
  }

  update(id: string, body: LoadConfigWrite): Observable<LoadConfig> {
    const index = this.configs.findIndex((item) => item.id === id);
    if (index < 0) {
      return this.fail(404, 'not_found', `Config ${id} was not found.`);
    }
    const validation = this.validationFor({ ...body, id });
    if (validation.errors.length) {
      return this.fail(422, 'validation_error', validation.errors[0].message, validation);
    }
    const current = this.configs[index];
    const updated = withDerived({
      ...structuredClone(body),
      id,
      createTime: current.createTime,
      updateTime: new Date().toISOString(),
    });
    this.configs = this.configs.map((item, itemIndex) => (itemIndex === index ? updated : item));
    return of(structuredClone(updated));
  }

  delete(id: string): Observable<void> {
    if (!this.configs.some((item) => item.id === id)) {
      return this.fail(404, 'not_found', `Config ${id} was not found.`);
    }
    this.configs = this.configs.filter((item) => item.id !== id);
    return of(undefined);
  }

  validate(body: LoadConfigWrite): Observable<ValidationResult> {
    return of(this.validationFor(body));
  }

  testPattern(body: TestPatternRequest): Observable<TestPatternResult> {
    let matches = false;
    try {
      matches = new RegExp(body.pattern).test(body.path);
    } catch {
      return this.fail(422, 'invalid_pattern', 'Pattern is not a valid regular expression.');
    }
    const matching = this.configs.find((item) => {
      if (item.deactivated) {
        return false;
      }
      return matchesPattern(item.patterns.ingest, body.path) || matchesPattern(item.patterns.preprocess, body.path);
    });
    return of({ matches, matchingConfigId: matching?.id ?? null });
  }

  templates(): Observable<TemplateListResponse> {
    return of({ items: structuredClone(TEMPLATES) });
  }

  meta(): Observable<Meta> {
    return of(structuredClone(META));
  }

  private validationFor(body: LoadConfigWrite): ValidationResult {
    return validateConfig(body, this.configs, META, TEMPLATES);
  }

  private fail(status: number, code: string, message: string, details?: unknown): Observable<never> {
    return throwError(() => new ApiException(status, code, message, details));
  }
}

function matchesPattern(pattern: string, path: string): boolean {
  try {
    return new RegExp(pattern).test(path);
  } catch {
    return false;
  }
}
