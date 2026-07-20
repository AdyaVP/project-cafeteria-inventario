jest.mock('../ordenes/ordenes.service', () => ({
  OrdenesService: jest.fn().mockImplementation(() => ({
    obtenerColaCocina: jest.fn(),
    marcarEnPreparacion: jest.fn(),
    marcarLista: jest.fn(),
  })),
}));

jest.mock('./cocina.gateway', () => ({
  CocinaGateway: jest.fn().mockImplementation(() => ({
    emitirEstadoOrden: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';

import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum';
import { TipoOrden } from '../ordenes/schemas/tipo-orden.enum';
import { OrdenesService } from '../ordenes/ordenes.service';
import type { OrdenCocinaResponse } from '../ordenes/interfaces/orden-response.interface';

import { CocinaGateway } from './cocina.gateway';
import { CocinaService } from './cocina.service';

const ORDEN_ID = '507f1f77bcf86cd799439011';
const COCINERO_ID = '507f1f77bcf86cd799439022';

function mockResponse(overrides: Partial<OrdenCocinaResponse> = {}): OrdenCocinaResponse {
  return {
    id: ORDEN_ID,
    mesa: { id: 'mesa-id', numero: 5 },
    mesero: { id: 'mesero-id', nombre: 'Test' },
    items: [],
    estadoGeneral: OrdenEstado.PENDIENTE,
    tipo: TipoOrden.COCINA,
    notaChef: undefined,
    tiempoEstimadoMin: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CocinaService', () => {
  let service: CocinaService;
  let mockOrdenesService: Record<string, jest.Mock>;
  let mockGateway: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockOrdenesService = {
      obtenerColaCocina: jest.fn(),
      marcarEnPreparacion: jest.fn(),
      marcarLista: jest.fn(),
    };

    mockGateway = {
      emitirEstadoOrden: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CocinaService,
        { provide: OrdenesService, useValue: mockOrdenesService },
        { provide: CocinaGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(CocinaService);
  });

  describe('obtenerColaActual', () => {
    it('retorna la cola de cocina delegando a OrdenesService', async () => {
      const ordenesMock = [mockResponse(), mockResponse()];
      mockOrdenesService.obtenerColaCocina.mockResolvedValue(ordenesMock);

      const resultado = await service.obtenerColaActual();

      expect(resultado).toHaveLength(2);
      expect(mockOrdenesService.obtenerColaCocina).toHaveBeenCalled();
    });
  });

  describe('marcarEnPreparacion', () => {
    it('cambia estado a EN_PREPARACION y emite evento', async () => {
      const response = mockResponse({ estadoGeneral: OrdenEstado.EN_PREPARACION });
      mockOrdenesService.marcarEnPreparacion.mockResolvedValue(response);

      const resultado = await service.marcarEnPreparacion(ORDEN_ID, COCINERO_ID);

      expect(resultado.estadoGeneral).toBe(OrdenEstado.EN_PREPARACION);
      expect(mockOrdenesService.marcarEnPreparacion).toHaveBeenCalledWith(ORDEN_ID);
      expect(mockGateway.emitirEstadoOrden).toHaveBeenCalledWith(
        ORDEN_ID,
        OrdenEstado.EN_PREPARACION,
      );
    });

    it('lanza error si la orden no es de tipo COCINA', async () => {
      const response = mockResponse({ tipo: TipoOrden.CAFETERIA });
      mockOrdenesService.marcarEnPreparacion.mockResolvedValue(response);

      await expect(service.marcarEnPreparacion(ORDEN_ID, COCINERO_ID)).rejects.toThrow(
        'La orden no es de tipo COCINA',
      );
      expect(mockGateway.emitirEstadoOrden).not.toHaveBeenCalled();
    });
  });

  describe('marcarLista', () => {
    it('cambia estado a LISTA y emite evento', async () => {
      const response = mockResponse({ estadoGeneral: OrdenEstado.LISTA });
      mockOrdenesService.marcarLista.mockResolvedValue(response);

      const resultado = await service.marcarLista(ORDEN_ID);

      expect(resultado.estadoGeneral).toBe(OrdenEstado.LISTA);
      expect(mockGateway.emitirEstadoOrden).toHaveBeenCalledWith(
        ORDEN_ID,
        OrdenEstado.LISTA,
      );
    });

    it('lanza error si la orden no es de tipo COCINA', async () => {
      const response = mockResponse({ tipo: TipoOrden.CAFETERIA });
      mockOrdenesService.marcarLista.mockResolvedValue(response);

      await expect(service.marcarLista(ORDEN_ID)).rejects.toThrow(
        'La orden no es de tipo COCINA',
      );
      expect(mockGateway.emitirEstadoOrden).not.toHaveBeenCalled();
    });
  });
});
