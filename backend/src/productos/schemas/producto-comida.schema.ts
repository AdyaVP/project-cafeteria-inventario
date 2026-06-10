import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Producto } from './producto.schema.js';

// Información específica para productos de comida
@Schema()
export class ProductoComida extends Producto {
  // Tiempo estimado de preparación
  @Prop({
    min: 1,
  })
  tiempoPreparacionMin?: number;

  // Categoría del producto
  @Prop({
    trim: true,
  })
  categoria?: string;
}

export const ProductoComidaSchema =
  SchemaFactory.createForClass(ProductoComida);