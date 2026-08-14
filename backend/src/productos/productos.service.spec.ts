import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Producto } from './schemas/producto.schema';
import { ProductoComida } from './schemas/producto-comida.schema';
import { ProductoBebida } from './schemas/producto-bebida.schema';
import { ProductoTipo } from './schemas/producto-tipo.enum';
import { Receta } from './schemas/receta.schema';
import { ProductosService } from './productos.service';

describe('ProductosService disponibilidad de comida', () => {
  const productoId = new Types.ObjectId().toHexString();

  let service: ProductosService;
  let productoModel: Record<string, jest.Mock> & {
    discriminators: Record<string, { create: jest.Mock }>;
  };
  let recetaModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    productoModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      discriminators: {
        [ProductoComida.name]: { create: jest.fn() },
        [ProductoBebida.name]: { create: jest.fn() },
      },
    };
    recetaModel = { exists: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductosService,
        { provide: getModelToken(Producto.name), useValue: productoModel },
        { provide: getModelToken(Receta.name), useValue: recetaModel },
      ],
    }).compile();

    service = module.get(ProductosService);
  });

  it('crea COMIDA como no disponible aunque el cliente envíe true', async () => {
    const create = productoModel.discriminators[ProductoComida.name].create;
    create.mockImplementation((datos: Record<string, unknown>) => ({
      _id: new Types.ObjectId(productoId),
      ...datos,
    }));

    const resultado = await service.crear({
      nombre: 'Plato nuevo',
      precio: 150,
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      tiempoPreparacionMin: 10,
      alergenos: [],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ disponible: false }),
    );
    expect(resultado.disponible).toBe(false);
  });

  it('rechaza activar una COMIDA sin receta', async () => {
    const producto = {
      _id: new Types.ObjectId(productoId),
      nombre: 'Plato',
      precio: 100,
      tipo: ProductoTipo.COMIDA,
      disponible: false,
      tiempoPreparacionMin: 5,
      alergenos: [],
      save: jest.fn(),
    };
    productoModel.findById.mockResolvedValue(producto);
    recetaModel.exists.mockResolvedValue(null);

    await expect(service.toggleDisponibilidad(productoId)).rejects.toThrow(
      BadRequestException,
    );

    expect(producto.save).not.toHaveBeenCalled();
    expect(producto.disponible).toBe(false);
  });

  it('activa una COMIDA cuando ya existe receta', async () => {
    const producto = {
      _id: new Types.ObjectId(productoId),
      nombre: 'Plato',
      precio: 100,
      tipo: ProductoTipo.COMIDA,
      disponible: false,
      tiempoPreparacionMin: 5,
      alergenos: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    productoModel.findById.mockResolvedValue(producto);
    recetaModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

    const resultado = await service.toggleDisponibilidad(productoId);

    expect(resultado.disponible).toBe(true);
    expect(producto.save).toHaveBeenCalled();
  });
});
