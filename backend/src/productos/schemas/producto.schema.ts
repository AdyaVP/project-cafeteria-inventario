import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { ProductoTipo } from './producto-tipo.enum.js';
import { TipoIsv } from './tipo-isv.enum.js';

// Tipo utilizado para trabajar con documentos de MongoDB
export type ProductoDocument = HydratedDocument<Producto> & {
  createdAt: Date;
  updatedAt: Date;
};

// Schema base para todos los productos del sistema
@Schema({
  timestamps: true,
  versionKey: false,
  discriminatorKey: 'tipo',
})
export class Producto {
  // Nombre del producto mostrado en el menú
  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  })
  nombre: string;

  // Descripción opcional del producto
  @Prop({
    trim: true,
  })
  descripcion?: string;

  // Precio de venta del producto
  @Prop({
    required: true,
    min: 0,
  })
  precio: number;

  // Permite habilitar o deshabilitar productos sin eliminarlos
  @Prop({
    default: true,
  })
  disponible: boolean;

  // URL de imagen utilizada por el frontend
  @Prop()
  imagenUrl?: string;

  // Tipo de producto utilizado por los discriminadores
  tipo: ProductoTipo;

  @Prop({
    type: String,
    enum: Object.values(TipoIsv),
    default: TipoIsv.GRAVADO_15,
  })
  tipoIsv: TipoIsv;
}

export const ProductoSchema = SchemaFactory.createForClass(Producto);

// Índice para optimizar búsquedas por nombre y tipo
ProductoSchema.index({
  nombre: 1,
  tipo: 1,
});
