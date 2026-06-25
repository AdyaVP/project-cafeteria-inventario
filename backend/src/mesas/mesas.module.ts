import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MesasService } from './mesas.service.js';
import { MesasController } from './mesas.controller.js';
import { Mesa, MesaSchema } from './schemas/mesa.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Mesa.name,
        schema: MesaSchema,
      },
    ]),
  ],
  controllers: [MesasController],
  providers: [MesasService],
  exports: [MesasService],
})
export class MesasModule {}
