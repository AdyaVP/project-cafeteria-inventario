import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MesasService } from './mesas.service.js';
import { MesasController } from './mesas.controller.js';
import { Mesa, MesaSchema } from './schemas/mesa.schema.js';
import { Orden, OrdenSchema } from '../ordenes/schemas/orden.schema.js';
import { Usuario, UsuarioSchema } from '../usuarios/schemas/usuario.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Mesa.name,
        schema: MesaSchema,
      },
      {
        name: Orden.name,
        schema: OrdenSchema,
      },
      {
        name: Usuario.name,
        schema: UsuarioSchema,
      },
    ]),
  ],
  controllers: [MesasController],
  providers: [MesasService],
  exports: [MesasService],
})
export class MesasModule {}
