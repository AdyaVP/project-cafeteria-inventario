import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';

import {
  InventarioItem,
  InventarioItemSchema,
} from './schemas/inventario-item.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: InventarioItem.name,
        schema: InventarioItemSchema,
      },
    ]),
  ],
  controllers: [InventarioController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}