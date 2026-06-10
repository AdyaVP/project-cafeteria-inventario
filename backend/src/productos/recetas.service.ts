import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Receta,
  RecetaDocument,
} from './schemas/receta.schema.js';

@Injectable()
export class RecetasService {
  constructor(
    @InjectModel(Receta.name)
    private readonly recetaModel: Model<RecetaDocument>,
  ) {}

  // Listar recetas
  async listar(): Promise<Receta[]> {
    return this.recetaModel.find().exec();
  }

  // Crear receta
  async crear(
  receta: {
    productoId: string;
    ingredientes: {
      inventarioItemId: string;
      cantidad: number;
    }[];
  },
): Promise<Receta> {
  return this.recetaModel.create(receta);
}

  // Buscar receta asociada a un producto
  async buscarPorProducto(
    productoId: string,
  ): Promise<Receta | null> {
    return this.recetaModel.findOne({
      productoId,
    }).exec();
  }
}