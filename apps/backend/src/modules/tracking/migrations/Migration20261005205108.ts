import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261005205108 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tracking_settings" add column if not exists "meta_test_event_code_at" timestamptz null, add column if not exists "tiktok_test_event_code_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "tracking_settings" drop column if exists "meta_test_event_code_at", drop column if exists "tiktok_test_event_code_at";`);
  }

}
