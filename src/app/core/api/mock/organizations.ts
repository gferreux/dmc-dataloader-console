import { DirectoryOrg } from '../../utils/plumbing';

/** Fictional directory used by mock autocomplete and derive. */
export const ORGANIZATIONS: readonly DirectoryOrg[] = [
  {
    id: 'org_demo_retail',
    name: 'Demo Retail',
    slug: 'demo_retail',
    type: 'publisher',
    accounts: [],
    bases: [
      { id: 'base_demo', name: 'Demo', slug: 'demo' },
      { id: 'base_outlet', name: 'Outlet', slug: 'outlet' },
    ],
  },
  {
    id: 'org_sample_brand',
    name: 'Sample Brand',
    slug: 'sample_brand',
    type: 'advertiser',
    accounts: [
      { id: 'acc_sample', name: 'Sample', slug: 'sample' },
      { id: 'acc_wholesale', name: 'Wholesale', slug: 'wholesale' },
    ],
    bases: [],
  },
  {
    id: 'org_cafe_northwind',
    name: 'Café Northwind',
    slug: 'cafe_northwind',
    type: 'advertiser',
    accounts: [{ id: 'acc_paris', name: 'Paris-Est', slug: 'paris_est' }],
    bases: [],
  },
];
