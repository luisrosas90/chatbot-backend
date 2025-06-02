import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePhoneNumberLength1717098100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_chat_sessions 
      ALTER COLUMN phone_number TYPE VARCHAR(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_chat_sessions 
      ALTER COLUMN phone_number TYPE VARCHAR(20);
    `);
  }
} 