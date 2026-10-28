// Detalle de lista: añadir productos, agrupados por categoría; comprados al final.
// Modo Organizar: cada producto muestra un desplegable para cambiarlo de categoría sin abrir el panel.
// 📷 Foto: se lee una lista en papel con IA (Edge Function scan-list) y, tras revisarla, se añade entera.
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router';

import { AddItemBar, type Suggestion } from '@/components/AddItemBar';
import { Button } from '@/components/Button';
import { CategoryPrompt } from '@/components/CategoryPrompt';
import { EmptyState } from '@/components/EmptyState';
import { ItemEditModal, type ItemDraft } from '@/components/ItemEditModal';
import { ItemRow } from '@/components/ItemRow';
import { Page } from '@/components/Page';
import { ScanReviewModal, type ReviewItem } from '@/components/ScanReviewModal';
import type { Category } from '@/features/categories/api';
import { useCategories } from '@/features/categories/hooks';
import { useHousehold, useMemberNames } from '@/features/household/hooks';
import { UNITS, itemCategoryId, normalizeName, type ListItem } from '@/features/items/api';
import { useItemMutations, useListItems, useProducts } from '@/features/items/hooks';
import { useList } from '@/features/lists/hooks';
import type { ScannedItem } from '@/features/scan/api';
import { useScanList } from '@/features/scan/hooks';
import { confirm, notifyError } from '@/lib/confirm';
import { formatQuantity } from '@/lib/format';

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
  const memberNames = useMemberNames(householdId).data ?? {};
  const mutations = useItemMutations(id, householdId ?? '');
  const [editing, setEditing] = useState<ListItem | null>(null);
  // Producto recién creado sin categoría: se pregunta debajo de la barra de añadir.
  const [askCategory, setAskCategory] = useState<{ productId: string; name: string } | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const scan = useScanList();
  const photoInput = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<ReviewItem[] | null>(null);

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
  const promptOptions = useMemo(
    () => categoryOptions.filter((o): o is { value: string; label: string } => o.value !== null),
    [categoryOptions],
  );

  const addProduct = (name: string) => {
    mutations.add.mutate(
      { name },
      {
        onSuccess: ({ product, created }) => {
          if (created && !product.default_category_id) setAskCategory({ productId: product.id, name: product.name });
        },
      },
    );
  };

  const pickCategory = (categoryId: string) => {
    if (!askCategory) return;
    mutations.updateProduct.mutate({ productId: askCategory.productId, changes: { default_category_id: categoryId } });
    setAskCategory(null);
  };

  /** "Añadido por …" / "Comprado por …" (también lo propio, con el nombre de cada uno). */
  const bylineFor = (item: ListItem) => {
    const who = item.is_checked ? item.checked_by : item.created_by;
    if (!who || !memberNames[who]) return null;
    return `${item.is_checked ? 'Comprado' : 'Añadido'} por ${memberNames[who]}`;
  };

  /** Lo leído de la foto, listo para revisar. Si el producto ya está en el catálogo, manda su categoría. */
  const toReview = (scanned: ScannedItem[]): ReviewItem[] => {
    const catalog = new Map((products.data ?? []).map((p) => [p.name_normalized ?? normalizeName(p.name), p]));
    const labelOf = (id: string | null) => categoryOptions.find((o) => o.value === id)?.label ?? 'Sin categoría';
    return scanned.map((it) => {
      const known = catalog.get(normalizeName(it.name));
      const categoryId = known ? known.default_category_id : it.category_id;
      const parts = [`${formatQuantity(it.quantity)} ${it.unit}`, labelOf(categoryId), ...(known ? [] : ['nuevo'])];
      return { name: it.name, quantity: it.quantity, unit: it.unit, categoryId, detail: parts.join(' · ') };
    });
  };

  const onPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir la misma foto otra vez
    if (!file) return;
    scan.mutate(file, { onSuccess: (scanned) => setReview(toReview(scanned)), onError: notifyError });
  };

  const addReviewed = (selected: ReviewItem[]) => {
    setReview(null);
    mutations.addMany.mutate(
      selected.map(({ name, quantity, unit, categoryId }) => ({ name, quantity, unit, categoryId })),
    );
  };

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
    <Page
      title={list.data?.name ?? 'Lista'}
      backTo="/"
      // En modo Organizar, "Hecho" fijo abajo: siempre a mano aunque la lista sea larga.
      footer={organizing && <Button onClick={() => setOrganizing(false)}>Hecho</Button>}>
      {organizing ? (
        <p className={styles.hint}>Elige la categoría de cada producto. Se recordará la próxima vez que lo añadáis.</p>
      ) : (
        <>
          <AddItemBar
            suggestions={suggestions}
            normalize={normalizeName}
            onAdd={addProduct}
            adding={mutations.add.isPending}
          />
          {/* Fuera de la cabecera: allí el título largo de la lista se cortaría */}
          <div className={styles.toolbar}>
            {/* Selector de fotos del sistema (en el iPhone: "Hacer foto" o "Fototeca"); se abre desde el botón */}
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              aria-label="Foto de una lista"
              onChange={onPhoto}
            />
            <Button
              variant="ghost"
              compact
              loading={scan.isPending || mutations.addMany.isPending}
              onClick={() => photoInput.current?.click()}>
              {scan.isPending ? 'Leyendo foto' : mutations.addMany.isPending ? 'Añadiendo' : '📷 Foto'}
            </Button>
            {sections.length > 0 && (
              <Button
                variant="ghost"
                compact
                onClick={() => {
                  setAskCategory(null);
                  setOrganizing(true);
                }}>
                Organizar
              </Button>
            )}
          </div>
        </>
      )}

      {!organizing && askCategory && promptOptions.length > 0 && (
        <CategoryPrompt
          key={askCategory.productId}
          productName={askCategory.name}
          categories={promptOptions}
          onPick={pickCategory}
          onDismiss={() => setAskCategory(null)}
        />
      )}

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
              {section.key === 'checked' && !organizing && (
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
                  byline={bylineFor(item)}
                  onToggle={() => mutations.update.mutate({ id: item.id, changes: { is_checked: !item.is_checked } })}
                  onEdit={() => setEditing(item)}
                  organize={
                    organizing
                      ? {
                          categoryId: itemCategoryId(item),
                          options: categoryOptions,
                          onChange: (categoryId) => mutations.setCategory.mutate({ item, categoryId }),
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <ScanReviewModal items={review} onConfirm={addReviewed} onClose={() => setReview(null)} />

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
