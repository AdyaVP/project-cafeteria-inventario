import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MesasModule } from '../mesas/mesas.module.js';
import { OrdenesModule } from '../ordenes/ordenes.module.js';
import { ProductosModule } from '../productos/productos.module.js';

import { CajaController } from './caja.controller.js';
import { CajaService } from './caja.service.js';
import { CorteCaja, CorteCajaSchema } from './schemas/corte-caja.schema.js';
import { Counter, CounterSchema } from './schemas/counter.schema.js';
import { Factura, FacturaSchema } from './schemas/factura.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Factura.name, schema: FacturaSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: CorteCaja.name, schema: CorteCajaSchema },
    ]),
    MesasModule,
    OrdenesModule,
    ProductosModule,
  ],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}
