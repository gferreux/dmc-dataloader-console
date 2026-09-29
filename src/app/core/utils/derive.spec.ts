import { classify, withDerived } from './derive';
import { LoadConfig } from '../models/load-config.model';

describe('derived partner and import type', () => {
  it('reads advertiser sales from the dataset and table', () => {
    expect(
      classify({
        destination: { datasetId: 'dkp_dmc_advertisers_raw_eu_dev', tableId: 'sales' },
        id: 'sample_brand:sample:sales',
        organization: { type: 'advertiser' },
      }),
    ).toEqual({ partnerType: 'advertiser', importType: 'sales' });
  });

  it('treats publisher profiles as optin and keeps a server-provided value', () => {
    expect(
      classify({
        destination: { datasetId: 'dkp_dmc_publishers_raw_eu_dev', tableId: 'profiles' },
        id: 'demo_retail:demo:optin',
      }),
    ).toEqual({ partnerType: 'publisher', importType: 'optin' });

    const config = {
      destination: {
        projectId: 'demo-dmc-eu',
        datasetId: 'dkp_dmc_publishers_raw_eu_dev',
        tableId: 'profiles',
      },
      id: 'demo_retail:demo:optin',
      partnerType: 'advertiser',
      importType: 'optin',
    } as LoadConfig;
    expect(withDerived(config).partnerType).toBe('advertiser');
  });

  it('ignores legacy referential and falls back to the dataset', () => {
    expect(
      classify({
        organization: { type: 'referential' },
        destination: { datasetId: 'dkp_dmc_advertisers_raw_eu_dev', tableId: 'stores' },
        id: 'sample_brand:sample:stores',
      }),
    ).toEqual({ partnerType: 'advertiser', importType: 'stores' });
  });
});
