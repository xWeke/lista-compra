-- Permisos de service_role (la Edge Function sync-mercadona) sobre las tablas de catálogos.
-- Este proyecto no da permisos automáticos a las tablas nuevas: hay que concederlos uno a uno.
-- service_role se salta el RLS, pero no los GRANT: sin esto, "permission denied for table store_products".
grant select, insert, update on public.stores, public.store_products to service_role;
-- El historial lo escribe el trigger store_products_track_price con los permisos de quien guarda.
grant select, insert on public.store_product_prices to service_role;
grant select, insert, update, delete on public.product_store_links to service_role;
