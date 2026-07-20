import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { Role } from '../common/constants/roles.enum';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum';
import { CocinaGateway } from './cocina.gateway';

import {
  SALA_COCINA,
  EVENTO_WS_NUEVA_ORDEN,
  EVENTO_WS_ORDEN_ACTUALIZADA,
  EVENTO_WS_MESA_ACTUALIZADA,
} from './cocina.constants';

describe('CocinaGateway', () => {
  let gateway: CocinaGateway;
  let mockJwtService: Record<string, jest.Mock>;
  let mockServer: Record<string, jest.Mock>;
  let mockClient: Record<string, unknown>;

  const TOKEN_VALIDO = 'token-valido';
  const PAYLOAD_COCINA = {
    sub: 'user-id',
    email: 'cocinero@test.com',
    roles: [Role.COCINA],
  };

  beforeEach(async () => {
    mockJwtService = {
      verifyAsync: jest.fn(),
    };

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockClient = {
      handshake: {
        headers: {
          cookie: `access_token=${TOKEN_VALIDO}`,
        },
      },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CocinaGateway,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    gateway = module.get<CocinaGateway>(CocinaGateway);
    gateway.server = mockServer as unknown as Server;
  });

  describe('handleConnection', () => {
    it('debe conectar y unir al room cocina si el rol es COCINA', async () => {
      mockJwtService.verifyAsync.mockResolvedValue(PAYLOAD_COCINA);

      await gateway.handleConnection(mockClient as unknown as Socket);

      expect(mockClient.join).toHaveBeenCalledWith(SALA_COCINA);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect((mockClient.data as Record<string, unknown>).usuario).toEqual(
        PAYLOAD_COCINA,
      );
    });

    it('debe desconectar si no hay token en cookie', async () => {
      const clientSinCookie: Record<string, unknown> = {
        handshake: { headers: {} },
        join: jest.fn(),
        disconnect: jest.fn(),
        data: {},
      };

      await gateway.handleConnection(clientSinCookie as unknown as Socket);

      expect(clientSinCookie.disconnect).toHaveBeenCalled();
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('debe desconectar si el JWT es invalido', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('Token invalido'),
      );

      await gateway.handleConnection(mockClient as unknown as Socket);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('debe conectar sin unir a room si el rol no es COCINA', async () => {
      const payloadMesero = {
        sub: 'user-id',
        email: 'mesero@test.com',
        roles: [Role.MESERO],
      };
      mockJwtService.verifyAsync.mockResolvedValue(payloadMesero);

      await gateway.handleConnection(mockClient as unknown as Socket);

      expect(mockClient.join).not.toHaveBeenCalled();
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('manejarOrdenCreada', () => {
    it('debe emitir nueva-orden al room cocina', () => {
      const payload = {
        ordenes: [{ id: 'orden-1' }],
        mesaId: 'mesa-id',
        timestamp: new Date(),
      };

      gateway.manejarOrdenCreada(payload);

      expect(mockServer.to).toHaveBeenCalledWith(SALA_COCINA);
      expect(mockServer.emit).toHaveBeenCalledWith(EVENTO_WS_NUEVA_ORDEN, payload);
    });
  });

  describe('manejarMesaCambiada', () => {
    it('debe emitir mesa-actualizada a todos los clientes', () => {
      const payload = {
        mesaId: 'mesa-id',
        nuevoEstado: 'OCUPADA',
        timestamp: new Date(),
      };

      gateway.manejarMesaCambiada(payload);

      expect(mockServer.emit).toHaveBeenCalledWith(
        EVENTO_WS_MESA_ACTUALIZADA,
        payload,
      );
    });
  });

  describe('emitirEstadoOrden', () => {
    it('debe emitir orden-actualizada al room cocina', () => {
      gateway.emitirEstadoOrden('orden-1', OrdenEstado.LISTA);

      expect(mockServer.to).toHaveBeenCalledWith(SALA_COCINA);
      expect(mockServer.emit).toHaveBeenCalledWith(
        EVENTO_WS_ORDEN_ACTUALIZADA,
        expect.objectContaining({
          ordenId: 'orden-1',
          nuevoEstado: OrdenEstado.LISTA,
        }),
      );
    });
  });
});
