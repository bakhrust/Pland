export function extractFirestoreErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // plain string message
  }
  return raw;
}

export function isTransientFirestoreError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '').toLowerCase()
      : '';
  const msg = extractFirestoreErrorMessage(error).toLowerCase();

  if (
    code.includes('permission-denied') ||
    msg.includes('permission_denied') ||
    msg.includes('missing or insufficient permissions')
  ) {
    return false;
  }

  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'aborted' ||
    msg.includes('code=unavailable') ||
    msg.includes('[unavailable]') ||
    msg.includes('the client is offline') ||
    msg.includes('could not reach cloud firestore backend') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('network-request-failed') ||
    msg.includes('failed to fetch')
  );
}
