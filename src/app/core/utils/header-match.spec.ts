import { splitHeader, suggestHeaderMatches } from './header-match';

describe('header matching', () => {
  it('splits a comma header and a real tab header', () => {
    expect(splitHeader('email, mobile_phone, first_name', ',')).toEqual([
      'email',
      'mobile_phone',
      'first_name',
    ]);
    expect(splitHeader('email\tmobile_phone', '\t')).toEqual(['email', 'mobile_phone']);
  });

  it('suggests sources only for empty rows and normalizes names', () => {
    const suggestions = suggestHeaderMatches(
      [
        { column: 'mobile_phone', src: '' },
        { column: 'first_name', src: 'given_name' },
        { column: 'zip_code', src: '' },
      ],
      'Mobile Phone, zip-code, unused',
      ',',
    );
    expect(suggestions).toEqual([
      { column: 'mobile_phone', src: 'Mobile Phone' },
      { column: 'zip_code', src: 'zip-code' },
    ]);
  });

  it('returns nothing for a blank paste', () => {
    expect(suggestHeaderMatches([{ column: 'email', src: '' }], '   ', ',')).toEqual([]);
  });
});
