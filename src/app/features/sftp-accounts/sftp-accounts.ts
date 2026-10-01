import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { SftpFieldErrors, sftpErrorView } from '../../core/api/sftp-error';
import { SFTP_ACCOUNT_API } from '../../core/api/sftp-account-api';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import {
  SFTP_LOGIN_ERROR,
  SFTP_NAME_ERROR,
  SftpAccountForm,
  createSftpAccountForm,
  toSftpAccountRequest,
} from '../../core/forms/sftp-account-form';
import {
  MOCK_SFTP_BASE,
  MOCK_SFTP_USER,
  SFTP_NAME_PATTERN,
  SftpAccountConfig,
  SftpAccountLookup,
  SftpAccountPreview,
  SftpAccountRequest,
  SftpAccountResult,
  SftpClientType,
  SftpCreateUserAction,
  SftpPreviewUserAction,
} from '../../core/models/sftp-account.model';

@Component({
  selector: 'dmc-sftp-accounts',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
  ],
  templateUrl: './sftp-accounts.html',
  styleUrl: './sftp-accounts.scss',
})
export class SftpAccounts {
  private readonly api = inject(SFTP_ACCOUNT_API);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lookups = new Subject<string>();

  readonly config = inject(RUNTIME_CONFIG);
  readonly form: SftpAccountForm = createSftpAccountForm();
  readonly existingUser = MOCK_SFTP_USER;
  readonly existingBase = MOCK_SFTP_BASE;
  readonly nameHint =
    'Lowercase letters, digits, hyphens, and underscores. Must start with a letter or digit.';
  readonly nameError = SFTP_NAME_ERROR;
  readonly loginError = SFTP_LOGIN_ERROR;

  readonly previewActionLabel: Record<SftpPreviewUserAction, string> = {
    create: 'Create a new SFTP user',
    update: 'Add this base to the existing user',
    unchanged: 'This base is already configured',
  };
  readonly resultHeading: Record<SftpCreateUserAction, string> = {
    created: 'SFTP account created',
    updated: 'SFTP account updated',
    unchanged: 'SFTP account unchanged',
  };

  readonly loading = signal(true);
  readonly notConfigured = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly phase = signal<'form' | 'preview' | 'result'>('form');
  readonly busy = signal(false);
  readonly checking = signal(false);
  readonly lookup = signal<SftpAccountLookup | null>(null);
  readonly lookupError = signal<string | null>(null);
  readonly plan = signal<SftpAccountPreview | null>(null);
  readonly outcome = signal<SftpAccountResult | null>(null);
  /** Shown once. Cleared when leaving the page. Never written to storage or the URL. */
  readonly secret = signal<string | null>(null);
  readonly copied = signal(false);
  readonly copyFailed = signal(false);
  readonly banner = signal<string | null>(null);
  readonly fieldErrors = signal<SftpFieldErrors>({});

  private planned: SftpAccountRequest | null = null;
  private readonly clientType = toSignal(this.form.controls.clientType.valueChanges, {
    initialValue: this.form.controls.clientType.value,
  });
  private readonly baseName = toSignal(this.form.controls.base.valueChanges, {
    initialValue: this.form.controls.base.value,
  });
  private readonly clientTypes = signal<SftpAccountConfig['clientTypes'] | null>(null);

  readonly folderPaths = computed(() => {
    const type = this.clientType();
    const types = this.clientTypes();
    if ((type !== 'publisher' && type !== 'advertiser') || !types) {
      return [];
    }
    const base = this.baseName().trim();
    const label = SFTP_NAME_PATTERN.test(base) ? base : '<base>';
    return types[type].map((sub) => `/${label}/${sub}`);
  });

