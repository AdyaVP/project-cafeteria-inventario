import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { Role } from '../common/constants/roles.enum.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum.js';

import {
  SALA_COCINA,
  EVENTO_WS_NUEVA_ORDEN,
  EVENTO_WS_ORDEN_ACTUALIZADA,
  EVENTO_WS_MESA_ACTUALIZADA,
  EVENTO_ORDEN_CREADA,
  EVENTO_MESA_ESTADO_CAMBIADO,
} from './cocina.constants.js';

interface OrdenCreadaPayload {
  ordenes: unknown[];
  mesaId: string;
  timestamp: Date;
}

interface MesaCambiadaPayload {
  mesaId: string;
  nuevoEstado: string;
  timestamp: Date;
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: '/cocina',
})
@Injectable()
export class CocinaGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this._extraerToken(client);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      client.data.usuario = payload;

      if (payload.roles.includes(Role.COCINA)) {
        client.join(SALA_COCINA);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {}

  @OnEvent(EVENTO_ORDEN_CREADA)
  manejarOrdenCreada(payload: OrdenCreadaPayload): void {
    this.server.to(SALA_COCINA).emit(EVENTO_WS_NUEVA_ORDEN, payload);
  }

  @OnEvent(EVENTO_MESA_ESTADO_CAMBIADO)
  manejarMesaCambiada(payload: MesaCambiadaPayload): void {
    this.server.emit(EVENTO_WS_MESA_ACTUALIZADA, payload);
  }

  emitirEstadoOrden(
    ordenId: string,
    nuevoEstado: OrdenEstado,
  ): void {
    this.server.to(SALA_COCINA).emit(EVENTO_WS_ORDEN_ACTUALIZADA, {
      ordenId,
      nuevoEstado,
      timestamp: new Date(),
    });
  }

  private _extraerToken(client: Socket): string | null {
    const cookie = client.handshake.headers.cookie;

    if (!cookie) {
      return null;
    }

    const match = cookie.match(/access_token=([^;]+)/);

    return match ? match[1] : null;
  }
}
