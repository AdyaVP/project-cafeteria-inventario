import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Orden } from './orden.schema.js';
import { Temperatura } from '../../productos/schemas/temperatura.enum.js';

@Schema()
export class OrdenCafeteria extends Orden {
  @Prop({
    enum: Temperatura,
  })
  temperatura?: Temperatura;

  @Prop()
  tamano?: string;
}

export const OrdenCafeteriaSchema =
  SchemaFactory.createForClass(OrdenCafeteria);
