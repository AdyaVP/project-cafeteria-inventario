jest.mock('../mesas/mesas.service', () => ({
  MesasService: jest.fn().mockImplementation(() => ({
    buscarPorId: jest.fn(),
    cambiarEstadoMesa: jest.fn(),
  })),
}));

jest.mock('../productos/productos.service', () => ({
  ProductosService: jest.fn().mockImplementation(() => ({
    buscarPorId: jest.fn(),
  })),
}));

jest.mock('../productos/recetas.service', () => ({
  RecetasService: jest.fn().mockImplementation(() => ({
    buscarPorProducto: jest.fn(),
  })),
}));

jest.mock('../inventario/inventario.service', () => ({
  InventarioService: jest.fn().mockImplementation(() => ({
    buscarPorId: jest.fn(),
    descontarPorReceta: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { MesasService } from '../mesas/mesas.service';
import { MesaEstado } from '../mesas/schemas/mesa.schema';
import { ProductosService } from '../productos/productos.service';
import { RecetasService } from '../productos/recetas.service';
import { InventarioService } from '../inventario/inventario.service';
import { ProductoTipo } from '../productos/schemas/producto-tipo.enum';
import { Orden } from './schemas/orden.schema';
import { OrdenEstado } from './schemas/orden-estado.enum';
import { ItemEstado } from './schemas/item-estado.enum';
import { TipoOrden } from './schemas/tipo-orden.enum';
import { OrdenesService } from './ordenes.service';

const MESA_ID = new Types.ObjectId().toHexString();
const MESERO_ID = new Types.ObjectId().toHexString();
const PRODUCTO_COMIDA_ID = new Types.ObjectId().toHexString();
const PRODUCTO_BEBIDA_ID = new Types.ObjectId().toHexString();
const INVENTARIO_ITEM_ID = new Types.ObjectId().toHexString();
const ITEM_ID = new Types.ObjectId().toHexString();

const dtoBase = {
  mesaId: MESA_ID,
  items: [
    { productoId: PRODUCTO_COMIDA_ID, cantidad: 2 },
    { productoId: PRODUCTO_BEBIDA_ID, cantidad: 1 },
  ],
};

function mockDoc(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  const base = {
    _id,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(),
    mesa: { _id: new Types.ObjectId(), numero: 5 },
    mesero: { _id: new Types.ObjectId(), nombre: 'Test' },
    items: [] as Array<Record<string, unknown>>,
    estadoGeneral: OrdenEstado.PENDIENTE,
    tipo: TipoOrden.COCINA as string,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  const populated = {
    _id,
    mesa: { _id: base.mesa._id, numero: 5 },
    mesero: { _id: base.mesero._id, nombre: 'Test' },
    items: base.items.map((item: Record<string, unknown>) => ({
      _id: item._id ?? new Types.ObjectId(),
      producto: {
        _id: item.producto ?? new Types.ObjectId(),
        nombre: 'Test',
        precio: 100,
      },
      nombreProductoSnapshot: item.nombreProductoSnapshot,
      precioUnitarioSnapshot: item.precioUnitarioSnapshot,
      cantidad: item.cantidad ?? 1,
      notas: item.notas,
      estadoItem: item.estadoItem ?? ItemEstado.PENDIENTE,
    })),
    estadoGeneral: base.estadoGeneral,
    tipo: base.tipo,
    notaChef: undefined as string | undefined,
    tiempoEstimadoMin: undefined as number | undefined,
    temperatura: undefined as string | undefined,
    tamano: undefined as string | undefined,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  };

  base.toObject = jest.fn().mockReturnValue(populated);

  return base;
}

function mockQuery(resultado: unknown) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resultado),
  };
}

describe('OrdenesService', () => {
  let service: OrdenesService;
  let mockMesasService: Record<string, jest.Mock>;
  let mockProductosService: Record<string, jest.Mock>;
  let mockRecetasService: Record<string, jest.Mock>;
  let mockInventarioService: Record<string, jest.Mock>;
  let mockEventEmitter: Record<string, jest.Mock>;
  let model: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockMesasService = {
      buscarPorId: jest.fn(),
      confirmarMeseroActivo: jest.fn().mockResolvedValue(true),
      confirmarMesaAceptaOrden: jest.fn(),
      cambiarEstadoMesa: jest.fn(),
    };
    mockProductosService = { buscarPorId: jest.fn() };
    mockRecetasService = { buscarPorProducto: jest.fn() };
    mockInventarioService = {
      buscarPorId: jest.fn(),
      descontarPorReceta: jest.fn(),
    };
    mockEventEmitter = { emit: jest.fn() };

    model = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      discriminators: {} as jest.Mock,
      db: {
        startSession: jest.fn().mockResolvedValue({
          withTransaction: jest.fn(async (callback: () => Promise<void>) => {
            await callback();
          }),
          endSession: jest.fn(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdenesService,
        { provide: getModelToken(Orden.name), useValue: model },
        { provide: MesasService, useValue: mockMesasService },
        { provide: ProductosService, useValue: mockProductosService },
        { provide: RecetasService, useValue: mockRecetasService },
        { provide: InventarioService, useValue: mockInventarioService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get(OrdenesService);
  });

  describe('crearOrden', () => {
    it('crea ordenes separadas COCINA y CAFETERIA', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        capacidad: 4,
        estado: MesaEstado.OCUPADA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
        abiertaEn: new Date(),
        cerradaEn: null,
      });

      mockProductosService.buscarPorId
        .mockResolvedValueOnce({
          id: PRODUCTO_COMIDA_ID,
          nombre: 'Hamburguesa',
          precio: 120,
          disponible: true,
          tipo: ProductoTipo.COMIDA,
          tiempoPreparacionMin: 15,
          calorias: 500,
          alergenos: ['gluten'],
        })
        .mockResolvedValueOnce({
          id: PRODUCTO_BEBIDA_ID,
          nombre: 'Coca Cola',
          precio: 25,
          disponible: true,
          tipo: ProductoTipo.BEBIDA,
          temperatura: 'FRIA',
          tamanosDisponibles: [],
        });

      mockRecetasService.buscarPorProducto.mockResolvedValue({
        id: new Types.ObjectId().toHexString(),
        productoId: PRODUCTO_COMIDA_ID,
        ingredientes: [{ inventarioItemId: INVENTARIO_ITEM_ID, cantidad: 0.2 }],
      });

      mockInventarioService.buscarPorId.mockResolvedValue({
        id: INVENTARIO_ITEM_ID,
        nombre: 'Harina',
        unidad: 'KG',
        stockActual: 10,
        stockMinimo: 1,
        costoUnitario: 20,
        activo: true,
      });

      mockInventarioService.descontarPorReceta.mockResolvedValue(undefined);

      const docCocina = mockDoc({
        _id: new Types.ObjectId(),
        tipo: TipoOrden.COCINA,
      });
      const docCafeteria = mockDoc({
        _id: new Types.ObjectId(),
        tipo: TipoOrden.CAFETERIA,
      });

      model.create
        .mockResolvedValueOnce([docCocina])
        .mockResolvedValueOnce([docCafeteria]);

      model.find = jest
        .fn()
        .mockReturnValue(mockQuery([docCocina, docCafeteria]));

      const resultado = await service.crearOrden(dtoBase, MESERO_ID);

      expect(resultado).toHaveLength(2);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'orden.creada',
        expect.objectContaining({ mesaId: MESA_ID }),
      );
      expect(mockInventarioService.descontarPorReceta).toHaveBeenCalled();
      expect(mockMesasService.confirmarMesaAceptaOrden).toHaveBeenCalledWith(
        MESA_ID,
        MESERO_ID,
        expect.any(Date),
        expect.any(Object),
      );
      expect(model.create).toHaveBeenNthCalledWith(
        1,
        [
          expect.objectContaining({
            items: [
              expect.objectContaining({
                nombreProductoSnapshot: 'Hamburguesa',
                precioUnitarioSnapshot: 120,
              }),
            ],
          }),
        ],
        expect.any(Object),
      );
      expect(model.create).toHaveBeenNthCalledWith(
        2,
        [
          expect.objectContaining({
            items: [
              expect.objectContaining({
                nombreProductoSnapshot: 'Coca Cola',
                precioUnitarioSnapshot: 25,
              }),
            ],
          }),
        ],
        expect.any(Object),
      );
    });

    it('lanza error si mesa no esta ocupada', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.LIBRE,
      });

      await expect(service.crearOrden(dtoBase, MESERO_ID)).rejects.toThrow(
        BadRequestException,
      );

      expect(model.create).not.toHaveBeenCalled();
    });

    it('rechaza ordenes de un mesero distinto al asignado', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.OCUPADA,
        meseroActual: {
          id: new Types.ObjectId().toHexString(),
          nombre: 'Otro',
        },
      });

      await expect(service.crearOrden(dtoBase, MESERO_ID)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockProductosService.buscarPorId).not.toHaveBeenCalled();
      expect(model.create).not.toHaveBeenCalled();
    });

    it('lanza error si producto no disponible', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.OCUPADA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockProductosService.buscarPorId.mockResolvedValueOnce({
        id: PRODUCTO_COMIDA_ID,
        nombre: 'Hamburguesa',
        precio: 120,
        disponible: false,
        tipo: ProductoTipo.COMIDA,
        tiempoPreparacionMin: 15,
        calorias: 500,
        alergenos: ['gluten'],
      });

      await expect(service.crearOrden(dtoBase, MESERO_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(model.create).not.toHaveBeenCalled();
    });

    it('lanza error detallado si falta stock (valida antes de descontar)', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.OCUPADA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockProductosService.buscarPorId
        .mockResolvedValueOnce({
          id: PRODUCTO_COMIDA_ID,
          nombre: 'Hamburguesa',
          precio: 120,
          disponible: true,
          tipo: ProductoTipo.COMIDA,
          tiempoPreparacionMin: 15,
          calorias: 500,
          alergenos: ['gluten'],
        })
        .mockResolvedValueOnce({
          id: PRODUCTO_BEBIDA_ID,
          nombre: 'Coca Cola',
          precio: 25,
          disponible: true,
          tipo: ProductoTipo.BEBIDA,
          temperatura: 'FRIA',
          tamanosDisponibles: [],
        });

      mockRecetasService.buscarPorProducto.mockResolvedValue({
        id: new Types.ObjectId().toHexString(),
        productoId: PRODUCTO_COMIDA_ID,
        ingredientes: [{ inventarioItemId: INVENTARIO_ITEM_ID, cantidad: 0.2 }],
      });
      mockInventarioService.buscarPorId.mockResolvedValue({
        id: INVENTARIO_ITEM_ID,
        nombre: 'Harina',
        unidad: 'KG',
        stockActual: 0.1,
        stockMinimo: 1,
        costoUnitario: 20,
        activo: true,
      });

      await expect(service.crearOrden(dtoBase, MESERO_ID)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockInventarioService.descontarPorReceta).not.toHaveBeenCalled();
      expect(model.create).not.toHaveBeenCalled();
    });
  });

  describe('listarPorMesa', () => {
    it('retorna ordenes activas de la mesa', async () => {
      model.find = jest.fn().mockReturnValue(mockQuery([mockDoc()]));

      const resultado = await service.listarPorMesa(MESA_ID);

      expect(resultado).toHaveLength(1);
      expect(model.find).toHaveBeenCalledWith({
        mesa: expect.any(Types.ObjectId),
        estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
      });
    });

    it('aplica filtro createdAt >= desde cuando se envia desde', async () => {
      const desde = new Date('2026-07-30T08:00:00-06:00');
      model.find = jest.fn().mockReturnValue(mockQuery([mockDoc()]));

      await service.listarPorMesa(MESA_ID, 50, desde);

      expect(model.find).toHaveBeenCalledWith({
        mesa: expect.any(Types.ObjectId),
        estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
        createdAt: { $gte: desde },
      });
    });
  });

  describe('listarEntregadasPorMesa', () => {
    it('retorna solo ordenes entregadas con limite por defecto', async () => {
      const query = mockQuery([mockDoc()]);
      model.find = jest.fn().mockReturnValue(query);

      await service.listarEntregadasPorMesa(MESA_ID);

      expect(model.find).toHaveBeenCalledWith({
        mesa: expect.any(Types.ObjectId),
        estadoGeneral: OrdenEstado.ENTREGADA,
      });
      expect(query.limit).toHaveBeenCalledWith(100);
    });

    it('aplica createdAt >= desde y limite personalizado', async () => {
      const desde = new Date('2026-07-30T08:00:00-06:00');
      const query = mockQuery([mockDoc()]);
      model.find = jest.fn().mockReturnValue(query);

      await service.listarEntregadasPorMesa(MESA_ID, 25, desde);

      expect(model.find).toHaveBeenCalledWith({
        mesa: expect.any(Types.ObjectId),
        estadoGeneral: OrdenEstado.ENTREGADA,
        createdAt: { $gte: desde },
      });
      expect(query.limit).toHaveBeenCalledWith(25);
    });

    it('conserva nombre y precio tomados al crear la orden', async () => {
      const doc = mockDoc({
        items: [
          {
            _id: new Types.ObjectId(),
            producto: new Types.ObjectId(PRODUCTO_COMIDA_ID),
            nombreProductoSnapshot: 'Hamburguesa original',
            precioUnitarioSnapshot: 120,
            cantidad: 2,
            estadoItem: ItemEstado.ENTREGADO,
          },
        ],
        estadoGeneral: OrdenEstado.ENTREGADA,
      });
      const poblado = doc.toObject() as {
        items: Array<{ producto: { nombre: string; precio: number } }>;
      };
      poblado.items[0].producto.nombre = 'Nombre editado';
      poblado.items[0].producto.precio = 999;
      doc.toObject.mockReturnValue(poblado);
      model.find = jest.fn().mockReturnValue(mockQuery([doc]));

      const [orden] = await service.listarEntregadasPorMesa(MESA_ID);

      expect(orden.items[0].nombreProducto).toBe('Hamburguesa original');
      expect(orden.items[0].precioUnitario).toBe(120);
    });

    it('mantiene compatibilidad con órdenes antiguas sin snapshot', async () => {
      const doc = mockDoc({
        items: [
          {
            _id: new Types.ObjectId(),
            producto: new Types.ObjectId(PRODUCTO_COMIDA_ID),
            cantidad: 1,
            estadoItem: ItemEstado.ENTREGADO,
          },
        ],
        estadoGeneral: OrdenEstado.ENTREGADA,
      });
      model.find = jest.fn().mockReturnValue(mockQuery([doc]));

      const [orden] = await service.listarEntregadasPorMesa(MESA_ID);

      expect(orden.items[0].nombreProducto).toBe('Test');
      expect(orden.items[0].precioUnitario).toBe(100);
    });
  });

  describe('marcarOrdenEntregada', () => {
    it('marca como entregada si todos los items estan LISTO', async () => {
      const doc = mockDoc({
        mesero: new Types.ObjectId(MESERO_ID),
        items: [
          {
            _id: new Types.ObjectId(ITEM_ID),
            estadoItem: ItemEstado.LISTO,
            producto: new Types.ObjectId(),
          },
          {
            _id: new Types.ObjectId(),
            estadoItem: ItemEstado.LISTO,
            producto: new Types.ObjectId(),
          },
        ],
        estadoGeneral: OrdenEstado.LISTA,
      });
      model.findById = jest.fn().mockReturnValue(mockQuery(doc));

      await service.marcarOrdenEntregada(doc._id.toHexString(), MESERO_ID);

      expect(doc.estadoGeneral).toBe(OrdenEstado.ENTREGADA);
      expect(doc.save).toHaveBeenCalled();
    });

    it('lanza error si hay items pendientes', async () => {
      const doc = mockDoc({
        mesero: new Types.ObjectId(MESERO_ID),
        items: [
          {
            _id: new Types.ObjectId(),
            estadoItem: ItemEstado.PENDIENTE,
            producto: new Types.ObjectId(),
          },
          {
            _id: new Types.ObjectId(),
            estadoItem: ItemEstado.LISTO,
            producto: new Types.ObjectId(),
          },
        ],
      });
      model.findById = jest.fn().mockReturnValue(mockQuery(doc));

      await expect(
        service.marcarOrdenEntregada(doc._id.toHexString(), MESERO_ID),
      ).rejects.toThrow(BadRequestException);
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('rechaza la entrega por un mesero distinto al de la orden', async () => {
      const doc = mockDoc({
        mesero: new Types.ObjectId(MESERO_ID),
        items: [
          {
            _id: new Types.ObjectId(),
            estadoItem: ItemEstado.LISTO,
            producto: new Types.ObjectId(),
          },
        ],
        estadoGeneral: OrdenEstado.LISTA,
      });
      model.findById = jest.fn().mockReturnValue(mockQuery(doc));

      await expect(
        service.marcarOrdenEntregada(
          doc._id.toHexString(),
          new Types.ObjectId().toHexString(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('obtenerColaCocina', () => {
    it('retorna ordenes COCINA y CAFETERIA pendientes o en preparacion', async () => {
      model.find = jest.fn().mockReturnValue(mockQuery([mockDoc(), mockDoc()]));

      const resultado = await service.obtenerColaCocina();

      expect(resultado).toHaveLength(2);
      expect(model.find).toHaveBeenCalledWith({
        estadoGeneral: {
          $in: [OrdenEstado.PENDIENTE, OrdenEstado.EN_PREPARACION],
        },
      });
    });
  });

  describe('actualizarEstadoItem', () => {
    it('actualiza estado de un item especifico', async () => {
      const doc = mockDoc({
        items: [
          {
            _id: new Types.ObjectId(ITEM_ID),
            estadoItem: ItemEstado.PENDIENTE,
            producto: new Types.ObjectId(),
          },
        ],
      });
      model.findById = jest.fn().mockReturnValue(mockQuery(doc));

      await service.actualizarEstadoItem(
        doc._id.toHexString(),
        ITEM_ID,
        ItemEstado.EN_PREPARACION,
      );

      expect(doc.items[0].estadoItem).toBe(ItemEstado.EN_PREPARACION);
      expect(doc.save).toHaveBeenCalled();
    });
  });
});
