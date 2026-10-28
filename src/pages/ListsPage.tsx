// Portada "Mis listas": listas del hogar con nº de pendientes; se ordenan arrastrando desde ≡.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Button, ButtonLink } from '@/components/Button';
import { ChipSelect } from '@/components/ChipSelect';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Page } from '@/components/Page';
import { PromptModal } from '@/components/PromptModal';
import { SortableList } from '@/components/SortableList';
import { useHousehold } from '@/features/household/hooks';
import type { ListSummary } from '@/features/lists/api';
import { useListMutations, useLists } from '@/features/lists/hooks';
import { useAuth } from '@/lib/auth';
import { confirm, notifyError } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { THEME_OPTIONS, applyTheme, getThemeChoice, type ThemeChoice } from '@/lib/theme';

import styles from './ListsPage.module.css';

type PromptState = { mode: 'create' } | { mode: 'rename'; list: ListSummary } | null;

export function ListsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const household = useHousehold();
  const householdId = household.data?.id;
  const lists = useLists(householdId);
  const mutations = useListMutations(householdId ?? '');
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);

  const actions = (
    <>
      <ButtonLink to="/categorias" variant="ghost" compact>
        Categorías
      </ButtonLink>
      <Button variant="ghost" compact onClick={signOut}>
        Salir
      </Button>
    </>
  );

  if (household.isLoading) return <EmptyState loading />;
  if (household.error) return <EmptyState title="Error" message={household.error.message} />;
  if (!household.data) {
    return (
      <Page title="Mis listas" actions={actions}>
        <EmptyState
          title="Tu usuario no pertenece a ningún hogar"
          message="Ejecuta supabase/setup_household.sql en el SQL Editor de Supabase con vuestros emails."
        />
      </Page>
    );
  }

  const onSubmitPrompt = async (name: string) => {
    try {
      if (prompt?.mode === 'create') {
        const list = await mutations.create.mutateAsync(name);
        navigate(`/listas/${list.id}`);
      } else if (prompt?.mode === 'rename') {
        await mutations.rename.mutateAsync({ listId: prompt.list.id, name });
      }
      setPrompt(null);
    } catch (e) {
      notifyError(e);
    }
  };

  const onDelete = (list: ListSummary) => {
    if (confirm('Borrar lista', `¿Borrar "${list.name}" y todos sus productos?`)) {
      mutations.remove.mutate(list.id, { onError: notifyError });
    }
  };

  return (
    <Page
      title={household.data.name}
      actions={actions}
      footer={<Button onClick={() => setPrompt({ mode: 'create' })}>+ Nueva lista</Button>}>
      {lists.isLoading ? (
        <EmptyState loading />
      ) : !lists.data?.length ? (
        <EmptyState title="No hay listas" message="Crea la primera." />
      ) : (
        <SortableList
          items={lists.data}
          getId={(list) => list.id}
          getLabel={(list) => list.name}
          onReorder={(ids) => mutations.reorder.mutate(ids)}
          rowClassName={styles.card}
          renderItem={(list, handle) => (
            <>
              {handle}
              <Link to={`/listas/${list.id}`} className={styles.cardMain}>
                <span className={styles.name}>{list.name}</span>
                <span className={styles.counts}>
                  {plural(list.pending_count ?? 0, 'pendiente')}
                  {list.checked_count ? ` · ${plural(list.checked_count, 'comprado')}` : ''}
                </span>
              </Link>
              <IconButton
                symbol="✎"
                label={`Renombrar ${list.name}`}
                onClick={() => setPrompt({ mode: 'rename', list })}
              />
              <IconButton symbol="🗑" label={`Borrar ${list.name}`} onClick={() => onDelete(list)} />
            </>
          )}
        />
      )}

      {/* Apariencia: se guarda en este dispositivo (cada uno puede tener la suya). */}
      <section className={styles.settings} aria-labelledby="apariencia">
        <h2 id="apariencia" className={styles.settingsTitle}>
          Apariencia
        </h2>
        <span className={styles.settingsLabel}>Modo</span>
        <ChipSelect
          label="Modo claro u oscuro"
          options={THEME_OPTIONS}
          value={theme}
          onChange={(t) => {
            applyTheme(t);
            setTheme(t);
          }}
        />
      </section>

      <PromptModal
        open={!!prompt}
        title={prompt?.mode === 'rename' ? 'Renombrar lista' : 'Nueva lista'}
        initialValue={prompt?.mode === 'rename' ? prompt.list.name : ''}
        placeholder="Compra semanal, Farmacia…"
        confirmText={prompt?.mode === 'rename' ? 'Guardar' : 'Crear'}
        onSubmit={onSubmitPrompt}
        onClose={() => setPrompt(null)}
      />
    </Page>
  );
}
