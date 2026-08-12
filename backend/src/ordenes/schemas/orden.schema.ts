import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { ItemEstado } from './item-estado.enum.js';
import { OrdenEstado } from './orden-estado.enum.js';
import { TipoOrden } from './tipo-orden.enum.js';

export type OrdenDocument = HydratedDocument<Orden> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({
  timestamps: true,
  versionKey: false,
  discriminatorKey: 'tipo',
})
export class Orden {
  @Prop({
    type: Types.ObjectId,
    ref: 'Mesa',
    required: true,
  })
  mesa: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    required: true,
  })
  mesero: Types.ObjectId;

  @Prop({
    type: [
      {
        producto: {
          type: Types.ObjectId,
          ref: 'Producto',
          required: true,
        },
        cantidad: {
          type: Number,
          required: true,
          min: 1,
        },
        notas: {
          type: String,
        },
        estadoItem: {
          type: String,
          enum: ItemEstado,
          default: ItemEstado.PENDIENTE,
        },
      },
    ],
    required: true,
    validate: {
      validator: (items: Orden['items']) => items.length > 0,
      message: 'Debe haber al menos un producto en la orden',
    },
  })
  items: {
    _id: Types.ObjectId;
    producto: Types.ObjectId;
    cantidad: number;
    notas?: string;
    estadoItem: ItemEstado;
  }[];

  @Prop({
    type: String,
    enum: OrdenEstado,
    default: OrdenEstado.PENDIENTE,
  })
  estadoGeneral: OrdenEstado;

  // Gestionado automáticamente por Mongoose como discriminatorKey
  tipo: TipoOrden;
}

export const OrdenSchema = SchemaFactory.createForClass(Orden);

OrdenSchema.index({ mesa: 1, estadoGeneral: 1 });
OrdenSchema.index({ 'items.producto': 1 });
