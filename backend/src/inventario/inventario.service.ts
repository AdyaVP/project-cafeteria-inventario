import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  InventarioItem,
  InventarioItemDocument,
} from './schemas/inventario-item.schema.js';

import type { CreateInventarioItemDto } from './dto/create-inventario-item.dto.js';

@Injectable()
export class InventarioService {
  constructor(
    @InjectModel(InventarioItem.name)
    private readonly inventarioModel: Model<InventarioItemDocument>,
  ) {}

  // Crear ingrediente o insumo
  async crear(
    dto: CreateInventarioItemDto,
  ): Promise<InventarioItem> {
    return this.inventarioModel.create(dto);
  }

  // Obtener todos los insumos
  async listar(): Promise<InventarioItem[]> {
    return this.inventarioModel.find().exec();
  }

  // Buscar por id
  async buscarPorId(
    id: string,
  ): Promise<InventarioItem | null> {
    return this.inventarioModel.findById(id).exec();
  }

  // Ajustar stock
  async ajustarStock(
    id: string,
    cantidad: number,
    operacion: 'AGREGAR' | 'DESCONTAR',
  ): Promise<InventarioItem | null> {
    const item =
      await this.inventarioModel.findById(id);

    if (!item) {
      return null;
    }

    if (operacion === 'AGREGAR') {
      item.stockActual += cantidad;
    } else {
      item.stockActual -= cantidad;
    }

    await item.save();

    return item;
  }

  // Obtener productos con stock bajo
  async obtenerAlertas(): Promise<InventarioItem[]> {
    const items =
      await this.inventarioModel.find().exec();

    return items.filter(
      (item) =>
        item.stockActual <= item.stockMinimo,
    );
  }
}