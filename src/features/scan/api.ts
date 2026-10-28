// Foto de una lista en papel → productos, con la Edge Function "scan-list" (supabase/functions/scan-list),
// que se la pasa a Gemini. La app solo envía la foto: la clave de la IA vive en Supabase.
import { FunctionsHttpError } from '@supabase/supabase-js';

import { shrinkImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';

export type ScannedItem = { name: string; quantity: number; unit: string; category_id: string | null };

export async function scanListPhoto(photo: Blob): Promise<ScannedItem[]> {
  const { base64, mimeType } = await shrinkImage(photo);
  // functions.invoke añade el token de la sesión: la función sabe quién llama.
  const { data, error } = await supabase.functions.invoke<{ items: ScannedItem[] }>('scan-list', {
    body: { image: base64, mimeType },
    timeout: 60_000, // la función corta a los 45 s; esto cubre además una conexión que no responde
  });
  if (error) {
    // Los errores de la función traen un mensaje en español en el cuerpo: se muestra ese.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw new Error('No se ha podido leer la foto. Comprueba la conexión y prueba otra vez.');
  }
  return data?.items ?? [];
}
