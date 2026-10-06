import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261006040101 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "store_settings" ("id" text not null, "overrides" jsonb not null default '{}', "secrets" jsonb not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "store_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_settings_deleted_at" ON "store_settings" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "store_settings_change" ("id" text not null, "actor_id" text null, "actor_email" text null, "changes" jsonb not null default '{}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "store_settings_change_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_settings_change_deleted_at" ON "store_settings_change" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "store_settings" cascade;`);

    this.addSql(`drop table if exists "store_settings_change" cascade;`);
  }

}
