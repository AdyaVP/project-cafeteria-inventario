import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import {
  Model,
  Types,
} from 'mongoose';

import {
  Receta,
  RecetaDocument,
} from './schemas/receta.schema.js';

import type {
  CreateRecetaDto,
} from './dto/create-receta.dto.js';

import type {
  RecetaResponse,
} from './interfaces/receta-response.interface.js';

@Injectable()
export class RecetasService {
  constructor(
    @InjectModel(Receta.name)
    private readonly recetaModel: Model<RecetaDocument>,
  ) {}

  async listar(): Promise<
    RecetaResponse[]
  > {
    const recetas =
      await this.recetaModel.find();

    return recetas.map((receta) =>
      this.toResponse(receta),
    );
  }

  async crear(
    dto: CreateRecetaDto,
  ): Promise<RecetaResponse> {
    this.validarObjectId(
      dto.productoId,
    );

    dto.ingredientes.forEach(
      (ingrediente) => {
        this.validarObjectId(
          ingrediente.inventarioItemId,
        );
      },
    );

    const receta =
      await this.recetaModel.create(dto);

    return this.toResponse(receta);
  }

  async buscarPorProducto(
    productoId: string,
  ): Promise<RecetaResponse> {
    this.validarObjectId(productoId);

    const receta =
      await this.recetaModel.findOne({
        productoId,
      });

    if (!receta) {
      throw new NotFoundException(
        'Receta no encontrada',
      );
    }

    return this.toResponse(receta);
  }

  private toResponse(
    receta: RecetaDocument,
  ): RecetaResponse {
    return {
      id: receta._id.toString(),

      productoId:
        receta.productoId.toString(),

      ingredientes:
        receta.ingredientes.map(
          (ingrediente) => ({
            inventarioItemId:
              ingrediente.inventarioItemId.toString(),

            cantidad:
              ingrediente.cantidad,
          }),
        ),
    };
  }

  private validarObjectId(
    id: string,
  ): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'ID inválido',
      );
    }
  }
}