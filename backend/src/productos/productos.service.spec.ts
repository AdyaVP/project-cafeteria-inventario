import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { ProductosService } from './productos.service';
import { Producto } from './schemas/producto.schema';
import { ProductoTipo } from './schemas/producto-tipo.enum';
import { TipoIsv } from './schemas/tipo-isv.enum';

const PRODUCTO_ID = new Types.ObjectId().toHexString();

function mockProductoDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(PRODUCTO_ID),
    nombre: 'Hamburguesa',
    descripcion: undefined,
    precio: 120,
    disponible: true,
    imagenUrl: undefined,
    tipo: ProductoTipo.COMIDA,
    tipoIsv: TipoIsv.GRAVADO_15,
    ...overrides,
  };
}

describe('ProductosService', () => {
  let service: ProductosService;
  let productoModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    productoModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductosService,
        { provide: getModelToken(Producto.name), useValue: productoModel },
      ],
    }).compile();

    service = module.get(ProductosService);
  });

  describe('buscarVarios', () => {
    it('retorna mapa de productos por ids', async () => {
      productoModel.find.mockResolvedValue([mockProductoDoc()]);

      const mapa = await service.buscarVarios([PRODUCTO_ID]);

      expect(mapa.size).toBe(1);
      expect(mapa.get(PRODUCTO_ID)).toMatchObject({
        nombre: 'Hamburguesa',
        tipoIsv: TipoIsv.GRAVADO_15,
      });
    });

    it('lanza error si hay ids invalidos', async () => {
      await expect(service.buscarVarios(['id-invalido'])).rejects.toThrow(
        BadRequestException,
      );
      expect(productoModel.find).not.toHaveBeenCalled();
    });

    it('lanza error si faltan productos', async () => {
      productoModel.find.mockResolvedValue([]);

      await expect(service.buscarVarios([PRODUCTO_ID])).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
