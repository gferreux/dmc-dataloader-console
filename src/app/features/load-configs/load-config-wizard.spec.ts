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

  it('walks an advertiser through file type and prefills the sales template', async () => {
    const fixture = TestBed.createComponent(LoadConfigWizard);
    fixture.detectChanges();
    await fixture.whenStable();

    click(fixture.nativeElement, '[data-testid="kind-advertiser"]');
    fixture.detectChanges();
    await fixture.whenStable();
    clickButton(fixture.nativeElement, 'Continue');
    fixture.detectChanges();
    await fixture.whenStable();

    await typeInto(fixture, 'organization-name', 'Sample Brand');
    click(fixture.nativeElement, '[data-testid="wizard-continue"]');
    fixture.detectChanges();
    await fixture.whenStable();

    await typeInto(fixture, 'nested-name', 'Sample');
    click(fixture.nativeElement, '[data-testid="wizard-continue"]');
    fixture.detectChanges();
    await fixture.whenStable();

    click(fixture.nativeElement, '[data-testid="kind-advertiser-sales"]');
    fixture.detectChanges();
    await fixture.whenStable();
    click(fixture.nativeElement, '[data-testid="wizard-continue"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const values = [...fixture.nativeElement.querySelectorAll('input')].map(
      (input) => (input as HTMLInputElement).value,
    );
    expect(values).toContain('order_ts');
    expect(values).toContain('price_before_tax');
    expect(fixture.nativeElement.textContent).toContain('Required');
    expect(fixture.nativeElement.textContent).toContain('Computed by the server');
    expect(fixture.nativeElement.querySelector('[formcontrolname="projectId"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[formcontrolname="preprocess"]')).toBeNull();
  });
});

function click(root: ParentNode, selector: string): void {
  const element = root.querySelector(selector) as HTMLButtonElement | null;
  expect(element).toBeTruthy();
  element?.click();
}

function clickButton(root: ParentNode, text: string): void {
  const button = [...root.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(text),
  );
  expect(button).toBeTruthy();
  (button as HTMLButtonElement).click();
}

async function typeInto(
  fixture: {
    nativeElement: ParentNode;
    detectChanges: () => void;
    whenStable: () => Promise<unknown>;
  },
  testId: string,
  value: string,
): Promise<void> {
  const input = fixture.nativeElement.querySelector(
    `[data-testid="${testId}"]`,
  ) as HTMLInputElement;
  expect(input).toBeTruthy();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
  await fixture.whenStable();
}
