import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';

import { toApiException } from '../../core/api/api-error';
import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import { toWriteModelFromConfig } from '../../core/forms/load-config-form';
import { ImportType, ListQuery, LoadConfig, Meta } from '../../core/models/load-config.model';
import { destinationLabel } from '../../core/utils/derive';
import { Notify } from '../../core/notify/notify.service';
import { DeleteConfigDialog, DeleteDialogResult } from './delete-config-dialog';

@Component({
  selector: 'dmc-load-config-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
  ],
  templateUrl: './load-config-list.html',
  styleUrl: './load-config-list.scss',
})
export class LoadConfigList {
  private readonly api = inject(LOAD_CONFIG_API);
  private readonly notify = inject(Notify);
  private readonly dialog = inject(MatDialog);
  private readonly refresh$ = new Subject<void>();

  readonly filters = inject(FormBuilder).nonNullable.group({
    partnerType: '',
    importType: '',
    status: 'active',
    q: '',
  });

  readonly meta = signal<Meta | null>(null);
  readonly items = signal<LoadConfig[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingId = signal<string | null>(null);

  constructor() {
    this.refresh$
      .pipe(
        switchMap(() =>
          this.api.list(this.query()).pipe(
            catchError((error) => {
              this.error.set(toApiException(error).message);
              return of({ items: [] as LoadConfig[] });
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        this.items.set(this.applyStatus(response.items));
        this.loading.set(false);
      });

    this.filters.valueChanges.pipe(debounceTime(200), takeUntilDestroyed()).subscribe(() => this.refresh());
    this.filters.controls.partnerType.valueChanges.pipe(takeUntilDestroyed()).subscribe((partner) => {
      const current = this.filters.controls.importType.value;
      if (current && !this.importOptions(partner).includes(current as ImportType)) {
        this.filters.controls.importType.setValue('');
      }
    });

    this.api
      .meta()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (meta) => this.meta.set(meta),
        error: (error) => this.error.set(toApiException(error).message),
      });
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.refresh$.next();
  }

  importOptions(partner = this.filters.controls.partnerType.value): ImportType[] {
    const meta = this.meta();
    if (!meta) {
      return [];
    }
    if (partner === 'publisher' || partner === 'advertiser') {
      return meta.importTypes[partner];
    }
    return [...meta.importTypes.publisher, ...meta.importTypes.advertiser];
  }

  destination(config: LoadConfig): string {
    return destinationLabel(config);
  }

  setActive(row: LoadConfig, event: MatSlideToggleChange): void {
    this.updateActive(row, event.checked, () => {
      event.source.checked = !row.deactivated;
    });
  }

  confirmDelete(row: LoadConfig): void {
    const ref = this.dialog.open(DeleteConfigDialog, {
      width: '480px',
      data: { id: row.id, publisherName: row.publisherName, deactivated: row.deactivated },
    });
    ref.afterClosed().subscribe((result: DeleteDialogResult) => {
      if (result === 'deactivate') {
        this.updateActive(row, false);
        return;
      }
      if (result === 'delete') {
        this.api.delete(row.id).subscribe({
          next: () => {
            this.notify.success('Config deleted');
            this.refresh();
          },
          error: (error) => this.notify.error(toApiException(error).message),
        });
      }
    });
  }

  private updateActive(row: LoadConfig, active: boolean, revert?: () => void): void {
    this.savingId.set(row.id);
    const write = toWriteModelFromConfig(row);
    write.deactivated = !active;
    this.api.update(row.id, write).subscribe({
      next: (updated) => {
        this.savingId.set(null);
        this.notify.success(updated.deactivated ? 'Config deactivated' : 'Config activated');
        this.refresh();
      },
      error: (error) => {
        this.savingId.set(null);
        this.notify.error(toApiException(error).message);
        revert?.();
      },
    });
  }

  private query(): ListQuery {
    const value = this.filters.getRawValue();
    return {
      partnerType: value.partnerType || undefined,
      importType: value.importType || undefined,
      q: value.q.trim() || undefined,
      includeDeactivated: value.status !== 'active',
    };
  }

  private applyStatus(items: LoadConfig[]): LoadConfig[] {
    const status = this.filters.controls.status.value;
    if (status === 'deactivated') {
      return items.filter((item) => item.deactivated);
    }
    if (status === 'active') {
      return items.filter((item) => !item.deactivated);
    }
    return items;
  }
}
