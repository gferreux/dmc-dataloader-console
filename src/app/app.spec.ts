import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { App } from './app';
import { appConfig } from './app.config';
import { RUNTIME_CONFIG } from './core/config/runtime-config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '', useMock: true } },
        ...appConfig.providers,
      ],
    }).compileComponents();
  });

  it('creates the console shell', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Import configs');
    expect(compiled.textContent).toContain('SFTP accounts');
    expect(compiled.textContent).toContain('Mock API');
  });
});
