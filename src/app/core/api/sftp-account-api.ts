import { HttpClient } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { RuntimeConfig } from '../config/runtime-config';
import {
  SftpAccountConfig,
  SftpAccountLookup,
  SftpAccountPreview,
  SftpAccountRequest,
  SftpAccountResult,
} from '../models/sftp-account.model';
import { HttpSftpAccountApi } from './http-sftp-account-api';
import { MockSftpAccountApi } from './mock/mock-sftp-account-api';

export interface SftpAccountApi {
  config(): Observable<SftpAccountConfig>;
  lookup(username: string): Observable<SftpAccountLookup>;
  preview(body: SftpAccountRequest): Observable<SftpAccountPreview>;
  create(body: SftpAccountRequest): Observable<SftpAccountResult>;
}

export const SFTP_ACCOUNT_API = new InjectionToken<SftpAccountApi>('SFTP_ACCOUNT_API');

export function sftpAccountApiFactory(http: HttpClient, config: RuntimeConfig): SftpAccountApi {
  return config.useMock ? new MockSftpAccountApi() : new HttpSftpAccountApi(http, config);
}
