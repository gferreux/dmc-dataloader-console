import { ApiException, toApiException } from './api-error';

export type SftpFieldName = 'user' | 'base' | 'clientType' | 'passwordMode' | 'publicKeys';

export type SftpFieldErrors = Partial<Record<SftpFieldName, string>>;

export interface SftpErrorView {
  message: string;
  fields: SftpFieldErrors;
  notConfigured: boolean;
}

const FIELD_NAMES: readonly SftpFieldName[] = [
  'user',
  'base',
  'clientType',
  'passwordMode',
  'publicKeys',
];

const BUCKET_MISMATCH =
  'This account is already on a different bucket, so this base cannot be added.';
const SFTPGO_FAILED = 'SFTPGo returned an error. The account was not changed.';
export const SFTPGO_NOT_CONFIGURED = 'SFTPGo is not configured on the server.';
const VALIDATION_FALLBACK = 'Check the user name, base, and client type.';

export function sftpErrorView(error: unknown): SftpErrorView {
  const exception = toApiException(error);
  const fields = readFields(exception.details);
  switch (exception.status) {
    case 422:
      return {
        message: Object.keys(fields).length
          ? 'Some fields need attention.'
          : readable(exception, VALIDATION_FALLBACK),
        fields,
        notConfigured: false,
      };
    case 409:
      return bucketView(exception);
    case 502:
      return {
        message: SFTPGO_FAILED,
        fields: {},
        notConfigured: false,
      };
    case 503:
      return {
        message: SFTPGO_NOT_CONFIGURED,
        fields: {},
        notConfigured: true,
      };
    default:
      if (exception.code === 'bucket_mismatch') {
        return bucketView(exception);
      }
      return {
        message: readable(exception, 'Request failed.'),
        fields: {},
        notConfigured: false,
      };
  }
}

function bucketView(exception: ApiException): SftpErrorView {
  return {
    message: detail(BUCKET_MISMATCH, exception),
    fields: {},
    notConfigured: false,
  };
}

function detail(fallback: string, exception: ApiException): string {
  const message = readable(exception, '');
  if (!message || message === fallback) {
    return fallback;
  }
  return `${fallback} ${message}`;
}

function readable(exception: ApiException, fallback: string): string {
  const message = exception.message?.trim() ?? '';
  if (!message || message === 'Request failed' || message.startsWith('Http failure')) {
    return fallback;
  }
  return message;
}

function readFields(details: unknown): SftpFieldErrors {
  const fields: SftpFieldErrors = {};
  for (const issue of readIssues(details)) {
    if (isFieldName(issue.field) && !fields[issue.field]) {
      fields[issue.field] = issue.message;
    }
  }
  return fields;
}

function readIssues(details: unknown): { field: string; message: string }[] {
  const list = Array.isArray(details)
    ? details
    : details && typeof details === 'object' && 'errors' in details
      ? (details as { errors: unknown }).errors
      : [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter(isIssue);
}

function isIssue(value: unknown): value is { field: string; message: string } {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const issue = value as { field?: unknown; message?: unknown };
  return typeof issue.field === 'string' && typeof issue.message === 'string';
}

function isFieldName(value: string): value is SftpFieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}
