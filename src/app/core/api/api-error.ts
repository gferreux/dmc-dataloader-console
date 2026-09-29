import { HttpErrorResponse } from '@angular/common/http';

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
