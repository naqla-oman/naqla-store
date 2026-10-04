import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004113334 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_entry" drop constraint if exists "loyalty_entry_order_id_kind_unique";`);
    this.addSql(`create table if not exists "loyalty_entry" ("id" text not null, "customer_id" text not null, "order_id" text null, "order_display_id" integer null, "kind" text check ("kind" in ('earn', 'redeem')) not null, "status" text check ("status" in ('pending', 'available', 'canceled')) not null, "points" integer not null, "code" text null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_entry_customer_id" ON "loyalty_entry" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_entry_deleted_at" ON "loyalty_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_loyalty_entry_order_id_kind_unique" ON "loyalty_entry" ("order_id", "kind") WHERE order_id IS NOT NULL AND deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "loyalty_entry" cascade;`);
  }

}
