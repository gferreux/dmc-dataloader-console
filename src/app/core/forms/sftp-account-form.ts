import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import {
  SFTP_NAME_PATTERN,
  SftpAccountRequest,
  SftpClientType,
  SftpPasswordMode,
} from '../models/sftp-account.model';

export interface SftpAccountFormControls {
  user: FormControl<string>;
  base: FormControl<string>;
  clientType: FormControl<SftpClientType | ''>;
  passwordMode: FormControl<SftpPasswordMode>;
  publicKeys: FormControl<string>;
}

export type SftpAccountForm = FormGroup<SftpAccountFormControls>;

export const SFTP_NAME_ERROR = 'Use lowercase letters, digits, hyphens, and underscores.';
export const SFTP_LOGIN_ERROR = 'Add at least one SSH public key, or generate a password.';

export function sftpNameValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return { required: true };
  }
  return SFTP_NAME_PATTERN.test(value) ? null : { sftpName: true };
}

export function sftpLoginMethodValidator(control: AbstractControl): ValidationErrors | null {
  const group = control as SftpAccountForm;
  if (group.controls.passwordMode.value !== 'none') {
    return null;
  }
  return parsePublicKeys(group.controls.publicKeys.value).length ? null : { loginMethod: true };
}

export function createSftpAccountForm(): SftpAccountForm {
  return new FormGroup<SftpAccountFormControls>(
    {
      user: new FormControl('', {
        nonNullable: true,
        validators: [sftpNameValidator],
      }),
      base: new FormControl('', {
        nonNullable: true,
        validators: [sftpNameValidator],
      }),
      clientType: new FormControl<SftpClientType | ''>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      passwordMode: new FormControl<SftpPasswordMode>('generate', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      publicKeys: new FormControl('', { nonNullable: true }),
    },
    { validators: [sftpLoginMethodValidator] },
  );
}

export function parsePublicKeys(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function toSftpAccountRequest(form: SftpAccountForm): SftpAccountRequest {
  const value = form.getRawValue();
  const keys = parsePublicKeys(value.publicKeys);
  const body: SftpAccountRequest = {
    user: value.user.trim(),
    base: value.base.trim(),
    clientType: value.clientType as SftpClientType,
    passwordMode: value.passwordMode,
  };
  if (keys.length) {
    body.publicKeys = keys;
  }
  return body;
}
