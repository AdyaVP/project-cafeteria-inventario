jest.mock('../mesas/mesas.service', () => ({
  MesasService: jest.fn().mockImplementation(() => ({
    buscarPorId: jest.fn(),
    cerrarMesa: jest.fn(),
    cerrarMesaAtomicamente: jest.fn(),
    abrirMesa: jest.fn(),
    solicitarCuenta: jest.fn(),
  })),
}));

jest.mock('../ordenes/ordenes.service', () => ({
  OrdenesService: jest.fn().mockImplementation(() => ({
    listarEntregadasPorMesa: jest.fn(),
    listarPorMesa: jest.fn(),
  })),
}));

jest.mock('../productos/productos.service', () => ({
  ProductosService: jest.fn().mockImplementation(() => ({
    buscarPorId: jest.fn(),
    buscarVarios: jest.fn(),
  })),
}));

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { MesasService } from '../mesas/mesas.service';
import { MesaEstado } from '../mesas/schemas/mesa.schema';
import { OrdenesService } from '../ordenes/ordenes.service';
import { ProductosService } from '../productos/productos.service';
import { TipoIsv } from '../productos/schemas/tipo-isv.enum';

import { CajaService } from './caja.service';
import { CorteCaja, CorteEstado } from './schemas/corte-caja.schema';
import { Counter } from './schemas/counter.schema';
import type { CobrarMesaDto } from './dto/cobrar-mesa.dto';

import {
  Factura,
  FacturaEstado,
  MetodoPago,
  TipoDocumento,
} from './schemas/factura.schema';

const MESA_ID = new Types.ObjectId().toHexString();
const MESERO_ID = new Types.ObjectId().toHexString();
const CAJERO_ID = new Types.ObjectId().toHexString();
const PRODUCTO_ID = new Types.ObjectId().toHexString();
const PRODUCTO_2_ID = new Types.ObjectId().toHexString();
const FACTURA_ID = new Types.ObjectId().toHexString();

function mockFacturaDoc(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId(FACTURA_ID);
  const now = new Date();

  const defaults = {
    _id,
    correlativo: 1,
    numeroFactura: '001-001-000001',
    comercioNombre: 'Cafeteria Test',
    comercioRtn: '08019001000000',
    cai: '0000000000000000',
    fechaLimiteEmision: new Date('2026-12-31'),
    tipoDocumento: TipoDocumento.FACTURA,
    mesa: { _id: new Types.ObjectId(MESA_ID), numero: 5 },
    mesero: { _id: new Types.ObjectId(MESERO_ID), nombre: 'Mesero Test' },
    cajero: { _id: new Types.ObjectId(CAJERO_ID), nombre: 'Cajero Test' },
    clienteNombre: undefined as string | undefined,
    clienteRtn: undefined as string | undefined,
    items: [
      {
        producto: new Types.ObjectId(PRODUCTO_ID),
        nombreProducto: 'Hamburguesa',
        cantidad: 2,
        precioUnitario: 100,
        subtotal: 200,
        tipoIsv: TipoIsv.GRAVADO_15,
        isv: 30,
      },
    ],
    subtotal: 200,
    totalExento: 0,
    totalGravado15: 200,
    totalGravado18: 0,
    isv15: 30,
    isv18: 0,
    propina: 20,
    montoRecibido: 250,
    cambio: 0,
    total: 250,
    metodoPago: MetodoPago.EFECTIVO,
    estado: FacturaEstado.PAGADA,
    motivoAnulacion: undefined as string | undefined,
    fechaAnulacion: undefined as Date | undefined,
    createdAt: now,
    updatedAt: now,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(),
  };

  const data = { ...defaults, ...overrides };
  data.toObject = jest.fn().mockReturnValue(data);
  return data;
}

