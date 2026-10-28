// Precios de una lista en un súper: qué producto del súper corresponde a cada uno vuestro, cuánto cuesta
// cada línea y el total. "Cambiar" abre el buscador del catálogo del súper; la elección se recuerda.
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Page } from '@/components/Page';
import { StoreProductPicker, type PickerOption } from '@/components/StoreProductPicker';
import { useHousehold } from '@/features/household/hooks';
import { useListItems } from '@/features/items/hooks';
import { useList } from '@/features/lists/hooks';
import { priceLines, type StoreProduct } from '@/features/prices/api';
import { useSetStoreLink, useStoreLinks, useStoreSearch, useStores } from '@/features/prices/hooks';
import { formatPrice, formatQuantity, plural } from '@/lib/format';

import styles from './StorePricesPage.module.css';

/** "0,96 €/L" a partir del precio de referencia del súper */
function referenceLabel(sp: StoreProduct) {
  if (sp.reference_price === null || !sp.reference_format) return null;
  return `${formatPrice(Number(sp.reference_price))}/${sp.reference_format}`;
}

const toOption = (sp: StoreProduct): PickerOption => ({
  id: sp.id,
  name: sp.name,
  packaging: sp.packaging,
  price: Number(sp.price),
  reference: referenceLabel(sp),
  imageUrl: sp.image_url,
});

export function StorePricesPage() {
  const { id = '', storeId = '' } = useParams();
  const householdId = useHousehold().data?.id;
  const list = useList(id);
  const items = useListItems(id, householdId);
  const store = useStores().data?.find((s) => s.id === storeId);
  const storeName = store?.name ?? storeId;

  const lines = useMemo(
    () =>
      (items.data ?? [])
        .map((i) => ({
          id: i.id,
          productId: i.product.id,
          name: i.product.name,
          quantity: Number(i.quantity),
          unit: i.unit,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [items.data],
  );
  const links = useStoreLinks(
    storeId,
    lines.map((l) => l.productId),
  );
  const priced = useMemo(() => priceLines(lines, links.data ?? []), [lines, links.data]);

  // Buscador: qué producto se está cambiando y qué se ha buscado
  const [picking, setPicking] = useState<{ productId: string; name: string; currentId: string | null } | null>(null);
  const [query, setQuery] = useState('');
  const search = useStoreSearch(storeId, picking ? query : '');
  const setLink = useSetStoreLink(storeId);

  const openPicker = (line: (typeof priced.lines)[number]) => {
    setPicking({ productId: line.productId, name: line.name, currentId: line.link?.store_product_id ?? null });
    setQuery(line.name);
  };
  const pick = (storeProductId: string | null) => {
    if (picking) setLink.mutate({ productId: picking.productId, storeProductId });
    setPicking(null);
  };

  const synced = store?.catalog_synced_at
    ? new Date(store.catalog_synced_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  return (
    <Page title={storeName} backTo={`/listas/${id}`}>
      <section className={styles.summary} aria-label="Total">
        <span className={styles.summaryLabel}>
          {list.data?.name ?? 'Lista'} en {storeName}
        </span>
        <span className={styles.summaryTotal}>{links.data ? formatPrice(priced.total) : '…'}</span>
        <span className={styles.summaryNote}>
          {priced.missing > 0 && `${plural(priced.missing, 'producto')} sin precio (no cuentan). `}
          {synced ? `Precios de la web del ${synced}.` : 'Aún no se ha descargado el catálogo.'}
        </span>
      </section>

      {items.isLoading || (lines.length > 0 && links.isLoading) ? (
        <EmptyState loading />
      ) : links.error ? (
        <EmptyState title="Error al cargar los precios" message={links.error.message} />
      ) : lines.length === 0 ? (
        <EmptyState title="Lista vacía" />
      ) : (
        <ul>
          {priced.lines.map((line) => {
            const sp = line.link?.store_product;
            return (
              <li key={line.id} className={styles.row}>
                <span className={styles.texts}>
                  <span className={styles.name}>
                    {line.name}
                    <span className={styles.qty}>
                      {formatQuantity(line.quantity)} {line.unit}
                    </span>
                  </span>
                  <span className={styles.match}>
                    {sp
                      ? [sp.name, sp.packaging, formatPrice(Number(sp.price))].filter(Boolean).join(' · ')
                      : line.link
                        ? 'No lo compráis aquí'
                        : `Sin equivalente en ${storeName}`}
                  </span>
                </span>
                <span className={styles.cost}>{line.cost === null ? '—' : formatPrice(line.cost)}</span>
                <Button variant="ghost" compact aria-label={`Cambiar ${line.name}`} onClick={() => openPicker(line)}>
                  {sp ? 'Cambiar' : 'Buscar'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <StoreProductPicker
        open={picking && { productName: picking.name, storeName, currentId: picking.currentId }}
        results={search.data?.map(toOption)}
        loading={search.isFetching}
        onSearch={setQuery}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
    </Page>
  );
}
