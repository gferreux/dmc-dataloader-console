import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

import { RuntimeConfig } from '../config/runtime-config';
import {
  SftpAccountConfig,
  SftpAccountLookup,
  SftpAccountPreview,
  SftpAccountRequest,
  SftpAccountResult,
} from '../models/sftp-account.model';
import { toApiException } from './api-error';
import { SftpAccountApi } from './sftp-account-api';

export class HttpSftpAccountApi implements SftpAccountApi {
  constructor(
    private readonly http: HttpClient,
    private readonly runtime: RuntimeConfig,
  ) {}

  config(): Observable<SftpAccountConfig> {
    return this.http
      .get<SftpAccountConfig>(this.url('/api/v1/sftp-accounts/config'))
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  lookup(username: string): Observable<SftpAccountLookup> {
    return this.http
      .get<SftpAccountLookup>(this.url(`/api/v1/sftp-accounts/${encodeURIComponent(username)}`))
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  preview(body: SftpAccountRequest): Observable<SftpAccountPreview> {
    return this.http
      .post<SftpAccountPreview>(this.url('/api/v1/sftp-accounts/preview'), body)
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  create(body: SftpAccountRequest): Observable<SftpAccountResult> {
    return this.http
      .post<SftpAccountResult>(this.url('/api/v1/sftp-accounts'), body)
      .pipe(catchError((error) => throwError(() => toApiException(error))));
  }

  private url(path: string): string {
    return `${this.runtime.apiBaseUrl.replace(/\/$/, '')}${path}`;
  }
}
