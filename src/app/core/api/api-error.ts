import { HttpErrorResponse } from '@angular/common/http';

import { FieldMessage } from '../models/load-config.model';

export class ApiException extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export function toApiException(error: unknown): ApiException {
  if (error instanceof ApiException) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    const envelope = readEnvelope(error.error);
    return new ApiException(
      error.status,
      envelope?.code || 'http_error',
      envelope?.message || error.message || 'Request failed',
      envelope?.details,
    );
  }
  if (error instanceof Error) {
    return new ApiException(0, 'unknown', error.message);
  }
  return new ApiException(0, 'unknown', 'Unexpected error');
}

export function fieldIssues(error: unknown): FieldMessage[] {
  const exception = toApiException(error);
  const parsed = readIssues(exception.details).map((issue) => ({
    field: canonicalField(issue.field, issue.message),
    message: issue.message,
  }));
  if (parsed.length) {
    return parsed;
  }
  if (exception.status !== 422) {
    return [];
  }
  const message = exception.message || 'Request failed';
  if (/account|base/i.test(message)) {
    return [{ field: 'nestedName', message }];
  }
  if (/organi[sz]ation/i.test(message)) {
    return [{ field: 'organizationName', message }];
  }
  if (/file.?type|import/i.test(message)) {
    return [{ field: 'fileType', message }];
  }
  return [];
}

export function canonicalField(field: string, message = ''): string {
  const token = field.toLowerCase();
  if (token === 'organizationname' || token.includes('organization')) {
    return 'organizationName';
  }
  if (
    token === 'nestedname' ||
    token.includes('account') ||
    token.includes('base') ||
    token.includes('nested')
  ) {
    return 'nestedName';
  }
  if (token === 'filetype' || token.includes('filetype') || token.includes('import')) {
    return 'fileType';
  }
  if (/account|base/i.test(message)) {
    return 'nestedName';
  }
  if (/organi[sz]ation/i.test(message)) {
    return 'organizationName';
  }
  return field;
}

function readIssues(details: unknown): FieldMessage[] {
  if (Array.isArray(details)) {
    return details.filter(isFieldMessage);
  }
  if (details && typeof details === 'object' && 'errors' in details) {
    const errors = (details as { errors: unknown }).errors;
    if (Array.isArray(errors)) {
      return errors.filter(isFieldMessage);
    }
  }
  return [];
}

function isFieldMessage(value: unknown): value is FieldMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const issue = value as FieldMessage;
  return typeof issue.field === 'string' && typeof issue.message === 'string';
}

function readEnvelope(body: unknown): ErrorEnvelope['error'] | undefined {
  if (!body) {
    return undefined;
  }
  if (typeof body === 'string') {
    try {
      return readEnvelope(JSON.parse(body));
    } catch {
      return { message: body };
    }
  }
  if (typeof body === 'object' && 'error' in body) {
    const envelope = (body as ErrorEnvelope).error;
    if (envelope && typeof envelope === 'object') {
      return envelope;
    }
  }
  return undefined;
}
