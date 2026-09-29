import { FIXTURES } from '../api/mock/fixtures';
import { TEMPLATES } from '../api/mock/catalog';
import { MAPPING_TYPE_RENAME, MAPPING_TYPE_SQL } from '../models/load-config.model';
import { TAB_DELIMITER } from '../utils/delimiter';
import { applyTemplate, createLoadConfigForm, setMappings, draftsFromConfig, toWriteModel } from './load-config-form';

describe('load config form', () => {
  it('prefills a template with RENAME mappings and a numeric CSV source format', () => {
    const form = createLoadConfigForm();
    const sales = TEMPLATES.find((item) => item.importType === 'sales');
    expect(sales).toBeTruthy();
    applyTemplate(form, sales!);

    const orderTs = form.controls.mappings.controls.find(
      (group) => group.controls.column.value === 'order_ts',
    );
    expect(orderTs?.controls.required.value).toBe(true);
    expect(orderTs?.controls.src.value).toBe('order_ts');
    expect(orderTs?.controls.type.value).toBe(MAPPING_TYPE_RENAME);
    expect(orderTs?.controls.bqType.value).toBe('TIMESTAMP');
    expect(form.controls.mode.value).toBe('APPEND');
    expect(form.controls.sourceFormat.value).toBe(0);

    form.controls.fieldDelimiter.setValue(TAB_DELIMITER);
    const written = toWriteModel(form);
    expect(written.bqParams.fieldDelimiter).toBe('\t');
    expect(written.bqParams.fieldDelimiter).not.toBe('\\t');
    expect(written.bqParams.sourceFormat).toBe(0);
    expect(written.bqParams.nullMarker).toBeNull();
    expect(written.organization.account).toBeNull();
    expect(written).not.toHaveProperty('deactivated');
    expect(written).not.toHaveProperty('incremental');
    expect(Object.values(written.mappings)[0]).not.toHaveProperty('isPartitionKey');
  });

  it('keeps country as a renamed CSV column', () => {
    const form = createLoadConfigForm();
    const customers = TEMPLATES.find((item) => item.importType === 'customers');
    applyTemplate(form, customers!);
    const country = form.controls.mappings.controls.find(
      (group) => group.controls.column.value === 'country',
    );
    expect(country?.controls.src.value).toBe('country');
    expect(country?.controls.type.value).toBe(MAPPING_TYPE_RENAME);
    expect(country?.controls.required.value).toBe(false);
  });

  it('displays a legacy organization type and a SQL mapping', () => {
    const stores = FIXTURES.find((item) => item.id === 'sample_brand:sample:stores');
    const optin = FIXTURES.find((item) => item.id === 'demo_retail:demo:optin');
    expect(stores?.organization.type).toBe('referential');
    const form = createLoadConfigForm(stores);
    setMappings(form, draftsFromConfig(stores!));
    expect(form.controls.organizationType.value).toBe('referential');
    expect(form.controls.organizationAccount.value).toBe('');
    expect(toWriteModel(form).organization.type).toBe('referential');
    expect(toWriteModel(form).organization.account).toBeNull();

    const idMapping = optin?.mappings['id'];
    expect(idMapping?.type).toBe(MAPPING_TYPE_SQL);
    expect(idMapping?.src).toBe('SUBSTR(email, 1, 8)');
  });
});
