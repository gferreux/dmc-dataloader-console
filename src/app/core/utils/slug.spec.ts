import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases, strips accents, and turns spaces and hyphens into underscores', () => {
    expect(slugify('Café Northwind')).toBe('cafe_northwind');
    expect(slugify('Paris-Est')).toBe('paris_est');
    expect(slugify('Demo Retail')).toBe('demo_retail');
  });

  it('drops characters outside [a-z0-9_]', () => {
    expect(slugify('A&B / C.')).toBe('ab__c');
    expect(slugify("L'Oréal")).toBe('loreal');
    expect(slugify('Gadól')).toBe('gadol');
    expect(slugify('foo-bar baz')).toBe('foo_bar_baz');
  });

  it('trims before replacing spaces and rejects an empty slug', () => {
    expect(slugify('  BigMat France ')).toBe('bigmat_france');
    expect(slugify(' !!! ')).toBe('');
  });
});
