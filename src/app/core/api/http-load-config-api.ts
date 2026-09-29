import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';

import { toApiException } from './api-error';
import { LoadConfigApi } from './load-config-api';
import { toDocumentBody, toWriteBody } from './write-body';
import { RuntimeConfig } from '../config/runtime-config';
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
} from '../models/load-config.model';
import { slugify } from '../utils/slug';
import { withDerived } from '../utils/derive';

export class HttpLoadConfigApi implements LoadConfigApi {
  constructor(
    private readonly http: HttpClient,
    private readonly config: RuntimeConfig,
  ) {}

  list(query: ListQuery): Observable<ListResponse> {
    let params = new HttpParams();
    if (query.partnerType) {
      params = params.set('partnerType', query.partnerType);
    }
    if (query.importType) {
      params = params.set('importType', query.importType);
    }
    if (query.q) {
      params = params.set('q', query.q);
    }
    return this.http.get<ListResponse>(this.url('/api/v1/load-configs'), { params }).pipe(
      map((body) => ({ items: (body.items ?? []).map((item) => withDerived(item)) })),
      catchError((error) => throwError(() => toApiException(error))),
    );
  }

  get(id: string): Observable<LoadConfig> {
    return this.http
      .get<LoadConfig>(this.url(`/api/v1/load-configs/${encodeURIComponent(id)}`))
      .pipe(
        map((config) => withDerived(config)),
        catchError((error) => throwError(() => toApiException(error))),
      );
  }

  create(body: LoadConfigWrite): Observable<LoadConfig> {
    return this.http
      .post<LoadConfig>(this.url('/api/v1/load-configs'), toWriteBody(body), {
        observe: 'response',
      })
      .pipe(
        map((response) =>
          withDerived(applyLocation(response.body, response.headers.get('Location'))),
        ),
        catchError((error) => throwError(() => toApiException(error))),
      );
  }

  update(id: string, body: LoadConfigUpdate): Observable<LoadConfig> {
    return this.http
      .put<LoadConfig>(
        this.url(`/api/v1/load-configs/${encodeURIComponent(id)}`),
        toWriteBody(body),
        { observe: 'response' },
      )
      .pipe(
        map((response) =>
          withDerived(applyLocation(response.body, response.headers.get('Location'))),
        ),
        catchError((error) => throwError(() => toApiException(error))),
      );
  }

  delete(id: string): Observable<void> {
    return this.http
      .delete(this.url(`/api/v1/load-configs/${encodeURIComponent(id)}`), {
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        map(() => undefined),
        catchError((error) => throwError(() => toApiException(error))),
      );
  }

  validate(body: LoadConfig): Observable<ValidationResult> {
    return this.http
      .post<ValidationResult>(this.url('/api/v1/load-configs/validate'), toDocumentBody(body))
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  derive(body: DeriveRequest): Observable<DeriveResult> {
    return this.http
      .post<DeriveResult>(this.url('/api/v1/load-configs/derive'), {
        kind: body.kind,
        organizationName: body.organizationName,
        nestedName: body.nestedName,
        fileType: body.fileType,
      })
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  organizations(type: PartnerType): Observable<OrganizationSummary[]> {
    const params = new HttpParams().set('type', type);
    return this.http.get<OrganizationSummary[]>(this.url('/api/v1/organizations'), { params }).pipe(
      map((body) => asList(body)),
      catchError((error) => throwError(() => toApiException(error))),
    );
  }

  accounts(organizationId: string): Observable<NestedSummary[]> {
    return this.http
      .get<NestedSummary[]>(
        this.url(`/api/v1/organizations/${encodeURIComponent(organizationId)}/accounts`),
      )
      .pipe(
        map((body) => nestedList(asList(body))),
        catchError((error) => throwError(() => toApiException(error))),
      );
  }

  bases(slug: string): Observable<NestedSummary[]> {
    const params = new HttpParams().set('type', 'publisher');
    return this.http
      .get<NestedSummary[]>(this.url(`/api/v1/organizations/${encodeURIComponent(slug)}/bases`), {
        params,
      })
      .pipe(
        map((body) => nestedList(asList(body))),
        catchError((error) => throwError(() => toApiException(error))),
      );
  }

  testPattern(body: TestPatternRequest): Observable<TestPatternResult> {
    return this.http
      .post<TestPatternResult>(this.url('/api/v1/load-configs/test-pattern'), body)
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  templates(): Observable<TemplateListResponse> {
    return this.http
      .get<TemplateListResponse>(this.url('/api/v1/templates'))
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  meta(): Observable<Meta> {
    return this.http
      .get<Meta>(this.url('/api/v1/meta'))
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  private url(path: string): string {
    return `${this.config.apiBaseUrl.replace(/\/$/, '')}${path}`;
  }
}

function asList<T>(body: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(body)) {
    return body;
  }
  return body?.items ?? [];
}

function nestedList(items: NestedSummary[]): NestedSummary[] {
  return items.map((item) => {
    const row: NestedSummary = {
      name: item.name,
      slug: item.slug || slugify(item.name),
    };
    if (item.id) {
      row.id = item.id;
    }
    return row;
  });
}

function applyLocation(body: LoadConfig | null, location: string | null): LoadConfig {
  if (!body) {
    throw new Error('Empty response');
  }
  const id = idFromLocation(location);
  return id ? { ...body, id } : body;
}

function idFromLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const segment = location.split('?')[0].replace(/\/$/, '').split('/').pop();
  if (!segment) {
    return null;
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
