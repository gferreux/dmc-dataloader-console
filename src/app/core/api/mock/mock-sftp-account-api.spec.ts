import { firstValueFrom } from 'rxjs';

import {
  MOCK_SFTP_BASE,
  MOCK_SFTP_USER,
  SFTP_BUCKETS,
  SFTP_WARNING_KEYS_IGNORED,
  SFTP_WARNING_PASSWORD_KEPT,
} from '../../models/sftp-account.model';
import { ApiException } from '../api-error';
import { MockSftpAccountApi } from './mock-sftp-account-api';

describe('MockSftpAccountApi', () => {
  it('reports the seeded user and adds a new base on preview then create', async () => {
    const api = new MockSftpAccountApi();
    const config = await firstValueFrom(api.config());
    expect(config.configured).toBe(true);
    expect(config.clientTypes.publisher).toEqual(['optin', 'optout', 'stop']);

    const existing = await firstValueFrom(api.lookup(MOCK_SFTP_USER));
    expect(existing.exists).toBe(true);
    expect(existing.bases).toEqual([MOCK_SFTP_BASE]);
    expect(existing.bucket).toBe(SFTP_BUCKETS.publisher);

    const missing = await firstValueFrom(api.lookup('new_shop'));
    expect(missing).toEqual({
      username: 'new_shop',
      exists: false,
      virtualFolders: [],
      bases: [],
    });

    const same = await firstValueFrom(
      api.preview({ user: MOCK_SFTP_USER, base: MOCK_SFTP_BASE, clientType: 'publisher' }),
    );
    expect(same.userAction).toBe('unchanged');
    expect(same.folders.every((folder) => folder.action === 'exists')).toBe(true);

    const plan = await firstValueFrom(
      api.preview({ user: MOCK_SFTP_USER, base: 'extra', clientType: 'publisher' }),
    );
    expect(plan.userAction).toBe('update');
    expect(plan.warnings).toEqual([SFTP_WARNING_PASSWORD_KEPT]);
    expect(plan.bucket).toBe(SFTP_BUCKETS.publisher);
    expect(plan.folders.map((folder) => folder.virtualPath)).toEqual([
      '/extra/optin',
      '/extra/optout',
      '/extra/stop',
    ]);
    expect(plan.folders.every((folder) => folder.action === 'create')).toBe(true);

    const fresh = await firstValueFrom(
      api.preview({ user: 'new_shop', base: 'paris', clientType: 'advertiser' }),
    );
    expect(fresh.userAction).toBe('create');
    expect(fresh.warnings).toEqual([]);

    const withKeys = await firstValueFrom(
      api.preview({
        user: MOCK_SFTP_USER,
        base: 'extra',
        clientType: 'publisher',
        publicKeys: ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample'],
      }),
    );
    expect(withKeys.warnings).toEqual([SFTP_WARNING_PASSWORD_KEPT, SFTP_WARNING_KEYS_IGNORED]);

    const created = await firstValueFrom(
      api.create({
        user: 'new_shop',
        base: 'paris',
        clientType: 'advertiser',
        passwordMode: 'generate',
      }),
    );
    expect(created.userAction).toBe('created');
    expect(created.generatedPassword).toMatch(/^[A-Za-z0-9_.!@#%+=-]{24}$/);
    expect(created.foldersCreated).toHaveLength(4);
    expect(created.verified).toBe(true);

    const again = await firstValueFrom(
      api.create({ user: 'new_shop', base: 'paris', clientType: 'advertiser' }),
    );
    expect(again.userAction).toBe('unchanged');
    expect(again.generatedPassword).toBeUndefined();
    expect((await firstValueFrom(api.lookup('new_shop'))).bases).toEqual(['paris']);
  });

  it('rejects a bucket mismatch, an invalid name, and a server that is not configured', async () => {
    const api = new MockSftpAccountApi();
    const mismatch = { user: MOCK_SFTP_USER, base: 'shop', clientType: 'advertiser' as const };
    await expect(firstValueFrom(api.preview(mismatch))).rejects.toMatchObject({
      status: 409,
      code: 'bucket_mismatch',
    });
    await expect(firstValueFrom(api.create(mismatch))).rejects.toMatchObject({
      status: 409,
      code: 'bucket_mismatch',
    });

    await expect(
      firstValueFrom(api.create({ user: 'Bad', base: 'shop', clientType: 'publisher' })),
    ).rejects.toBeInstanceOf(ApiException);

    const offline = new MockSftpAccountApi({ configured: false });
    expect((await firstValueFrom(offline.config())).configured).toBe(false);
    const body = { user: 'acme', base: 'acme', clientType: 'publisher' as const };
    await expect(firstValueFrom(offline.lookup('acme'))).rejects.toMatchObject({
      status: 503,
      code: 'sftpgo_unconfigured',
    });
    await expect(firstValueFrom(offline.preview(body))).rejects.toMatchObject({
      status: 503,
      code: 'sftpgo_unconfigured',
    });
    await expect(firstValueFrom(offline.create(body))).rejects.toMatchObject({
      status: 503,
      code: 'sftpgo_unconfigured',
    });
  });
});
