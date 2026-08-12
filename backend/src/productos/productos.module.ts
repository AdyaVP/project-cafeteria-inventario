import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';
import { RecetasController } from './recetas.controller.js';
import { RecetasService } from './recetas.service.js';

import {
  Producto,
  ProductoSchema,
} from './schemas/producto.schema.js';

import {
  ProductoComida,
  ProductoComidaSchema,
} from './schemas/producto-comida.schema.js';

import {
  ProductoBebida,
  ProductoBebidaSchema,
} from './schemas/producto-bebida.schema.js';

import {
  ProductoTipo,
} from './schemas/producto-tipo.enum.js';

import {
  Receta,
  RecetaSchema,
} from './schemas/receta.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Producto.name,
        schema: ProductoSchema,
        discriminators: [
          {
            name: ProductoComida.name,
            schema: ProductoComidaSchema,
            value: ProductoTipo.COMIDA,
          },
          {
            name: ProductoBebida.name,
            schema: ProductoBebidaSchema,
            value: ProductoTipo.BEBIDA,
          },
        ],
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
