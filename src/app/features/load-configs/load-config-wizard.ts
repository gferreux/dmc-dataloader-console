import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  of,
  switchMap,
} from 'rxjs';

import { fieldIssues, toApiException } from '../../core/api/api-error';
import { materialize } from '../../core/api/write-body';
import { findTemplate } from '../../core/api/mock/catalog';
import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import {
  IdentityInput,
  LoadConfigForm,
  applyTemplate,
  createLoadConfigForm,
  duplicateColumns,
  toWriteModel,
} from '../../core/forms/load-config-form';
import {
  DeriveRequest,
  DeriveResult,
  FieldMessage,
  ImportTemplate,
  ImportType,
  Meta,
  NestedSummary,
  OrganizationSummary,
  PartnerType,
  ValidationResult,
} from '../../core/models/load-config.model';
import { fileTypesFor } from '../../core/utils/plumbing';
import { Notify } from '../../core/notify/notify.service';
import { ValidationPanel } from '../../shared/validation-panel';
import { ComputedPanel } from './computed-panel';
import { ConfigForm } from './config-form';
import { NameField } from './name-field';

@Component({
  selector: 'dmc-load-config-wizard',
  imports: [MatButton, RouterLink, ConfigForm, ValidationPanel, ComputedPanel, NameField],
  templateUrl: './load-config-wizard.html',
  styleUrl: './load-config-wizard.scss',
})
export class LoadConfigWizard {
  private readonly api = inject(LOAD_CONFIG_API);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly orgRequests = new Subject<PartnerType>();
  private readonly nestedRequests = new Subject<{
    kind: PartnerType;
    org: OrganizationSummary;
  } | null>();
  private readonly deriveRequests = new Subject<DeriveRequest | null>();
  private appliedFileType = '';

  readonly step = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly meta = signal<Meta | null>(null);
  readonly templates = signal<ImportTemplate[]>([]);
  readonly kind = signal<PartnerType | ''>('');
  readonly organizationName = signal('');
  readonly nestedName = signal('');
  readonly fileType = signal<ImportType | ''>('');
  readonly orgOptions = signal<OrganizationSummary[]>([]);
  readonly nestedOptions = signal<NestedSummary[]>([]);
  readonly form = signal<LoadConfigForm | null>(null);
  readonly derived = signal<DeriveResult | null>(null);
  readonly issues = signal<FieldMessage[]>([]);
  readonly deriving = signal(false);
  readonly validation = signal<ValidationResult | null>(null);
  readonly localError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly stepLabels = computed(() => {
    const nested =
      this.kind() === 'advertiser'
        ? 'Account'
        : this.kind() === 'publisher'
          ? 'Base'
          : 'Base or account';
    return ['Kind', 'Organization', nested, 'File type', 'Configuration'];
  });

