import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/constants/roles.enum.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

import { CajaService } from './caja.service.js';

import { AnularFacturaSchema } from './dto/anular-factura.dto.js';
import type { AnularFacturaDto } from './dto/anular-factura.dto.js';

import { EmitirFacturaSchema } from './dto/emitir-factura.dto.js';
import type { EmitirFacturaDto } from './dto/emitir-factura.dto.js';

import type {
  FacturaResponse,
  PreCuentaResponse,
  ReporteDiario,
} from './interfaces/factura-response.interface.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Get('pre-cuenta/:mesaId')
  @Roles(Role.CAJERO, Role.MESERO, Role.ADMIN)
  async generarPreCuenta(
    @Param('mesaId') mesaId: string,
  ): Promise<PreCuentaResponse> {
    return this.cajaService.generarPreCuenta(mesaId);
  }

  @Post('factura')
  @Roles(Role.CAJERO)
  async emitirFactura(
    @CurrentUser() usuario: JwtPayload,
    @Body(new ZodValidationPipe(EmitirFacturaSchema)) dto: EmitirFacturaDto,
  ): Promise<FacturaResponse> {
    return this.cajaService.emitirFactura(usuario.sub, dto);
  }

  @Get('factura/:id')
  @Roles(Role.CAJERO, Role.ADMIN)
  async buscarFactura(@Param('id') id: string): Promise<FacturaResponse> {
    return this.cajaService.buscarFactura(id);
  }

  @Patch('factura/:id/anular')
  @Roles(Role.ADMIN)
  async anularFactura(
    @Param('id') id: string,
    @CurrentUser() usuario: JwtPayload,
    @Body(new ZodValidationPipe(AnularFacturaSchema)) dto: AnularFacturaDto,
  ): Promise<FacturaResponse> {
    return this.cajaService.anularFactura(id, usuario.sub, dto.justificacion);
  }

  @Get('reportes/diario')
  @Roles(Role.ADMIN)
  async reporteDiario(@Query('fecha') fecha?: string): Promise<ReporteDiario> {
    return this.cajaService.reporteDiario(fecha);
  }
}
