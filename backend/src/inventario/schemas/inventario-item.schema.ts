import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { Unidad } from './unidad.enum.js';

export type InventarioItemDocument = HydratedDocument<InventarioItem> & {
  createdAt: Date;
  updatedAt: Date;
};

// Representa un ingrediente o insumo almacenado
@Schema({
  timestamps: true,
  versionKey: false,
})
export class InventarioItem {
  // Nombre del ingrediente o insumo
  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  })
  nombre: string;

  // Unidad de medida utilizada para el stock
  @Prop({
    type: String,
    required: true,
    enum: Unidad,
  })
  unidad: Unidad;

  // Existencia actual disponible
  @Prop({
    required: true,
    min: 0,
  })
  stockActual: number;

  // Cantidad mínima permitida antes de generar alerta
  @Prop({
    required: true,
    min: 0,
  })
  stockMinimo: number;

  // Costo de compra por unidad
  @Prop({
    required: true,
    min: 0,
  })
  costoUnitario: number;

  // Indica si el insumo sigue utilizándose
  @Prop({
    default: true,
  })
  activo: boolean;
}

export const InventarioItemSchema =
  SchemaFactory.createForClass(InventarioItem);

// Evita duplicados de ingredientes
InventarioItemSchema.index({ nombre: 1 }, { unique: true });
