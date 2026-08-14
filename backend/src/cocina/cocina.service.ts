import { Injectable } from '@nestjs/common';

import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum.js';
import { OrdenesService } from '../ordenes/ordenes.service.js';
import { OrdenCocinaResponse } from '../ordenes/interfaces/orden-response.interface.js';

import { CocinaGateway } from './cocina.gateway.js';

@Injectable()
export class CocinaService {
  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly cocinaGateway: CocinaGateway,
  ) {}

  async obtenerColaActual(): Promise<OrdenCocinaResponse[]> {
    return this.ordenesService.obtenerColaCocina();
  }

  async marcarEnPreparacion(
    ordenId: string,
    cocineroId: string,
  ): Promise<OrdenCocinaResponse> {
    const response = await this.ordenesService.marcarEnPreparacion(ordenId);

    this.cocinaGateway.emitirEstadoOrden(
      ordenId,
      OrdenEstado.EN_PREPARACION,
      response.mesero.id,
      response.mesa,
      response.tipo,
    );

    return response as OrdenCocinaResponse;
  }

  async marcarLista(ordenId: string): Promise<OrdenCocinaResponse> {
    const response = await this.ordenesService.marcarLista(ordenId);

    this.cocinaGateway.emitirEstadoOrden(
      ordenId,
      OrdenEstado.LISTA,
      response.mesero.id,
      response.mesa,
      response.tipo,
    );

    return response as OrdenCocinaResponse;
  }
}
