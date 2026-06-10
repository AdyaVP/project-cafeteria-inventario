import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { ProductosService } from './productos.service.js';

import type { CreateProductoDto } from './dto/create-producto.dto.js';

@Controller('productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
  ) {}

  @Get()
  async listar() {
    return this.productosService.listar();
  }

  @Get('disponibles')
  async listarDisponibles() {
    return this.productosService.listarDisponibles();
  }

  @Get(':id')
  async buscarPorId(
    @Param('id') id: string,
  ) {
    return this.productosService.buscarPorId(id);
  }

  @Post()
  async crear(
    @Body() dto: CreateProductoDto,
  ) {
    return this.productosService.crear(dto);
  }

  @Patch(':id')
  async actualizar(
    @Param('id') id: string,
    @Body() datos: Record<string, unknown>,
  ) {
    return this.productosService.actualizar(
      id,
      datos,
    );
  }

  @Patch(':id/disponibilidad')
  async toggleDisponibilidad(
    @Param('id') id: string,
  ) {
    return this.productosService.toggleDisponibilidad(
      id,
    );
  }
}