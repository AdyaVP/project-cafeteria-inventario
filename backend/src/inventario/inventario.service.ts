import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';
import type { ClientSession } from 'mongoose';

import {
  InventarioItem,
  InventarioItemDocument,
} from './schemas/inventario-item.schema.js';

import type { CreateInventarioItemDto } from './dto/create-inventario-item.dto.js';

import type { InventarioResponse } from './interfaces/inventario-response.interface.js';

@Injectable()
export class InventarioService {
  constructor(
    @InjectModel(InventarioItem.name)
    private readonly inventarioModel: Model<InventarioItemDocument>,
  ) {}

  async crear(dto: CreateInventarioItemDto): Promise<InventarioResponse> {
    const existente = await this.inventarioModel.findOne({
      nombre: dto.nombre,
    });

    if (existente) {
      throw new ConflictException('Ya existe un insumo con ese nombre');
    }

    const item = await this.inventarioModel.create(dto);

    return this.toResponse(item);
  }

  async listar(): Promise<InventarioResponse[]> {
    const items = await this.inventarioModel.find();

    return items.map((item) => this.toResponse(item));
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
      throw new NotFoundException('Insumo no encontrado');
    }

    return this.toResponse(item);
  }

  async ajustarStock(
    id: string,
    cantidad: number,
    operacion: 'AGREGAR' | 'DESCONTAR',
  ): Promise<InventarioResponse> {
    this.validarObjectId(id);

    const filtro: Record<string, unknown> = {
      _id: new Types.ObjectId(id),
    };
    const incremento = operacion === 'AGREGAR' ? cantidad : -cantidad;

    if (operacion === 'DESCONTAR') {
      filtro.stockActual = { $gte: cantidad };
    }

    const item = await this.inventarioModel.findOneAndUpdate(
      filtro,
      { $inc: { stockActual: incremento } },
      { new: true },
    );

    if (!item) {
      const existente = await this.inventarioModel.exists({ _id: id });
      if (!existente) {
        throw new NotFoundException('Insumo no encontrado');
      }
      throw new BadRequestException('Stock insuficiente');
    }

    return this.toResponse(item);
  }

  async obtenerAlertas(): Promise<InventarioResponse[]> {
    const items = await this.inventarioModel.find({
      $expr: {
        $lte: ['$stockActual', '$stockMinimo'],
      },
    });

    return items.map((item) => this.toResponse(item));
  }

  async descontarPorReceta(
    ingredientes: {
      inventarioItemId: string;
      cantidad: number;
    }[],
    session?: ClientSession,
  ): Promise<void> {
    for (const ingrediente of ingredientes) {
      this.validarObjectId(ingrediente.inventarioItemId);

      const opciones = session ? { new: true, session } : { new: true };
      const item = await this.inventarioModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(ingrediente.inventarioItemId),
          stockActual: { $gte: ingrediente.cantidad },
        },
        { $inc: { stockActual: -ingrediente.cantidad } },
        opciones,
      );

      if (!item) {
        const consulta = this.inventarioModel.findById(
          ingrediente.inventarioItemId,
        );
        const existente = session
          ? await consulta.session(session)
          : await consulta;
        if (!existente) {
          throw new NotFoundException(
            `Insumo no encontrado: ${ingrediente.inventarioItemId}`,
          );
        }
        throw new BadRequestException(
          `Stock insuficiente para ${existente.nombre}`,
        );
      }
    }
  }

  private toResponse(item: InventarioItemDocument): InventarioResponse {
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

  private validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
  }
}
