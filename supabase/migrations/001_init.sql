-- Initial schema: 5 tables plus enums for the opportunity guide.
-- RLS is enabled with no policies, so the anon key reads nothing; only the service key (server and pipeline) can.

create type stage as enum ('grade_8', 'admitted_college');
create type category as enum ('milestone', 'program', 'scholarship', 'research', 'competition', 'club', 'campus_task');
create type grade_basis as enum ('current', 'entering', 'age', 'unknown');
create type opp_status as enum ('open', 'upcoming', 'ongoing', 'auto_considered', 'closed', 'cancelled', 'unknown');
create type action_type as enum ('apply', 'register', 'attend', 'check_award', 'ask_school', 'mark_calendar');
create type verification_state as enum ('verified', 'needs_review', 'rejected');
create type date_confidence as enum ('exact', 'year_unknown', 'not_published');

create table schools (
  id bigint generated always as identity primary key,
  slug text not null unique,
  kind text not null check (kind in ('middle_school', 'college')),
  name text not null,
  district text,
  county text,
  city text,
  zip text,
  lat double precision,
  lon double precision,
  grade_low int,
  grade_high int,
  feeder_high_school text,
  source_url text,
  verified_at timestamptz
);

create table sources (
  id bigint generated always as identity primary key,
  slug text not null unique,
  url text not null,
  owner text not null,
  stage stage not null,
  scope_type text not null check (scope_type in ('school', 'district', 'institution', 'radius', 'county', 'region')),
  scope_value text not null,
  lat double precision,
  lon double precision,
  last_status int,
  last_hash text,
  last_fetched_at timestamptz,
  last_checked_at timestamptz
);

create table opportunities (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  source_id bigint not null references sources (id),
  stage stage not null,
  category category not null,
  title text not null,
  summary text not null,
  scope_type text not null check (scope_type in ('school', 'district', 'institution', 'radius', 'county', 'region')),
  scope_value text not null,
  venue_lat double precision,
  venue_lon double precision,
  grade_basis grade_basis not null default 'unknown',
  grades_allowed int[],
  requires jsonb not null default '{}'::jsonb,
  opens_on date,
  deadline date,
  starts_on date,
  cycle_label text,
  date_confidence date_confidence not null default 'not_published',
  status opp_status not null default 'unknown',
  action_type action_type not null,
  action_url text,
  cost_type text,
  cost_usd numeric,
  tags text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  source_url text not null,
  verification_state verification_state not null,
  extraction_method text not null check (extraction_method in ('llm', 'manual')),
  review_note text,
  last_verified_at timestamptz
);

create table pipeline_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sources_attempted int not null default 0,
  sources_ok int not null default 0,
  extracted int not null default 0,
  verified int not null default 0,
  needs_review int not null default 0,
  rejected int not null default 0,
  tokens_in bigint not null default 0,
  tokens_out bigint not null default 0,
  cost_usd numeric
);

create table rejections (
  id bigint generated always as identity primary key,
  run_id bigint references pipeline_runs (id),
  source_id bigint references sources (id),
  title text,
  reason_code text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index opportunities_stage_state_idx on opportunities (stage, verification_state);
create index opportunities_scope_idx on opportunities (scope_type, scope_value);

alter table schools enable row level security;
alter table sources enable row level security;
alter table opportunities enable row level security;
alter table pipeline_runs enable row level security;
alter table rejections enable row level security;
