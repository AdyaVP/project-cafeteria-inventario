import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Orden } from '../ordenes/schemas/orden.schema';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum';
import { Usuario } from '../usuarios/schemas/usuario.schema';
import { Mesa, MesaEstado } from './schemas/mesa.schema';
import { MesasService } from './mesas.service';

function queryResult(resultado: unknown) {
  return {
    populate: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resultado),
  };
}

describe('MesasService solicitarCuenta', () => {
  const mesaId = new Types.ObjectId().toHexString();
  const meseroId = new Types.ObjectId().toHexString();
  const abiertaEn = new Date('2026-08-13T10:00:00-06:00');

  let service: MesasService;
  let mesaModel: Record<string, jest.Mock>;
  let ordenModel: Record<string, jest.Mock>;
  let usuarioModel: Record<string, jest.Mock>;
  let eventEmitter: Record<string, jest.Mock>;

  const mesaOcupada = (propietario = meseroId) => ({
    _id: new Types.ObjectId(mesaId),
    numero: 4,
    capacidad: 4,
    estado: MesaEstado.OCUPADA,
    meseroActual: new Types.ObjectId(propietario),
    abiertaEn,
    cerradaEn: null,
  });

  beforeEach(async () => {
    mesaModel = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      db: {
        startSession: jest.fn().mockResolvedValue({
          withTransaction: jest.fn(async (callback: () => Promise<void>) => {
            await callback();
          }),
          endSession: jest.fn(),
        }),
      },
    };
    ordenModel = {
      countDocuments: jest.fn(),
    };
    usuarioModel = { findOneAndUpdate: jest.fn() };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MesasService,
        { provide: getModelToken(Mesa.name), useValue: mesaModel },
        { provide: getModelToken(Orden.name), useValue: ordenModel },
        { provide: getModelToken(Usuario.name), useValue: usuarioModel },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(MesasService);
  });

  it('notifica por WebSocket al crear una mesa libre', async () => {
    const creada = {
      _id: new Types.ObjectId(mesaId),
      numero: 4,
      capacidad: 4,
      estado: MesaEstado.LIBRE,
      meseroActual: null,
      abiertaEn: null,
      cerradaEn: null,
    };
    mesaModel.findOne = jest.fn().mockReturnValue({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    });
    mesaModel.create = jest.fn().mockResolvedValue(creada);
    mesaModel.findById.mockReturnValue(queryResult(creada));

    await service.crear({ numero: 4, capacidad: 4 });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'mesa.estado.cambiado',
      expect.objectContaining({
        mesaId,
        nuevoEstado: MesaEstado.LIBRE,
      }),
    );
  });

  it('rechaza la cuenta si todavía hay órdenes activas y no cambia la mesa', async () => {
    mesaModel.findById.mockReturnValue(queryResult(mesaOcupada()));
    ordenModel.countDocuments
      .mockReturnValueOnce(queryResult(1))
      .mockReturnValueOnce(queryResult(1));

    await expect(service.solicitarCuenta(mesaId, meseroId)).rejects.toThrow(
      BadRequestException,
    );

    expect(mesaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza la cuenta sin órdenes entregadas de la sesión actual', async () => {
    mesaModel.findById.mockReturnValue(queryResult(mesaOcupada()));
    ordenModel.countDocuments
      .mockReturnValueOnce(queryResult(0))
      .mockReturnValueOnce(queryResult(0));

    await expect(service.solicitarCuenta(mesaId, meseroId)).rejects.toThrow(
      'sin órdenes entregadas en la sesión actual',
    );

    expect(mesaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza a un mesero distinto antes de consultar órdenes', async () => {
    mesaModel.findById.mockReturnValue(
      queryResult(mesaOcupada(new Types.ObjectId().toHexString())),
    );

    await expect(service.solicitarCuenta(mesaId, meseroId)).rejects.toThrow(
      ForbiddenException,
    );

    expect(ordenModel.countDocuments).not.toHaveBeenCalled();
    expect(mesaModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('cambia a CUENTA_PEDIDA cuando la sesión solo tiene órdenes entregadas', async () => {
    const actual = mesaOcupada();
    const actualizada = {
      ...actual,
      estado: MesaEstado.CUENTA_PEDIDA,
    };
    const poblada = {
      ...actualizada,
      meseroActual: {
        _id: new Types.ObjectId(meseroId),
        nombre: 'Mesero Demo',
      },
    };

    mesaModel.findById
      .mockReturnValueOnce(queryResult(actual))
      .mockReturnValueOnce(queryResult(poblada));
    ordenModel.countDocuments
      .mockReturnValueOnce(queryResult(0))
      .mockReturnValueOnce(queryResult(2));
    mesaModel.findOneAndUpdate.mockReturnValue(queryResult(actualizada));

    const resultado = await service.solicitarCuenta(mesaId, meseroId);

    expect(resultado.estado).toBe(MesaEstado.CUENTA_PEDIDA);
    expect(mesaModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: MesaEstado.OCUPADA,
        abiertaEn,
      }),
      { $set: { estado: MesaEstado.CUENTA_PEDIDA } },
      expect.objectContaining({ new: true }),
    );
    expect(ordenModel.countDocuments).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
        createdAt: { $gte: abiertaEn },
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'mesa.estado.cambiado',
      expect.objectContaining({ nuevoEstado: MesaEstado.CUENTA_PEDIDA }),
    );
  });
});
