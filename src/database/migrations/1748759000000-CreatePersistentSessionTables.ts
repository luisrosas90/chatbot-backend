import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePersistentSessionTables1748759000000 implements MigrationInterface {
    name = 'CreatePersistentSessionTables1748759000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tabla de sesiones persistentes
        await queryRunner.query(`
            CREATE TABLE "persistent_sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "phoneNumber" character varying NOT NULL,
                "clientId" character varying,
                "clientName" character varying,
                "identificationNumber" character varying,
                "clientPushname" character varying,
                "isAuthenticated" boolean NOT NULL DEFAULT false,
                "isNewClient" boolean NOT NULL DEFAULT true,
                "context" character varying NOT NULL DEFAULT 'initial',
                "status" character varying NOT NULL DEFAULT 'active',
                "lastUserMessage" text,
                "lastBotResponse" text,
                "lastActivity" TIMESTAMP,
                "messageCount" integer NOT NULL DEFAULT 0,
                "searchCount" integer NOT NULL DEFAULT 0,
                "activeChatbotId" character varying,
                "metadata" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_persistent_sessions" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_persistent_sessions_phone" UNIQUE ("phoneNumber")
            )
        `);

        // Tabla de historial de búsquedas
        await queryRunner.query(`
            CREATE TABLE "search_history" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "phoneNumber" character varying NOT NULL,
                "searchTerm" character varying NOT NULL,
                "originalSearchTerm" character varying NOT NULL,
                "resultsCount" integer NOT NULL DEFAULT 0,
                "hasResults" boolean NOT NULL DEFAULT false,
                "sessionContext" character varying,
                "chatbotId" character varying,
                "sessionId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_search_history" PRIMARY KEY ("id")
            )
        `);

        // Tabla de carrito de compras
        await queryRunner.query(`
            CREATE TABLE "shopping_carts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "phoneNumber" character varying NOT NULL,
                "productCode" character varying NOT NULL,
                "productName" character varying NOT NULL,
                "unitPriceUsd" numeric(10,2) NOT NULL,
                "ivaTax" numeric(5,2) NOT NULL DEFAULT 0,
                "quantity" integer NOT NULL DEFAULT 1,
                "exchangeRate" numeric(10,2),
                "status" character varying NOT NULL DEFAULT 'active',
                "chatbotId" character varying,
                "metadata" jsonb,
                "sessionId" uuid,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_shopping_carts" PRIMARY KEY ("id")
            )
        `);

        // Índices para optimización
        await queryRunner.query(`CREATE INDEX "IDX_search_history_phone_term" ON "search_history" ("phoneNumber", "searchTerm")`);
        await queryRunner.query(`CREATE INDEX "IDX_search_history_phone_date" ON "search_history" ("phoneNumber", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_shopping_carts_phone_status" ON "shopping_carts" ("phoneNumber", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_persistent_sessions_phone" ON "persistent_sessions" ("phoneNumber")`);
        await queryRunner.query(`CREATE INDEX "IDX_persistent_sessions_status" ON "persistent_sessions" ("status")`);

        // Relaciones de clave externa
        await queryRunner.query(`
            ALTER TABLE "search_history" 
            ADD CONSTRAINT "FK_search_history_session" 
            FOREIGN KEY ("sessionId") REFERENCES "persistent_sessions"("id") 
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "shopping_carts" 
            ADD CONSTRAINT "FK_shopping_carts_session" 
            FOREIGN KEY ("sessionId") REFERENCES "persistent_sessions"("id") 
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shopping_carts" DROP CONSTRAINT "FK_shopping_carts_session"`);
        await queryRunner.query(`ALTER TABLE "search_history" DROP CONSTRAINT "FK_search_history_session"`);
        
        await queryRunner.query(`DROP INDEX "IDX_persistent_sessions_status"`);
        await queryRunner.query(`DROP INDEX "IDX_persistent_sessions_phone"`);
        await queryRunner.query(`DROP INDEX "IDX_shopping_carts_phone_status"`);
        await queryRunner.query(`DROP INDEX "IDX_search_history_phone_date"`);
        await queryRunner.query(`DROP INDEX "IDX_search_history_phone_term"`);
        
        await queryRunner.query(`DROP TABLE "shopping_carts"`);
        await queryRunner.query(`DROP TABLE "search_history"`);
        await queryRunner.query(`DROP TABLE "persistent_sessions"`);
    }
} 