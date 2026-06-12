import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/constants/roles.enum.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { RecetasService } from './recetas.service.js';

import {
  CreateRecetaSchema,
} from './dto/create-receta.dto.js';

import type {
  CreateRecetaDto,
} from './dto/create-receta.dto.js';

@Controller('recetas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecetasController {
  constructor(
    private readonly recetasService: RecetasService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.COCINA)
  async listar() {
    return this.recetasService.listar();
  }

  @Get(':productoId')
  @Roles(Role.ADMIN, Role.COCINA)
  async buscarPorProducto(
    @Param('productoId') productoId: string,
  ) {
    return this.recetasService.buscarPorProducto(
      productoId,
    );
  }

  @Post()
  @Roles(Role.ADMIN, Role.COCINA)
  @UsePipes(
    new ZodValidationPipe(CreateRecetaSchema),
  )
  async crear(
    @Body() dto: CreateRecetaDto,
  ) {
    return this.recetasService.crear(dto);
  }
}