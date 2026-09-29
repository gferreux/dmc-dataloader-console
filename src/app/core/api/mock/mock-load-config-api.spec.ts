import { firstValueFrom } from 'rxjs';

import { TAB_DELIMITER } from '../../utils/delimiter';
import { validateConfig } from './validate-config';
import { FIXTURES } from './fixtures';
import { META } from './catalog';
import { MockLoadConfigApi } from './mock-load-config-api';
import { ApiException } from '../api-error';
import { LoadConfig, LoadConfigWrite, PartnerType } from '../../models/load-config.model';

describe('MockLoadConfigApi', () => {
  function api(): MockLoadConfigApi {
    return new MockLoadConfigApi();
  }

  function write(
    config: LoadConfig,
    identity: Omit<LoadConfigWrite, 'mode' | 'bqParams' | 'mappings'>,
  ): LoadConfigWrite {
    return {
      ...identity,
      mode: config.mode,
      bqParams: config.bqParams,
      mappings: config.mappings,
    };
  }

  it('accepts convention fixtures and a legacy document', async () => {
    const client = api();
    const optin = await firstValueFrom(client.get('demo_retail:demo:optin'));
    const sales = await firstValueFrom(client.get('sample_brand:sample:sales'));
    expect(optin.kind).toBe('publisher');
    expect(optin.organizationName).toBe('demo_retail');
    expect(optin.nestedName).toBe('demo');
    expect(optin.fileType).toBe('optin');
    expect(optin.publisherName).toBe(optin.id);
    expect(optin.organization.account).toBe('');
    expect((await firstValueFrom(client.validate(optin))).errors).toEqual([]);
    expect(sales.organization.account).toBe('acc_sample');
    expect((await firstValueFrom(client.validate(sales))).errors).toEqual([]);

    const legacy = await firstValueFrom(client.get('legacy_sample_stores'));
    expect(legacy.kind).toBeUndefined();
    expect(legacy.organizationName).toBeUndefined();
    expect(legacy.nestedName).toBeUndefined();
    expect(legacy.fileType).toBeUndefined();
    expect((await firstValueFrom(client.validate(legacy))).errors).toEqual([]);
    expect(legacy.organization.type).toBe('advertiser');
    expect(legacy.organization.account).toBeNull();
  });

  it('filters by partner, import type and text, in document id order', async () => {
    const all = await firstValueFrom(api().list({}));
    expect(all.items.map((item) => item.id)).toContain('sample_brand:sample:stores');
    expect(all.items.map((item) => item.id)).toContain('legacy_sample_stores');
    expect(all.items.every((item) => item.partnerType && item.importType)).toBe(true);
    const ids = all.items.map((item) => item.id);
    expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)));

    const advertisers = await firstValueFrom(api().list({ partnerType: 'advertiser' }));
    expect(advertisers.items.every((item) => item.partnerType === 'advertiser')).toBe(true);

    const sales = await firstValueFrom(api().list({ importType: 'sales' }));
    expect(sales.items.map((item) => item.id)).toEqual(['sample_brand:sample:sales']);

    const search = await firstValueFrom(api().list({ q: 'profiles' }));
    expect(search.items.map((item) => item.id)).toEqual(['demo_retail:demo:optin']);
  });

  it('keeps a real tab and a null account on the legacy stores config', async () => {
    const stores = await firstValueFrom(api().get('legacy_sample_stores'));
    expect(stores.bqParams.fieldDelimiter).toBe(TAB_DELIMITER);
    expect(stores.bqParams.fieldDelimiter).not.toBe('\\t');
    expect(stores.bqParams.nullMarker).toBeNull();
    expect(stores.bqParams.sourceFormat).toBe(0);
    expect(stores.organization.type).toBe('advertiser');
    expect(stores.organization.account).toBeNull();
    expect(stores.partnerType).toBe('advertiser');
    expect(stores.importType).toBe('stores');
  });

  it('derives plumbing, rejects an unknown organization, and conflicts on an existing id', async () => {
    const client = api();
    const derived = await firstValueFrom(
      client.derive({
        kind: 'advertiser',
        organizationName: 'Sample Brand',
        nestedName: 'Wholesale',
        fileType: 'customers',
      }),
    );
    expect(derived.id).toBe('sample_brand:wholesale:customers');
    expect(derived.destination.tableId).toBe('customers');
    expect(derived.patterns.preprocess).toContain(
      'dkp-dmc-advertisers-raw-euw1-dev/sample_brand/wholesale/customers/',
    );
    expect(derived.patterns.preprocess.startsWith('^')).toBe(true);
    expect(derived.patterns.preprocess.endsWith('$')).toBe(true);
    expect(derived.organization.account).toBe('acc_wholesale');
    expect(derived.publisherName).toBe(derived.id);
    expect(derived.warnings).toEqual([]);

    await expect(
      firstValueFrom(
        client.derive({
          kind: 'publisher',
          organizationName: 'Missing',
          nestedName: 'Demo',
          fileType: 'optin',
        }),
      ),
    ).rejects.toMatchObject({
      status: 422,
      details: [expect.objectContaining({ field: 'organizationName' })],
    } satisfies Partial<ApiException>);

    const existing = FIXTURES.find((item) => item.id === 'demo_retail:demo:optin')!;
    await expect(
      firstValueFrom(
        client.create(
          write(existing, {
            kind: 'publisher',
            organizationName: 'Demo Retail',
            nestedName: 'Demo',
            fileType: 'optin',
          }),
        ),
      ),
    ).rejects.toMatchObject({ status: 409, code: 'conflict' });

    const invalid = write(existing, {
      kind: 'publisher',
      organizationName: 'Demo Retail',
      nestedName: 'Outlet',
      fileType: 'optin',
    });
    invalid.bqParams = { ...invalid.bqParams, sourceFormat: 7 };
    await expect(firstValueFrom(client.create(invalid))).rejects.toMatchObject({ status: 422 });
  });

  it('keeps legacy patterns unless the identity changes', async () => {
    const client = api();
    const legacy = await firstValueFrom(client.get('legacy_sample_stores'));
    const kept = await firstValueFrom(
      client.update(legacy.id, {
        mode: 'OVERWRITE',
        bqParams: legacy.bqParams,
        mappings: legacy.mappings,
      }),
    );
    expect(kept.id).toBe(legacy.id);
    expect(kept.patterns).toEqual(legacy.patterns);
    expect(kept.destination).toEqual(legacy.destination);
    expect(kept.organization.type).toBe('advertiser');
    expect(kept.mode).toBe('OVERWRITE');

    const optin = await firstValueFrom(client.get('demo_retail:demo:optin'));
    const renamed = await firstValueFrom(
      client.update(optin.id, {
        kind: 'publisher',
        organizationName: 'Demo Retail',
        nestedName: 'Outlet',
        fileType: 'optin',
        mode: optin.mode,
        bqParams: optin.bqParams,
        mappings: optin.mappings,
      }),
    );
    expect(renamed.id).toBe('demo_retail:outlet:optin');
    expect(renamed.patterns.ingest).toContain('/demo_retail/outlet/optin/');
    await expect(firstValueFrom(client.get(optin.id))).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a stored referential organization type', () => {
    const current = structuredClone(FIXTURES[0]);
    current.organization = { ...current.organization, type: 'referential' };
    const report = validateConfig(current, FIXTURES, META);
    expect(report.errors.some((issue) => issue.field === 'organization.type')).toBe(true);
  });

  it('warns on an unanchored regex in the document validator', () => {
    const current = structuredClone(FIXTURES[0]);
    current.patterns = { ...current.patterns, ingest: 'demo-bucket/publisher/optin/.*\\.csv' };
    const warnings = validateConfig(current, FIXTURES, META);
    expect(warnings.warnings.some((issue) => issue.field === 'patterns.ingest')).toBe(true);
  });

  it('lists organizations, bases, and accounts', async () => {
    const client = api();
    const publishers = await firstValueFrom(client.organizations('publisher'));
    expect(publishers.map((item) => item.slug)).toEqual(['demo_retail']);
    const bases = await firstValueFrom(client.bases('demo_retail'));
    expect(bases).toEqual([{ name: 'demo', slug: 'demo' }]);
    expect(bases[0].id).toBeUndefined();
    await expect(firstValueFrom(client.organizations('nope' as PartnerType))).rejects.toMatchObject(
      { status: 400, code: 'bad_request' },
    );
    const accounts = await firstValueFrom(client.accounts('org_sample_brand'));
    expect(accounts.map((item) => item.slug)).toEqual(['sample', 'wholesale']);
  });

  it('tests a pattern and reports the first config that matches the path', async () => {
    const sales = FIXTURES.find((item) => item.id === 'sample_brand:sample:sales')!;
    const result = await firstValueFrom(
      api().testPattern({
        pattern: sales.patterns.ingest,
        path: 'dkp-dmc-advertisers-staging-euw1-dev/data/2026-04-18T14:30:00Z/sample_brand/sample/sales/orders.csv',
      }),
    );
    expect(result.matches).toBe(true);
    expect(result.matchingConfigId).toBe('sample_brand:sample:sales');
  });

  it('deletes a config', async () => {
    const client = api();
    const current = await firstValueFrom(client.get('demo_retail:demo:optout'));
    await firstValueFrom(client.delete(current.id));
    await expect(firstValueFrom(client.get(current.id))).rejects.toMatchObject({ status: 404 });
  });
});
