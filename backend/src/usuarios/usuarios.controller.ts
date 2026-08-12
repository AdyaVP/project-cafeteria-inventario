import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { Role } from '../common/constants/roles.enum.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

import { UpdateUsuarioRolesSchema } from './dto/update-usuario.dto.js';
import type { UpdateUsuarioRolesDto } from './dto/update-usuario.dto.js';
import type { UsuarioResponse } from './interfaces/usuario-response.interface.js';
import { UsuariosService } from './usuarios.service.js';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles(Role.ADMIN)
  async listarTodos(): Promise<UsuarioResponse[]> {
    return this.usuariosService.listarTodos();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async buscarPorId(@Param('id') id: string): Promise<UsuarioResponse> {
    return this.usuariosService.buscarPorId(id);
  }

  @Patch(':id/roles')
  @Roles(Role.ADMIN)
  async actualizarRoles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUsuarioRolesSchema))
    dto: UpdateUsuarioRolesDto,
  ): Promise<UsuarioResponse> {
    return this.usuariosService.actualizarRoles(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async desactivar(@Param('id') id: string): Promise<void> {
    await this.usuariosService.desactivar(id);
  }
}
