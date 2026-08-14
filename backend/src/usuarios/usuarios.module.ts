import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Usuario, UsuarioSchema } from './schemas/usuario.schema.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';
import { Mesa, MesaSchema } from '../mesas/schemas/mesa.schema.js';
import { Orden, OrdenSchema } from '../ordenes/schemas/orden.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Mesa.name, schema: MesaSchema },
      { name: Orden.name, schema: OrdenSchema },
    ]),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
