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

import { AbrirCajaSchema } from './dto/abrir-caja.dto.js';
import type { AbrirCajaDto } from './dto/abrir-caja.dto.js';

import { AnularFacturaSchema } from './dto/anular-factura.dto.js';
import type { AnularFacturaDto } from './dto/anular-factura.dto.js';

import { CerrarCajaSchema } from './dto/cerrar-caja.dto.js';
import type { CerrarCajaDto } from './dto/cerrar-caja.dto.js';

import { CobrarMesaSchema } from './dto/cobrar-mesa.dto.js';
import type { CobrarMesaDto } from './dto/cobrar-mesa.dto.js';

import type {
  CorteCajaResponse,
  CuentaPendienteResponse,
  FacturaResponse,
  PaginatedResponse,
  ReporteDiario,
} from './interfaces/factura-response.interface.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Post('apertura')
  @Roles(Role.ADMIN, Role.CAJERO)
  async abrirCaja(
    @CurrentUser() usuario: JwtPayload,
    @Body(new ZodValidationPipe(AbrirCajaSchema)) dto: AbrirCajaDto,
  ): Promise<CorteCajaResponse> {
    return this.cajaService.abrirCaja(usuario.sub, dto.fondoInicial);
  }

  @Post('cierre')
  @Roles(Role.ADMIN, Role.CAJERO)
  async cerrarCaja(
    @CurrentUser() usuario: JwtPayload,
    @Body(new ZodValidationPipe(CerrarCajaSchema)) dto: CerrarCajaDto,
  ): Promise<CorteCajaResponse> {
    return this.cajaService.cerrarCaja(usuario.sub, dto.totalReal);
  }

  @Get('cortes')
  @Roles(Role.ADMIN)
  async listarCortes(): Promise<CorteCajaResponse[]> {
    return this.cajaService.listarCortes();
  }

  @Get('cuenta/:mesaId')
  @Roles(Role.ADMIN, Role.CAJERO)
  async obtenerCuenta(
    @Param('mesaId') mesaId: string,
  ): Promise<CuentaPendienteResponse> {
    return this.cajaService.obtenerCuenta(mesaId);
  }

  @Post('cobrar/:mesaId')
  @Roles(Role.ADMIN, Role.CAJERO)
  async cobrarMesa(
    @Param('mesaId') mesaId: string,
    @CurrentUser() usuario: JwtPayload,
    @Body(new ZodValidationPipe(CobrarMesaSchema)) dto: CobrarMesaDto,
  ): Promise<FacturaResponse> {
    return this.cajaService.cobrarMesa(mesaId, usuario.sub, dto);
  }

  @Get('facturas')
  @Roles(Role.ADMIN, Role.CAJERO)
  async listarFacturas(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('mesaId') mesaId?: string,
  ): Promise<PaginatedResponse<FacturaResponse>> {
    return this.cajaService.listarFacturas(
      pagina ? Number(pagina) : 1,
      limite ? Number(limite) : 20,
      mesaId,
    );
  }

  @Get('facturas/:id')
  @Roles(Role.ADMIN, Role.CAJERO)
  async buscarFactura(@Param('id') id: string): Promise<FacturaResponse> {
    return this.cajaService.buscarFactura(id);
  }

  @Patch('facturas/:id/anular')
  @Roles(Role.ADMIN)
  async anularFactura(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AnularFacturaSchema)) dto: AnularFacturaDto,
  ): Promise<FacturaResponse> {
    return this.cajaService.anularFactura(id, dto);
  }

  @Get('reporte/diario')
  @Roles(Role.ADMIN)
  async reporteDiario(@Query('fecha') fecha?: string): Promise<ReporteDiario> {
    return this.cajaService.reporteDiario(fecha);
  }
}
