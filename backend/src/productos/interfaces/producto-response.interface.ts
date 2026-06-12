import { ProductoTipo } from '../schemas/producto-tipo.enum.js';
import { Temperatura } from '../schemas/temperatura.enum.js';

export interface ProductoResponse {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  disponible: boolean;
  imagenUrl?: string;
  tipo: ProductoTipo;
}

export interface ProductoComidaResponse
  extends ProductoResponse {
  tiempoPreparacionMin: number;
  calorias?: number;
  alergenos: string[];
}

export interface ProductoBebidaResponse
  extends ProductoResponse {
  temperatura: Temperatura;
  tamanosDisponibles: {
    nombre: string;
    precioAdicional: number;
  }[];
}

export type ProductoDetalle =
  | ProductoComidaResponse
  | ProductoBebidaResponse;