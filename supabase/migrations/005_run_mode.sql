-- Distinguishes real publishes from dry runs that still spent LLM money, so total spend is the true figure.
alter table pipeline_runs add column mode text not null default 'publish' check (mode in ('publish', 'dry_run'));
