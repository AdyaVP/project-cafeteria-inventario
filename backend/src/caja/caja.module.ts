import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MesasModule } from '../mesas/mesas.module.js';
import { OrdenesModule } from '../ordenes/ordenes.module.js';

import { CajaController } from './caja.controller.js';
import { CajaService } from './caja.service.js';
import { Factura, FacturaSchema } from './schemas/factura.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Factura.name, schema: FacturaSchema }]),
    MesasModule,
    OrdenesModule,
  ],
  controllers: [CajaController],
  providers: [CajaService],
})
export class CajaModule {}
