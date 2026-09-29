import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect, MatSelectChange } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
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
  createLoadConfigForm,
  draftsFromConfig,
  duplicateColumns,
  setMappings,
  toLegacyWrite,
  toWriteModel,
} from '../../core/forms/load-config-form';
import {
  DeriveRequest,
  DeriveResult,
  FieldMessage,
  ImportType,
  LoadConfig,
  LoadConfigUpdate,
  Meta,
  NestedSummary,
  OrganizationSummary,
  PartnerType,
  ValidationResult,
} from '../../core/models/load-config.model';
import {
  deriveViewFromConfig,
  fileTypesFor,
  hasConventionIdentity,
  isFileTypeForKind,
} from '../../core/utils/plumbing';
import { Notify } from '../../core/notify/notify.service';
import { ValidationPanel } from '../../shared/validation-panel';
import { ComputedPanel } from './computed-panel';
import { ConfigForm } from './config-form';
import { DeleteConfigDialog, DeleteDialogResult } from './delete-config-dialog';
import { NameField } from './name-field';

@Component({
  selector: 'dmc-load-config-edit',
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    RouterLink,
    ConfigForm,
    ValidationPanel,
    ComputedPanel,
    NameField,
  ],
  templateUrl: './load-config-edit.html',
  styleUrl: './load-config-edit.scss',
})
export class LoadConfigEdit {
  private readonly api = inject(LOAD_CONFIG_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly dialog = inject(MatDialog);
  private readonly orgRequests = new Subject<PartnerType>();
  private readonly nestedRequests = new Subject<{
    kind: PartnerType;
    org: OrganizationSummary;
  } | null>();
  private readonly deriveRequests = new Subject<DeriveRequest | null>();
  private loadGeneration = 0;
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null as string | null,
  });

  readonly loading = signal(true);
  readonly ready = signal(false);
  readonly error = signal<string | null>(null);
  readonly legacy = signal(false);
  readonly current = signal<LoadConfig | null>(null);
  readonly meta = signal<Meta | null>(null);
  readonly form = signal<LoadConfigForm | null>(null);
  readonly kind = signal<PartnerType | ''>('');
  readonly organizationName = signal('');
  readonly nestedName = signal('');
  readonly fileType = signal<ImportType | ''>('');
  readonly orgOptions = signal<OrganizationSummary[]>([]);
  readonly nestedOptions = signal<NestedSummary[]>([]);
  readonly derived = signal<DeriveResult | null>(null);
  readonly issues = signal<FieldMessage[]>([]);
  readonly deriving = signal(false);
  readonly validation = signal<ValidationResult | null>(null);
  readonly localError = signal<string | null>(null);
  readonly saving = signal(false);

  readonly panel = computed(() => {
    if (this.issues().length) {
      return null;
    }
    const derived = this.derived();
    if (derived) {
      return derived;
    }
    const current = this.current();
    return current ? deriveViewFromConfig(current) : null;
  });

  readonly panelHeading = computed(() =>
    this.legacy() ? 'Stored values' : 'Computed by the server',
  );

  constructor() {
    this.orgRequests
      .pipe(
        switchMap((kind) =>
          this.api.organizations(kind).pipe(catchError(() => of([] as OrganizationSummary[]))),
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
      });

    effect(() => {
      if (!this.ready() || this.legacy()) {
        this.deriveRequests.next(null);
        return;
      }
      const kind = this.kind();
      const organizationName = this.organizationName().trim();
      const nestedName = this.nestedName().trim();
      const fileType = this.fileType();
      this.deriveRequests.next(
        kind && organizationName && nestedName && fileType
          ? { kind, organizationName, nestedName, fileType }
          : null,
      );
    });

    effect(() => {
      if (!this.ready() || this.legacy()) {
        return;
      }
      const kind = this.kind();
      const name = this.organizationName().trim().toLowerCase();
      const org = this.orgOptions().find((item) => item.name.trim().toLowerCase() === name);
      if (!kind || !org) {
        this.nestedRequests.next(null);
        return;
      }
      this.nestedRequests.next({ kind, org });
    });

    effect(() => {
      const id = this.id();
      if (id) {
        this.load(id);
      }
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

  setKind(event: MatSelectChange): void {
    const kind = event.value as PartnerType;
    if (this.kind() === kind) {
      return;
    }
    this.kind.set(kind);
    const fileType = this.fileType();
    if (fileType && !isFileTypeForKind(kind, fileType)) {
      this.fileType.set('');
    }
    this.orgOptions.set([]);
    this.orgRequests.next(kind);
    this.clearIssue('organizationName');
  }

  setOrganization(value: string): void {
    this.organizationName.set(value);
    this.clearIssue('organizationName');
  }

  setNested(value: string): void {
    this.nestedName.set(value);
    this.clearIssue('nestedName');
  }

  setFileType(event: MatSelectChange): void {
    const fileType = event.value as ImportType;
    this.fileType.set(fileType);
    this.clearIssue('fileType');
  }

  save(force = false): void {
    const form = this.form();
    const current = this.current();
    if (!form || !current) {
      return;
    }
    form.markAllAsTouched();
    const duplicates = duplicateColumns(form);
    if (duplicates.length) {
      this.localError.set(`Duplicate target columns: ${duplicates.join(', ')}`);
      return;
    }
    const identity = this.identity();
    if (!this.legacy() && (!identity || this.issues().length || !this.derived())) {
      return;
    }
    const payload: LoadConfigUpdate =
      this.legacy() || !identity ? toLegacyWrite(form) : toWriteModel(form, identity);
    const derived = this.derived();
    const document =
      !this.legacy() && identity && derived
        ? materialize(derived, toWriteModel(form, identity))
        : {
            ...structuredClone(current),
            mode: payload.mode,
            bqParams: payload.bqParams,
            mappings: payload.mappings,
          };
    this.saving.set(true);
    this.localError.set(null);
    this.api.validate(document).subscribe({
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
        this.api.update(current.id, payload).subscribe({
          next: (updated) => {
            this.saving.set(false);
            this.validation.set({ errors: [], warnings: [] });
            this.notify.success('Config saved');
            if (updated.id !== current.id) {
              void this.router.navigate(['/load-configs', updated.id], { replaceUrl: true });
              return;
            }
            this.current.set(updated);
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

  confirmDelete(): void {
    const current = this.current();
    if (!current) {
      return;
    }
    const ref = this.dialog.open(DeleteConfigDialog, {
      width: '480px',
      data: { id: current.id, publisherName: current.publisherName },
    });
    ref.afterClosed().subscribe((result: DeleteDialogResult) => {
      if (result === 'delete') {
        this.api.delete(current.id).subscribe({
          next: () => {
            this.notify.success('Config deleted');
            void this.router.navigate(['/load-configs']);
          },
          error: (error) => this.notify.error(toApiException(error).message),
        });
      }
    });
  }

  private load(id: string): void {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.ready.set(false);
    this.error.set(null);
    this.derived.set(null);
    this.issues.set([]);
    this.api.get(id).subscribe({
      next: (config) => {
        if (generation !== this.loadGeneration) {
          return;
        }
        const convention = hasConventionIdentity(config) ? config : null;
        const kind = convention?.kind;
        forkJoin({
          meta: this.api.meta(),
          templates: this.api.templates(),
          orgs: kind ? this.api.organizations(kind) : of([] as OrganizationSummary[]),
        }).subscribe({
          next: ({ meta, templates, orgs }) => {
            if (generation !== this.loadGeneration) {
              return;
            }
            if (!convention || !kind) {
              this.finishLoad(config, meta, templates.items, {
                legacy: true,
                kind: '',
                organizationName: '',
                nestedName: '',
                fileType: '',
                orgs: [],
                nested: [],
              });
              return;
            }
            const org = orgs.find((item) => item.slug === convention.organizationName);
            const nestedRequest = !org
              ? of([] as NestedSummary[])
              : kind === 'advertiser'
                ? this.api.accounts(org.id)
                : this.api.bases(org.slug);
            nestedRequest.subscribe({
              next: (nested) => {
                if (generation !== this.loadGeneration) {
                  return;
                }
                const nestedHit = nested.find((item) => item.slug === convention.nestedName);
                this.finishLoad(config, meta, templates.items, {
                  legacy: false,
                  kind,
                  organizationName: org?.name ?? convention.organizationName,
                  nestedName: nestedHit?.name ?? convention.nestedName,
                  fileType: convention.fileType,
                  orgs,
                  nested,
                });
              },
              error: (error) => this.failLoad(generation, error),
            });
          },
          error: (error) => this.failLoad(generation, error),
        });
      },
      error: (error) => this.failLoad(generation, error),
    });
  }

  private finishLoad(
    config: LoadConfig,
    meta: Meta,
    templates: Parameters<typeof findTemplate>[0],
    identity: {
      legacy: boolean;
      kind: PartnerType | '';
      organizationName: string;
      nestedName: string;
      fileType: ImportType | '';
      orgs: OrganizationSummary[];
      nested: NestedSummary[];
    },
  ): void {
    const template = findTemplate(templates, config.partnerType, config.importType);
    const form = createLoadConfigForm(config);
    setMappings(form, draftsFromConfig(config, template));
    this.current.set(config);
    this.meta.set(meta);
    this.form.set(form);
    this.legacy.set(identity.legacy);
    this.kind.set(identity.kind);
    this.organizationName.set(identity.organizationName);
    this.nestedName.set(identity.nestedName);
    this.fileType.set(identity.fileType);
    this.orgOptions.set(identity.orgs);
    this.nestedOptions.set(identity.nested);
    this.loading.set(false);
    this.ready.set(true);
  }

  private failLoad(generation: number, error: unknown): void {
    if (generation !== this.loadGeneration) {
      return;
    }
    this.error.set(toApiException(error).message);
    this.loading.set(false);
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

  private clearIssue(field: string): void {
    this.issues.update((issues) => issues.filter((issue) => issue.field !== field));
  }

  private applySaveError(error: unknown): void {
    const parsed = fieldIssues(error);
    if (parsed.length) {
      this.issues.set(parsed);
      return;
    }
    this.notify.error(toApiException(error).message);
  }
}
