import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum CorteEstado {
  ABIERTO = 'ABIERTO',
  CERRADO = 'CERRADO',
}

export type CorteCajaDocument = HydratedDocument<CorteCaja> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true, versionKey: false })
export class CorteCaja {
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  cajero!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  fondoInicial!: number;

  @Prop({ default: 0, min: 0 })
  totalEsperado!: number;

  @Prop({ default: 0, min: 0 })
  totalReal!: number;

  @Prop({ default: 0 })
  diferencia!: number;

  @Prop({ default: 0, min: 0 })
  totalEfectivo!: number;

  @Prop({ default: 0, min: 0 })
  totalTarjeta!: number;

  @Prop({ default: 0, min: 0 })
  totalTransferencia!: number;

  @Prop({ default: 0, min: 0 })
  totalPropinas!: number;

  @Prop({ default: 0 })
  cantidadFacturas!: number;

  @Prop({
    type: String,
    enum: Object.values(CorteEstado),
    default: CorteEstado.ABIERTO,
  })
  estado!: CorteEstado;

  @Prop({ type: Date })
  aperturaEn!: Date;

  @Prop({ type: Date })
  cierreEn?: Date;
}

export const CorteCajaSchema = SchemaFactory.createForClass(CorteCaja);

CorteCajaSchema.index({ cajero: 1, aperturaEn: -1 });
CorteCajaSchema.index({ estado: 1 });

// Un cajero solo puede tener una caja ABIERTA a la vez
CorteCajaSchema.index(
  { cajero: 1 },
  { unique: true, partialFilterExpression: { estado: 'ABIERTO' } },
);
