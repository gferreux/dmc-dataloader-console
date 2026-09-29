import { firstValueFrom } from 'rxjs';

import { TAB_DELIMITER } from '../../utils/delimiter';
import { FIXTURES } from './fixtures';
import { MockLoadConfigApi } from './mock-load-config-api';
import { ApiException } from '../api-error';

describe('MockLoadConfigApi', () => {
  function api(): MockLoadConfigApi {
    return new MockLoadConfigApi();
  }

  it('accepts every sanitized fixture', async () => {
    const client = api();
    for (const fixture of FIXTURES) {
      const result = await firstValueFrom(client.validate(fixture));
      expect(result.errors).toEqual([]);
    }
  });

  it('filters by partner, import type, text and active state', async () => {
    const active = await firstValueFrom(api().list({ includeDeactivated: false }));
    expect(active.items.map((item) => item.id)).not.toContain('sample_brand:sample:stores');
    expect(active.items.every((item) => item.partnerType && item.importType)).toBe(true);

    const advertisers = await firstValueFrom(
      api().list({ partnerType: 'advertiser', includeDeactivated: true }),
    );
    expect(advertisers.items.every((item) => item.partnerType === 'advertiser')).toBe(true);

    const sales = await firstValueFrom(api().list({ importType: 'sales', includeDeactivated: true }));
    expect(sales.items.map((item) => item.id)).toEqual(['sample_brand:sample:sales']);

    const search = await firstValueFrom(api().list({ q: 'profiles', includeDeactivated: true }));
    expect(search.items.map((item) => item.id)).toEqual(['demo_retail:demo:optin']);
  });

  it('keeps a real tab delimiter on the stores fixture', async () => {
    const stores = await firstValueFrom(api().get('sample_brand:sample:stores'));
    expect(stores.bqParams.fieldDelimiter).toBe(TAB_DELIMITER);
    expect(stores.bqParams.fieldDelimiter).not.toBe('\\t');
    expect(stores.deactivated).toBe(true);
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
    invalid.bqParams.fieldDelimiter = '\\t';
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

  it('deletes a config and updates the deactivated flag', async () => {
    const client = api();
    const current = await firstValueFrom(client.get('demo_retail:demo:optout'));
    const updated = await firstValueFrom(client.update(current.id, { ...current, deactivated: true }));
    expect(updated.deactivated).toBe(true);
    await firstValueFrom(client.delete(current.id));
    await expect(firstValueFrom(client.get(current.id))).rejects.toMatchObject({ status: 404 });
  });
});
