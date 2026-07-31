jest.mock('../mesas/mesas.service', () => ({
  MesasService: jest.fn().mockImplementation(() => ({
    buscarPorId: jest.fn(),
    cerrarMesa: jest.fn(),
  })),
}));

jest.mock('../ordenes/ordenes.service', () => ({
  OrdenesService: jest.fn().mockImplementation(() => ({
    listarEntregadasPorMesa: jest.fn(),
    listarPorMesa: jest.fn(),
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

import { CajaService } from './caja.service';
import { Factura, FacturaEstado, MetodoPago } from './schemas/factura.schema';

const MESA_ID = new Types.ObjectId().toHexString();
const CAJERO_ID = new Types.ObjectId().toHexString();
const FACTURA_ID = new Types.ObjectId().toHexString();
const ORDEN_ID = new Types.ObjectId().toHexString();

function mockFacturaDoc(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId(FACTURA_ID);
  const now = new Date();

  const defaults = {
    _id,
    mesa: { _id: new Types.ObjectId(MESA_ID), numero: 5 },
    ordenes: [new Types.ObjectId(ORDEN_ID)],
    itemsSnapshot: [
      {
        nombre: 'Hamburguesa',
        cantidad: 2,
        precioUnitario: 100,
        subtotal: 200,
      },
    ],
    subtotal: 200,
    impuesto: 30,
    total: 230,
    metodoPago: MetodoPago.EFECTIVO,
    estado: FacturaEstado.PAGADA,
    cajero: { _id: new Types.ObjectId(CAJERO_ID), nombre: 'Cajero Test' },
    cai: undefined as string | undefined,
    rtn: undefined as string | undefined,
    fechaEmision: now,
    justificacionAnulacion: undefined as string | undefined,
    anuladoPor: undefined as unknown,
    createdAt: now,
    updatedAt: now,
    save: jest.fn().mockResolvedValue(undefined),
    toObject: jest.fn(),
  };

  const data = { ...defaults, ...overrides };
  data.toObject = jest.fn().mockReturnValue(data);
  return data;
}

function ordenEntregada() {
  return {
    id: ORDEN_ID,
    items: [
      {
        productoId: new Types.ObjectId().toHexString(),
        nombreProducto: 'Hamburguesa',
        precioUnitario: 100,
        cantidad: 2,
      },
    ],
  };
}

describe('CajaService', () => {
  let service: CajaService;
  let mockMesasService: Record<string, jest.Mock>;
  let mockOrdenesService: Record<string, jest.Mock>;
  let mockConfigService: Record<string, jest.Mock>;
  let mockEventEmitter: Record<string, jest.Mock>;
  let facturaModel: Record<string, jest.Mock>;

  const defaultConfig: Record<string, unknown> = {
    IMPUESTO_PORCENTAJE: '15',
  };

  function resetMocks() {
    mockMesasService = { buscarPorId: jest.fn(), cerrarMesa: jest.fn() };
    mockOrdenesService = {
      listarEntregadasPorMesa: jest.fn(),
      listarPorMesa: jest.fn().mockResolvedValue([]),
    };
    mockConfigService = { get: jest.fn((key: string) => defaultConfig[key]) };
    mockEventEmitter = { emit: jest.fn() };
    facturaModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      countDocuments: jest.fn(),
    };
  }

  async function createModule() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        { provide: getModelToken(Factura.name), useValue: facturaModel },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MesasService, useValue: mockMesasService },
        { provide: OrdenesService, useValue: mockOrdenesService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get(CajaService);
  }

  describe('generarPreCuenta', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('retorna la pre-cuenta con subtotal, impuesto y total', async () => {
      const apertura = new Date('2026-07-30T08:00:00-06:00');

      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        meseroActual: {
          id: new Types.ObjectId().toHexString(),
          nombre: 'Test',
        },
        abiertaEn: apertura,
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        ordenEntregada(),
      ]);

      const r = await service.generarPreCuenta(MESA_ID);

      expect(r.subtotal).toBe(200);
      expect(r.impuesto).toBe(30);
      expect(r.total).toBe(230);
      expect(r.items).toHaveLength(1);
      expect(r.items[0].nombre).toBe('Hamburguesa');
      expect(r.ordenes).toEqual([{ id: ORDEN_ID }]);
    });

    it('lanza error si la mesa no esta en CUENTA_PEDIDA', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.OCUPADA,
      });

      await expect(service.generarPreCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error si hay ordenes sin entregar', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.CUENTA_PEDIDA,
        abiertaEn: new Date(),
      });
      mockOrdenesService.listarPorMesa.mockResolvedValue([
        { id: new Types.ObjectId().toHexString() },
      ]);

      await expect(service.generarPreCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error si no hay ordenes entregadas', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.CUENTA_PEDIDA,
        abiertaEn: new Date(),
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([]);

      await expect(service.generarPreCuenta(MESA_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('filtra ordenes por la sesion actual (abiertaEn)', async () => {
      const apertura = new Date('2026-07-30T08:00:00-06:00');

      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        estado: MesaEstado.CUENTA_PEDIDA,
        abiertaEn: apertura,
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        ordenEntregada(),
      ]);

      await service.generarPreCuenta(MESA_ID);

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
  });

  describe('emitirFactura', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('crea factura con snapshot, impuesto, cierra mesa y emite evento', async () => {
      mockMesasService.buscarPorId.mockResolvedValue({
        id: MESA_ID,
        numero: 5,
        estado: MesaEstado.CUENTA_PEDIDA,
        abiertaEn: new Date(),
      });
      mockOrdenesService.listarEntregadasPorMesa.mockResolvedValue([
        ordenEntregada(),
      ]);
      mockMesasService.cerrarMesa.mockResolvedValue(undefined);

      const doc = mockFacturaDoc();
      facturaModel.create.mockResolvedValue(doc);
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });

      const r = await service.emitirFactura(CAJERO_ID, {
        mesaId: MESA_ID,
        metodoPago: MetodoPago.EFECTIVO,
      });

      expect(r.subtotal).toBe(200);
      expect(r.impuesto).toBe(30);
      expect(r.total).toBe(230);
      expect(r.estado).toBe(FacturaEstado.PAGADA);

      expect(facturaModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          itemsSnapshot: [
            {
              nombre: 'Hamburguesa',
              cantidad: 2,
              precioUnitario: 100,
              subtotal: 200,
            },
          ],
          impuesto: 30,
          total: 230,
          estado: FacturaEstado.PAGADA,
        }),
      );
      expect(mockMesasService.cerrarMesa).toHaveBeenCalledWith(MESA_ID);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'mesa.estado.cambiado',
        expect.objectContaining({ mesaId: MESA_ID }),
      );
    });

    it('lanza error con ObjectId invalido', async () => {
      await expect(
        service.emitirFactura(CAJERO_ID, {
          mesaId: 'id-invalido',
          metodoPago: MetodoPago.EFECTIVO,
        }),
      ).rejects.toThrow(BadRequestException);
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
      expect(r.total).toBe(230);
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

    it('lanza error con ObjectId invalido', async () => {
      await expect(service.buscarFactura('id-invalido')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('anularFactura', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('anula factura y registra quien anulo', async () => {
      const doc = mockFacturaDoc();
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(doc),
      });

      const r = await service.anularFactura(
        FACTURA_ID,
        CAJERO_ID,
        'Error en el cobro, el cliente no consumió los productos',
      );

      expect(r.estado).toBe(FacturaEstado.ANULADA);
      expect(r.justificacionAnulacion).toBe(
        'Error en el cobro, el cliente no consumió los productos',
      );
      expect(String(doc.anuladoPor)).toBe(CAJERO_ID);
    });

    it('lanza error si la factura ya esta anulada', async () => {
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue(mockFacturaDoc({ estado: FacturaEstado.ANULADA })),
      });

      await expect(
        service.anularFactura(FACTURA_ID, CAJERO_ID, 'Error de sistema'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza error si la factura no existe', async () => {
      facturaModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.anularFactura(FACTURA_ID, CAJERO_ID, 'Error de sistema'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reporteDiario', () => {
    beforeEach(async () => {
      resetMocks();
      await createModule();
    });

    it('genera reporte con total, desglose, mesas atendidas y ticket promedio', async () => {
      facturaModel.find = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          mockFacturaDoc({
            mesa: new Types.ObjectId(MESA_ID),
            total: 230,
            metodoPago: MetodoPago.EFECTIVO,
            estado: FacturaEstado.PAGADA,
          }),
          mockFacturaDoc({
            mesa: new Types.ObjectId(MESA_ID),
            total: 460,
            metodoPago: MetodoPago.TARJETA,
            estado: FacturaEstado.PAGADA,
          }),
        ]),
      });

      const r = await service.reporteDiario('2026-07-30');

      expect(r.totalCobrado).toBe(690);
      expect(r.desglosePorMetodoPago.EFECTIVO).toBe(230);
      expect(r.desglosePorMetodoPago.TARJETA).toBe(460);
      expect(r.mesasAtendidas).toBe(1);
      expect(r.ticketPromedio).toBe(345);
    });

    it('lanza error con fecha inexistente', async () => {
      await expect(service.reporteDiario('2026-02-30')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza error con formato invalido', async () => {
      await expect(service.reporteDiario('30-07-2026')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
