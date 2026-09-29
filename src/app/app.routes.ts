import { Routes } from '@angular/router';

import { LoadConfigEdit } from './features/load-configs/load-config-edit';
import { LoadConfigList } from './features/load-configs/load-config-list';
import { LoadConfigWizard } from './features/load-configs/load-config-wizard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'load-configs' },
      { path: 'load-configs', component: LoadConfigList, title: 'Import configs' },
      { path: 'load-configs/new', component: LoadConfigWizard, title: 'New import config' },
      { path: 'load-configs/:id', component: LoadConfigEdit, title: 'Edit import config' },
    ],
  },
  { path: '**', redirectTo: 'load-configs' },
];
