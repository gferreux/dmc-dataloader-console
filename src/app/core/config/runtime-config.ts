import { InjectionToken } from '@angular/core';

export interface RuntimeConfig {
  apiBaseUrl: string;
  useMock: boolean;
}

export const RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>('RUNTIME_CONFIG');

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: '',
  useMock: true,
};

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const response = await fetch('/assets/runtime-config.json', { cache: 'no-store' });
    if (!response.ok) {
      return DEFAULT_RUNTIME_CONFIG;
    }
    const body = (await response.json()) as Partial<RuntimeConfig>;
    return {
      apiBaseUrl: typeof body.apiBaseUrl === 'string' ? body.apiBaseUrl : '',
      useMock: Boolean(body.useMock),
    };
  } catch {
    return DEFAULT_RUNTIME_CONFIG;
  }
}
