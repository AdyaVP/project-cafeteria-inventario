import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { RecetasService } from './recetas.service.js';

import type { CreateRecetaDto } from './dto/create-receta.dto.js';

@Controller('recetas')
export class RecetasController {
  constructor(
    private readonly recetasService: RecetasService,
  ) {}

  @Get()
  async listar() {
    return this.recetasService.listar();
  }

  @Get(':productoId')
  async buscarPorProducto(
    @Param('productoId')
    productoId: string,
  ) {
    return this.recetasService.buscarPorProducto(
      productoId,
    );
  }

  @Post()
  async crear(
    @Body() dto: CreateRecetaDto,
  ) {
    return this.recetasService.crear(dto);
  }
}