import { ORGANIZATIONS } from '../api/mock/organizations';
import { deriveLoadConfig, parseConventionId } from './plumbing';

describe('deriveLoadConfig', () => {
  it('builds advertiser plumbing from the organization directory', () => {
    const outcome = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: 'Café Northwind',
        nestedName: 'Paris-Est',
        fileType: 'sales',
      },
      ORGANIZATIONS,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.result.id).toBe('cafe_northwind:paris_est:sales');
    expect(outcome.result.publisherName).toBe('cafe_northwind:paris_est:sales');
    expect(outcome.result.patterns.preprocess).toBe(
      'dkp-dmc-advertisers-raw-euw1-dev/cafe_northwind/paris_est/sales/.+[.](csv|zip|gz|gzip|tgz|tar.gz|7z)',
    );
    expect(outcome.result.patterns.ingest).toBe(
      'dkp-dmc-advertisers-staging-euw1-dev/data/[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z/cafe_northwind/paris_est/sales/.+',
    );
    expect(outcome.result.notification).toEqual({
      projectId: 'dmc-curated-inventory-dev-e6da',
      topicId: 'dkp-dmc-data-loader-notifications-dev',
    });
    expect(outcome.result.destination).toEqual({
      projectId: 'dmc-raw-advertisers-dev-27c7',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'sales',
    });
    expect(outcome.result.organization).toEqual({
      id: 'org_cafe_northwind',
      account: 'acc_paris',
      type: 'advertiser',
    });
    expect(
      new RegExp(outcome.result.patterns.preprocess).test(
        'dkp-dmc-advertisers-raw-euw1-dev/cafe_northwind/paris_est/sales/orders.csv',
      ),
    ).toBe(true);
  });

  it('sends publisher opt-in to profiles and opt-out to optout', () => {
    const optin = deriveLoadConfig(
      {
        kind: 'publisher',
        organizationName: 'demo retail',
        nestedName: 'Demo',
        fileType: 'optin',
      },
      ORGANIZATIONS,
    );
    const optout = deriveLoadConfig(
      {
        kind: 'publisher',
        organizationName: 'Demo Retail',
        nestedName: 'Demo',
        fileType: 'optout',
      },
      ORGANIZATIONS,
    );
    expect(optin.ok && optin.result.destination.tableId).toBe('profiles');
    expect(
      optin.ok && optin.result.patterns.preprocess.startsWith('dkp-dmc-publishers-raw-euw1-dev/'),
    ).toBe(true);
    expect(optout.ok && optout.result.destination).toEqual({
      projectId: 'dmc-raw-publishers-dev-c69c',
      datasetId: 'dkp_dmc_publishers_raw_eu_dev',
      tableId: 'optout',
    });
    expect(optout.ok && optout.result.id).toBe('demo_retail:demo:optout');
    expect(optin.ok && optin.result.organization.account).toBe('');
    expect(optin.ok && optin.result.publisherName).toBe('demo_retail:demo:optin');

    const freeBase = deriveLoadConfig(
      {
        kind: 'publisher',
        organizationName: 'Demo Retail',
        nestedName: 'New Base',
        fileType: 'optin',
      },
      ORGANIZATIONS,
    );
    expect(freeBase.ok && freeBase.result.id).toBe('demo_retail:new_base:optin');
  });

  it('returns 422 fields when the organization or account is missing', () => {
    const missingOrg = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: 'Unknown',
        nestedName: 'Sample',
        fileType: 'sales',
      },
      ORGANIZATIONS,
    );
    expect(missingOrg.ok).toBe(false);
    if (missingOrg.ok) {
      return;
    }
    expect(missingOrg.issues).toEqual([
      {
        field: 'organizationName',
        message: 'organization "Unknown" (advertiser) was not found',
      },
    ]);

    const missingAccount = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: 'Sample Brand',
        nestedName: 'Missing',
        fileType: 'customers',
      },
      ORGANIZATIONS,
    );
    expect(missingAccount.ok).toBe(false);
    if (missingAccount.ok) {
      return;
    }
    expect(missingAccount.issues).toEqual([
      {
        field: 'nestedName',
        message: 'account "Missing" was not found for organization "Sample Brand"',
      },
    ]);

    const empty = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: ' !!! ',
        nestedName: 'Sample',
        fileType: 'sales',
      },
      ORGANIZATIONS,
    );
    expect(empty.ok).toBe(false);
    if (empty.ok) {
      return;
    }
    expect(empty.issues[0]).toEqual({
      field: 'organizationName',
      message: 'organization name is empty after slug normalization',
    });
  });

  it('warns on overlap and when the derived id already exists', () => {
    const first = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: 'Sample Brand',
        nestedName: 'Sample',
        fileType: 'sales',
      },
      ORGANIZATIONS,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const overlap = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: 'Sample Brand',
        nestedName: 'Sample',
        fileType: 'sales',
      },
      ORGANIZATIONS,
      [{ id: 'other', patterns: first.result.patterns }],
    );
    expect(overlap.ok && overlap.result.warnings.map((issue) => issue.field)).toEqual(['patterns']);

    const self = deriveLoadConfig(
      {
        kind: 'advertiser',
        organizationName: 'Sample Brand',
        nestedName: 'Sample',
        fileType: 'sales',
      },
      ORGANIZATIONS,
      [{ id: first.result.id, patterns: first.result.patterns }],
    );
    expect(self.ok && self.result.warnings).toEqual([
      { field: 'id', message: 'a load config with this id already exists' },
    ]);
  });
});

describe('parseConventionId', () => {
  it('accepts slug:slug:fileType and rejects legacy ids', () => {
    expect(parseConventionId('demo_retail:demo:optin')).toEqual({
      orgSlug: 'demo_retail',
      nestedSlug: 'demo',
      fileType: 'optin',
    });
    expect(parseConventionId('legacy_sample_stores')).toBeNull();
    expect(parseConventionId('Demo:Retail:sales')).toEqual({
      orgSlug: 'demo',
      nestedSlug: 'retail',
      fileType: 'sales',
    });
  });
});
