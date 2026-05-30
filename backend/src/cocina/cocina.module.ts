import { Module } from '@nestjs/common';
import { CocinaController } from './cocina.controller';
import { CocinaService } from './cocina.service';
import { CocinaGateway } from './cocina.gateway';

@Module({
  controllers: [CocinaController],
  providers: [CocinaService, CocinaGateway],
})
export class CocinaModule {}
