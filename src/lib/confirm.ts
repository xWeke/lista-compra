// Diálogos simples del navegador. En iPhone (Safari / PWA) se muestran como alertas nativas.

export function confirm(title: string, message: string): boolean {
  return window.confirm(`${title}\n\n${message}`);
}

export function notifyError(error: unknown) {
  // Los errores de Supabase (PostgrestError) traen `message` aunque no siempre sean instancias de Error.
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
  window.alert(message);
}
