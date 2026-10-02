import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Esquema inicial: usuarios, permisos por rol, menú, catálogos, notificaciones, relaciones y todo el dominio de tickets. */

export class InitialSchema1790899311932 implements MigrationInterface {
    name = 'InitialSchema1790899311932'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("uuid" uuid NOT NULL, "name" character varying(120) NOT NULL, "email" character varying(254) NOT NULL, "role" character varying(20) NOT NULL, "avatar_icon" character varying(40), "avatar_color" character varying(20), "password_salt" bytea NOT NULL, "password_hash" bytea NOT NULL, "email_verified_at" TIMESTAMP WITH TIME ZONE, "disabled_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "totp_secret" text, "totp_pending_secret" text, "totp_last_step" integer NOT NULL DEFAULT '0', "failed_logins" integer NOT NULL DEFAULT '0', "locked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_951b8f1dfc94ac1d0301a14b7e1" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users"  ("email") `);
        await queryRunner.query(`CREATE TABLE "role_permissions" ("id" integer NOT NULL, "uuid" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by" character varying(64), "updated_at" TIMESTAMP WITH TIME ZONE, "updated_by" character varying(64), "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" character varying(64), "is_deleted" boolean NOT NULL DEFAULT false, "restored_at" TIMESTAMP WITH TIME ZONE, "restored_by" character varying(64), "role" character varying(20) NOT NULL, "subject" character varying(40) NOT NULL, "action" character varying(20) NOT NULL, "condition" character varying(20) NOT NULL, CONSTRAINT "PK_48546306cd3ade4a251649db22d" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "idx_role_permissions_role" ON "role_permissions"  ("role") `);
        await queryRunner.query(`CREATE TABLE "menu_items" ("id" integer NOT NULL, "uuid" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by" character varying(64), "updated_at" TIMESTAMP WITH TIME ZONE, "updated_by" character varying(64), "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" character varying(64), "is_deleted" boolean NOT NULL DEFAULT false, "restored_at" TIMESTAMP WITH TIME ZONE, "restored_by" character varying(64), "key" character varying(40) NOT NULL, "label" character varying(60) NOT NULL, "route" character varying(200) NOT NULL, "menu_group" character varying(40), "icon" character varying(43), "subject" character varying(40), "required_action" character varying(20), "sort_order" integer NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_b07d96452a2dd673e395327f523" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "idx_menu_items_key" ON "menu_items"  ("key") `);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" integer NOT NULL, "uuid" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by" character varying(64), "updated_at" TIMESTAMP WITH TIME ZONE, "updated_by" character varying(64), "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" character varying(64), "is_deleted" boolean NOT NULL DEFAULT false, "restored_at" TIMESTAMP WITH TIME ZONE, "restored_by" character varying(64), "recipient_uuid" uuid NOT NULL, "type" character varying(40) NOT NULL, "message" text NOT NULL, "resource_type" character varying(20), "resource_uuid" uuid, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_84989adc90ebf9f1c9b7ba66f0a" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "idx_notifications_recipient" ON "notifications"  ("recipient_uuid", "created_at") `);
        await queryRunner.query(`CREATE TABLE "relationships" ("id" integer NOT NULL, "uuid" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by" character varying(64), "updated_at" TIMESTAMP WITH TIME ZONE, "updated_by" character varying(64), "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" character varying(64), "is_deleted" boolean NOT NULL DEFAULT false, "restored_at" TIMESTAMP WITH TIME ZONE, "restored_by" character varying(64), "titular_uuid" uuid NOT NULL, "alternante_uuid" uuid NOT NULL, "status" character varying(10) NOT NULL, "grants" jsonb NOT NULL DEFAULT '[]', "ended_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e2992e0a23c981db510ea2ac44e" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "idx_relationships_titular" ON "relationships"  ("titular_uuid") `);
        await queryRunner.query(`CREATE INDEX "idx_relationships_alternante" ON "relationships"  ("alternante_uuid", "status") `);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" integer NOT NULL, "uuid" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_by" character varying(64), "updated_at" TIMESTAMP WITH TIME ZONE, "updated_by" character varying(64), "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" character varying(64), "is_deleted" boolean NOT NULL DEFAULT false, "restored_at" TIMESTAMP WITH TIME ZONE, "restored_by" character varying(64), "owner_uuid" uuid NOT NULL, "code" character varying(12) NOT NULL, "title" character varying(120) NOT NULL, "description" text NOT NULL DEFAULT '', "type" character varying(20) NOT NULL, "category" character varying(20) NOT NULL, "department" character varying(40) NOT NULL DEFAULT 'it', "complexity" character varying(10), "other_category_detail" character varying(120), "priority" character varying(10) NOT NULL, "status" character varying(20) NOT NULL, "assignee_email" character varying(254) NOT NULL DEFAULT '', "estimate_hours" smallint, "due_date" date, "notify_reporter" boolean NOT NULL DEFAULT false, "sla_response_minutes" integer NOT NULL, "sla_resolution_minutes" integer NOT NULL, "resolution" text, "resolved_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e522585e9439011828e606834e4" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_tickets_code" ON "tickets"  ("code") `);
        await queryRunner.query(`CREATE INDEX "idx_tickets_owner" ON "tickets"  ("owner_uuid") `);
        await queryRunner.query(`CREATE INDEX "idx_tickets_status" ON "tickets"  ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_tickets_assignee" ON "tickets"  ("assignee_email") `);
        await queryRunner.query(`CREATE INDEX "idx_tickets_department" ON "tickets"  ("department") `);
        await queryRunner.query(`CREATE TABLE "ticket_events" ("uuid" uuid NOT NULL, "ticket_uuid" uuid NOT NULL, "type" character varying(20) NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, "actor" character varying(10) NOT NULL, "visibility" character varying(10) NOT NULL, "actor_uuid" uuid, "actor_name" character varying(120) NOT NULL, "body" text, "attachments" jsonb NOT NULL DEFAULT '[]', "assignee" character varying(254), "status" character varying(20), "from_status" character varying(20), "to_status" character varying(20), "closed_by" character varying(10), CONSTRAINT "PK_d816cd7e441465a78ca70425180" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE INDEX "idx_ticket_events_ticket" ON "ticket_events"  ("ticket_uuid", "at") `);
        await queryRunner.query(`CREATE TABLE "ticket_attachments" ("id" uuid NOT NULL, "ticket_uuid" uuid NOT NULL, "name" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "size" integer NOT NULL, "content" bytea NOT NULL, "uploaded_by" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "comment_uuid" uuid, CONSTRAINT "PK_7e5011f87f95e78fe4bd7d982a3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ticket_attachments_ticket" ON "ticket_attachments"  ("ticket_uuid") `);
        await queryRunner.query(`CREATE TABLE "ticket_surveys" ("ticket_uuid" uuid NOT NULL, "requester_uuid" uuid NOT NULL, "assignee_email" character varying(254), "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "answered_at" TIMESTAMP WITH TIME ZONE, "score" smallint, "comment" character varying(500), CONSTRAINT "PK_3884392aa3e8de492e171446e66" PRIMARY KEY ("ticket_uuid"))`);
        await queryRunner.query(`CREATE TABLE "catalogs" ("key" character varying(40) NOT NULL, "name" character varying(60) NOT NULL, "description" character varying(200) NOT NULL DEFAULT '', "system" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_1fa9c57ba81ba9cdac0ec7b0553" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "catalog_items" ("uuid" uuid NOT NULL, "catalog_key" character varying(40) NOT NULL, "code" character varying(40) NOT NULL, "label" character varying(80) NOT NULL, "sort_order" integer NOT NULL, "active" boolean NOT NULL DEFAULT true, "system" boolean NOT NULL DEFAULT false, "icon" character varying(43), "severity" character varying(10), CONSTRAINT "PK_2978ed8276d8b80cc97b2b4676a" PRIMARY KEY ("uuid"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_catalog_items_code" ON "catalog_items"  ("catalog_key", "code") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."uq_catalog_items_code"`);
        await queryRunner.query(`DROP TABLE "catalog_items"`);
        await queryRunner.query(`DROP TABLE "catalogs"`);
        await queryRunner.query(`DROP TABLE "ticket_surveys"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ticket_attachments_ticket"`);
        await queryRunner.query(`DROP TABLE "ticket_attachments"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ticket_events_ticket"`);
        await queryRunner.query(`DROP TABLE "ticket_events"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tickets_department"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tickets_assignee"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tickets_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_tickets_owner"`);
        await queryRunner.query(`DROP INDEX "public"."uq_tickets_code"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP INDEX "public"."idx_relationships_alternante"`);
        await queryRunner.query(`DROP INDEX "public"."idx_relationships_titular"`);
        await queryRunner.query(`DROP TABLE "relationships"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notifications_recipient"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP INDEX "public"."idx_menu_items_key"`);
        await queryRunner.query(`DROP TABLE "menu_items"`);
        await queryRunner.query(`DROP INDEX "public"."idx_role_permissions_role"`);
        await queryRunner.query(`DROP TABLE "role_permissions"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
