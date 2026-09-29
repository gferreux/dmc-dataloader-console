import { iapEmail, initials } from './identity.service';

describe('identity helpers', () => {
  it('strips the IAP account prefix', () => {
    expect(iapEmail('accounts.google.com:demo.user@example.com')).toBe('demo.user@example.com');
    expect(iapEmail('')).toBeNull();
  });

  it('builds initials from the mailbox', () => {
    expect(initials('demo.user@example.com')).toBe('DU');
  });
});
