import { Unidad } from '../schemas/unidad.enum.js';

export interface InventarioResponse {
  id: string;
  nombre: string;
  unidad: Unidad;
  stockActual: number;
  stockMinimo: number;
  costoUnitario: number;
  activo: boolean;
}