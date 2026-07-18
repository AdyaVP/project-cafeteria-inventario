import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { CocinaController } from './cocina.controller.js';
import { CocinaService } from './cocina.service.js';
import { CocinaGateway } from './cocina.gateway.js';

@Module({
  imports: [AuthModule],
  controllers: [CocinaController],
  providers: [CocinaService, CocinaGateway],
})
export class CocinaModule {}
