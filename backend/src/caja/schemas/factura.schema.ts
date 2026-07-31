import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

export enum FacturaEstado {
  PENDIENTE = 'PENDIENTE',
  PAGADA = 'PAGADA',
  ANULADA = 'ANULADA',
}

export type FacturaDocument = HydratedDocument<Factura> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true, versionKey: false })
export class Factura {
  @Prop({ type: Types.ObjectId, ref: 'Mesa', required: true })
  mesa!: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Orden' }],
    default: [],
  })
  ordenes!: Types.ObjectId[];

  // Snapshot inmutable de cada item al momento del pago.
  // NO son referencias vivas: si el precio cambia mañana, esta factura no se altera.
  @Prop({
    type: [
      {
        nombre: { type: String, required: true },
        cantidad: { type: Number, required: true, min: 1 },
        precioUnitario: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true, min: 0 },
      },
    ],
    default: [],
  })
  itemsSnapshot!: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  // Porcentaje de impuesto configurado desde IMPUESTO_PORCENTAJE
  @Prop({ required: true, min: 0 })
  impuesto!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({
    type: String,
    enum: Object.values(MetodoPago),
    required: true,
  })
  metodoPago!: MetodoPago;

  @Prop({
    type: String,
    enum: Object.values(FacturaEstado),
    default: FacturaEstado.PENDIENTE,
  })
  estado!: FacturaEstado;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  cajero!: Types.ObjectId;

  @Prop()
  cai?: string;

  @Prop()
  rtn?: string;

  @Prop({ type: Date, required: true })
  fechaEmision!: Date;

  @Prop()
  justificacionAnulacion?: string;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  anuladoPor?: Types.ObjectId;
}

export const FacturaSchema = SchemaFactory.createForClass(Factura);

FacturaSchema.index({ mesa: 1, createdAt: -1 });
FacturaSchema.index({ estado: 1 });
FacturaSchema.index({ fechaEmision: 1 });
