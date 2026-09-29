import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';

import { toApiException } from './api-error';
import { LoadConfigApi } from './load-config-api';
import { RuntimeConfig } from '../config/runtime-config';
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
} from '../models/load-config.model';
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
    return this.http.get<LoadConfig>(this.url(`/api/v1/load-configs/${encodeURIComponent(id)}`)).pipe(
      map((config) => withDerived(config)),
      catchError((error) => throwError(() => toApiException(error))),
    );
  }

  create(body: LoadConfigWrite): Observable<LoadConfig> {
    return this.http.post<LoadConfig>(this.url('/api/v1/load-configs'), toRequestBody(body)).pipe(
      map((config) => withDerived(config)),
      catchError((error) => throwError(() => toApiException(error))),
    );
  }

  update(id: string, body: LoadConfigWrite): Observable<LoadConfig> {
    return this.http
      .put<LoadConfig>(this.url(`/api/v1/load-configs/${encodeURIComponent(id)}`), toRequestBody(body))
      .pipe(
        map((config) => withDerived(config)),
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

  validate(body: LoadConfigWrite): Observable<ValidationResult> {
    return this.http
      .post<ValidationResult>(this.url('/api/v1/load-configs/validate'), toRequestBody(body))
      .pipe(catchError((error) => throwError(() => toApiException(error))));
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

/** Keeps the JSON body inside the OpenAPI LoadConfig schema. Unknown fields are HTTP 400. */
function toRequestBody(body: LoadConfigWrite): LoadConfigWrite {
  const mappings: LoadConfigWrite['mappings'] = {};
  for (const [name, mapping] of Object.entries(body.mappings ?? {})) {
    mappings[name] = {
      src: mapping.src,
      type: mapping.type,
      primaryKey: mapping.primaryKey,
      useInDeleteFilter: mapping.useInDeleteFilter,
      isRequiredPartitionFilter: mapping.isRequiredPartitionFilter,
    };
  }
  return {
    id: body.id,
    publisherName: body.publisherName,
    mode: body.mode,
    patterns: {
      preprocess: body.patterns?.preprocess ?? '',
      ingest: body.patterns?.ingest ?? '',
    },
    destination: { ...body.destination },
    organization: {
      id: body.organization?.id ?? '',
      account: body.organization?.account ?? null,
      type: body.organization?.type ?? '',
    },
    notification: {
      projectId: body.notification?.projectId ?? '',
      topicId: body.notification?.topicId ?? '',
    },
    bqParams: {
      fieldDelimiter: body.bqParams?.fieldDelimiter ?? '',
      skipLeadingRows: body.bqParams?.skipLeadingRows ?? 0,
      nullMarker: body.bqParams?.nullMarker ?? null,
      quote: body.bqParams?.quote ?? '',
      sourceFormat: body.bqParams?.sourceFormat,
    },
    mappings,
  };
}
