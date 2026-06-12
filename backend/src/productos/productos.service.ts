import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  UpdateProductoDto,
} from './dto/update-producto.dto.js';

import { InjectModel } from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  Producto,
  ProductoDocument,
} from './schemas/producto.schema.js';

import type { CreateProductoDto } from './dto/create-producto.dto.js';

import type {
  ProductoResponse,
} from './interfaces/producto-response.interface.js';

@Injectable()
export class ProductosService {
  constructor(
    @InjectModel(Producto.name)
    private readonly productoModel: Model<ProductoDocument>,
  ) {}

  async crear(
    createProductoDto: CreateProductoDto,
  ): Promise<ProductoResponse> {
    const producto =
      await this.productoModel.create(
        createProductoDto,
      );

    return this.toResponse(producto);
  }

  async listar(): Promise<ProductoResponse[]> {
    const productos =
      await this.productoModel.find();

    return productos.map((producto) =>
      this.toResponse(producto),
    );
  }

  async buscarPorId(
    id: string,
  ): Promise<ProductoResponse> {
    this.validarObjectId(id);

    const producto =
      await this.productoModel.findById(id);

    if (!producto) {
      throw new NotFoundException(
        'Producto no encontrado',
      );
    }

    return this.toResponse(producto);
  }

  async listarDisponibles(): Promise<
    ProductoResponse[]
  > {
    const productos =
      await this.productoModel.find({
        disponible: true,
      });

    return productos.map((producto) =>
      this.toResponse(producto),
    );
  }

  async actualizar(
    id: string,
    datos: UpdateProductoDto,
  ): Promise<ProductoResponse> {
    this.validarObjectId(id);

    const producto =
      await this.productoModel.findByIdAndUpdate(
        id,
        datos,
        { new: true },
      );

    if (!producto) {
      throw new NotFoundException(
        'Producto no encontrado',
      );
    }

    return this.toResponse(producto);
  }

  async toggleDisponibilidad(
    id: string,
  ): Promise<ProductoResponse> {
    this.validarObjectId(id);

    const producto =
      await this.productoModel.findById(id);

    if (!producto) {
      throw new NotFoundException(
        'Producto no encontrado',
      );
    }

    producto.disponible =
      !producto.disponible;

    await producto.save();

    return this.toResponse(producto);
  }

  private toResponse(
    producto: ProductoDocument,
  ): ProductoResponse {
    return {
      id: producto._id.toString(),
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      disponible: producto.disponible,
      imagenUrl: producto.imagenUrl,
      tipo: producto.tipo,
    };
  }

  private validarObjectId(
    id: string,
  ): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'ID inválido',
      );
    }
  }
}