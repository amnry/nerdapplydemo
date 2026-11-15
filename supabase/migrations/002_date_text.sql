-- Adds the verbatim date wording a page used when it gave no year (for example 'November 1').
-- NOT YET APPLIED to the database: run it before the first --publish, because the pipeline now writes this column.
alter table opportunities add column date_text text;
