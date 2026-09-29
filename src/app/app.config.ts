import { HttpClient, provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { LOAD_CONFIG_API, loadConfigApiFactory } from './core/api/load-config-api';
import { RUNTIME_CONFIG } from './core/config/runtime-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    {
      provide: LOAD_CONFIG_API,
      useFactory: loadConfigApiFactory,
      deps: [HttpClient, RUNTIME_CONFIG],
    },
  ],
};
