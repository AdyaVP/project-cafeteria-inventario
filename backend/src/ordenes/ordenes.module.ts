import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Orden, OrdenSchema } from './schemas/orden.schema.js';
import { OrdenCocina, OrdenCocinaSchema } from './schemas/orden-cocina.schema.js';
import { OrdenCafeteria, OrdenCafeteriaSchema } from './schemas/orden-cafeteria.schema.js';
import { OrdenesController } from './ordenes.controller.js';
import { OrdenesService } from './ordenes.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Orden.name,
        schema: OrdenSchema,
        discriminators: [
          { name: OrdenCocina.name, schema: OrdenCocinaSchema },
          { name: OrdenCafeteria.name, schema: OrdenCafeteriaSchema },
        ],
      },
    ]),
  ],
  controllers: [OrdenesController],
  providers: [OrdenesService],
})
export class OrdenesModule {}
