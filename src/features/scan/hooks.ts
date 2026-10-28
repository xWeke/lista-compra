// Hook de la foto de lista: una mutación (no se cachea: cada foto es una petición nueva).
import { useMutation } from '@tanstack/react-query';

import { scanListPhoto } from './api';

export function useScanList() {
  return useMutation({ mutationFn: scanListPhoto });
}
