import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfig } from '../config/runtime-config';
import { TAB_DELIMITER } from '../utils/delimiter';
import { HttpLoadConfigApi } from './http-load-config-api';
import { FIXTURES } from './mock/fixtures';

describe('HttpLoadConfigApi', () => {
  const config: RuntimeConfig = { apiBaseUrl: 'http://api.test', useMock: false };

  function setup(): { api: HttpLoadConfigApi; http: HttpTestingController } {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      api: new HttpLoadConfigApi(TestBed.inject(HttpClient), config),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('lists with the contract query string and encodes ids', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(
      api.list({ partnerType: 'publisher', q: 'demo', includeDeactivated: false }),
    );
    const request = http.expectOne(
      'http://api.test/api/v1/load-configs?includeDeactivated=false&partnerType=publisher&q=demo',
    );
    request.flush({ items: [FIXTURES[0]] });
    const body = await pending;
    expect(body.items[0].partnerType).toBe('publisher');

    const remove = firstValueFrom(api.delete('demo_retail:demo:optin'));
    const deleted = http.expectOne('http://api.test/api/v1/load-configs/demo_retail%3Ademo%3Aoptin');
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush('', { status: 204, statusText: 'No Content' });
    await remove;
    http.verify();
  });

  it('posts validate and sends a real tab character', async () => {
    const { api, http } = setup();
    const payload = structuredClone(FIXTURES[4]);
    expect(payload.bqParams.fieldDelimiter).toBe(TAB_DELIMITER);
    const pending = firstValueFrom(api.validate(payload));
    const request = http.expectOne('http://api.test/api/v1/load-configs/validate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.bqParams.fieldDelimiter).toBe('\t');
    expect(JSON.stringify(request.request.body.bqParams)).toContain('\\t');
    request.flush({ errors: [], warnings: [] });
    await pending;
    http.verify();
  });

  it('maps the error envelope', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(api.get('missing'));
    http.expectOne('http://api.test/api/v1/load-configs/missing').flush(
      { error: { code: 'not_found', message: 'Missing config', details: { id: 'missing' } } },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(pending).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Missing config',
    });
    http.verify();
  });
});
