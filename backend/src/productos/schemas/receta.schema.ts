import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RecetaDocument =
  HydratedDocument<Receta> & {
    createdAt: Date;
    updatedAt: Date;
  };

// Relación entre un producto y los ingredientes que consume
@Schema({
  timestamps: true,
  versionKey: false,
})
export class Receta {
  // Producto al que pertenece la receta
  @Prop({
    type: Types.ObjectId,
    ref: 'Producto',
    required: true,
  })
  productoId: Types.ObjectId;

  // Ingredientes utilizados por el producto
  @Prop({
    type: [
      {
        inventarioItemId: {
          type: Types.ObjectId,
          ref: 'InventarioItem',
          required: true,
        },
        cantidad: {
          type: Number,
          required: true,
          min: 0.01,
        },
      },
    ],
    default: [],
  })
  ingredientes: {
    inventarioItemId: Types.ObjectId;
    cantidad: number;
  }[];
}

export const RecetaSchema =
  SchemaFactory.createForClass(Receta);

// Un producto solo debe tener una receta
RecetaSchema.index(
  { productoId: 1 },
  { unique: true },
);