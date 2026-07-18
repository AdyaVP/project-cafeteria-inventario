import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { Role } from '../common/constants/roles.enum.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { OrdenCocinaResponse } from '../ordenes/interfaces/orden-response.interface.js';

import { CocinaService } from './cocina.service.js';

@Controller('cocina')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CocinaController {
  constructor(private readonly cocinaService: CocinaService) {}

  @Get('cola')
  @Roles(Role.COCINA)
  async obtenerCola(): Promise<OrdenCocinaResponse[]> {
    return this.cocinaService.obtenerColaActual();
  }

  @Patch(':ordenId/preparacion')
  @Roles(Role.COCINA)
  async marcarPreparacion(
    @Param('ordenId') ordenId: string,
  ): Promise<OrdenCocinaResponse> {
    return this.cocinaService.marcarEnPreparacion(ordenId);
  }

  @Patch(':ordenId/lista')
  @Roles(Role.COCINA)
  async marcarLista(
    @Param('ordenId') ordenId: string,
  ): Promise<OrdenCocinaResponse> {
    return this.cocinaService.marcarLista(ordenId);
  }
}
