import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { RecetasService } from './recetas.service.js';

import { Producto, ProductoSchema } from './schemas/producto.schema.js';
import { Receta, RecetaSchema } from './schemas/receta.schema.js';

import { RecetasController } from './recetas.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Producto.name,
        schema: ProductoSchema,
      },
      {
        name: Receta.name,
        schema: RecetaSchema,
      },
    ]),
  ],
  controllers: [
    ProductosController,
    RecetasController,
    ],
  providers: [
    ProductosService,
    RecetasService,
  ],
  exports: [
    ProductosService,
    RecetasService,
  ],
})
export class ProductosModule {}