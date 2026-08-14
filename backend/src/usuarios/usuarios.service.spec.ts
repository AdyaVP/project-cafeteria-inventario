import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Role } from '../common/constants/roles.enum';
import { Usuario } from './schemas/usuario.schema';
import { Mesa, MesaEstado } from '../mesas/schemas/mesa.schema';
import { Orden } from '../ordenes/schemas/orden.schema';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum';
import { EVENTO_USUARIO_AUTORIZACION_CAMBIADA } from './usuarios.constants';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService autorización vigente', () => {
  const usuarioId = new Types.ObjectId().toHexString();
  const usuario = {
    _id: new Types.ObjectId(usuarioId),
    nombre: 'Usuario Demo',
    email: 'usuario@demo.local',
    roles: [Role.MESERO],
    activo: true,
    createdAt: new Date(),
  };

  let service: UsuariosService;
  let model: Record<string, jest.Mock>;
  let mesaModel: Record<string, jest.Mock>;
  let ordenModel: Record<string, jest.Mock>;
  let eventEmitter: Record<string, jest.Mock>;

  function mockUsuarioActual(valor: unknown): void {
    model.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue(valor),
    });
  }

  function mockExiste(modelo: Record<string, jest.Mock>, valor: unknown): void {
    modelo.exists.mockReturnValue({
      session: jest.fn().mockResolvedValue(valor),
    });
  }

  beforeEach(async () => {
    const session = {
      withTransaction: jest.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
      endSession: jest.fn(),
    };
    const query = (resultado: unknown) => ({
      session: jest.fn().mockResolvedValue(resultado),
    });
    model = {
      findById: jest.fn().mockImplementation(() => query(usuario)),
      findByIdAndUpdate: jest.fn(),
      db: { startSession: jest.fn().mockResolvedValue(session) },
    };
    mesaModel = {
      exists: jest
        .fn()
        .mockReturnValue({ session: jest.fn().mockResolvedValue(null) }),
    };
    ordenModel = {
      exists: jest
        .fn()
        .mockReturnValue({ session: jest.fn().mockResolvedValue(null) }),
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getModelToken(Usuario.name), useValue: model },
        { provide: getModelToken(Mesa.name), useValue: mesaModel },
        { provide: getModelToken(Orden.name), useValue: ordenModel },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('notifica para revocar sockets después de cambiar roles', async () => {
    mockUsuarioActual(usuario);
    model.findByIdAndUpdate.mockResolvedValue({
      ...usuario,
      roles: [Role.CAJERO],
    });

    await service.actualizarRoles(usuarioId, { roles: [Role.CAJERO] });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EVENTO_USUARIO_AUTORIZACION_CAMBIADA,
      { usuarioId },
    );
  });

  it('notifica para revocar sockets después de desactivar', async () => {
    mockUsuarioActual(usuario);
    model.findByIdAndUpdate.mockResolvedValue(usuario);

    await service.desactivar(usuarioId);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      EVENTO_USUARIO_AUTORIZACION_CAMBIADA,
      { usuarioId },
    );
  });

  it('consultar el usuario no desconecta su socket', async () => {
    model.findById.mockResolvedValue(usuario);

    await service.buscarPorId(usuarioId);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rechaza quitar MESERO si tiene una mesa ocupada o con cuenta', async () => {
    mockUsuarioActual(usuario);
    mockExiste(mesaModel, { _id: new Types.ObjectId() });

    await expect(
      service.actualizarRoles(usuarioId, { roles: [Role.CAJERO] }),
    ).rejects.toThrow('Finalice o reasigne su trabajo primero');

    expect(mesaModel.exists).toHaveBeenCalledWith({
      meseroActual: new Types.ObjectId(usuarioId),
      estado: { $in: [MesaEstado.OCUPADA, MesaEstado.CUENTA_PEDIDA] },
    });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza desactivar MESERO si tiene una orden activa', async () => {
    mockUsuarioActual(usuario);
    mockExiste(ordenModel, { _id: new Types.ObjectId() });

    await expect(service.desactivar(usuarioId)).rejects.toThrow(
      'Finalice o reasigne su trabajo primero',
    );

    expect(ordenModel.exists).toHaveBeenCalledWith({
      mesero: new Types.ObjectId(usuarioId),
      estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
    });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('permite cambiar otros roles sin consultar trabajo de mesero', async () => {
    mockUsuarioActual({
      ...usuario,
      roles: [Role.ADMIN],
    });
    model.findByIdAndUpdate.mockResolvedValue({
      ...usuario,
      roles: [Role.CAJERO],
    });

    await service.actualizarRoles(usuarioId, { roles: [Role.CAJERO] });

    expect(mesaModel.exists).not.toHaveBeenCalled();
    expect(ordenModel.exists).not.toHaveBeenCalled();
  });
});
