import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { RuntimeConfig } from '../config/runtime-config';
import { LoadConfig, LoadConfigWrite } from '../models/load-config.model';
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

  const salesWrite: LoadConfigWrite = {
    kind: 'advertiser',
    organizationName: 'Sample Brand',
    nestedName: 'Sample',
    fileType: 'sales',
    mode: 'APPEND',
    bqParams: {
      fieldDelimiter: TAB_DELIMITER,
      skipLeadingRows: 1,
      nullMarker: null,
      quote: '"',
      sourceFormat: 0,
    },
    mappings: { order_id: { src: 'order_id', type: 0, primaryKey: true } },
  };

  it('lists with the contract query string and encodes ids', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(api.list({ partnerType: 'publisher', q: 'demo' }));
    const request = http.expectOne(
      'http://api.test/api/v1/load-configs?partnerType=publisher&q=demo',
    );
    request.flush({ items: [FIXTURES[0]] });
    const body = await pending;
    expect(body.items[0].partnerType).toBe('publisher');

    const remove = firstValueFrom(api.delete('demo_retail:demo:optin'));
    const deleted = http.expectOne(
      'http://api.test/api/v1/load-configs/demo_retail%3Ademo%3Aoptin',
    );
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush('', { status: 204, statusText: 'No Content' });
    await remove;
    http.verify();
  });

  it('posts a create body without derived plumbing and validates a full document', async () => {
    const { api, http } = setup();
    const document: LoadConfig = {
      id: 'sample_brand:sample:sales',
      publisherName: 'sample_brand:sample:sales',
      mode: salesWrite.mode,
      patterns: { preprocess: '^pre$', ingest: '^in$' },
      destination: { projectId: 'p', datasetId: 'd', tableId: 'sales' },
      organization: { id: 'org_sample_brand', account: 'acc_sample', type: 'advertiser' },
      notification: { projectId: 'proj', topicId: 'topic' },
      bqParams: salesWrite.bqParams,
      mappings: salesWrite.mappings,
      kind: 'advertiser',
      organizationName: 'sample_brand',
      nestedName: 'sample',
      fileType: 'sales',
    };
    const pending = firstValueFrom(api.validate(document));
    const request = http.expectOne('http://api.test/api/v1/load-configs/validate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.id).toBe('sample_brand:sample:sales');
    expect(request.request.body.publisherName).toBe('sample_brand:sample:sales');
    expect(request.request.body.patterns).toEqual(document.patterns);
    expect(request.request.body.organization.account).toBe('acc_sample');
    expect(request.request.body.bqParams.fieldDelimiter).toBe('\t');
    expect(request.request.body).not.toHaveProperty('kind');
    expect(request.request.body).not.toHaveProperty('organizationName');
    expect(request.request.body).not.toHaveProperty('partnerType');
    expect(request.request.body).not.toHaveProperty('deactivated');
    expect(request.request.body.mappings.order_id).not.toHaveProperty('isPartitionKey');
    request.flush({ errors: [], warnings: [] });
    await pending;

    const created = firstValueFrom(api.create(salesWrite));
    const createRequest = http.expectOne('http://api.test/api/v1/load-configs');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(salesWrite);
    expect(createRequest.request.body).not.toHaveProperty('id');
    expect(createRequest.request.body).not.toHaveProperty('publisherName');
    createRequest.flush(document, {
      status: 201,
      statusText: 'Created',
      headers: { Location: '/api/v1/load-configs/sample_brand%3Asample%3Asales' },
    });
    expect((await created).id).toBe('sample_brand:sample:sales');
    http.verify();
  });

  it('calls derive, organizations, accounts, and publisher bases', async () => {
    const { api, http } = setup();
    const derived = firstValueFrom(
      api.derive({
        kind: 'publisher',
        organizationName: 'Demo Retail',
        nestedName: 'Demo',
        fileType: 'optin',
      }),
    );
    const deriveRequest = http.expectOne('http://api.test/api/v1/load-configs/derive');
    expect(deriveRequest.request.body).toEqual({
      kind: 'publisher',
      organizationName: 'Demo Retail',
      nestedName: 'Demo',
      fileType: 'optin',
    });
    deriveRequest.flush({
      id: 'demo_retail:demo:optin',
      publisherName: 'Demo Retail',
      patterns: { preprocess: 'pre', ingest: 'in' },
      notification: { projectId: 'proj', topicId: 'topic' },
      destination: { projectId: 'p', datasetId: 'd', tableId: 'profiles' },
      organization: { id: 'org_demo_retail', account: 'demo', type: 'publisher' },
      warnings: [],
    });
    expect((await derived).destination.tableId).toBe('profiles');

    const orgs = firstValueFrom(api.organizations('advertiser'));
    const orgRequest = http.expectOne('http://api.test/api/v1/organizations?type=advertiser');
    orgRequest.flush([{ id: 'org_sample_brand', name: 'Sample Brand', slug: 'sample_brand' }]);
    expect(await orgs).toEqual([
      { id: 'org_sample_brand', name: 'Sample Brand', slug: 'sample_brand' },
    ]);

    const accounts = firstValueFrom(api.accounts('org_sample_brand'));
    http
      .expectOne('http://api.test/api/v1/organizations/org_sample_brand/accounts')
      .flush([{ id: 'acc_sample', name: 'Sample', slug: 'sample' }]);
    expect((await accounts)[0].slug).toBe('sample');

    const bases = firstValueFrom(api.bases('demo_retail'));
    const basesRequest = http.expectOne(
      'http://api.test/api/v1/organizations/demo_retail/bases?type=publisher',
    );
    basesRequest.flush([{ name: 'demo', slug: 'demo' }]);
    expect(await bases).toEqual([{ name: 'demo', slug: 'demo' }]);
    http.verify();
  });

  it('maps the error envelope', async () => {
    const { api, http } = setup();
    const pending = firstValueFrom(api.get('missing'));
    http
      .expectOne('http://api.test/api/v1/load-configs/missing')
      .flush(
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
