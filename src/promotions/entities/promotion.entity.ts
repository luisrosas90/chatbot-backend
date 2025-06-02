import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('promotions')
export class Promotion {
  @ApiProperty({ description: 'ID único de la promoción' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Nombre de la promoción' })
  @Column()
  name: string;

  @ApiProperty({ description: 'Descripción de la promoción' })
  @Column()
  description: string;

  @ApiProperty({ description: 'Código de la promoción' })
  @Column({ unique: true })
  code: string;

  @ApiProperty({ description: 'Monto del descuento' })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount: number;

  @ApiProperty({ description: 'Tipo de descuento (percentage o fixed)' })
  @Column()
  discountType: 'percentage' | 'fixed';

  @ApiProperty({ description: 'Estado de la promoción' })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Fecha de inicio' })
  @Column({ type: 'timestamp' })
  startDate: Date;

  @ApiProperty({ description: 'Fecha de fin' })
  @Column({ type: 'timestamp' })
  endDate: Date;

  @ApiProperty({ description: 'Monto mínimo de compra', required: false })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumPurchaseAmount?: number;

  @ApiProperty({ description: 'Descuento máximo', required: false })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maximumDiscount?: number;

  @ApiProperty({ description: 'Límite de uso' })
  @Column({ default: 0 })
  usageLimit: number;

  @ApiProperty({ description: 'Contador de uso' })
  @Column({ default: 0 })
  usageCount: number;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Fecha de actualización' })
  @UpdateDateColumn()
  updatedAt: Date;
} 