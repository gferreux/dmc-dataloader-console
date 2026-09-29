import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import { SignedInUser } from '../models/load-config.model';

@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  readonly user = signal<SignedInUser | null>(null);

  constructor() {
    if (this.config.useMock) {
      this.user.set({ email: 'demo.user@example.com', id: 'demo-user' });
      return;
    }
    this.http.get<{ email?: string; id?: string }>('/whoami').subscribe({
      next: (body) => {
        const email = iapEmail(body.email);
        if (email) {
          this.user.set({ email, id: body.id || email });
        }
      },
      error: () => this.user.set(null),
    });
  }
}

export function iapEmail(raw: string | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const separator = raw.indexOf(':');
  const value = separator >= 0 ? raw.slice(separator + 1) : raw;
  return value.trim() || null;
}

export function initials(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return (letters || local.slice(0, 2)).toUpperCase();
}
