import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';
import type { ClientSession } from 'mongoose';

import {
  InventarioItem,
  InventarioItemDocument,
} from './schemas/inventario-item.schema.js';

import type { CreateInventarioItemDto } from './dto/create-inventario-item.dto.js';

import type {
  InventarioResponse,
} from './interfaces/inventario-response.interface.js';

@Injectable()
export class InventarioService {
  constructor(
    @InjectModel(InventarioItem.name)
    private readonly inventarioModel: Model<InventarioItemDocument>,
  ) {}

  async crear(
    dto: CreateInventarioItemDto,
  ): Promise<InventarioResponse> {
    const existente =
      await this.inventarioModel.findOne({
        nombre: dto.nombre,
      });

    if (existente) {
      throw new ConflictException(
        'Ya existe un insumo con ese nombre',
      );
    }

    const item =
      await this.inventarioModel.create(dto);

    return this.toResponse(item);
  }

  async listar(): Promise<
    InventarioResponse[]
  > {
    const items =
      await this.inventarioModel.find();

    return items.map((item) =>
      this.toResponse(item),
    );
  }

  async buscarPorId(
    id: string,
    session?: ClientSession,
  ): Promise<InventarioResponse> {
    this.validarObjectId(id);

    const item = session
      ? await this.inventarioModel.findById(id).session(session)
      : await this.inventarioModel.findById(id);

    if (!item) {
      throw new NotFoundException(
        'Insumo no encontrado',
      );
    }

    return this.toResponse(item);
  }

  async ajustarStock(
    id: string,
    cantidad: number,
    operacion: 'AGREGAR' | 'DESCONTAR',
  ): Promise<InventarioResponse> {
    this.validarObjectId(id);

    const item =
      await this.inventarioModel.findById(id);

    if (!item) {
      throw new NotFoundException(
        'Insumo no encontrado',
      );
    }

    if (operacion === 'AGREGAR') {
      item.stockActual += cantidad;
    } else {
      if (
        item.stockActual - cantidad < 0
      ) {
        throw new BadRequestException(
          'Stock insuficiente',
        );
      }

      item.stockActual -= cantidad;
    }

    await item.save();

    return this.toResponse(item);
  }

  async obtenerAlertas(): Promise<
    InventarioResponse[]
  > {
    const items =
      await this.inventarioModel.find({
        $expr: {
          $lte: [
            '$stockActual',
            '$stockMinimo',
          ],
        },
      });

    return items.map((item) =>
      this.toResponse(item),
    );
  }

  async descontarPorReceta(
    ingredientes: {
      inventarioItemId: string;
      cantidad: number;
    }[],
    session?: ClientSession,
  ): Promise<void> {
    for (const ingrediente of ingredientes) {
      this.validarObjectId(
        ingrediente.inventarioItemId,
      );

      const item = session
        ? await this.inventarioModel.findById(ingrediente.inventarioItemId).session(session)
        : await this.inventarioModel.findById(ingrediente.inventarioItemId);

      if (!item) {
        throw new NotFoundException(
          `Insumo no encontrado: ${ingrediente.inventarioItemId}`,
        );
      }

      if (
        item.stockActual <
        ingrediente.cantidad
      ) {
        throw new BadRequestException(
          `Stock insuficiente para ${item.nombre}`,
        );
      }

      item.stockActual -=
        ingrediente.cantidad;

      if (session) {
        await item.save({ session });
      } else {
        await item.save();
      }
    }
  }

  private toResponse(
    item: InventarioItemDocument,
  ): InventarioResponse {
    return {
      id: item._id.toString(),
      nombre: item.nombre,
      unidad: item.unidad,
      stockActual: item.stockActual,
      stockMinimo: item.stockMinimo,
      costoUnitario: item.costoUnitario,
      activo: item.activo,
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