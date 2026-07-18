import { MesaEstado } from '../schemas/mesa.schema';

interface MeseroPublico {
  id: string;
  nombre: string;
}

export interface MesaResponse {
  id: string;
  numero: number;
  capacidad: number;
  estado: MesaEstado;
  meseroActual: MeseroPublico | null;
  abiertaEn: Date | null;
  cerradaEn: Date | null;
}