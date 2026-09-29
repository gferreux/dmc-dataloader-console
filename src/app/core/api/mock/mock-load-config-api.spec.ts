import { firstValueFrom } from 'rxjs';

import { TAB_DELIMITER } from '../../utils/delimiter';
import { FIXTURES } from './fixtures';
import { MockLoadConfigApi } from './mock-load-config-api';
import { ApiException } from '../api-error';

describe('MockLoadConfigApi', () => {
  function api(): MockLoadConfigApi {
    return new MockLoadConfigApi();
  }

  it('accepts writable fixtures and reports a legacy organization type', async () => {
    const client = api();
    for (const fixture of FIXTURES) {
      const result = await firstValueFrom(client.validate(fixture));
      if (fixture.organization.type === 'referential') {
        expect(result.errors.map((issue) => issue.field)).toEqual(['organization.type']);
      } else {
        expect(result.errors).toEqual([]);
      }
    }
  });

  it('filters by partner, import type and text, in document id order', async () => {
    const all = await firstValueFrom(api().list({}));
    expect(all.items.map((item) => item.id)).toContain('sample_brand:sample:stores');
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

  it('keeps a real tab, a null marker, and a legacy organization type on stores', async () => {
    const stores = await firstValueFrom(api().get('sample_brand:sample:stores'));
    expect(stores.bqParams.fieldDelimiter).toBe(TAB_DELIMITER);
    expect(stores.bqParams.fieldDelimiter).not.toBe('\\t');
    expect(stores.bqParams.nullMarker).toBeNull();
    expect(stores.bqParams.sourceFormat).toBe(0);
    expect(stores.organization.type).toBe('referential');
    expect(stores.organization.account).toBeNull();
    expect(stores.partnerType).toBe('advertiser');
    expect(stores.importType).toBe('stores');
  });

  it('returns 409 when the id already exists and 422 when validation fails', async () => {
    const client = api();
    const existing = structuredClone(FIXTURES[0]);
    await expect(firstValueFrom(client.create(existing))).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
    } satisfies Partial<ApiException>);

    const invalid = structuredClone(existing);
    invalid.id = 'new_partner:new:optin';
    invalid.bqParams.sourceFormat = 7;
    await expect(firstValueFrom(client.create(invalid))).rejects.toMatchObject({ status: 422 });
  });

  it('blocks save-level validation on errors and warns on an unanchored regex', async () => {
    const client = api();
    const current = await firstValueFrom(client.get('demo_retail:demo:optin'));
    const broken = { ...current, publisherName: '' };
    const errors = await firstValueFrom(client.validate(broken));
    expect(errors.errors.some((issue) => issue.field === 'publisherName')).toBe(true);

    const unanchored = {
      ...current,
      patterns: { ...current.patterns, ingest: 'demo-bucket/publisher/optin/.*\\.csv' },
    };
    const warnings = await firstValueFrom(client.validate(unanchored));
    expect(warnings.errors).toEqual([]);
    expect(warnings.warnings.some((issue) => issue.field === 'patterns.ingest')).toBe(true);
  });

  it('tests a pattern and reports the first active config that matches the path', async () => {
    const result = await firstValueFrom(
      api().testPattern({
        pattern: '^demo-bucket/publisher/optin/.*\\.csv$',
        path: 'demo-bucket/publisher/optin/sample.csv',
      }),
    );
    expect(result.matches).toBe(true);
    expect(result.matchingConfigId).toBe('demo_retail:demo:optin');
  });

  it('deletes a config', async () => {
    const client = api();
    const current = await firstValueFrom(client.get('demo_retail:demo:optout'));
    await firstValueFrom(client.delete(current.id));
    await expect(firstValueFrom(client.get(current.id))).rejects.toMatchObject({ status: 404 });
  });
});
