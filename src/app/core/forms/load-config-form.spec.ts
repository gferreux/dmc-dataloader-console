import { FIXTURES } from '../api/mock/fixtures';
import { TEMPLATES } from '../api/mock/catalog';
import { MAPPING_TYPE_RENAME, MAPPING_TYPE_SQL } from '../models/load-config.model';
import { TAB_DELIMITER } from '../utils/delimiter';
import { hasConventionIdentity } from '../utils/plumbing';
import {
  applyTemplate,
  createLoadConfigForm,
  draftsFromConfig,
  setMappings,
  toWriteModel,
} from './load-config-form';

describe('load config form', () => {
  it('prefills a template and writes only identity, mappings, and load settings', () => {
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
    const written = toWriteModel(form, {
      kind: 'advertiser',
      organizationName: 'Sample Brand',
      nestedName: 'Sample',
      fileType: 'sales',
    });
    expect(written.kind).toBe('advertiser');
    expect(written.organizationName).toBe('Sample Brand');
    expect(written.nestedName).toBe('Sample');
    expect(written.fileType).toBe('sales');
    expect(written.bqParams.fieldDelimiter).toBe('\t');
    expect(written.bqParams.fieldDelimiter).not.toBe('\\t');
    expect(written.bqParams.sourceFormat).toBe(0);
    expect(written.bqParams.nullMarker).toBeNull();
    expect(written).not.toHaveProperty('id');
    expect(written).not.toHaveProperty('publisherName');
    expect(written).not.toHaveProperty('patterns');
    expect(written).not.toHaveProperty('destination');
    expect(written).not.toHaveProperty('organization');
    expect(written).not.toHaveProperty('notification');
    expect(written).not.toHaveProperty('deactivated');
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

  it('keeps a SQL mapping and a legacy document id', () => {
    const optin = FIXTURES.find((item) => item.id === 'demo_retail:demo:optin');
    const legacy = FIXTURES.find((item) => item.id === 'legacy_sample_stores');
    const form = createLoadConfigForm(optin);
    setMappings(form, draftsFromConfig(optin!));
    const idMapping = form.controls.mappings.controls.find(
      (group) => group.controls.column.value === 'id',
    );
    expect(idMapping?.controls.type.value).toBe(MAPPING_TYPE_SQL);
    expect(idMapping?.controls.src.value).toBe('SUBSTR(email, 1, 8)');
    expect(legacy?.organization.type).toBe('advertiser');
    expect(legacy?.organization.account).toBeNull();
    expect(hasConventionIdentity(legacy!)).toBe(false);
    expect(hasConventionIdentity(optin!)).toBe(true);
    expect(optin?.fileType).toBe('optin');
    expect(optin?.organizationName).toBe('demo_retail');
  });
});
