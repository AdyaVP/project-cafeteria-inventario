import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { InventarioService } from './inventario.service';
import { InventarioItem } from './schemas/inventario-item.schema';
import { Unidad } from './schemas/unidad.enum';

describe('InventarioService ajustes atómicos', () => {
  const itemId = new Types.ObjectId().toHexString();
  const item = {
    _id: new Types.ObjectId(itemId),
    nombre: 'Harina',
    unidad: Unidad.KG,
    stockActual: 8,
    stockMinimo: 2,
    costoUnitario: 20,
    activo: true,
  };

  let service: InventarioService;
  let model: Record<string, jest.Mock>;

  beforeEach(async () => {
    model = {
      findOneAndUpdate: jest.fn(),
      exists: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventarioService,
        { provide: getModelToken(InventarioItem.name), useValue: model },
      ],
    }).compile();

    service = module.get(InventarioService);
  });

  it('agrega stock con $inc atómico', async () => {
    model.findOneAndUpdate.mockResolvedValue({ ...item, stockActual: 13 });

    const resultado = await service.ajustarStock(itemId, 5, 'AGREGAR');

    expect(resultado.stockActual).toBe(13);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new Types.ObjectId(itemId) },
      { $inc: { stockActual: 5 } },
      { new: true },
    );
  });

  it('descuenta con guardia atómica de stock suficiente', async () => {
    model.findOneAndUpdate.mockResolvedValue({ ...item, stockActual: 5 });

    await service.ajustarStock(itemId, 3, 'DESCONTAR');

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(itemId),
        stockActual: { $gte: 3 },
      },
      { $inc: { stockActual: -3 } },
      { new: true },
    );
  });

  it('rechaza descuento cuando la actualización no cumple la guardia', async () => {
    model.findOneAndUpdate.mockResolvedValue(null);
    model.exists.mockResolvedValue({ _id: new Types.ObjectId(itemId) });

    await expect(service.ajustarStock(itemId, 20, 'DESCONTAR')).rejects.toThrow(
      BadRequestException,
    );
  });
});
