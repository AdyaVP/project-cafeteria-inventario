import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { InventarioService } from '../inventario/inventario.service';
import { Producto } from './schemas/producto.schema';
import { ProductoTipo } from './schemas/producto-tipo.enum';
import { Receta } from './schemas/receta.schema';
import { RecetasService } from './recetas.service';

describe('RecetasService', () => {
  const productoId = new Types.ObjectId().toHexString();
  const inventarioItemId = new Types.ObjectId().toHexString();
  const otroInventarioItemId = new Types.ObjectId().toHexString();

  let service: RecetasService;
  let recetaModel: Record<string, jest.Mock>;
  let productoModel: Record<string, jest.Mock>;
  let inventarioService: Record<string, jest.Mock>;

  beforeEach(async () => {
    recetaModel = {
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    productoModel = { findById: jest.fn() };
    inventarioService = {
      buscarPorId: jest.fn().mockImplementation((id: string) =>
        Promise.resolve({
          id,
          nombre: `Insumo ${id}`,
          unidad: 'UNIDAD',
          stockActual: 10,
          stockMinimo: 1,
          costoUnitario: 2,
          activo: true,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecetasService,
        { provide: getModelToken(Receta.name), useValue: recetaModel },
        { provide: getModelToken(Producto.name), useValue: productoModel },
        { provide: InventarioService, useValue: inventarioService },
      ],
    }).compile();

    service = module.get(RecetasService);
  });

  it('crea la receta sin cambiar disponibilidad implícitamente', async () => {
    const producto = {
      _id: new Types.ObjectId(productoId),
      tipo: ProductoTipo.COMIDA,
      disponible: false,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const receta = {
      _id: new Types.ObjectId(),
      productoId: new Types.ObjectId(productoId),
      ingredientes: [
        {
          inventarioItemId: new Types.ObjectId(inventarioItemId),
          cantidad: 1,
        },
      ],
    };
    productoModel.findById.mockResolvedValue(producto);
    recetaModel.create.mockResolvedValue(receta);

    await service.crear({
      productoId,
      ingredientes: [{ inventarioItemId, cantidad: 1 }],
    });

    expect(producto.disponible).toBe(false);
    expect(producto.save).not.toHaveBeenCalled();
    expect(inventarioService.buscarPorId).toHaveBeenCalledWith(
      inventarioItemId,
    );
  });

  it('actualiza los ingredientes atómicamente sin cambiar disponibilidad', async () => {
    const producto = {
      _id: new Types.ObjectId(productoId),
      tipo: ProductoTipo.COMIDA,
      disponible: true,
      save: jest.fn(),
    };
    const recetaActualizada = {
      _id: new Types.ObjectId(),
      productoId: new Types.ObjectId(productoId),
      ingredientes: [
        {
          inventarioItemId: new Types.ObjectId(inventarioItemId),
          cantidad: 1.5,
        },
        {
          inventarioItemId: new Types.ObjectId(otroInventarioItemId),
          cantidad: 0.25,
        },
      ],
    };
    productoModel.findById.mockResolvedValue(producto);
    recetaModel.findOneAndUpdate.mockResolvedValue(recetaActualizada);

    const result = await service.actualizar(productoId, {
      ingredientes: [
        { inventarioItemId, cantidad: 1.5 },
        { inventarioItemId: otroInventarioItemId, cantidad: 0.25 },
      ],
    });

    expect(recetaModel.findOneAndUpdate).toHaveBeenCalledWith(
      { productoId },
      {
        $set: {
          ingredientes: [
            {
              inventarioItemId: new Types.ObjectId(inventarioItemId),
              cantidad: 1.5,
            },
            {
              inventarioItemId: new Types.ObjectId(otroInventarioItemId),
              cantidad: 0.25,
            },
          ],
        },
      },
      { new: true, runValidators: true },
    );
    expect(result.ingredientes).toEqual([
      { inventarioItemId, cantidad: 1.5 },
      { inventarioItemId: otroInventarioItemId, cantidad: 0.25 },
    ]);
    expect(producto.disponible).toBe(true);
    expect(producto.save).not.toHaveBeenCalled();
  });

  it('rechaza IDs de producto inválidos antes de consultar', async () => {
    await expect(
      service.actualizar('producto-invalido', {
        ingredientes: [{ inventarioItemId, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(productoModel.findById).not.toHaveBeenCalled();
    expect(recetaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza insumos duplicados aunque se invoque el servicio directamente', async () => {
    productoModel.findById.mockResolvedValue({
      tipo: ProductoTipo.COMIDA,
    });

    await expect(
      service.actualizar(productoId, {
        ingredientes: [
          { inventarioItemId, cantidad: 1 },
          { inventarioItemId, cantidad: 2 },
        ],
      }),
    ).rejects.toThrow('No se puede repetir un insumo en la receta');

    expect(recetaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza la cantidad inválida %s',
    async (cantidad) => {
      productoModel.findById.mockResolvedValue({
        tipo: ProductoTipo.COMIDA,
      });

      await expect(
        service.actualizar(productoId, {
          ingredientes: [{ inventarioItemId, cantidad }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(recetaModel.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('rechaza un insumo inexistente antes de actualizar', async () => {
    productoModel.findById.mockResolvedValue({
      tipo: ProductoTipo.COMIDA,
    });
    inventarioService.buscarPorId.mockRejectedValue(
      new NotFoundException('Insumo no encontrado'),
    );

    await expect(
      service.actualizar(productoId, {
        ingredientes: [{ inventarioItemId, cantidad: 1 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(recetaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza un insumo inactivo antes de actualizar', async () => {
    productoModel.findById.mockResolvedValue({
      tipo: ProductoTipo.COMIDA,
    });
    inventarioService.buscarPorId.mockResolvedValue({
      id: inventarioItemId,
      nombre: 'Leche retirada',
      activo: false,
    });

    await expect(
      service.actualizar(productoId, {
        ingredientes: [{ inventarioItemId, cantidad: 1 }],
      }),
    ).rejects.toThrow('El insumo Leche retirada no está activo');

    expect(recetaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza recetas para productos que no son comida', async () => {
    productoModel.findById.mockResolvedValue({
      tipo: ProductoTipo.BEBIDA,
    });

    await expect(
      service.actualizar(productoId, {
        ingredientes: [{ inventarioItemId, cantidad: 1 }],
      }),
    ).rejects.toThrow('Solo los productos de tipo COMIDA pueden tener receta');

    expect(recetaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('responde 404 si el producto no tiene una receta', async () => {
    productoModel.findById.mockResolvedValue({
      tipo: ProductoTipo.COMIDA,
    });
    recetaModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.actualizar(productoId, {
        ingredientes: [{ inventarioItemId, cantidad: 1 }],
      }),
    ).rejects.toThrow('Receta no encontrada');
  });
});
