import { Component, input } from '@angular/core';

import { DeriveResult } from '../../core/models/load-config.model';

@Component({
  selector: 'dmc-computed-panel',
  templateUrl: './computed-panel.html',
  styleUrl: './computed-panel.scss',
})
export class ComputedPanel {
  readonly result = input<DeriveResult | null>(null);
  readonly pending = input(false);
  readonly heading = input('Computed by the server');

  accountText(account: string | null | undefined): string {
    if (account === '') {
      return '""';
    }
    return account ?? '—';
  }
}
