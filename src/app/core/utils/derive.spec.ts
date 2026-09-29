import { inferImportType, inferPartnerType, withDerived } from './derive';
import { LoadConfig } from '../models/load-config.model';

describe('derived partner and import type', () => {
  const base = {
    destination: {
      projectId: 'demo-dmc-eu',
      datasetId: 'dkp_dmc_advertisers_raw_eu_dev',
      tableId: 'sales',
    },
    id: 'sample_brand:sample:sales',
  } as Pick<LoadConfig, 'destination' | 'id'>;

  it('reads advertiser sales from the dataset and table', () => {
    expect(inferPartnerType(base)).toBe('advertiser');
    expect(inferImportType(base)).toBe('sales');
  });

  it('treats publisher profiles as optin and keeps a server-provided value', () => {
    const publisher = {
      destination: {
        projectId: 'demo-dmc-eu',
        datasetId: 'dkp_dmc_publishers_raw_eu_dev',
        tableId: 'profiles',
      },
      id: 'demo_retail:demo:optin',
    };
    expect(inferPartnerType(publisher)).toBe('publisher');
    expect(inferImportType(publisher)).toBe('optin');
    const config = { ...publisher, partnerType: 'publisher', importType: 'optin' } as LoadConfig;
    expect(withDerived({ ...config, partnerType: 'advertiser' }).partnerType).toBe('advertiser');
  });
});
