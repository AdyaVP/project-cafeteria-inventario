import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MesasModule } from '../mesas/mesas.module.js';
import { ProductosModule } from '../productos/productos.module.js';
import { InventarioModule } from '../inventario/inventario.module.js';

import { Orden, OrdenSchema } from './schemas/orden.schema.js';
import { OrdenCocina, OrdenCocinaSchema } from './schemas/orden-cocina.schema.js';
import { OrdenCafeteria, OrdenCafeteriaSchema } from './schemas/orden-cafeteria.schema.js';
import { TipoOrden } from './schemas/tipo-orden.enum.js';
import { OrdenesController } from './ordenes.controller.js';
import { OrdenesService } from './ordenes.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Orden.name,
        schema: OrdenSchema,
        discriminators: [
          {
            name: OrdenCocina.name,
            schema: OrdenCocinaSchema,
            value: TipoOrden.COCINA,
          },
          {
            name: OrdenCafeteria.name,
            schema: OrdenCafeteriaSchema,
            value: TipoOrden.CAFETERIA,
          },
        ],
      },
    ]),
    MesasModule,
    ProductosModule,
    InventarioModule,
  ],
  controllers: [OrdenesController],
  providers: [OrdenesService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
