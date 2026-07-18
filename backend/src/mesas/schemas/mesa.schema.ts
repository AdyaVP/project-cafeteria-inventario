import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum MesaEstado {
  LIBRE = 'LIBRE',
  OCUPADA = 'OCUPADA',
  CUENTA_PEDIDA = 'CUENTA_PEDIDA',
  CERRADA = 'CERRADA',
}

export type MesaDocument = HydratedDocument<Mesa>;

@Schema({ timestamps: true, versionKey: false })
export class Mesa {
  @Prop({
    type: Number,
    required: true,
    unique: true,
    min: 1,
  })
  numero!: number;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  capacidad!: number;

  @Prop({
    type: String,
    enum: Object.values(MesaEstado),
    default: MesaEstado.LIBRE,
  })
  estado!: MesaEstado;

  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    default: null,
  })
  meseroActual!: Types.ObjectId | null;

  @Prop({
    type: Date,
    default: null,
  })
  abiertaEn!: Date | null;

  @Prop({
    type: Date,
    default: null,
  })
  cerradaEn!: Date | null;
}

export const MesaSchema = SchemaFactory.createForClass(Mesa);

MesaSchema.index({ numero: 1 }, { unique: true });
