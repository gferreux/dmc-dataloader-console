import { provideAnimations } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';

import { META, TEMPLATES } from '../../core/api/mock/catalog';
import { applyTemplate, createLoadConfigForm } from '../../core/forms/load-config-form';
import { MappingEditor } from './mapping-editor';

describe('MappingEditor', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MappingEditor],
      providers: [provideAnimations()],
    }).compileComponents();
  });

  it('adds, reorders and suggests sources for empty rows', async () => {
    const form = createLoadConfigForm();
    const template = TEMPLATES.find((item) => item.importType === 'optout');
    applyTemplate(form, template!);
    form.controls.mappings.at(0).controls.src.setValue('');

    const fixture = TestBed.createComponent(MappingEditor);
    fixture.componentRef.setInput('mappings', form.controls.mappings);
    fixture.componentRef.setInput('mappingTypes', META.mappingTypes);
    fixture.componentRef.setInput('fieldDelimiter', ',');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Required');
    const add = fixture.nativeElement.querySelector('[data-testid="add-column"]') as HTMLButtonElement;
    add.click();
    await fixture.whenStable();
    expect(form.controls.mappings.length).toBe(2);

    const up = fixture.nativeElement.querySelector('[data-testid="move-up-1"]') as HTMLButtonElement;
    up.click();
    await fixture.whenStable();
    expect(form.controls.mappings.at(0).controls.column.value).toBe('');

    const header = fixture.nativeElement.querySelector('[data-testid="header-paste"]') as HTMLTextAreaElement;
    header.value = 'sha256_mobile_phone';
    header.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const apply = fixture.nativeElement.querySelector('[data-testid="apply-suggestions"]') as HTMLButtonElement;
    expect(apply).toBeTruthy();
    apply.click();
    await fixture.whenStable();
    const matched = form.controls.mappings.controls.find(
      (group) => group.controls.column.value === 'sha256_mobile_phone',
    );
    expect(matched?.controls.src.value).toBe('sha256_mobile_phone');
  });
});
