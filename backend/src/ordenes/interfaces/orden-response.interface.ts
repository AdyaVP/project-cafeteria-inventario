import { ItemEstado } from '../schemas/item-estado.enum.js';
import { OrdenEstado } from '../schemas/orden-estado.enum.js';
import { TipoOrden } from '../schemas/tipo-orden.enum.js';
import { Temperatura } from '../../productos/schemas/temperatura.enum.js';

export interface OrdenItemResponse {
  id: string;
  productoId: string;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
  notas?: string;
  estadoItem: ItemEstado;
}

export interface OrdenResponse {
  id: string;
  mesa: {
    id: string;
    numero: number;
  };
  mesero: {
    id: string;
    nombre: string;
  };
  items: OrdenItemResponse[];
  estadoGeneral: OrdenEstado;
  tipo: TipoOrden;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrdenCocinaResponse extends OrdenResponse {
  notaChef?: string;
  tiempoEstimadoMin?: number;
}

export interface OrdenCafeteriaResponse extends OrdenResponse {
  temperatura?: Temperatura;
  tamano?: string;
}
