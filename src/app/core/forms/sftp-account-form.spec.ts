import { SFTP_LOGIN_ERROR, createSftpAccountForm, toSftpAccountRequest } from './sftp-account-form';

describe('sftp account form', () => {
  it('rejects user and base names outside the SFTP pattern', () => {
    const form = createSftpAccountForm();
    form.controls.user.setValue('Acme');
    form.controls.base.setValue('bad base');
    form.controls.clientType.setValue('publisher');

    expect(form.controls.user.hasError('sftpName')).toBe(true);
    expect(form.controls.base.hasError('sftpName')).toBe(true);
    expect(form.valid).toBe(false);

    form.controls.user.setValue('_acme');
    form.controls.base.setValue('-shop');
    expect(form.controls.user.hasError('sftpName')).toBe(true);
    expect(form.controls.base.hasError('sftpName')).toBe(true);

    form.controls.user.setValue('  ');
    form.controls.base.setValue('');
    expect(form.controls.user.hasError('required')).toBe(true);
    expect(form.controls.base.hasError('required')).toBe(true);

    form.controls.user.setValue('acme');
    form.controls.base.setValue('acme_fr-1');
    expect(form.controls.user.valid).toBe(true);
    expect(form.controls.base.valid).toBe(true);
    expect(form.valid).toBe(true);
  });

  it('requires a public key when no password will be generated', () => {
    const form = createSftpAccountForm();
    form.controls.user.setValue('acme');
    form.controls.base.setValue('acme_fr');
    form.controls.clientType.setValue('advertiser');
    form.controls.passwordMode.setValue('none');

    expect(form.hasError('loginMethod')).toBe(true);
    form.controls.publicKeys.setValue('  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample  \n');
    expect(form.hasError('loginMethod')).toBe(false);

    const body = toSftpAccountRequest(form);
    expect(body).toEqual({
      user: 'acme',
      base: 'acme_fr',
      clientType: 'advertiser',
      passwordMode: 'none',
      publicKeys: ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample'],
    });
    expect(SFTP_LOGIN_ERROR).toContain('public key');
  });

  it('omits public keys when the field is blank', () => {
    const form = createSftpAccountForm();
    form.setValue({
      user: 'acme',
      base: 'acme_fr',
      clientType: 'publisher',
      passwordMode: 'generate',
      publicKeys: ' \n ',
    });
    expect(toSftpAccountRequest(form).publicKeys).toBeUndefined();
  });
});
