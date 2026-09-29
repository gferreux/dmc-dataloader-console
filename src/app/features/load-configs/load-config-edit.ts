import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { toApiException } from '../../core/api/api-error';
import { findTemplate } from '../../core/api/mock/catalog';
import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import {
  LoadConfigForm,
  createLoadConfigForm,
  draftsFromConfig,
  duplicateColumns,
  setMappings,
  toWriteModel,
} from '../../core/forms/load-config-form';
import { LoadConfig, Meta, ValidationResult } from '../../core/models/load-config.model';
import { Notify } from '../../core/notify/notify.service';
import { ValidationPanel } from '../../shared/validation-panel';
import { ConfigForm } from './config-form';
import { DeleteConfigDialog, DeleteDialogResult } from './delete-config-dialog';

@Component({
  selector: 'dmc-load-config-edit',
  imports: [MatButton, RouterLink, ConfigForm, ValidationPanel],
  templateUrl: './load-config-edit.html',
  styleUrl: './load-config-edit.scss',
})
export class LoadConfigEdit {
  private readonly api = inject(LOAD_CONFIG_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(Notify);
  private readonly dialog = inject(MatDialog);
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null as string | null,
  });

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly current = signal<LoadConfig | null>(null);
  readonly meta = signal<Meta | null>(null);
  readonly form = signal<LoadConfigForm | null>(null);
  readonly validation = signal<ValidationResult | null>(null);
  readonly localError = signal<string | null>(null);
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) {
        this.load(id);
      }
    });
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
    const payload = toWriteModel(form);
    this.saving.set(true);
    this.localError.set(null);
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
        this.api.update(current.id, payload).subscribe({
          next: (updated) => {
            this.current.set(updated);
            this.saving.set(false);
            this.validation.set({ errors: [], warnings: [] });
            this.notify.success(updated.deactivated ? 'Config saved and deactivated' : 'Config saved');
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

  confirmDelete(): void {
    const current = this.current();
    if (!current) {
      return;
    }
    const ref = this.dialog.open(DeleteConfigDialog, {
      width: '480px',
      data: { id: current.id, publisherName: current.publisherName, deactivated: current.deactivated },
    });
    ref.afterClosed().subscribe((result: DeleteDialogResult) => {
      if (result === 'deactivate') {
        this.form()?.controls.deactivated.setValue(true);
        this.save(true);
        return;
      }
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
    forkJoin({
      config: this.api.get(id),
      meta: this.api.meta(),
      templates: this.api.templates(),
    }).subscribe({
      next: ({ config, meta, templates }) => {
        const template = findTemplate(templates.items, config.partnerType, config.importType);
        const form = createLoadConfigForm(config);
        setMappings(form, draftsFromConfig(config, template));
        this.current.set(config);
        this.meta.set(meta);
        this.form.set(form);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(toApiException(error).message);
        this.loading.set(false);
      },
    });
  }
}
