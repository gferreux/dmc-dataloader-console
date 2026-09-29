import { provideAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LOAD_CONFIG_API } from '../../core/api/load-config-api';
import { MockLoadConfigApi } from '../../core/api/mock/mock-load-config-api';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { LoadConfigList } from './load-config-list';

describe('LoadConfigList', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadConfigList],
      providers: [
        provideAnimations(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '', useMock: true } },
        { provide: LOAD_CONFIG_API, useValue: new MockLoadConfigApi() },
      ],
    }).compileComponents();
  });

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  it('lists active configs and filters by partner', async () => {
    const fixture = TestBed.createComponent(LoadConfigList);
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('demo_retail:demo:optin');
    expect(text()).toContain('sample_brand:sample:sales');
    expect(text()).not.toContain('sample_brand:sample:stores');

    fixture.componentInstance.filters.controls.partnerType.setValue('advertiser');
    await settle();
    await fixture.whenStable();
    expect(text()).toContain('sample_brand:sample:sales');
    expect(text()).not.toContain('demo_retail:demo:optin');
  });
});
