import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { InventarioService } from './inventario.service.js';

import type { CreateInventarioItemDto } from './dto/create-inventario-item.dto.js';
import type { UpdateStockDto } from './dto/update-stock.dto.js';

@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
  ) {}

  @Get()
  async listar() {
    return this.inventarioService.listar();
  }

  @Get('alertas')
  async alertas() {
    return this.inventarioService.obtenerAlertas();
  }

  @Get(':id')
  async buscarPorId(
    @Param('id') id: string,
  ) {
    return this.inventarioService.buscarPorId(id);
  }

  @Post()
  async crear(
    @Body() dto: CreateInventarioItemDto,
  ) {
    return this.inventarioService.crear(dto);
  }

  @Patch(':id/stock')
  async actualizarStock(
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
  ) {
    return this.inventarioService.ajustarStock(
      id,
      dto.cantidad,
      dto.operacion,
    );
  }
}