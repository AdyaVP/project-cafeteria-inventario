export interface RecetaResponse {
  id: string;

  productoId: string;

  ingredientes: {
    inventarioItemId: string;
    cantidad: number;
  }[];
}
