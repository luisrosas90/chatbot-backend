import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChatbotTable1748758969237 implements MigrationInterface {
    name = 'CreateChatbotTable1748758969237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "sender" character varying NOT NULL, "timestamp" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "session_id" uuid, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "admin_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" character varying NOT NULL, "direction" character varying NOT NULL, "type" character varying NOT NULL, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "conversationId" uuid, CONSTRAINT "PK_cd88ac69c0495b7c41d863be6b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "chatbotId" uuid NOT NULL, "cart" jsonb, "metadata" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "chatbots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "apiKey" character varying NOT NULL, "isActive" boolean NOT NULL, "settings" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ec8923205b2059dbc8dfb6ef8e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_0672782561e44d43febcfba2984" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "admin_messages" ADD CONSTRAINT "FK_50d4e70cf89d00d00e247dd2715" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_01ab654f197c64b6366ed40f139" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_a9b3b5d51da1c75242055338b59" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_a9b3b5d51da1c75242055338b59"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_01ab654f197c64b6366ed40f139"`);
        await queryRunner.query(`ALTER TABLE "admin_messages" DROP CONSTRAINT "FK_50d4e70cf89d00d00e247dd2715"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_0672782561e44d43febcfba2984"`);
        await queryRunner.query(`DROP TABLE "chatbots"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TABLE "admin_messages"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
    }

}
