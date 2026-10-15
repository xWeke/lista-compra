// Detalle de lista: añadir productos, agrupados por categoría; comprados al final.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { AddItemBar, type Suggestion } from '@/components/AddItemBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ItemEditModal, type ItemDraft } from '@/components/ItemEditModal';
import { ItemRow } from '@/components/ItemRow';
import { Page } from '@/components/Page';
import type { Category } from '@/features/categories/api';
import { useCategories } from '@/features/categories/hooks';
import { useHousehold } from '@/features/household/hooks';
import { UNITS, itemCategoryId, normalizeName, type ListItem } from '@/features/items/api';
import { useItemMutations, useListItems, useProducts } from '@/features/items/hooks';
import { useList } from '@/features/lists/hooks';
import { confirm } from '@/lib/confirm';

import styles from './ListPage.module.css';

type Section = { key: string; title: string; items: ListItem[] };

/** Pendientes agrupados por categoría (en su orden) y, al final, los comprados. */
function buildSections(items: ListItem[], categories: Category[]): Section[] {
  const byName = (a: ListItem, b: ListItem) => a.product.name.localeCompare(b.product.name, 'es');
  const pending = items.filter((i) => !i.is_checked);
  const checked = items.filter((i) => i.is_checked).sort(byName);

  const sections: Section[] = [];
  for (const cat of categories) {
    const inCat = pending.filter((i) => itemCategoryId(i) === cat.id).sort(byName);
    if (inCat.length) sections.push({ key: cat.id, title: `${cat.icon ?? ''} ${cat.name}`.trim(), items: inCat });
  }
  const known = new Set(categories.map((c) => c.id));
  const uncategorized = pending.filter((i) => !known.has(itemCategoryId(i) ?? '')).sort(byName);
  if (uncategorized.length) sections.push({ key: 'none', title: 'Sin categoría', items: uncategorized });
  if (checked.length) sections.push({ key: 'checked', title: `Comprados (${checked.length})`, items: checked });
  return sections;
}

export function ListPage() {
  const { id = '' } = useParams();
  const householdId = useHousehold().data?.id;
  const list = useList(id);
  const items = useListItems(id, householdId);
  const categories = useCategories(householdId);
  const products = useProducts(householdId);
  const mutations = useItemMutations(id, householdId ?? '');
  const [editing, setEditing] = useState<ListItem | null>(null);

  const sections = useMemo(() => buildSections(items.data ?? [], categories.data ?? []), [items.data, categories.data]);
  const suggestions = useMemo<Suggestion[]>(
    () =>
      (products.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        normalized: p.name_normalized ?? normalizeName(p.name),
      })),
    [products.data],
  );
  const categoryOptions = useMemo(
    () => [
      { value: null, label: 'Sin categoría' },
      ...(categories.data ?? []).map((c) => ({
        value: c.id as string | null,
        label: `${c.icon ?? ''} ${c.name}`.trim(),
      })),
    ],
    [categories.data],
  );

  const draft: ItemDraft | null = editing && {
    name: editing.product.name,
    quantity: Number(editing.quantity),
    unit: editing.unit,
    categoryId: itemCategoryId(editing),
    note: editing.note ?? '',
  };

  const saveEdit = (d: ItemDraft) => {
    if (!editing) return;
    // Nombre y categoría pertenecen al producto: así se recuerdan la próxima vez que se añada.
    const productChanges: { name?: string; default_category_id?: string | null } = {};
    if (d.name.trim() !== editing.product.name) productChanges.name = d.name.trim();
    if (d.categoryId !== itemCategoryId(editing)) productChanges.default_category_id = d.categoryId;
    if (Object.keys(productChanges).length) {
      mutations.updateProduct.mutate({ productId: editing.product.id, changes: productChanges });
    }
    mutations.update.mutate({
      id: editing.id,
      changes: {
        quantity: d.quantity,
        unit: d.unit,
        note: d.note.trim() || null,
        ...(productChanges.default_category_id !== undefined && { category_id: null }),
      },
    });
    setEditing(null);
  };

  const deleteEditing = () => {
    if (!editing) return;
    const item = editing;
    setEditing(null);
    if (confirm('Borrar producto', `¿Quitar "${item.product.name}" de la lista?`)) mutations.remove.mutate(item.id);
  };

  const clearChecked = () => {
    if (confirm('Limpiar comprados', 'Los productos comprados se quitarán de la lista.')) {
      mutations.clearChecked.mutate();
    }
  };

  return (
    <Page title={list.data?.name ?? 'Lista'} backTo="/">
      <AddItemBar
        suggestions={suggestions}
        normalize={normalizeName}
        onAdd={(name) => mutations.add.mutate({ name })}
        adding={mutations.add.isPending}
      />

      {items.isLoading ? (
        <EmptyState loading />
      ) : items.error ? (
        <EmptyState title="Error al cargar" message={items.error.message} />
      ) : sections.length === 0 ? (
        <EmptyState title="Lista vacía" message="Añade lo que haga falta comprar." />
      ) : (
        sections.map((section) => (
          <section key={section.key}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              {/* "Limpiar" junto a los comprados: en la cabecera no cabe junto a títulos largos */}
              {section.key === 'checked' && (
                <Button variant="ghost" compact onClick={clearChecked} aria-label="Limpiar comprados">
                  Limpiar
                </Button>
              )}
            </div>
            <ul>
              {section.items.map((item) => (
                <ItemRow
                  key={item.id}
                  name={item.product.name}
                  quantity={Number(item.quantity)}
                  unit={item.unit}
                  note={item.note}
                  checked={item.is_checked}
                  onToggle={() => mutations.update.mutate({ id: item.id, changes: { is_checked: !item.is_checked } })}
                  onEdit={() => setEditing(item)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <ItemEditModal
        initial={draft}
        units={UNITS}
        categories={categoryOptions}
        onSave={saveEdit}
        onDelete={deleteEditing}
        onClose={() => setEditing(null)}
      />
    </Page>
  );
}
