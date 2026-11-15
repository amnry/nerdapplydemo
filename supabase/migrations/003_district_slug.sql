-- Adds the stable key used to match district-scoped rows to schools (display names are not comparable to slugs).
alter table schools add column district_slug text;
