import { HttpClient } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

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
import { HttpLoadConfigApi } from './http-load-config-api';
import { MockLoadConfigApi } from './mock/mock-load-config-api';

export interface LoadConfigApi {
  list(query: ListQuery): Observable<ListResponse>;
  get(id: string): Observable<LoadConfig>;
  create(body: LoadConfigWrite): Observable<LoadConfig>;
  update(id: string, body: LoadConfigWrite): Observable<LoadConfig>;
  delete(id: string): Observable<void>;
  validate(body: LoadConfigWrite): Observable<ValidationResult>;
  testPattern(body: TestPatternRequest): Observable<TestPatternResult>;
  templates(): Observable<TemplateListResponse>;
  meta(): Observable<Meta>;
}

export const LOAD_CONFIG_API = new InjectionToken<LoadConfigApi>('LOAD_CONFIG_API');

export function loadConfigApiFactory(http: HttpClient, config: RuntimeConfig): LoadConfigApi {
  return config.useMock ? new MockLoadConfigApi() : new HttpLoadConfigApi(http, config);
}
