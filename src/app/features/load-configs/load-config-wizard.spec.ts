import { provideAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import { MockLoadConfigApi } from '../../core/api/mock/mock-load-config-api';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { LoadConfigWizard } from './load-config-wizard';

describe('LoadConfigWizard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadConfigWizard],
      providers: [
        provideAnimations(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '', useMock: true } },
        { provide: LOAD_CONFIG_API, useValue: new MockLoadConfigApi() },
      ],
    }).compileComponents();
  });

  it('prefills the sales template with required columns', async () => {
    const fixture = TestBed.createComponent(LoadConfigWizard);
    await fixture.whenStable();
    const sales = fixture.nativeElement.querySelector(
      '[data-testid="kind-advertiser-sales"]',
    ) as HTMLButtonElement;
    sales.click();
    await fixture.whenStable();
    const continueButton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Continue'),
    ) as HTMLButtonElement;
    continueButton.click();
    await fixture.whenStable();

    const values = [...fixture.nativeElement.querySelectorAll('input')].map(
      (input) => (input as HTMLInputElement).value,
    );
    expect(values).toContain('order_ts');
    expect(values).toContain('price_before_tax');
    expect(fixture.nativeElement.textContent).toContain('Required');
  });
});