  constructor() {
    this.lookups
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((username) => {
          if (!username) {
            this.checking.set(false);
            this.lookup.set(null);
            return EMPTY;
          }
          this.checking.set(true);
          this.lookupError.set(null);
          return this.api.lookup(username).pipe(
            catchError((error) => {
              this.checking.set(false);
              this.lookup.set(null);
              const view = sftpErrorView(error);
              if (view.notConfigured) {
                this.notConfigured.set(true);
              } else {
                this.lookupError.set(view.message);
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((found) => {
        this.checking.set(false);
        this.lookup.set(found);
      });

    this.form.controls.user.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const username = value.trim();
      if (!SFTP_NAME_PATTERN.test(username)) {
        this.lookup.set(null);
        this.lookupError.set(null);
        this.checking.set(false);
        this.lookups.next('');
        return;
      }
      if (this.lookup()?.username !== username) {
        this.lookup.set(null);
      }
      this.lookups.next(username);
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.phase() === 'result') {
        return;
      }
      this.plan.set(null);
      this.planned = null;
      this.banner.set(null);
      this.fieldErrors.set({});
      if (this.phase() === 'preview') {
        this.phase.set('form');
      }
    });

    this.api
      .config()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (settings) => {
          this.clientTypes.set(settings.clientTypes);
          this.notConfigured.set(!settings.configured);
          this.loading.set(false);
        },
        error: (error) => {
          const view = sftpErrorView(error);
          this.loading.set(false);
          if (view.notConfigured) {
            this.notConfigured.set(true);
          } else {
            this.loadError.set(view.message);
          }
        },
      });

    this.destroyRef.onDestroy(() => this.clearSecret());
  }

  selectClient(type: SftpClientType): void {
    this.form.controls.clientType.setValue(type);
    this.form.controls.clientType.markAsTouched();
  }

  requestPreview(): void {
    this.form.markAllAsTouched();
    this.banner.set(null);
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.banner.set(
        this.form.hasError('loginMethod')
          ? SFTP_LOGIN_ERROR
          : 'Check the user name, base, and client type.',
      );
      return;
    }
    const body = toSftpAccountRequest(this.form);
    this.busy.set(true);
    this.api
      .preview(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (plan) => {
          this.planned = body;
          this.plan.set(plan);
          this.phase.set('preview');
          this.busy.set(false);
        },
        error: (error) => {
          this.busy.set(false);
          this.applyError(error);
        },
      });
  }

  requestCreate(): void {
    const body = this.planned;
    if (!body || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.banner.set(null);
    this.api
      .create(body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.rememberResult(result);
          this.phase.set('result');
          this.busy.set(false);
        },
        error: (error) => {
          this.busy.set(false);
          this.applyError(error);
        },
      });
  }

  startOver(): void {
    this.clearSecret();
    this.phase.set('form');
    this.outcome.set(null);
    this.plan.set(null);
    this.planned = null;
    this.banner.set(null);
    this.fieldErrors.set({});
    this.lookup.set(null);
    this.lookupError.set(null);
    this.form.reset({
      user: '',
      base: '',
      clientType: '',
      passwordMode: 'generate',
      publicKeys: '',
    });
  }

  async copyPassword(input: HTMLInputElement): Promise<void> {
    const password = this.secret();
    if (!password) {
      return;
    }
    this.copyFailed.set(false);
    try {
      await navigator.clipboard.writeText(password);
      this.copied.set(true);
    } catch {
      input.focus();
      input.select();
      this.copied.set(false);
      this.copyFailed.set(true);
    }
  }

  private rememberResult(result: SftpAccountResult): void {
    const password = result.generatedPassword ?? null;
    delete result.generatedPassword;
    this.secret.set(password);
    this.copied.set(false);
    this.copyFailed.set(false);
    const stored: SftpAccountResult = {
      user: result.user,
      base: result.base,
      clientType: result.clientType,
      bucket: result.bucket,
      subfolders: result.subfolders,
      foldersCreated: result.foldersCreated,
      foldersExisting: result.foldersExisting,
      userAction: result.userAction,
      addedVirtualFolders: result.addedVirtualFolders,
      verified: result.verified,
    };
    if (result.missing?.length) {
      stored.missing = result.missing;
    }
    this.outcome.set(stored);
  }

  private applyError(error: unknown): void {
    const view = sftpErrorView(error);
    this.fieldErrors.set(view.fields);
    this.banner.set(view.message);
    if (view.notConfigured) {
      this.notConfigured.set(true);
      this.plan.set(null);
      this.planned = null;
    }
  }

  private clearSecret(): void {
    this.secret.set(null);
    this.copied.set(false);
    this.copyFailed.set(false);
  }
}
