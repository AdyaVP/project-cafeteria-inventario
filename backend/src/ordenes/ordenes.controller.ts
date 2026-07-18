import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { Role } from '../common/constants/roles.enum.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

import { CrearOrdenSchema } from './dto/crear-orden.dto.js';
import type { CrearOrdenDto } from './dto/crear-orden.dto.js';
import { OrdenCocinaResponse, OrdenCafeteriaResponse } from './interfaces/orden-response.interface.js';
import { OrdenesService } from './ordenes.service.js';

@Controller('ordenes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  @Post()
  @Roles(Role.MESERO)
  async crear(
    @Body(new ZodValidationPipe(CrearOrdenSchema))
    dto: CrearOrdenDto,
    @CurrentUser() usuario: JwtPayload,
  ): Promise<(OrdenCocinaResponse | OrdenCafeteriaResponse)[]> {
    return this.ordenesService.crearOrden(dto, usuario.sub);
  }

  @Get('mesa/:mesaId')
  @Roles(Role.MESERO, Role.CAJERO, Role.ADMIN)
  async listarPorMesa(
    @Param('mesaId') mesaId: string,
  ): Promise<(OrdenCocinaResponse | OrdenCafeteriaResponse)[]> {
    return this.ordenesService.listarPorMesa(mesaId);
  }

  @Patch(':id/entregar')
  @Roles(Role.MESERO)
  async marcarEntregada(
    @Param('id') id: string,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    return this.ordenesService.marcarOrdenEntregada(id);
  }
}
