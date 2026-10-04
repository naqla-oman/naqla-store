import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004220249 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seo_redirect" drop constraint if exists "seo_redirect_from_path_unique";`);
    this.addSql(`create table if not exists "seo_redirect" ("id" text not null, "from_path" text not null, "to_path" text not null, "entity" text check ("entity" in ('product', 'category')) not null, "entity_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seo_redirect_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seo_redirect_from_path_unique" ON "seo_redirect" ("from_path") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seo_redirect_deleted_at" ON "seo_redirect" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tracking_settings" ("id" text not null, "ga4_measurement_id" text null, "ga4_api_secret" text null, "meta_pixel_id" text null, "meta_access_token" text null, "meta_test_event_code" text null, "snap_pixel_id" text null, "snap_access_token" text null, "snap_test_mode" boolean not null default false, "tiktok_pixel_id" text null, "tiktok_access_token" text null, "tiktok_test_event_code" text null, "clarity_project_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tracking_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tracking_settings_deleted_at" ON "tracking_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_redirect" cascade;`);

    this.addSql(`drop table if exists "tracking_settings" cascade;`);
  }

}
