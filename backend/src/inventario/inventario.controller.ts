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

import { InventarioService } from './inventario.service.js';

import {
  CreateInventarioItemSchema,
} from './dto/create-inventario-item.dto.js';

import {
  UpdateStockSchema,
} from './dto/update-stock.dto.js';

import type {
  CreateInventarioItemDto,
} from './dto/create-inventario-item.dto.js';

import type {
  UpdateStockDto,
} from './dto/update-stock.dto.js';

@Controller('inventario')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.COCINA)
  async listar() {
    return this.inventarioService.listar();
  }

  @Get('alertas')
  @Roles(Role.ADMIN, Role.COCINA)
  async alertas() {
    return this.inventarioService.obtenerAlertas();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COCINA)
  async buscarPorId(
    @Param('id') id: string,
  ) {
    return this.inventarioService.buscarPorId(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @UsePipes(
    new ZodValidationPipe(
      CreateInventarioItemSchema,
    ),
  )
  async crear(
    @Body() dto: CreateInventarioItemDto,
  ) {
    return this.inventarioService.crear(dto);
  }

  @Patch(':id/stock')
  @Roles(Role.ADMIN, Role.COCINA)
  @UsePipes(
    new ZodValidationPipe(UpdateStockSchema),
  )
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