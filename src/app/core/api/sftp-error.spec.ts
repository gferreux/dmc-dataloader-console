import { ApiException } from './api-error';
import { SFTPGO_NOT_CONFIGURED, sftpErrorView } from './sftp-error';

describe('sftpErrorView', () => {
  it('maps validation details onto fields', () => {
    const view = sftpErrorView(
      new ApiException(422, 'validation_error', 'invalid user', [
        { field: 'user', message: 'Use lowercase letters, digits, hyphens, and underscores.' },
      ]),
    );
    expect(view.message).toBe('Some fields need attention.');
    expect(view.fields.user).toContain('lowercase');
    expect(view.notConfigured).toBe(false);
  });

  it('maps a bucket mismatch to a readable message', () => {
    const view = sftpErrorView(
      new ApiException(
        409,
        'bucket_mismatch',
        'user demo_retail is on bucket other, expected publishers',
      ),
    );
    expect(view.message).toContain('different bucket');
    expect(view.message).toContain('expected publishers');
    expect(view.fields).toEqual({});
  });

  it('maps an SFTPGo failure without echoing a raw payload', () => {
    const view = sftpErrorView(
      new ApiException(502, 'bad_gateway', '{"error":"upstream exploded"}'),
    );
    expect(view.message).toBe('SFTPGo returned an error. The account was not changed.');
    expect(view.message).not.toContain('exploded');
  });

  it('maps a missing SFTPGo configuration', () => {
    const view = sftpErrorView(new ApiException(503, 'service_unavailable', 'not configured'));
    expect(view.message).toBe(SFTPGO_NOT_CONFIGURED);
    expect(view.notConfigured).toBe(true);
  });
});
