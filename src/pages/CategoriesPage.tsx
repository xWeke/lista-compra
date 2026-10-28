// Gestión de categorías: crear, renombrar, ordenar arrastrando (≡, p. ej. según los pasillos) y borrar.
import { useState } from 'react';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Page } from '@/components/Page';
import { PromptModal } from '@/components/PromptModal';
import { SortableList } from '@/components/SortableList';
import type { Category } from '@/features/categories/api';
import { useCategories, useCategoryMutations } from '@/features/categories/hooks';
import { useHousehold } from '@/features/household/hooks';
import { confirm, notifyError } from '@/lib/confirm';

import styles from './CategoriesPage.module.css';

type PromptState = { mode: 'create' } | { mode: 'rename'; category: Category } | null;

/** "🥦 Fruta" → { icon: '🥦', name: 'Fruta' }: si el texto empieza por un emoji, se guarda como icono. */
function splitIcon(text: string): { icon: string | null; name: string } {
  const match = text.match(/^(\p{Extended_Pictographic}️?)\s*(.+)$/u);
  return match ? { icon: match[1], name: match[2].trim() } : { icon: null, name: text.trim() };
}

export function CategoriesPage() {
  const householdId = useHousehold().data?.id;
  const categories = useCategories(householdId);
  const mutations = useCategoryMutations(householdId ?? '');
  const [prompt, setPrompt] = useState<PromptState>(null);
  const data = categories.data ?? [];

  const onSubmit = async (text: string) => {
    const { icon, name } = splitIcon(text);
    try {
      if (prompt?.mode === 'create') await mutations.create.mutateAsync({ name, icon });
      else if (prompt?.mode === 'rename') await mutations.update.mutateAsync({ id: prompt.category.id, name, icon });
      setPrompt(null);
    } catch (e) {
      notifyError(e);
    }
  };

  const onDelete = (c: Category) => {
    if (confirm('Borrar categoría', `Los productos de "${c.name}" quedarán sin categoría.`)) {
      mutations.remove.mutate(c.id, { onError: notifyError });
    }
  };

  return (
    <Page
      title="Categorías"
      backTo="/"
      footer={<Button onClick={() => setPrompt({ mode: 'create' })}>+ Nueva categoría</Button>}>
      {categories.isLoading ? (
        <EmptyState loading />
      ) : data.length === 0 ? (
        <EmptyState title="Sin categorías" />
      ) : (
        <SortableList
          items={data}
          getId={(c) => c.id}
          getLabel={(c) => c.name}
          onReorder={(ids) => mutations.reorder.mutate(ids)}
          rowClassName={styles.row}
          renderItem={(c, handle) => (
            <>
              {handle}
              <span className={styles.name}>
                {c.icon ? `${c.icon}  ` : ''}
                {c.name}
              </span>
              <IconButton
                symbol="✎"
                label={`Renombrar ${c.name}`}
                onClick={() => setPrompt({ mode: 'rename', category: c })}
              />
              <IconButton symbol="🗑" label={`Borrar ${c.name}`} onClick={() => onDelete(c)} />
            </>
          )}
        />
      )}

      <PromptModal
        open={!!prompt}
        title={prompt?.mode === 'rename' ? 'Renombrar categoría' : 'Nueva categoría'}
        initialValue={
          prompt?.mode === 'rename'
            ? `${prompt.category.icon ? prompt.category.icon + ' ' : ''}${prompt.category.name}`
            : ''
        }
        placeholder="🍷 Vinos (el emoji inicial es opcional)"
        confirmText={prompt?.mode === 'rename' ? 'Guardar' : 'Crear'}
        onSubmit={onSubmit}
        onClose={() => setPrompt(null)}
      />
    </Page>
  );
}
