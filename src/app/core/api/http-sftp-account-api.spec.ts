import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfig } from '../config/runtime-config';
import { SftpAccountRequest } from '../models/sftp-account.model';
import { HttpSftpAccountApi } from './http-sftp-account-api';

describe('HttpSftpAccountApi', () => {
  const config: RuntimeConfig = { apiBaseUrl: 'http://api.test', useMock: false };
  const body: SftpAccountRequest = {
    user: 'acme',
    base: 'acme_fr',
    clientType: 'advertiser',
    passwordMode: 'generate',
  };

  function setup(): { api: HttpSftpAccountApi; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      api: new HttpSftpAccountApi(TestBed.inject(HttpClient), config),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('calls the sftp account routes and keeps a generated password only in the body', async () => {
    const { api, http } = setup();
    const pendingConfig = firstValueFrom(api.config());
    http.expectOne('http://api.test/api/v1/sftp-accounts/config').flush({
      configured: true,
      clientTypes: { publisher: ['optin'], advertiser: ['sales'] },
      buckets: { publisher: 'pub', advertiser: 'adv' },
    });
    await expect(pendingConfig).resolves.toMatchObject({ configured: true });

    const pendingLookup = firstValueFrom(api.lookup('demo_retail'));
    http.expectOne('http://api.test/api/v1/sftp-accounts/demo_retail').flush({
      username: 'demo_retail',
      exists: false,
      virtualFolders: [],
      bases: [],
    });
    await expect(pendingLookup).resolves.toMatchObject({ exists: false });

    const pendingPreview = firstValueFrom(api.preview(body));
    const preview = http.expectOne('http://api.test/api/v1/sftp-accounts/preview');
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual(body);
    preview.flush({
      ...body,
      bucket: 'adv',
      subfolders: ['sales'],
      folders: [],
      userAction: 'create',
      warnings: [],
    });
    await pendingPreview;

    const pendingCreate = firstValueFrom(api.create(body));
    const created = http.expectOne('http://api.test/api/v1/sftp-accounts');
    expect(created.request.method).toBe('POST');
    created.flush(
      {
        ...body,
        bucket: 'adv',
        subfolders: ['sales'],
        foldersCreated: ['acme/acme_fr/sales'],
        foldersExisting: [],
        userAction: 'created',
        addedVirtualFolders: 1,
        generatedPassword: 'secret-value',
        verified: true,
      },
      { status: 201, statusText: 'Created' },
    );
    const result = await pendingCreate;
    expect(result.generatedPassword).toBe('secret-value');
    expect(result.userAction).toBe('created');
    http.verify();
  });

  it('surfaces 503 as an API exception', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(api.config());
    http
      .expectOne('http://api.test/api/v1/sftp-accounts/config')
      .flush(
        { error: { code: 'service_unavailable', message: 'SFTPGo is not configured' } },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await expect(pending).rejects.toMatchObject({ status: 503, code: 'service_unavailable' });
    http.verify();
  });
});
