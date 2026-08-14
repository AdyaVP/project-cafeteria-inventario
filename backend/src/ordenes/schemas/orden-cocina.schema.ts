import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Orden } from './orden.schema.js';

@Schema()
export class OrdenCocina extends Orden {
  @Prop()
  notaChef?: string;

  @Prop({
    min: 0,
  })
  tiempoEstimadoMin?: number;
}

export const OrdenCocinaSchema =
  SchemaFactory.createForClass(OrdenCocina);
