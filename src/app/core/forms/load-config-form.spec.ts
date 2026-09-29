import { TEMPLATES } from '../api/mock/catalog';
import { TAB_DELIMITER } from '../utils/delimiter';
import { applyTemplate, createLoadConfigForm, toWriteModel } from './load-config-form';

describe('load config form', () => {
  it('prefills a template, marks required columns and keeps a tab delimiter', () => {
    const form = createLoadConfigForm();
    const sales = TEMPLATES.find((item) => item.importType === 'sales');
    expect(sales).toBeTruthy();
    applyTemplate(form, sales!);

    const orderTs = form.controls.mappings.controls.find(
      (group) => group.controls.column.value === 'order_ts',
    );
    expect(orderTs?.controls.required.value).toBe(true);
    expect(orderTs?.controls.src.value).toBe('order_ts');
    expect(form.controls.mode.value).toBe('INCREMENTAL');
    expect(form.controls.incremental.value).toBe(true);

    form.controls.fieldDelimiter.setValue(TAB_DELIMITER);
    expect(toWriteModel(form).bqParams.fieldDelimiter).toBe('\t');
    expect(toWriteModel(form).bqParams.fieldDelimiter).not.toBe('\\t');
  });

  it('prefills country with the SQL literal for the default FR hint', () => {
    const form = createLoadConfigForm();
    const customers = TEMPLATES.find((item) => item.importType === 'customers');
    applyTemplate(form, customers!);
    const country = form.controls.mappings.controls.find(
      (group) => group.controls.column.value === 'country',
    );
    expect(country?.controls.src.value).toBe("'FR'");
    expect(country?.controls.required.value).toBe(false);
  });
});
