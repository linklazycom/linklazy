-- 015_remove_pricing_links.sql
-- Header/footer links are stored in the database (table site_settings, keys
-- nav_links and footer_links) and override the defaults in code. The old
-- "Pricing" link (/pricing) is still stored there, but that page no longer exists (404).
--
-- STEP 1 (read-only): look at what is stored. Run it alone.
select key, value from public.site_settings where key in ('nav_links', 'footer_links');

-- STEP 2: remove every link that points to /pricing. Run this block as a separate Run.
-- (footer_links = object of columns -> arrays of {label, href}; nav_links = array)
update public.site_settings
set value = (
  select coalesce(jsonb_object_agg(col.k, col.cleaned), '{}'::jsonb)
  from (
    select t.k,
           (select coalesce(jsonb_agg(e), '[]'::jsonb)
            from jsonb_array_elements(t.v) e
            where coalesce(e->>'href', '') not in ('/pricing', 'https://www.linklazy.com/pricing', 'https://linklazy.com/pricing')) as cleaned
    from jsonb_each(value) as t(k, v)
    where jsonb_typeof(t.v) = 'array'
  ) col
)
where key = 'footer_links' and jsonb_typeof(value) = 'object';

update public.site_settings
set value = (
  select coalesce(jsonb_agg(e), '[]'::jsonb)
  from jsonb_array_elements(value) e
  where coalesce(e->>'href', '') not in ('/pricing', 'https://www.linklazy.com/pricing', 'https://linklazy.com/pricing')
)
where key = 'nav_links' and jsonb_typeof(value) = 'array';

-- STEP 3 (read-only): confirm no "pricing" is left (expected: no rows). Separate Run.
-- select key from public.site_settings where value::text ilike '%pricing%';
