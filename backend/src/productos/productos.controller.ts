import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/constants/roles.enum.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { ProductosService } from './productos.service.js';

import {
  CreateProductoSchema,
} from './dto/create-producto.dto.js';

import type {
  CreateProductoDto,
} from './dto/create-producto.dto.js';

import {
  UpdateProductoSchema,
} from './dto/update-producto.dto.js';

import type {
  UpdateProductoDto,
} from './dto/update-producto.dto.js';

@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.CAJERO, Role.MESERO)
  async listar() {
    return this.productosService.listar();
  }

  @Get('disponibles')
  @Roles(
    Role.ADMIN,
    Role.CAJERO,
    Role.MESERO,
    Role.COCINA,
  )
  async listarDisponibles() {
    return this.productosService.listarDisponibles();
  }

  @Get(':id')
  @Roles(
    Role.ADMIN,
    Role.CAJERO,
    Role.MESERO,
    Role.COCINA,
  )
  async buscarPorId(
    @Param('id') id: string,
  ) {
    return this.productosService.buscarPorId(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @UsePipes(
    new ZodValidationPipe(
      CreateProductoSchema,
    ),
  )
  async crear(
    @Body() dto: CreateProductoDto,
  ) {
    return this.productosService.crear(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UsePipes(
    new ZodValidationPipe(
      UpdateProductoSchema,
    ),
  )
  async actualizar(
    @Param('id') id: string,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.productosService.actualizar(
      id,
      dto,
    );
  }

  @Patch(':id/disponibilidad')
  @Roles(Role.ADMIN)
  async toggleDisponibilidad(
    @Param('id') id: string,
  ) {
    return this.productosService.toggleDisponibilidad(
      id,
    );
  }
}