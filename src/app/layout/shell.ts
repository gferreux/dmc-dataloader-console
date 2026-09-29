import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { RUNTIME_CONFIG } from '../core/config/runtime-config';
import { IdentityService, initials } from '../core/identity/identity.service';

@Component({
  selector: 'dmc-shell',
  imports: [MatSidenavModule, RouterOutlet, RouterLink, RouterLinkActive, MatIcon, MatIconButton],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly identity = inject(IdentityService);
  readonly config = inject(RUNTIME_CONFIG);
  readonly user = this.identity.user;
  readonly menuOpen = signal(false);
  readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  initials(email: string): string {
    return initials(email);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
