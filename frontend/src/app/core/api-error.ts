import { HttpErrorResponse } from '@angular/common/http';

/** Error body returned by the API (ApiErrorResponse in the backend). */
export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  errors: Record<string, string[]>;
}

export function isApiError(
  error: unknown,
  status?: number,
  code?: string,
): error is HttpErrorResponse {
  if (!(error instanceof HttpErrorResponse)) return false;
  const body = error.error as Partial<ApiErrorBody> | null;
  return (
    (status === undefined || error.status === status) && (code === undefined || body?.code === code)
  );
}

/** Turns any failure into a message that can be shown to the user (the API already answers in Portuguese). */
export function errorMessage(
  error: unknown,
  fallback = 'Não foi possível concluir a operação.',
): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Não foi possível conectar à API.';
    const body = error.error as Partial<ApiErrorBody> | null;
    return body?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
