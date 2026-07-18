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
  cors: { origin: process.env.FRONTEND_URL ?? '*', credentials: true },
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
        client.join('cocina');
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {}

  @OnEvent('orden.creada')
  manejarOrdenCreada(payload: OrdenCreadaPayload): void {
    this.server.to('cocina').emit('nueva-orden', payload);
  }

  @OnEvent('mesa.estado.cambiado')
  manejarMesaCambiada(payload: MesaCambiadaPayload): void {
    this.server.emit('mesa-actualizada', payload);
  }

  emitirEstadoOrden(
    ordenId: string,
    nuevoEstado: OrdenEstado,
  ): void {
    this.server.to('cocina').emit('orden-actualizada', {
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
