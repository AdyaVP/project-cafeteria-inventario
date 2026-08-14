import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import { Producto } from './producto.schema.js';

@Schema()
export class ProductoComida extends Producto {
  @Prop({
    min: 1,
  })
  tiempoPreparacionMin?: number;

  @Prop({
    min: 0,
  })
  calorias?: number;

  @Prop({
    type: [String],
    default: [],
  })
  alergenos: string[];
}

export const ProductoComidaSchema =
  SchemaFactory.createForClass(
    ProductoComida,
  );