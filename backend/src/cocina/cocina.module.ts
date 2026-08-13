import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OrdenesModule } from '../ordenes/ordenes.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';

import { CocinaController } from './cocina.controller.js';
import { CocinaService } from './cocina.service.js';
import { CocinaGateway } from './cocina.gateway.js';

@Module({
  imports: [AuthModule, OrdenesModule, UsuariosModule],
  controllers: [CocinaController],
  providers: [CocinaService, CocinaGateway],
})
export class CocinaModule {}
