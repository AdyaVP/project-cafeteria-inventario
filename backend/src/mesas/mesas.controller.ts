import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';

import { MesasService } from './mesas.service.js';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

import { Role } from '../common/constants/roles.enum.js';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { CreateMesaSchema } from './dto/create-mesa.dto.js';
import type { CreateMesaDto } from './dto/create-mesa.dto.js';

import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import type { MesaResponse } from './interfaces/mesa-response.interface.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mesas')
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MESERO, Role.CAJERO)
  async listarTodas(): Promise<MesaResponse[]> {
    return this.mesasService.listarTodas();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MESERO, Role.CAJERO)
  async buscarPorId(@Param('id') id: string): Promise<MesaResponse> {
    return this.mesasService.buscarPorId(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async crear(
    @Body(new ZodValidationPipe(CreateMesaSchema))
    dto: CreateMesaDto,
  ): Promise<MesaResponse> {
    return this.mesasService.crear(dto);
  }

  @Patch(':id/abrir')
  @Roles(Role.MESERO)
  async abrirMesa(
    @Param('id') mesaId: string,
    @CurrentUser() usuario: JwtPayload,
  ): Promise<MesaResponse> {
    return this.mesasService.abrirMesa(mesaId, usuario.sub);
  }

  @Patch(':id/solicitar-cuenta')
  @Roles(Role.MESERO)
  async solicitarCuenta(@Param('id') mesaId: string): Promise<MesaResponse> {
    return this.mesasService.solicitarCuenta(mesaId);
  }

  @Patch(':id/cerrar')
  @Roles(Role.ADMIN, Role.CAJERO)
  async cerrarMesa(@Param('id') mesaId: string): Promise<MesaResponse> {
    return this.mesasService.cerrarMesa(mesaId);
  }
}
