import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMessageTemplatesTable1733140800000 implements MigrationInterface {
  name = 'CreateMessageTemplatesTable1733140800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tabla de plantillas de mensajes
    await queryRunner.createTable(
      new Table({
        name: 'message_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'welcome',
              'farewell',
              'error',
              'no_response',
              'product_found',
              'product_not_found',
              'authentication_required',
              'authentication_success',
              'authentication_failed',
              'menu',
              'help',
              'custom'
            ],
            default: "'custom'",
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'variables',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive', 'draft'],
            default: "'active'",
          },
          {
            name: 'language',
            type: 'varchar',
            length: '10',
            default: "'es'",
          },
          {
            name: 'priority',
            type: 'int',
            default: 0,
          },
          {
            name: 'conditions',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'quick_replies',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'chatbot_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['chatbot_id'],
            referencedTableName: 'chatbots',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Crear índices para mejorar el rendimiento
    await queryRunner.createIndex(
      'message_templates',
      new TableIndex({
        name: 'IDX_message_templates_chatbot_id',
        columnNames: ['chatbot_id'],
      }),
    );

    await queryRunner.createIndex(
      'message_templates',
      new TableIndex({
        name: 'IDX_message_templates_type',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'message_templates',
      new TableIndex({
        name: 'IDX_message_templates_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'message_templates',
      new TableIndex({
        name: 'IDX_message_templates_priority',
        columnNames: ['priority'],
      }),
    );

    await queryRunner.createIndex(
      'message_templates',
      new TableIndex({
        name: 'IDX_message_templates_chatbot_type',
        columnNames: ['chatbot_id', 'type'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índices
    await queryRunner.dropIndex('message_templates', 'IDX_message_templates_chatbot_type');
    await queryRunner.dropIndex('message_templates', 'IDX_message_templates_priority');
    await queryRunner.dropIndex('message_templates', 'IDX_message_templates_status');
    await queryRunner.dropIndex('message_templates', 'IDX_message_templates_type');
    await queryRunner.dropIndex('message_templates', 'IDX_message_templates_chatbot_id');

    // Eliminar tabla
    await queryRunner.dropTable('message_templates');
  }
} 