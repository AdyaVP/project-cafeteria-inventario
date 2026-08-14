import { MetodoPago, FacturaEstado } from '../schemas/factura.schema.js';

export interface ItemSnapshotResponse {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PreCuentaResponse {
  mesa: {
    id: string;
    numero: number;
  };
  ordenes: Array<{ id: string }>;
  items: ItemSnapshotResponse[];
  subtotal: number;
  impuesto: number;
  total: number;
}

export interface FacturaResponse {
  id: string;
  mesa: {
    id: string;
    numero: number;
  };
  ordenes: Array<{ id: string }>;
  itemsSnapshot: ItemSnapshotResponse[];
  subtotal: number;
  impuesto: number;
  total: number;
  metodoPago: MetodoPago;
  estado: FacturaEstado;
  cajero: {
    id: string;
    nombre: string;
  };
  cai?: string;
  rtn?: string;
  fechaEmision: Date;
  justificacionAnulacion?: string;
  anuladoPor?: {
    id: string;
    nombre: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ReporteDiario {
  fecha: string;
  totalCobrado: number;
  desglosePorMetodoPago: {
    EFECTIVO: number;
    TARJETA: number;
    TRANSFERENCIA: number;
  };
  mesasAtendidas: number;
  ticketPromedio: number;
}
