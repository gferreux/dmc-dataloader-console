import { Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { toApiException } from '../../core/api/api-error';
import { findTemplate } from '../../core/api/mock/catalog';
import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import {
  LoadConfigForm,
  applyTemplate,
  createLoadConfigForm,
  duplicateColumns,
  toWriteModel,
} from '../../core/forms/load-config-form';
import {
  ImportTemplate,
  ImportType,
  Meta,
  PartnerType,
  ValidationResult,
} from '../../core/models/load-config.model';
import { delimiterLabel } from '../../core/utils/delimiter';
import { Notify } from '../../core/notify/notify.service';
import { ValidationPanel } from '../../shared/validation-panel';
import { ConfigForm } from './config-form';

@Component({
  selector: 'dmc-load-config-wizard',
  imports: [MatButton, RouterLink, ConfigForm, ValidationPanel],
  templateUrl: './load-config-wizard.html',
  styleUrl: './load-config-wizard.scss',
})
export class LoadConfigWizard {
  private readonly api = inject(LOAD_CONFIG_API);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private appliedKey = '';

  readonly steps = ['Import kind', 'Configuration', 'Review'];
  readonly publisherKinds: ImportType[] = ['optin', 'optout'];
  readonly advertiserKinds: ImportType[] = ['blacklists', 'customers', 'stores', 'sales'];
  readonly step = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly meta = signal<Meta | null>(null);
  readonly templates = signal<ImportTemplate[]>([]);
  readonly partner = signal<PartnerType | ''>('');
  readonly importType = signal<ImportType | ''>('');
  readonly form = signal<LoadConfigForm | null>(null);
  readonly validation = signal<ValidationResult | null>(null);
  readonly localError = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
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

  select(partner: PartnerType, importType: ImportType): void {
    this.partner.set(partner);
    this.importType.set(importType);
  }

  label(importType: ImportType): string {
    return this.templates().find((item) => item.importType === importType)?.label ?? importType;
  }

  continueFromKind(): void {
    const partner = this.partner();
    const importType = this.importType();
    const template = findTemplate(this.templates(), partner, importType);
    if (!partner || !importType || !template) {
      return;
    }
    const key = `${partner}:${importType}`;
    if (this.appliedKey !== key) {
      const form = createLoadConfigForm();
      applyTemplate(form, template);
      this.form.set(form);
      this.appliedKey = key;
      this.validation.set(null);
    }
    this.step.set(1);
  }

  goToReview(): void {
    const form = this.form();
    if (!form) {
      return;
    }
    form.markAllAsTouched();
    const duplicates = duplicateColumns(form);
    if (duplicates.length) {
      this.localError.set(`Duplicate target columns: ${duplicates.join(', ')}`);
      return;
    }
    this.localError.set(null);
    this.step.set(2);
    this.validateOnly();
  }

  save(force = false): void {
    const form = this.form();
    if (!form) {
      return;
    }
    form.markAllAsTouched();
    const duplicates = duplicateColumns(form);
    if (duplicates.length) {
      this.localError.set(`Duplicate target columns: ${duplicates.join(', ')}`);
      return;
    }
    const payload = toWriteModel(form);
    this.saving.set(true);
    this.api.validate(payload).subscribe({
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
            this.notify.error(toApiException(error).message);
          },
        });
      },
      error: (error) => {
        this.saving.set(false);
        this.notify.error(toApiException(error).message);
      },
    });
  }

  delimiter(): string {
    const form = this.form();
    return form ? delimiterLabel(form.controls.fieldDelimiter.value) : '';
  }

  mappingCount(): number {
    return this.form()?.controls.mappings.length ?? 0;
  }

  private validateOnly(): void {
    const form = this.form();
    if (!form) {
      return;
    }
    this.api.validate(toWriteModel(form)).subscribe({
      next: (validation) => this.validation.set(validation),
      error: (error) => this.notify.error(toApiException(error).message),
    });
  }
}
