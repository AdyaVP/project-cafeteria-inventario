import {
  MetodoPago,
  FacturaEstado,
  TipoDocumento,
} from '../schemas/factura.schema.js';
import { CorteEstado } from '../schemas/corte-caja.schema.js';
import { TipoIsv } from '../../productos/schemas/tipo-isv.enum.js';

export interface ItemFacturaResponse {
  productoId: string;
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  tipoIsv: TipoIsv;
  isv: number;
}

export interface CuentaPendienteResponse {
  mesaId: string;
  numero: number;
  mesero: { id: string; nombre: string };
  items: ItemFacturaResponse[];
  subtotal: number;
  totalExento: number;
  totalGravado15: number;
  totalGravado18: number;
  isv15: number;
  isv18: number;
  total: number;
}

export interface FacturaResponse {
  id: string;
  correlativo: number;
  numeroFactura: string;
  comercioNombre: string;
  comercioRtn: string;
  cai: string;
  fechaLimiteEmision: Date;
  tipoDocumento: TipoDocumento;
  mesa: { id: string; numero: number };
  mesero: { id: string; nombre: string };
  cajero: { id: string; nombre: string };
  clienteNombre?: string;
  clienteRtn?: string;
  items: ItemFacturaResponse[];
  subtotal: number;
  totalExento: number;
  totalGravado15: number;
  totalGravado18: number;
  isv15: number;
  isv18: number;
  propina: number;
  montoRecibido: number;
  cambio: number;
  total: number;
  metodoPago: MetodoPago;
  estado: FacturaEstado;
  motivoAnulacion?: string;
  fechaAnulacion?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReporteDiario {
  fecha: string;
  totalFacturado: number;
  totalIsv15: number;
  totalIsv18: number;
  totalExento: number;
  totalPropinas: number;
  cantidadFacturas: number;
  facturasAnuladas: number;
  desglosePorMetodoPago: {
    EFECTIVO: number;
    TARJETA: number;
    TRANSFERENCIA: number;
  };
  desglosePorCajero: Array<{
    cajeroId: string;
    cajeroNombre: string;
    total: number;
    cantidad: number;
  }>;
}

export interface CorteCajaResponse {
  id: string;
  cajero: { id: string; nombre: string };
  fondoInicial: number;
  totalEsperado: number;
  totalReal: number;
  diferencia: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalPropinas: number;
  cantidadFacturas: number;
  estado: CorteEstado;
  aperturaEn: Date;
  cierreEn?: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}
