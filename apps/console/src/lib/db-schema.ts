export const SCHEMA = `
create table if not exists admins (
  id serial primary key, email text unique not null, password_hash text not null,
  totp_secret text not null, totp_last_step bigint default 0, created_at timestamptz default now());
create table if not exists sessions (
  token_hash text primary key, admin_id int references admins(id) on delete cascade,
  created_at timestamptz default now(), last_seen timestamptz default now(), ip text);
create table if not exists audit (
  id bigserial primary key, at timestamptz default now(), admin_email text, action text not null,
  target text, ok boolean default true, detail jsonb default '{}', ip text);
create table if not exists stores (
  slug text primary key, name text not null, template text not null, status text not null default 'provisioning',
  version text, domain text, phone text, email text, backend_port int, storefront_port int,
  last_backup_at timestamptz, health text, created_at timestamptz default now(), updated_at timestamptz default now(),
  meta jsonb default '{}');
create table if not exists jobs (
  id bigserial primary key, store_slug text, kind text not null, status text not null default 'queued',
  input jsonb default '{}', steps jsonb default '[]', current int default 0, error text, created_by text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists backups (
  id bigserial primary key, store_slug text not null, file text not null, size bigint, kind text default 'manual',
  created_at timestamptz default now());
`
