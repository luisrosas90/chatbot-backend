/**
 * Entidad que representa una plantilla de mensaje.
 * Las plantillas permiten crear mensajes predefinidos con variables
 * que pueden ser personalizadas dinámicamente.
 * 
 * @class MessageTemplate
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Chatbot } from '../../admin/entities/chatbot.entity';

export enum TemplateType {
  WELCOME = 'welcome',
  FAREWELL = 'farewell',
  ERROR = 'error',
  NO_RESPONSE = 'no_response',
  PRODUCT_FOUND = 'product_found',
  PRODUCT_NOT_FOUND = 'product_not_found',
  AUTHENTICATION_REQUIRED = 'authentication_required',
  AUTHENTICATION_SUCCESS = 'authentication_success',
  AUTHENTICATION_FAILED = 'authentication_failed',
  MENU = 'menu',
  HELP = 'help',
  CUSTOM = 'custom'
}

export enum TemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft'
}

@Entity('message_templates')
export class MessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nombre descriptivo de la plantilla
   */
  @Column()
  name: string;

  /**
   * Tipo de plantilla (bienvenida, despedida, error, etc.)
   */
  @Column({
    type: 'enum',
    enum: TemplateType,
    default: TemplateType.CUSTOM
  })
  type: TemplateType;

  /**
   * Contenido de la plantilla con variables
   * Ejemplo: "¡Hola {{nombre}}! Bienvenido a {{empresa}}"
   */
  @Column('text')
  content: string;

  /**
   * Variables disponibles en formato JSON
   * Ejemplo: ["nombre", "empresa", "fecha", "producto"]
   */
  @Column('json', { nullable: true })
  variables: string[];

  /**
   * Descripción de la plantilla
   */
  @Column('text', { nullable: true })
  description: string;

  /**
   * Estado de la plantilla
   */
  @Column({
    type: 'enum',
    enum: TemplateStatus,
    default: TemplateStatus.ACTIVE
  })
  status: TemplateStatus;

  /**
   * Idioma de la plantilla
   */
  @Column({ default: 'es' })
  language: string;

  /**
   * Prioridad para selección automática (mayor número = mayor prioridad)
   */
  @Column({ default: 0 })
  priority: number;

  /**
   * Condiciones para uso automático (JSON)
   * Ejemplo: {"context": "menu", "authenticated": true}
   */
  @Column('json', { nullable: true })
  conditions: any;

  /**
   * Botones o acciones rápidas (para WhatsApp Business)
   */
  @Column('json', { nullable: true })
  quickReplies: string[];

  /**
   * Chatbot al que pertenece esta plantilla
   */
  @ManyToOne(() => Chatbot)
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbot;

  /**
   * ID del chatbot
   */
  @Column('uuid')
  chatbotId: string;

  /**
   * Usuario que creó la plantilla
   */
  @Column({ nullable: true })
  createdBy: string;

  /**
   * Momento de creación del registro
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Momento de última actualización
   */
  @UpdateDateColumn()
  updatedAt: Date;
} 