describe('CajaService', () => {
  let service: CajaService;
  let mockMesasService: Record<string, jest.Mock>;
  let mockOrdenesService: Record<string, jest.Mock>;
  let mockProductosService: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockEventEmitter: Record<string, jest.Mock>;
  let facturaModel: Record<string, jest.Mock>;
  let counterModel: Record<string, jest.Mock>;
  let corteModel: Record<string, jest.Mock>;

  const defaultConfig: Record<string, unknown> = {
    COMERCIO_NOMBRE: 'Cafeteria Test',
    COMERCIO_RTN: '08019001000000',
    COMERCIO_CAI: '0000000000000000',
    COMERCIO_FECHA_LIMITE_EMISION: '2030-12-31',
    COMERCIO_ESTABLECIMIENTO: '001',
    COMERCIO_PUNTO_EMISION: '001',
    COMERCIO_RANGO_INICIAL: 1,
    COMERCIO_RANGO_FINAL: 100000,
    ISV_TASA_15: 0.15,
    ISV_TASA_18: 0.18,
  };

  function resetMocks() {
    mockMesasService = {
      buscarPorId: jest.fn(),
      cerrarMesa: jest.fn(),
      cerrarMesaAtomicamente: jest.fn(),
      abrirMesa: jest.fn(),
      solicitarCuenta: jest.fn(),
    };
    mockOrdenesService = {
      listarEntregadasPorMesa: jest.fn(),
      listarPorMesa: jest.fn().mockResolvedValue([]),
    };
    mockProductosService = { buscarPorId: jest.fn(), buscarVarios: jest.fn() };
    mockConfigService = { get: jest.fn((key: string) => defaultConfig[key]) };
    mockEventEmitter = { emit: jest.fn() };
    facturaModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
    };
    counterModel = { findOneAndUpdate: jest.fn() };
    corteModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
    };
  }

  async function createModule() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        { provide: getModelToken(Factura.name), useValue: facturaModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(CorteCaja.name), useValue: corteModel },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MesasService, useValue: mockMesasService },
        { provide: OrdenesService, useValue: mockOrdenesService },
        { provide: ProductosService, useValue: mockProductosService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get(CajaService);
  }

  describe('abrirCaja', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('abre una caja para el cajero', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      corteModel.create.mockResolvedValue({
        _id: new Types.ObjectId(CAJERO_ID),
        cajero: new Types.ObjectId(CAJERO_ID),
        fondoInicial: 500,
        estado: CorteEstado.ABIERTO,
        aperturaEn: new Date(),
        toObject: jest.fn(),
      });
      corteModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(CAJERO_ID),
          cajero: { _id: new Types.ObjectId(CAJERO_ID), nombre: 'Cajero Test' },
          fondoInicial: 500,
          totalEsperado: 0,
          totalReal: 0,
          diferencia: 0,
          totalEfectivo: 0,
          totalTarjeta: 0,
          totalTransferencia: 0,
          totalPropinas: 0,
          cantidadFacturas: 0,
          estado: CorteEstado.ABIERTO,
          aperturaEn: new Date(),
          cierreEn: undefined,
        }),
      });

      const resultado = await service.abrirCaja(CAJERO_ID, 500);
      expect(resultado.fondoInicial).toBe(500);
      expect(resultado.estado).toBe(CorteEstado.ABIERTO);
    });

    it('lanza error si ya hay una caja abierta', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          estado: CorteEstado.ABIERTO,
        }),
      });
      await expect(service.abrirCaja(CAJERO_ID, 500)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cerrarCaja', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('cierra la caja y calcula diferencias', async () => {
      const apertura = new Date();
      apertura.setHours(8, 0, 0, 0);

      const doc = {
        _id: new Types.ObjectId(),
        cajero: new Types.ObjectId(CAJERO_ID),
        fondoInicial: 500,
        totalEsperado: 0,
        totalReal: 0,
        diferencia: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalPropinas: 0,
        cantidadFacturas: 0,
        estado: CorteEstado.ABIERTO,
        aperturaEn: apertura,
        save: jest.fn().mockResolvedValue(undefined),
      };

      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      facturaModel.find = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });

      corteModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          cajero: { _id: new Types.ObjectId(CAJERO_ID), nombre: 'Cajero Test' },
          fondoInicial: 500,
          totalEsperado: 500,
          totalReal: 1000,
          diferencia: 500,
          totalEfectivo: 500,
          totalTarjeta: 300,
          totalTransferencia: 200,
          totalPropinas: 50,
          cantidadFacturas: 5,
          estado: CorteEstado.CERRADO,
          aperturaEn: new Date(),
          cierreEn: new Date(),
        }),
      });

      const resultado = await service.cerrarCaja(CAJERO_ID, 1000);
      expect(resultado.estado).toBe(CorteEstado.CERRADO);
      expect(resultado.totalReal).toBe(1000);
    });

    it('redondea la diferencia a 2 decimales', async () => {
      const apertura = new Date();
      apertura.setHours(8, 0, 0, 0);

      const doc = {
        _id: new Types.ObjectId(),
        cajero: new Types.ObjectId(CAJERO_ID),
        fondoInicial: 0.1,
        totalEsperado: 0,
        totalReal: 0,
        diferencia: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalPropinas: 0,
        cantidadFacturas: 0,
        estado: CorteEstado.ABIERTO,
        aperturaEn: apertura,
        save: jest.fn().mockResolvedValue(undefined),
      };

      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(doc),
      });

      facturaModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            total: 0.2,
            propina: 0,
            metodoPago: MetodoPago.EFECTIVO,
          },
          {
            total: 0.1,
            propina: 0,
            metodoPago: MetodoPago.EFECTIVO,
          },
        ]),
      });

      corteModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          cajero: { _id: new Types.ObjectId(CAJERO_ID), nombre: 'Cajero Test' },
          fondoInicial: 0.1,
          totalEsperado: 0.4,
          totalReal: 0.4,
          diferencia: 0,
          totalEfectivo: 0.3,
          totalTarjeta: 0,
          totalTransferencia: 0,
          totalPropinas: 0,
          cantidadFacturas: 2,
          estado: CorteEstado.CERRADO,
          aperturaEn: new Date(),
          cierreEn: new Date(),
        }),
      });

      const resultado = await service.cerrarCaja(CAJERO_ID, 0.4);
      expect(resultado.totalEsperado).toBe(0.4);
      expect(resultado.diferencia).toBe(0);
      expect(resultado.totalEfectivo).toBe(0.3);
    });

    it('lanza error si no hay caja abierta', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.cerrarCaja(CAJERO_ID, 1000)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('obtenerCuenta', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('retorna cuenta pendiente con ISV', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
            {
              productoId: PRODUCTO_2_ID,
              nombreProducto: 'Coca Cola',
              precioUnitario: 25,
              cantidad: 1,
            },
          ],
        },
      ]);
      const mapa = new Map<string, { tipoIsv: TipoIsv }>([
        [PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }],
        [PRODUCTO_2_ID, { tipoIsv: TipoIsv.GRAVADO_15 }],
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(mapa);

      const r = await service.obtenerCuenta(MESA_ID);
      expect(r.subtotal).toBe(225);
      expect(r.isv15).toBe(33.75);
    });

    it('lanza error si mesa no esta en CUENTA_PEDIDA', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.OCUPADA,
      });
      await expect(service.obtenerCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error si no hay ordenes entregadas', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([]);
      await expect(service.obtenerCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error si hay ordenes sin entregar en la mesa', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockOrdenesService.listarPorMesa.mockResolvedValue([
        { id: new Types.ObjectId().toHexString() },
      ]);

      await expect(service.obtenerCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('retorna total en la cuenta pendiente', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );

      const r = await service.obtenerCuenta(MESA_ID);
      expect(r.total).toBe(230);
    });

    it('filtra ordenes por la sesion actual de la mesa (abiertaEn)', async () => {
      const apertura = new Date('2026-07-30T08:00:00-06:00');

      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
        abiertaEn: apertura,
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );

      await service.obtenerCuenta(MESA_ID);

      expect(mockOrdenesService.listarEntregadasPorMesa).toHaveBeenCalledWith(
        MESA_ID,
        apertura,
      );
      expect(mockOrdenesService.listarPorMesa).toHaveBeenCalledWith(
        MESA_ID,
        100,
        apertura,
      );
    });

    it('factura con tipoIsv por defecto si el producto fue eliminado', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Producto Borrado',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockRejectedValue(
        new NotFoundException('Productos no encontrados'),
      );

      const r = await service.obtenerCuenta(MESA_ID);
      expect(r.items[0].tipoIsv).toBe(TipoIsv.GRAVADO_15);
      expect(r.items[0].nombreProducto).toBe('Producto Borrado');
      expect(r.total).toBe(230);
    });

    it('maneja items exentos y gravados 18%', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Agua',
              precioUnitario: 20,
              cantidad: 1,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.EXENTO }]]),
      );

      const r = await service.obtenerCuenta(MESA_ID);
      expect(r.totalExento).toBe(20);
      expect(r.isv15).toBe(0);
      expect(r.isv18).toBe(0);
    });

    it('calcula ISV 18% correctamente', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Cerveza',
              precioUnitario: 50,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_18 }]]),
      );

      const r = await service.obtenerCuenta(MESA_ID);
      expect(r.totalGravado18).toBe(100);
      expect(r.isv18).toBe(18);
    });
  });

  describe('cobrarMesa', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('valida caja abierta antes de cobrar', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.EFECTIVO,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea factura completa con correlativo, ISV, numeroFactura, tipoDoc', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });

      const doc = mockFacturaDoc({ montoRecibido: 300, cambio: 50 });
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      const r = await service.cobrarMesa(MESA_ID, CAJERO_ID, {
        metodoPago: MetodoPago.EFECTIVO,
        montoRecibido: 300,
        propina: 20,
      });

      expect(r.correlativo).toBe(1);
      expect(r.numeroFactura).toBe('001-001-000001');
      expect(r.tipoDocumento).toBe(TipoDocumento.FACTURA);
      expect(r.total).toBe(250);
      expect(r.montoRecibido).toBe(300);
      expect(r.cambio).toBe(50);
      expect(mockMesasService.cerrarMesaAtomicamente).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'factura.creada',
        expect.objectContaining({ correlativo: 1 }),
      );
    });

    it('lanza error si no se envia montoRecibido en efectivo', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );

      const errDto = { metodoPago: MetodoPago.EFECTIVO } as CobrarMesaDto;

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, errDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza error si montoRecibido < total', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.EFECTIVO,
          montoRecibido: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no crea factura si cerrarMesa falla', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockMesasService.cerrarMesaAtomicamente.mockRejectedValue(
        new BadRequestException('Transición inválida'),
      );
      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.TARJETA,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(facturaModel.create).not.toHaveBeenCalled();
    });

    it('lanza error si se agota el rango de correlativos', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'COMERCIO_RANGO_FINAL') return 100;
        return defaultConfig[key];
      });
      await createModule();

      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 101 }),
      });

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.TARJETA,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(facturaModel.create).not.toHaveBeenCalled();
      // La mesa NO debe cerrarse si falla el correlativo
      expect(mockMesasService.cerrarMesaAtomicamente).not.toHaveBeenCalled();
    });

    it('lanza error si CAI ha expirado', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'COMERCIO_FECHA_LIMITE_EMISION') return '2020-01-01';
        return defaultConfig[key];
      });
      await createModule();

      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([]);

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.EFECTIVO,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('acepta pagos con tarjeta sin montoRecibido', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });

      const doc = mockFacturaDoc({
        metodoPago: MetodoPago.TARJETA,
        montoRecibido: 0,
        cambio: 0,
      });
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      const r = await service.cobrarMesa(MESA_ID, CAJERO_ID, {
        metodoPago: MetodoPago.TARJETA,
      });
      expect(r.metodoPago).toBe(MetodoPago.TARJETA);
    });

    it('restaura mesa y contador si falla al guardar factura', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);
      mockMesasService.abrirMesa.mockResolvedValue(undefined);
      mockMesasService.solicitarCuenta.mockResolvedValue(undefined);

      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });
      counterModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      });

      facturaModel.create.mockRejectedValue(new Error('DB caída'));

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.TARJETA,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockMesasService.abrirMesa).toHaveBeenCalledWith(
        MESA_ID,
        MESERO_ID,
      );
      expect(mockMesasService.solicitarCuenta).toHaveBeenCalledWith(MESA_ID);

      // El correlativo NO se decrementa: reutilizarlo bajo concurrencia
      // podría duplicar facturas. Se acepta el hueco en la secuencia.
      expect(counterModel.updateOne).not.toHaveBeenCalled();
    });

    it('lanza error claro si mesa no tiene mesero asignado', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: null,
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );

      await expect(
        service.cobrarMesa(MESA_ID, CAJERO_ID, {
          metodoPago: MetodoPago.TARJETA,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'La mesa no tiene un mesero asignado. No se puede facturar.',
        ),
      );

      expect(mockMesasService.cerrarMesaAtomicamente).not.toHaveBeenCalled();
    });

    it('acepta pago en efectivo exacto con precios decimales', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Cafe',
              precioUnitario: 0.1,
              cantidad: 3,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.EXENTO }]]),
      );
      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      const doc = mockFacturaDoc({
        metodoPago: MetodoPago.EFECTIVO,
        subtotal: 0.3,
        total: 0.3,
        montoRecibido: 0.3,
        cambio: 0,
      });
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });

      const r = await service.cobrarMesa(MESA_ID, CAJERO_ID, {
        metodoPago: MetodoPago.EFECTIVO,
        montoRecibido: 0.3,
      });

      expect(r.total).toBe(0.3);
      expect(r.cambio).toBe(0);
    });

    it('reintenta generacion de correlativo ante E11000', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      const errConCodigo = Object.assign(new Error('E11000'), { code: 11000 });
      counterModel.findOneAndUpdate
        .mockReturnValueOnce({
          exec: jest.fn().mockRejectedValue(errConCodigo),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
        });

      const doc = mockFacturaDoc();
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });

      const r = await service.cobrarMesa(MESA_ID, CAJERO_ID, {
        metodoPago: MetodoPago.TARJETA,
      });

      expect(r.correlativo).toBe(1);
      expect(counterModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it('respeta RANGO_INICIAL aunque llegue como string del env', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      // Env SIEMPRE devuelve strings: "500" no 500
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'COMERCIO_RANGO_INICIAL') return '500';
        if (key === 'COMERCIO_RANGO_FINAL') return '1000';
        return defaultConfig[key];
      });
      await createModule();

      counterModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
      });
      counterModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      });

      const doc = mockFacturaDoc({
        correlativo: 500,
        numeroFactura: '001-001-000500',
      });
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });

      const r = await service.cobrarMesa(MESA_ID, CAJERO_ID, {
        metodoPago: MetodoPago.TARJETA,
      });

      expect(r.correlativo).toBe(500);
      expect(counterModel.updateOne).toHaveBeenCalledWith(
        { nombre: 'factura' },
        { $set: { secuencial: 500 } },
      );
    });

    it('repara contador corrupto (secuencial string) y continua', async () => {
      corteModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ estado: CorteEstado.ABIERTO }),
      });
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: { id: MESERO_ID, nombre: 'Mesero Test' },
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        {
          id: new Types.ObjectId().toHexString(),
          items: [
            {
              productoId: PRODUCTO_ID,
              nombreProducto: 'Hamburguesa',
              precioUnitario: 100,
              cantidad: 2,
            },
          ],
        },
      ]);
      mockProductosService.buscarVarios.mockResolvedValue(
        new Map([[PRODUCTO_ID, { tipoIsv: TipoIsv.GRAVADO_15 }]]),
      );
      mockMesasService.cerrarMesaAtomicamente.mockResolvedValue(undefined);

      const errTipo = Object.assign(
        new Error('Cannot apply $inc to a value of non-numeric type'),
        { code: 14 },
      );
      counterModel.findOneAndUpdate
        .mockReturnValueOnce({
          exec: jest.fn().mockRejectedValue(errTipo),
        })
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue({ secuencial: 1 }),
        });
      counterModel.updateOne = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(undefined),
      });

      const doc = mockFacturaDoc();
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });

      const r = await service.cobrarMesa(MESA_ID, CAJERO_ID, {
        metodoPago: MetodoPago.TARJETA,
      });

      expect(r.correlativo).toBe(1);
      expect(counterModel.updateOne).toHaveBeenCalledWith(
        { nombre: 'factura' },
        { $set: { secuencial: 1 } },
      );
      expect(counterModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('listarFacturas', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('retorna lista paginada', async () => {
      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockFacturaDoc()]),
      });
      facturaModel.countDocuments = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      const r = await service.listarFacturas(1, 20);
      expect(r.data).toHaveLength(1);
      expect(r.total).toBe(1);
      expect(r.totalPaginas).toBe(1);
    });

    it('filtra por mesaId cuando se provee', async () => {
      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockFacturaDoc()]),
      });
      facturaModel.countDocuments = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });

      await service.listarFacturas(1, 20, MESA_ID);

      expect(facturaModel.find).toHaveBeenCalledWith({
        mesa: new Types.ObjectId(MESA_ID),
      });
      expect(facturaModel.countDocuments).toHaveBeenCalledWith({
        mesa: new Types.ObjectId(MESA_ID),
      });
    });

    it('lanza error si mesaId es invalido', async () => {
      await expect(
        service.listarFacturas(1, 20, 'id-invalido'),
      ).rejects.toThrow(BadRequestException);
    });

    it('retorna lista vacia', async () => {
      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      facturaModel.countDocuments = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });

      const r = await service.listarFacturas(1, 20);
      expect(r.data).toHaveLength(0);
      expect(r.total).toBe(0);
      expect(r.totalPaginas).toBe(0);
    });

    it('lanza error con pagina invalida', async () => {
      await expect(service.listarFacturas(0, 20)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.listarFacturas(-1, 20)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.listarFacturas(1.5, 20)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error con limite invalido', async () => {
      await expect(service.listarFacturas(1, 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.listarFacturas(1, 101)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.listarFacturas(1, NaN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('buscarFactura', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('retorna factura por id', async () => {
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockFacturaDoc()),
      });
      const r = await service.buscarFactura(FACTURA_ID);
      expect(r.id).toBe(FACTURA_ID);
    });

    it('lanza error si no existe', async () => {
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.buscarFactura(FACTURA_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('anularFactura', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('anula factura y guarda motivo', async () => {
      const doc = mockFacturaDoc();
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });
      const r = await service.anularFactura(FACTURA_ID, {
        motivo: 'Error en el cobro, el cliente no consumió',
      });
      expect(r.estado).toBe(FacturaEstado.ANULADA);
      expect(r.motivoAnulacion).toBe(
        'Error en el cobro, el cliente no consumió',
      );
    });

    it('lanza error si ya esta anulada', async () => {
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue(mockFacturaDoc({ estado: FacturaEstado.ANULADA })),
      });
      await expect(
        service.anularFactura(FACTURA_ID, { motivo: 'Error' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza error si no existe', async () => {
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.anularFactura(FACTURA_ID, { motivo: 'Error' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reporteDiario', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('genera reporte con desglose', async () => {
      const doc = mockFacturaDoc({
        createdAt: new Date(),
        total: 250,
        isv15: 30,
        isv18: 0,
        totalExento: 0,
        propina: 20,
        metodoPago: MetodoPago.EFECTIVO,
        estado: FacturaEstado.PAGADA,
        cajero: { _id: new Types.ObjectId(CAJERO_ID), nombre: 'Cajero Test' },
      });

      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([doc]),
      });

      const r = await service.reporteDiario();
      expect(r.totalFacturado).toBe(250);
      expect(r.totalIsv15).toBe(30);
      expect(r.cantidadFacturas).toBe(1);
      expect(r.desglosePorMetodoPago.EFECTIVO).toBe(250);
    });

    it('excluye facturas anuladas del total facturado', async () => {
      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue([
            mockFacturaDoc({ estado: FacturaEstado.ANULADA }),
          ]),
      });
      const r = await service.reporteDiario();
      expect(r.cantidadFacturas).toBe(0);
      expect(r.facturasAnuladas).toBe(1);
    });

    it('no crashea si el cajero fue eliminado', async () => {
      const doc = mockFacturaDoc({
        total: 250,
        estado: FacturaEstado.PAGADA,
        cajero: null,
      });

      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([doc]),
      });

      const r = await service.reporteDiario();
      expect(r.totalFacturado).toBe(250);
      // El total se agrupa bajo la etiqueta de cajero eliminado
      expect(r.desglosePorCajero).toHaveLength(1);
      expect(r.desglosePorCajero[0].cajeroNombre).toBe('Cajero eliminado');
      expect(r.desglosePorCajero[0].total).toBe(250);
    });

    it('lanza error con fecha que no existe en el calendario', async () => {
      await expect(service.reporteDiario('2026-02-30')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.reporteDiario('2026-02-29')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error con formato de fecha invalido', async () => {
      await expect(service.reporteDiario('02-30-2026')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.reporteDiario('2026/02/30')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.reporteDiario('abc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('acepta fecha valida en formato YYYY-MM-DD', async () => {
      facturaModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const r = await service.reporteDiario('2026-07-30');
      expect(r.fecha).toBe('2026-07-30');
      expect(r.cantidadFacturas).toBe(0);
    });
  });

  describe('listarCortes', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('retorna lista de cortes populada', async () => {
      corteModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            cajero: {
              _id: new Types.ObjectId(CAJERO_ID),
              nombre: 'Cajero Test',
            },
            fondoInicial: 500,
            totalEsperado: 1000,
            totalReal: 1000,
            diferencia: 0,
            totalEfectivo: 500,
            totalTarjeta: 300,
            totalTransferencia: 200,
            totalPropinas: 50,
            cantidadFacturas: 5,
            estado: CorteEstado.CERRADO,
            aperturaEn: new Date(),
            cierreEn: new Date(),
          },
        ]),
      });

      const r = await service.listarCortes();
      expect(r).toHaveLength(1);
      expect(r[0].cajero.nombre).toBe('Cajero Test');
    });

    it('no crashea si el cajero del corte fue eliminado', async () => {
      corteModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            cajero: null,
            fondoInicial: 500,
            totalEsperado: 1000,
            totalReal: 1000,
            diferencia: 0,
            totalEfectivo: 500,
            totalTarjeta: 300,
            totalTransferencia: 200,
            totalPropinas: 50,
            cantidadFacturas: 5,
            estado: CorteEstado.CERRADO,
            aperturaEn: new Date(),
            cierreEn: new Date(),
          },
        ]),
      });

      const r = await service.listarCortes();
      expect(r).toHaveLength(1);
      expect(r[0].cajero).toEqual({ id: '', nombre: '' });
    });
  });

  describe('validaciones generales', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('lanza error con ObjectId invalido en buscarFactura', async () => {
      await expect(service.buscarFactura('id-invalido')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error con ObjectId invalido en anularFactura', async () => {
      await expect(
        service.anularFactura('id-invalido', { motivo: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza error con ObjectId invalido en obtenerCuenta', async () => {
      await expect(service.obtenerCuenta('id-invalido')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error si mesa no esta en CUENTA_PEDIDA', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.OCUPADA,
      });
      await expect(service.obtenerCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
