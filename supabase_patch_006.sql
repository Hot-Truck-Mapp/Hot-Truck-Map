-- Patch 006: add missing menu_items.sort_order column
--
-- The app code (app/dashboard/menu/page.tsx, app/dashboard/page.tsx,
-- app/truck/[id]/page.tsx, app/truck/[id]/menu/page.tsx) selects and
-- orders by menu_items.sort_order, but this column was never added to
-- the schema. Every menu_items query that requests it currently fails
-- with Postgres error 42703 ("column menu_items.sort_order does not
-- exist"), which breaks the public truck menu, the truck detail page,
-- and the operator menu-reorder UI.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order integer;
