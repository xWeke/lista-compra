// Estilo visual activo (TEMPORAL mientras se elige entre los dos; al decidir, borrar este fichero,
// el selector de ListsPage y el CSS del estilo descartado).
// Se elige con ?estilo=neobrutalism en la URL o con el selector de "Mis listas", y se recuerda en este navegador.
import { syncThemeColor } from '@/lib/theme';

export const STYLES = {
  colorful: { label: 'Colorful' },
  neobrutalism: { label: 'Neobrutalism' },
} as const;

export type StyleName = keyof typeof STYLES;

const STORAGE_KEY = 'lista-compra:estilo';
const isStyle = (value: string | null): value is StyleName => !!value && value in STYLES;

export function getStyle(): StyleName {
  const fromUrl = new URLSearchParams(window.location.search).get('estilo');
  if (isStyle(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isStyle(saved)) return saved;
  } catch {
    // localStorage puede no estar disponible (modo privado): se usa el estilo por defecto
  }
  return 'colorful';
}

/** Aplica el estilo: atributo data-style en <html> (activa sus variables CSS) y color de la barra del navegador. */
export function applyStyle(style: StyleName) {
  document.documentElement.dataset.style = style;
  try {
    localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // sin persistencia: se aplica solo en esta visita
  }
  syncThemeColor();
}
