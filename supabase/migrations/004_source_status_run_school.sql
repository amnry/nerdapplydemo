-- Records what happened to each source on its last check (ok, error, skipped, blocked_by_robots) and which school a run covered.
alter table sources add column last_result text, add column last_note text;
alter table pipeline_runs add column school_slug text;
