import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { TipoIsv } from '../../productos/schemas/tipo-isv.enum.js';

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

export enum FacturaEstado {
  PAGADA = 'PAGADA',
  ANULADA = 'ANULADA',
}

export enum TipoDocumento {
  FACTURA = 'FACTURA',
  NOTA_CREDITO = 'NOTA_CREDITO',
  TICKET = 'TICKET',
}

export type FacturaDocument = HydratedDocument<Factura> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true, versionKey: false })
export class Factura {
  @Prop({ required: true, unique: true })
  correlativo!: number;

  @Prop({ required: true })
  numeroFactura!: string;

  @Prop({ required: true })
  comercioNombre!: string;

  @Prop({ required: true })
  comercioRtn!: string;

  @Prop({ required: true })
  cai!: string;

  @Prop({ required: true })
  fechaLimiteEmision!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Mesa', required: true })
  mesa!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  mesero!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  cajero!: Types.ObjectId;

  @Prop()
  clienteNombre?: string;

  @Prop()
  clienteRtn?: string;

  @Prop({
    type: [
      {
        producto: { type: Types.ObjectId, ref: 'Producto', required: true },
        nombreProducto: { type: String, required: true },
        cantidad: { type: Number, required: true, min: 1 },
        precioUnitario: { type: Number, required: true, min: 0 },
        subtotal: { type: Number, required: true, min: 0 },
        tipoIsv: {
          type: String,
          enum: Object.values(TipoIsv),
          required: true,
        },
        isv: { type: Number, required: true, min: 0 },
      },
    ],
    default: [],
  })
  items!: Array<{
    producto: Types.ObjectId;
    nombreProducto: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    tipoIsv: TipoIsv;
    isv: number;
  }>;

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ required: true, min: 0 })
  totalExento!: number;

  @Prop({ required: true, min: 0 })
  totalGravado15!: number;

  @Prop({ required: true, min: 0 })
  totalGravado18!: number;

  @Prop({ required: true, min: 0 })
  isv15!: number;

  @Prop({ required: true, min: 0 })
  isv18!: number;

  @Prop({ default: 0, min: 0 })
  propina!: number;

  @Prop({ default: 0, min: 0 })
  montoRecibido!: number;

  @Prop({ default: 0, min: 0 })
  cambio!: number;

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
    enum: Object.values(TipoDocumento),
    default: TipoDocumento.FACTURA,
  })
  tipoDocumento!: TipoDocumento;

  @Prop({
    type: String,
    enum: Object.values(FacturaEstado),
    default: FacturaEstado.PAGADA,
  })
  estado!: FacturaEstado;

  @Prop()
  motivoAnulacion?: string;

  @Prop()
  fechaAnulacion?: Date;
}

export const FacturaSchema = SchemaFactory.createForClass(Factura);

FacturaSchema.index({ correlativo: 1 }, { unique: true });
FacturaSchema.index({ numeroFactura: 1 }, { unique: true });
FacturaSchema.index({ createdAt: -1 });
FacturaSchema.index({ mesa: 1, createdAt: -1 });
