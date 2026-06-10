import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Producto,
  ProductoDocument,
} from './schemas/producto.schema.js';

import type { CreateProductoDto } from './dto/create-producto.dto.js';

@Injectable()
export class ProductosService {
  constructor(
    @InjectModel(Producto.name)
    private readonly productoModel: Model<ProductoDocument>,
  ) {}

  async crear(
    createProductoDto: CreateProductoDto,
  ): Promise<Producto> {
    return this.productoModel.create(createProductoDto);
  }

  async listar(): Promise<Producto[]> {
    return this.productoModel.find().exec();
  }

  async buscarPorId(
    id: string,
  ): Promise<Producto | null> {
    return this.productoModel.findById(id).exec();
  }

  // PEGAR AQUÍ ↓↓↓

  async listarDisponibles(): Promise<Producto[]> {
    return this.productoModel.find({
      disponible: true,
    }).exec();
  }

  async actualizar(
    id: string,
    datos: Partial<Producto>,
  ): Promise<Producto | null> {
    return this.productoModel.findByIdAndUpdate(
      id,
      datos,
      { new: true },
    ).exec();
  }

  async toggleDisponibilidad(
    id: string,
  ): Promise<Producto | null> {
    const producto =
      await this.productoModel.findById(id);

    if (!producto) {
      return null;
    }

    producto.disponible =
      !producto.disponible;

    await producto.save();

    return producto;
  }
}