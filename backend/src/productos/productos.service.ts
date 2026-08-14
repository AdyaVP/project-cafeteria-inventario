import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

import type { UpdateProductoDto } from './dto/update-producto.dto.js';

import type { CreateProductoDto } from './dto/create-producto.dto.js';

import { Producto, ProductoDocument } from './schemas/producto.schema.js';

import { ProductoComida } from './schemas/producto-comida.schema.js';

import { ProductoBebida } from './schemas/producto-bebida.schema.js';

import { ProductoTipo } from './schemas/producto-tipo.enum.js';
import { Receta, RecetaDocument } from './schemas/receta.schema.js';

import type { ProductoDetalle } from './interfaces/producto-response.interface.js';

@Injectable()
export class ProductosService {
  constructor(
    @InjectModel(Producto.name)
    private readonly productoModel: Model<ProductoDocument>,
    @InjectModel(Receta.name)
    private readonly recetaModel: Model<RecetaDocument>,
  ) {}

  async crear(createProductoDto: CreateProductoDto): Promise<ProductoDetalle> {
    const discriminatorName =
      createProductoDto.tipo === ProductoTipo.COMIDA
        ? ProductoComida.name
        : ProductoBebida.name;

    const discriminatorModel =
      this.productoModel.discriminators?.[discriminatorName];

    if (!discriminatorModel) {
      throw new BadRequestException(
        `Discriminador ${discriminatorName} no registrado`,
      );
    }

    const datos =
      createProductoDto.tipo === ProductoTipo.COMIDA
        ? { ...createProductoDto, disponible: false }
        : createProductoDto;

    const producto = (await discriminatorModel.create(
      datos,
    )) as ProductoDocument;

    return this.toResponse(producto);
  }

  async listar(): Promise<ProductoDetalle[]> {
    const productos = await this.productoModel.find();

    return productos.map((producto) => this.toResponse(producto));
  }

  async buscarPorId(
    id: string,
    session?: ClientSession,
  ): Promise<ProductoDetalle> {
    this.validarObjectId(id);

    const producto = session
      ? await this.productoModel.findById(id).session(session)
      : await this.productoModel.findById(id);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.toResponse(producto);
  }

  async listarDisponibles(): Promise<ProductoDetalle[]> {
    const productos = await this.productoModel.find({
      disponible: true,
    });

    return productos.map((producto) => this.toResponse(producto));
  }

  async actualizar(
    id: string,
    datos: UpdateProductoDto,
  ): Promise<ProductoDetalle> {
    this.validarObjectId(id);

    if (datos.disponible === true) {
      await this.validarRecetaParaActivar(id);
    }

    const producto = await this.productoModel.findByIdAndUpdate(id, datos, {
      new: true,
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    return this.toResponse(producto);
  }

  async toggleDisponibilidad(id: string): Promise<ProductoDetalle> {
    this.validarObjectId(id);

    const producto = await this.productoModel.findById(id);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (!producto.disponible) {
      await this.validarRecetaParaActivar(id, producto.tipo);
    }

    producto.disponible = !producto.disponible;

    await producto.save();

    return this.toResponse(producto);
  }

  private toResponse(producto: ProductoDocument): ProductoDetalle {
    const base = {
      id: producto._id.toString(),
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      disponible: producto.disponible,
      imagenUrl: producto.imagenUrl,
      tipo: producto.tipo,
    };

    if (producto.tipo === ProductoTipo.COMIDA) {
      const comida = producto as ProductoComida & ProductoDocument;

      return {
        ...base,
        tiempoPreparacionMin: comida.tiempoPreparacionMin ?? 0,
        calorias: comida.calorias,
        alergenos: comida.alergenos ?? [],
      };
    }

    const bebida = producto as ProductoBebida & ProductoDocument;

    return {
      ...base,
      temperatura: bebida.temperatura,
      tamanosDisponibles: bebida.tamanosDisponibles ?? [],
    };
  }

  private validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
  }

  private async validarRecetaParaActivar(
    productoId: string,
    tipoConocido?: ProductoTipo,
  ): Promise<void> {
    let tipo = tipoConocido;

    if (!tipo) {
      const producto = await this.productoModel
        .findById(productoId)
        .select('tipo')
        .lean()
        .exec();

      if (!producto) {
        throw new NotFoundException('Producto no encontrado');
      }
      tipo = producto.tipo;
    }

    if (tipo !== ProductoTipo.COMIDA) {
      return;
    }

    const recetaExiste = await this.recetaModel.exists({
      productoId,
    });

    if (!recetaExiste) {
      throw new BadRequestException(
        'No se puede activar una comida sin receta. Cree la receta primero.',
      );
    }
  }
}
