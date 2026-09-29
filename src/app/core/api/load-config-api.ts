import { HttpClient } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

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
import { HttpLoadConfigApi } from './http-load-config-api';
import { MockLoadConfigApi } from './mock/mock-load-config-api';

export interface LoadConfigApi {
  list(query: ListQuery): Observable<ListResponse>;
  get(id: string): Observable<LoadConfig>;
  create(body: LoadConfigWrite): Observable<LoadConfig>;
  update(id: string, body: LoadConfigUpdate): Observable<LoadConfig>;
  delete(id: string): Observable<void>;
  /** Full stored document. Create and update still send `LoadConfigWrite`. */
  validate(body: LoadConfig): Observable<ValidationResult>;
  derive(body: DeriveRequest): Observable<DeriveResult>;
  organizations(type: PartnerType): Observable<OrganizationSummary[]>;
  accounts(organizationId: string): Observable<NestedSummary[]>;
  bases(slug: string): Observable<NestedSummary[]>;
  testPattern(body: TestPatternRequest): Observable<TestPatternResult>;
  templates(): Observable<TemplateListResponse>;
  meta(): Observable<Meta>;
}

export const LOAD_CONFIG_API = new InjectionToken<LoadConfigApi>('LOAD_CONFIG_API');

export function loadConfigApiFactory(http: HttpClient, config: RuntimeConfig): LoadConfigApi {
  return config.useMock ? new MockLoadConfigApi() : new HttpLoadConfigApi(http, config);
}