  constructor() {
    this.orgRequests
      .pipe(
        switchMap((kind) =>
          this.api.organizations(kind).pipe(
            catchError((error) => {
              this.error.set(toApiException(error).message);
              return of([] as OrganizationSummary[]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((items) => this.orgOptions.set(items));

    this.nestedRequests
      .pipe(
        switchMap((pick) => {
          if (!pick) {
            return of([] as NestedSummary[]);
          }
          const request =
            pick.kind === 'advertiser'
              ? this.api.accounts(pick.org.id)
              : this.api.bases(pick.org.slug);
          return request.pipe(catchError(() => of([] as NestedSummary[])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((items) => this.nestedOptions.set(items));

    this.deriveRequests
      .pipe(
        debounceTime(300),
        distinctUntilChanged((left, right) => JSON.stringify(left) === JSON.stringify(right)),
        switchMap((input) => {
          if (!input) {
            this.deriving.set(false);
            this.derived.set(null);
            this.issues.set([]);
            return EMPTY;
          }
          this.deriving.set(true);
          this.issues.set([]);
          return this.api.derive(input).pipe(
            catchError((error) => {
              const parsed = fieldIssues(error);
              this.issues.set(parsed);
              this.derived.set(null);
              this.deriving.set(false);
              if (!parsed.length) {
                this.notify.error(toApiException(error).message);
              }
              this.focusIssue(parsed);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.derived.set(result);
        this.deriving.set(false);
        this.issues.set([]);
        if (this.step() === 4) {
          this.validateSoon();
        }
      });

    effect(() => {
      const kind = this.kind();
      const organizationName = this.organizationName().trim();
      const nestedName = this.nestedName().trim();
      const fileType = this.fileType();
      const next =
        kind && organizationName && nestedName && fileType
          ? { kind, organizationName, nestedName, fileType }
          : null;
      this.deriveRequests.next(next);
    });

    effect(() => {
      const kind = this.kind();
      const name = this.organizationName().trim().toLowerCase();
      const org = this.orgOptions().find((item) => item.name.trim().toLowerCase() === name);
      if (!kind || !org) {
        this.nestedRequests.next(null);
        return;
      }
      this.nestedRequests.next({ kind, org });
    });

    forkJoin({ meta: this.api.meta(), templates: this.api.templates() }).subscribe({
      next: ({ meta, templates }) => {
        this.meta.set(meta);
        this.templates.set(templates.items);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(toApiException(error).message);
        this.loading.set(false);
      },
    });
  }

  fileTypes(): ImportType[] {
    const kind = this.kind();
    if (kind !== 'publisher' && kind !== 'advertiser') {
      return [];
    }
    return [...(this.meta()?.importTypes[kind] ?? fileTypesFor(kind))];
  }

  nestedLabel(): string {
    return this.kind() === 'advertiser' ? 'Account' : 'Base';
  }

  issue(field: string): string | null {
    return this.issues().find((item) => item.field === field)?.message ?? null;
  }

  label(importType: ImportType): string {
    return this.templates().find((item) => item.importType === importType)?.label ?? importType;
  }

  selectKind(kind: PartnerType): void {
    if (this.kind() === kind) {
      return;
    }
    this.kind.set(kind);
    this.organizationName.set('');
    this.nestedName.set('');
    this.fileType.set('');
    this.appliedFileType = '';
    this.orgOptions.set([]);
    this.nestedOptions.set([]);
    this.issues.set([]);
    this.derived.set(null);
    this.validation.set(null);
    this.orgRequests.next(kind);
  }

  setOrganization(value: string): void {
    this.organizationName.set(value);
    this.clearIssue('organizationName');
  }

  setNested(value: string): void {
    this.nestedName.set(value);
    this.clearIssue('nestedName');
  }

  chooseFileType(fileType: ImportType): void {
    this.fileType.set(fileType);
    this.clearIssue('fileType');
    const template = findTemplate(this.templates(), this.kind(), fileType);
    const form = this.form() ?? createLoadConfigForm();
    if (template && this.appliedFileType !== fileType) {
      applyTemplate(form, template);
      this.appliedFileType = fileType;
    }
    this.form.set(form);
  }

  canContinue(): boolean {
    switch (this.step()) {
      case 0:
        return Boolean(this.kind());
      case 1:
        return Boolean(this.organizationName().trim());
      case 2:
        return Boolean(this.nestedName().trim());
      case 3:
        return Boolean(this.fileType());
      default:
        return true;
    }
  }

  next(): void {
    if (!this.canContinue()) {
      return;
    }
    this.step.update((value) => Math.min(value + 1, 4));
    if (this.step() === 4) {
      this.validateSoon();
    }
  }

  back(): void {
    this.step.update((value) => Math.max(value - 1, 0));
  }

  save(force = false): void {
    const form = this.form();
    const identity = this.identity();
    if (!form || !identity || !this.derived() || this.issues().length) {
      return;
    }
    form.markAllAsTouched();
    const duplicates = duplicateColumns(form);
    if (duplicates.length) {
      this.localError.set(`Duplicate target columns: ${duplicates.join(', ')}`);
      return;
    }
    const payload = toWriteModel(form, identity);
    const derived = this.derived();
    if (!derived) {
      return;
    }
    this.saving.set(true);
    this.localError.set(null);
    this.api.validate(materialize(derived, payload)).subscribe({
      next: (validation) => {
        this.validation.set(validation);
        if (form.invalid || validation.errors.length) {
          this.saving.set(false);
          this.localError.set(form.invalid ? 'Some fields still need attention.' : null);
          return;
        }
        if (validation.warnings.length && !force) {
          this.saving.set(false);
          return;
        }
        this.api.create(payload).subscribe({
          next: (created) => {
            this.saving.set(false);
            this.notify.success('Config created');
            void this.router.navigate(['/load-configs', created.id]);
          },
          error: (error) => {
            this.saving.set(false);
            this.applySaveError(error);
          },
        });
      },
      error: (error) => {
        this.saving.set(false);
        this.applySaveError(error);
      },
    });
  }

  private identity(): IdentityInput | null {
    const kind = this.kind();
    const fileType = this.fileType();
    const organizationName = this.organizationName().trim();
    const nestedName = this.nestedName().trim();
    if (!kind || !fileType || !organizationName || !nestedName) {
      return null;
    }
    return { kind, fileType, organizationName, nestedName };
  }

  private validateSoon(): void {
    const form = this.form();
    const identity = this.identity();
    const derived = this.derived();
    if (!form || !identity || !derived) {
      return;
    }
    this.api.validate(materialize(derived, toWriteModel(form, identity))).subscribe({
      next: (validation) => this.validation.set(validation),
      error: (error) => this.notify.error(toApiException(error).message),
    });
  }

  private clearIssue(field: string): void {
    this.issues.update((issues) => issues.filter((issue) => issue.field !== field));
  }

  private focusIssue(issues: FieldMessage[]): void {
    const order = ['organizationName', 'nestedName', 'fileType'] as const;
    const first = order.find((field) => issues.some((issue) => issue.field === field));
    const steps = { organizationName: 1, nestedName: 2, fileType: 3 };
    if (first && this.step() > steps[first]) {
      this.step.set(steps[first]);
    }
  }

  private applySaveError(error: unknown): void {
    const parsed = fieldIssues(error);
    if (parsed.length) {
      this.issues.set(parsed);
      this.focusIssue(parsed);
      return;
    }
    this.notify.error(toApiException(error).message);
  }
}
