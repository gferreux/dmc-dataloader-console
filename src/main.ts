import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { RUNTIME_CONFIG, loadRuntimeConfig } from './app/core/config/runtime-config';

loadRuntimeConfig()
  .then((config) =>
    bootstrapApplication(App, {
      providers: [{ provide: RUNTIME_CONFIG, useValue: config }, ...appConfig.providers],
    }),
  )
  .catch((error) => console.error(error));
