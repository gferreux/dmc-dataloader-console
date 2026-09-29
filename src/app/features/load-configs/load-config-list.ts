import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';

import { toApiException } from '../../core/api/api-error';
import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
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
    q: '',
  });

  readonly meta = signal<Meta | null>(null);
  readonly items = signal<LoadConfig[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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
        this.items.set(response.items);
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

  confirmDelete(row: LoadConfig): void {
    const ref = this.dialog.open(DeleteConfigDialog, {
      width: '480px',
      data: { id: row.id, publisherName: row.publisherName },
    });
    ref.afterClosed().subscribe((result: DeleteDialogResult) => {
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

  private query(): ListQuery {
    const value = this.filters.getRawValue();
    return {
      partnerType: value.partnerType || undefined,
      importType: value.importType || undefined,
      q: value.q.trim() || undefined,
    };
  }
}
