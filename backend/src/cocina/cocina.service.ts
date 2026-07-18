import { BadRequestException, Injectable } from '@nestjs/common';

import { OrdenEstado } from '../ordenes/schemas/orden-estado.enum.js';
import { TipoOrden } from '../ordenes/schemas/tipo-orden.enum.js';
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
  ): Promise<OrdenCocinaResponse> {
    const response = await this.ordenesService.marcarEnPreparacion(ordenId);

    if (response.tipo !== TipoOrden.COCINA) {
      throw new BadRequestException('La orden no es de tipo COCINA');
    }

    this.cocinaGateway.emitirEstadoOrden(ordenId, OrdenEstado.EN_PREPARACION);

    return response as OrdenCocinaResponse;
  }

  async marcarLista(ordenId: string): Promise<OrdenCocinaResponse> {
    const response = await this.ordenesService.marcarLista(ordenId);

    if (response.tipo !== TipoOrden.COCINA) {
      throw new BadRequestException('La orden no es de tipo COCINA');
    }

    this.cocinaGateway.emitirEstadoOrden(ordenId, OrdenEstado.LISTA);

    return response as OrdenCocinaResponse;
  }
}
