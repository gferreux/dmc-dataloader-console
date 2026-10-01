import { provideAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, throwError } from 'rxjs';

import { ApiException } from '../../core/api/api-error';
import { MockSftpAccountApi } from '../../core/api/mock/mock-sftp-account-api';
import { SFTP_ACCOUNT_API, SftpAccountApi } from '../../core/api/sftp-account-api';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { SftpAccountPreview, SftpAccountRequest } from '../../core/models/sftp-account.model';
import { SftpAccounts } from './sftp-accounts';

describe('SftpAccounts', () => {
  async function setup(api: SftpAccountApi = new MockSftpAccountApi()): Promise<{
    fixture: ReturnType<typeof TestBed.createComponent<SftpAccounts>>;
    api: SftpAccountApi;
  }> {
    await TestBed.configureTestingModule({
      imports: [SftpAccounts],
      providers: [
        provideAnimations(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '', useMock: true } },
        { provide: SFTP_ACCOUNT_API, useValue: api },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SftpAccounts);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, api };
  }

  function text(fixture: { nativeElement: HTMLElement }): string {
    return fixture.nativeElement.textContent ?? '';
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  it('shows validation errors and does not preview an invalid account', async () => {
    const { fixture, api } = await setup();
    const preview = vi.spyOn(api, 'preview');
    const component = fixture.componentInstance;
    component.form.controls.user.setValue('Acme');
    component.form.controls.base.setValue('bad base');
    component.form.markAllAsTouched();
    fixture.detectChanges();

    const previewButton = fixture.nativeElement.querySelector(
      '[data-testid="preview-account"]',
    ) as HTMLButtonElement;
    expect(previewButton.disabled).toBe(true);
    previewButton.click();
    fixture.detectChanges();

    expect(text(fixture)).toContain('Use lowercase letters, digits, hyphens, and underscores.');
    expect(text(fixture)).toContain('Choose a publisher or an advertiser.');
    expect(fixture.nativeElement.querySelector('[data-testid="preview-plan"]')).toBeNull();
    expect(preview).not.toHaveBeenCalled();
  });

  it('looks up an existing user and lists the current bases', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.form.controls.user.setValue('demo_retail');
    await settle();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const notice = fixture.nativeElement.querySelector('[data-testid="existing-account"]');
    expect(notice?.textContent).toContain('already exists');
    expect(notice?.textContent).toContain('demo_fr');
    expect(text(fixture)).toContain('A new base will be added');
  });

  it('previews the plan and then creates the account', async () => {
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    component.form.controls.user.setValue('new_shop');
    component.form.controls.base.setValue('paris');
    component.selectClient('advertiser');
    fixture.detectChanges();

    expect(text(fixture)).toContain('/paris/blacklists');
    expect(text(fixture)).toContain('/paris/customers');
    expect(text(fixture)).toContain('/paris/stores');
    expect(text(fixture)).toContain('/paris/sales');

    click(fixture.nativeElement, '[data-testid="preview-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const plan = fixture.nativeElement.querySelector('[data-testid="preview-plan"]');
    expect(plan?.textContent).toContain('dkp-dmc-advertisers-raw-euw1-dev');
    expect(plan?.textContent).toContain('Create a new SFTP user');
    expect(plan?.textContent).toContain('Create');
    expect(plan?.textContent).toContain('/paris/sales');

    click(fixture.nativeElement, '[data-testid="create-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const result = fixture.nativeElement.querySelector('[data-testid="create-result"]');
    expect(result?.textContent).toContain('SFTP account created');
    expect(result?.textContent).toContain('new_shop');
    expect(result?.textContent).toContain('paris');
    expect(result?.textContent).toContain('Verified');
  });

  it('shows a generated password once and drops it when the page is left', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { fixture } = await setup();
    const component = fixture.componentInstance;
    component.form.controls.user.setValue('secret_shop');
    component.form.controls.base.setValue('lyon');
    component.selectClient('publisher');
    fixture.detectChanges();

    click(fixture.nativeElement, '[data-testid="preview-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    click(fixture.nativeElement, '[data-testid="create-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '[data-testid="generated-password-value"]',
    ) as HTMLInputElement;
    expect(input.value).toMatch(/^[A-Za-z0-9_.!@#%+=-]{24}$/);
    expect(text(fixture)).toContain('will not be shown again');
    expect(text(fixture)).toContain('not stored in this browser');
    expect(setItem).not.toHaveBeenCalled();
    expect(fixture.nativeElement.ownerDocument.location.href).not.toContain(input.value);
    expect(component.outcome()?.generatedPassword).toBeUndefined();

    const revealed = input.value;
    fixture.destroy();
    expect(component.secret()).toBeNull();
    expect(JSON.stringify(component.outcome())).not.toContain(revealed);
    setItem.mockRestore();
  });

  it('shows the not-configured state instead of the form', async () => {
    const { fixture } = await setup(new MockSftpAccountApi({ configured: false }));
    expect(text(fixture)).toContain('SFTPGo is not configured on the server');
    expect(fixture.nativeElement.querySelector('[data-testid="sftp-user"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows inline errors for bucket mismatch, SFTPGo failure, and validation', async () => {
    const conflict = new MockSftpAccountApi();
    conflict.preview = () =>
      throwError(
        () => new ApiException(409, 'conflict', 'user demo_retail is on bucket other, expected x'),
      );
    const { fixture } = await setup(conflict);
    fillReady(fixture.componentInstance);
    fixture.detectChanges();
    click(fixture.nativeElement, '[data-testid="preview-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('[data-testid="sftp-error"]');
    expect(banner?.textContent).toContain('different bucket');
    expect(banner?.textContent).toContain('expected x');
  });

  it('shows an inline SFTPGo error and a field validation error', async () => {
    const failing = new MockSftpAccountApi();
    let calls = 0;
    failing.preview = (body: SftpAccountRequest): Observable<SftpAccountPreview> => {
      calls += 1;
      if (calls === 1) {
        return throwError(() => new ApiException(502, 'bad_gateway', 'raw upstream dump'));
      }
      void body;
      return throwError(
        () =>
          new ApiException(422, 'validation_error', 'invalid user', [
            { field: 'user', message: 'That user name is reserved.' },
          ]),
      );
    };
    const { fixture } = await setup(failing);
    fillReady(fixture.componentInstance);
    fixture.detectChanges();

    click(fixture.nativeElement, '[data-testid="preview-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="sftp-error"]')?.textContent).toBe(
      'SFTPGo returned an error. The account was not changed.',
    );

    click(fixture.nativeElement, '[data-testid="preview-account"]');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(fixture)).toContain('Some fields need attention.');
    expect(text(fixture)).toContain('That user name is reserved.');
  });
});

function fillReady(component: SftpAccounts): void {
  component.form.controls.user.setValue('acme');
  component.form.controls.base.setValue('acme_fr');
  component.selectClient('publisher');
}

function click(root: ParentNode, selector: string): void {
  const element = root.querySelector(selector) as HTMLButtonElement | null;
  expect(element).toBeTruthy();
  element?.click();
}
