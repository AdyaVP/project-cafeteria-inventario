import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { InventarioService } from '../inventario/inventario.service.js';

import { Receta, RecetaDocument } from './schemas/receta.schema.js';
import { Producto, ProductoDocument } from './schemas/producto.schema.js';
import { ProductoTipo } from './schemas/producto-tipo.enum.js';

import type { CreateRecetaDto } from './dto/create-receta.dto.js';
import type { UpdateRecetaDto } from './dto/update-receta.dto.js';

import type { RecetaResponse } from './interfaces/receta-response.interface.js';

@Injectable()
export class RecetasService {
  constructor(
    @InjectModel(Receta.name)
    private readonly recetaModel: Model<RecetaDocument>,
    @InjectModel(Producto.name)
    private readonly productoModel: Model<ProductoDocument>,
    private readonly inventarioService: InventarioService,
  ) {}

  async listar(): Promise<RecetaResponse[]> {
    const recetas = await this.recetaModel.find();

    return recetas.map((receta) => this.toResponse(receta));
  }

  async crear(dto: CreateRecetaDto): Promise<RecetaResponse> {
    this.validarObjectId(dto.productoId);
    await Promise.all([
      this.validarProductoComida(dto.productoId),
      this.validarIngredientes(dto.ingredientes),
    ]);

    const receta = await this.recetaModel.create(dto);

    return this.toResponse(receta);
  }

  async actualizar(
    productoId: string,
    dto: UpdateRecetaDto,
  ): Promise<RecetaResponse> {
    this.validarObjectId(productoId);
    await Promise.all([
      this.validarProductoComida(productoId),
      this.validarIngredientes(dto.ingredientes),
    ]);

    const receta = await this.recetaModel.findOneAndUpdate(
      { productoId },
      {
        $set: {
          ingredientes: dto.ingredientes.map((ingrediente) => ({
            inventarioItemId: new Types.ObjectId(ingrediente.inventarioItemId),
            cantidad: ingrediente.cantidad,
          })),
        },
      },
      { new: true, runValidators: true },
    );

    if (!receta) {
      throw new NotFoundException('Receta no encontrada');
    }

    return this.toResponse(receta);
  }

  async buscarPorProducto(
    productoId: string,
    session?: ClientSession,
  ): Promise<RecetaResponse> {
    this.validarObjectId(productoId);

    const receta = session
      ? await this.recetaModel.findOne({ productoId }).session(session)
      : await this.recetaModel.findOne({ productoId });

    if (!receta) {
      throw new NotFoundException('Receta no encontrada');
    }

    return this.toResponse(receta);
  }

  private toResponse(receta: RecetaDocument): RecetaResponse {
    return {
      id: receta._id.toString(),

      productoId: receta.productoId.toString(),

      ingredientes: receta.ingredientes.map((ingrediente) => ({
        inventarioItemId: ingrediente.inventarioItemId.toString(),

        cantidad: ingrediente.cantidad,
      })),
    };
  }

  private validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
  }

  private async validarProductoComida(productoId: string): Promise<void> {
    const producto = await this.productoModel.findById(productoId);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    if (producto.tipo !== ProductoTipo.COMIDA) {
      throw new BadRequestException(
        'Solo los productos de tipo COMIDA pueden tener receta',
      );
    }
  }

  private async validarIngredientes(
    ingredientes: UpdateRecetaDto['ingredientes'],
  ): Promise<void> {
    if (ingredientes.length === 0) {
      throw new BadRequestException(
        'La receta debe tener al menos un ingrediente',
      );
    }

    const ids = new Set<string>();
    for (const ingrediente of ingredientes) {
      this.validarObjectId(ingrediente.inventarioItemId);
      if (
        !Number.isFinite(ingrediente.cantidad) ||
        ingrediente.cantidad < 0.01
      ) {
        throw new BadRequestException(
          'La cantidad mínima por ingrediente es 0.01',
        );
      }
      if (ids.has(ingrediente.inventarioItemId)) {
        throw new BadRequestException(
          'No se puede repetir un insumo en la receta',
        );
      }
      ids.add(ingrediente.inventarioItemId);
    }

    const items = await Promise.all(
      [...ids].map((id) => this.inventarioService.buscarPorId(id)),
    );
    const inactivo = items.find((item) => !item.activo);
    if (inactivo) {
      throw new BadRequestException(
        `El insumo ${inactivo.nombre} no está activo`,
      );
    }
  }
}
