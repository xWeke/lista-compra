// Modo claro / oscuro. El usuario elige Automático (sigue al sistema), Claro u Oscuro; se recuerda
// en este dispositivo. Se aplica con <html data-theme="light|dark">, que activa las variables CSS del modo.

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

const STORAGE_KEY = 'lista-compra:tema';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  } catch {
    // localStorage no disponible (modo privado): Automático
  }
  return 'auto';
}

/** Pinta la barra del navegador / de estado del iPhone con el color de la cabecera del estilo y modo actuales. */
export function syncThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--color-header-bg').trim();
  if (!color) return;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = color;
  });
}

let current: ThemeChoice = 'auto';

function render() {
  const dark = current === 'dark' || (current === 'auto' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  syncThemeColor();
}

/** Aplica y recuerda la elección. En "Automático" sigue los cambios del sistema en vivo. */
export function applyTheme(choice: ThemeChoice) {
  current = choice;
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // sin persistencia: se aplica solo en esta visita
  }
  render();
}

systemDark.addEventListener('change', () => {
  if (current === 'auto') render();
});
