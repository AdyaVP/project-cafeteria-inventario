import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import { Producto } from './producto.schema.js';
import { Temperatura } from './temperatura.enum.js';

@Schema()
export class ProductoBebida extends Producto {
  @Prop({
    required: true,
    enum: Temperatura,
  })
  temperatura: Temperatura;

  @Prop({
    type: [
      {
        nombre: {
          type: String,
          required: true,
        },
        precioAdicional: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    default: [],
  })
  tamanosDisponibles: {
    nombre: string;
    precioAdicional: number;
  }[];
}

export const ProductoBebidaSchema =
  SchemaFactory.createForClass(
    ProductoBebida,
  );