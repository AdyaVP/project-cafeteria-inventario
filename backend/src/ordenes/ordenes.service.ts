import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types, type Query } from 'mongoose';

import { MesaEstado } from '../mesas/schemas/mesa.schema.js';
import { MesasService } from '../mesas/mesas.service.js';
import { ProductosService } from '../productos/productos.service.js';
import { RecetasService } from '../productos/recetas.service.js';
import { InventarioService } from '../inventario/inventario.service.js';
import {
  ProductoDetalle,
  ProductoComidaResponse,
} from '../productos/interfaces/producto-response.interface.js';
import { ProductoTipo } from '../productos/schemas/producto-tipo.enum.js';

import { Orden, OrdenDocument } from './schemas/orden.schema.js';
import { OrdenCocina } from './schemas/orden-cocina.schema.js';
import { OrdenCafeteria } from './schemas/orden-cafeteria.schema.js';
import { OrdenEstado } from './schemas/orden-estado.enum.js';
import { ItemEstado } from './schemas/item-estado.enum.js';
import { TipoOrden } from './schemas/tipo-orden.enum.js';
import { Temperatura } from '../productos/schemas/temperatura.enum.js';
import { EVENTO_ORDEN_CREADA } from '../cocina/cocina.constants.js';
import { CrearOrdenDto, CrearOrdenItemDto } from './dto/crear-orden.dto.js';
import {
  OrdenCocinaResponse,
  OrdenCafeteriaResponse,
  OrdenResponse,
} from './interfaces/orden-response.interface.js';

interface ItemProcesado {
  productoId: Types.ObjectId;
  cantidad: number;
  notas?: string;
  estadoItem: ItemEstado;
  tiempoPreparacionMin: number;
}

interface GrupoItems {
  tipo: TipoOrden;
  items: ItemProcesado[];
}

interface PopulatedItem {
  _id: Types.ObjectId;
  producto: { _id: Types.ObjectId; nombre: string; precio: number };
  cantidad: number;
  notas?: string;
  estadoItem: ItemEstado;
}

interface PopulatedOrden {
  _id: Types.ObjectId;
  mesa: { _id: Types.ObjectId; numero: number };
  mesero: { _id: Types.ObjectId; nombre: string };
  items: PopulatedItem[];
  estadoGeneral: OrdenEstado;
  tipo: TipoOrden;
  notaChef?: string;
  tiempoEstimadoMin?: number;
  temperatura?: Temperatura;
  tamano?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrdenesService {
  constructor(
    @InjectModel(Orden.name)
    private readonly ordenModel: Model<OrdenDocument>,
    private readonly mesasService: MesasService,
    private readonly productosService: ProductosService,
    private readonly recetasService: RecetasService,
    private readonly inventarioService: InventarioService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async _populateFind(
    query: Query<OrdenDocument[], OrdenDocument>,
  ): Promise<PopulatedOrden[]> {
    const docs = await query
      .populate('mesa', 'numero')
      .populate('mesero', 'nombre')
      .populate('items.producto', 'nombre precio')
      .exec();

    return docs.map((doc) => doc.toObject() as unknown as PopulatedOrden);
  }

  private async _populateFindOne(
    query: Query<OrdenDocument | null, OrdenDocument>,
  ): Promise<PopulatedOrden | null> {
    const doc = await query
      .populate('mesa', 'numero')
      .populate('mesero', 'nombre')
      .populate('items.producto', 'nombre precio')
      .exec();

    if (!doc) {
      return null;
    }

    return doc.toObject() as unknown as PopulatedOrden;
  }

  async crearOrden(
    dto: CrearOrdenDto,
    meseroId: string,
  ): Promise<(OrdenCocinaResponse | OrdenCafeteriaResponse)[]> {
    this._validarObjectId(dto.mesaId);
    this._validarObjectId(meseroId);

    const mesa = await this.mesasService.buscarPorId(dto.mesaId);

    if (mesa.estado !== MesaEstado.OCUPADA) {
      throw new BadRequestException(
        `La mesa debe estar ocupada para recibir una orden. Estado actual: ${mesa.estado}`,
      );
    }

    const productosValidados = await this._validarProductos(dto.items);

    const grupos = this._separarItemsPorTipo(dto.items, productosValidados);

    await this._verificarStock(grupos);

    await this._descontarInventario(grupos);

    const idsDocumentos = await this._crearDocumentos(
      grupos,
      dto.mesaId,
      meseroId,
    );

    const ordenesPopuladas = await this._populateFind(
      this.ordenModel.find({ _id: { $in: idsDocumentos } }),
    );

    this.eventEmitter.emit(EVENTO_ORDEN_CREADA, {
      ordenes: ordenesPopuladas,
      mesaId: dto.mesaId,
      timestamp: new Date(),
    });

    return ordenesPopuladas.map((orden) => this._toResponse(orden));
  }

  async listarPorMesa(
    mesaId: string,
    limite = 100,
    desde?: Date,
  ): Promise<(OrdenCocinaResponse | OrdenCafeteriaResponse)[]> {
    this._validarObjectId(mesaId);

    const filtro: Record<string, unknown> = {
      mesa: new Types.ObjectId(mesaId),
      estadoGeneral: { $ne: OrdenEstado.ENTREGADA },
    };

    if (desde) {
      filtro.createdAt = { $gte: desde };
    }

    const ordenes = await this._populateFind(
      this.ordenModel.find(filtro).sort({ createdAt: -1 }).limit(limite),
    );

    return ordenes.map((orden) => this._toResponse(orden));
  }

  async marcarOrdenEntregada(
    ordenId: string,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    const orden = await this._buscarOrdenPorId(ordenId);

    if (orden.estadoGeneral === OrdenEstado.ENTREGADA) {
      throw new BadRequestException('La orden ya fue entregada');
    }

    const todosListos = orden.items.every(
      (item) => item.estadoItem === ItemEstado.LISTO,
    );
    if (!todosListos) {
      throw new BadRequestException(
        'No se puede entregar la orden: todos los items deben estar en estado LISTO',
      );
    }

    orden.estadoGeneral = OrdenEstado.ENTREGADA;
    orden.items.forEach((item) => {
      item.estadoItem = ItemEstado.ENTREGADO;
    });

    await orden.save();

    const ordenPopulada = await this._populateFindOne(
      this.ordenModel.findById(orden._id),
    );

    if (!ordenPopulada) {
      throw new NotFoundException(
        `Orden con id ${orden._id} no encontrada después de guardar`,
      );
    }

    return this._toResponse(ordenPopulada);
  }

  async obtenerColaCocina(limite = 100): Promise<OrdenCocinaResponse[]> {
    const ordenes = await this._populateFind(
      this.ordenModel
        .find({
          tipo: TipoOrden.COCINA,
          estadoGeneral: {
            $in: [OrdenEstado.PENDIENTE, OrdenEstado.EN_PREPARACION],
          },
        })
        .sort({ createdAt: 1 })
        .limit(limite),
    );

    return ordenes.map(
      (orden) => this._toResponse(orden) as OrdenCocinaResponse,
    );
  }

  async marcarEnPreparacion(
    ordenId: string,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    return this._cambiarEstadoIndividual(
      ordenId,
      OrdenEstado.PENDIENTE,
      OrdenEstado.EN_PREPARACION,
    );
  }

  async marcarLista(
    ordenId: string,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    return this._marcarLista(ordenId);
  }

  private async _cambiarEstadoIndividual(
    ordenId: string,
    estadoActualRequerido: OrdenEstado,
    nuevoEstado: OrdenEstado,
    actualizarItems?: (orden: OrdenDocument) => void,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    const orden = await this._buscarOrdenPorId(ordenId);

    if (orden.estadoGeneral !== estadoActualRequerido) {
      throw new BadRequestException(
        `La orden debe estar en estado ${estadoActualRequerido}. Estado actual: ${orden.estadoGeneral}`,
      );
    }

    orden.estadoGeneral = nuevoEstado;

    if (actualizarItems) {
      actualizarItems(orden);
    }

    await orden.save();

    const ordenPopulada = await this._populateFindOne(
      this.ordenModel.findById(orden._id),
    );

    if (!ordenPopulada) {
      throw new NotFoundException(
        `Orden con id ${orden._id} no encontrada después de guardar`,
      );
    }

    return this._toResponse(ordenPopulada);
  }

  private async _marcarLista(
    ordenId: string,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    return this._cambiarEstadoIndividual(
      ordenId,
      OrdenEstado.EN_PREPARACION,
      OrdenEstado.LISTA,
      (orden) => {
        orden.items.forEach((item) => {
          item.estadoItem = ItemEstado.LISTO;
        });
      },
    );
  }

  async actualizarEstadoItem(
    ordenId: string,
    itemId: string,
    nuevoEstado: ItemEstado,
  ): Promise<OrdenCocinaResponse | OrdenCafeteriaResponse> {
    this._validarObjectId(ordenId);
    this._validarObjectId(itemId);

    const orden = await this._buscarOrdenPorId(ordenId);

    const itemObjectId = new Types.ObjectId(itemId);
    const itemIndex = orden.items.findIndex((i) => i._id.equals(itemObjectId));

    if (itemIndex === -1) {
      throw new NotFoundException(
        `Item con id ${itemId} no encontrado en la orden`,
      );
    }

    orden.items[itemIndex].estadoItem = nuevoEstado;
    await orden.save();

    const ordenPopulada = await this._populateFindOne(
      this.ordenModel.findById(ordenId),
    );

    if (!ordenPopulada) {
      throw new NotFoundException(
        `Orden con id ${ordenId} no encontrada después de guardar`,
      );
    }

    return this._toResponse(ordenPopulada);
  }

  async listarEntregadasPorMesa(
    mesaId: string,
    desde?: Date,
  ): Promise<(OrdenCocinaResponse | OrdenCafeteriaResponse)[]> {
    this._validarObjectId(mesaId);

    const filtro: Record<string, unknown> = {
      mesa: new Types.ObjectId(mesaId),
      estadoGeneral: OrdenEstado.ENTREGADA,
    };

    if (desde) {
      filtro.createdAt = { $gte: desde };
    }

    const ordenes = await this._populateFind(
      this.ordenModel.find(filtro).sort({ createdAt: -1 }),
    );

    return ordenes.map((orden) => this._toResponse(orden));
  }

  private _toResponse(
    doc: PopulatedOrden,
  ): OrdenCocinaResponse | OrdenCafeteriaResponse {
    const base: OrdenResponse = {
      id: doc._id.toString(),
      mesa: {
        id: doc.mesa._id.toString(),
        numero: doc.mesa.numero,
      },
      mesero: {
        id: doc.mesero._id.toString(),
        nombre: doc.mesero.nombre,
      },
      items: doc.items.map((item) => ({
        id: item._id.toString(),
        productoId: item.producto._id.toString(),
        nombreProducto: item.producto.nombre,
        precioUnitario: item.producto.precio,
        cantidad: item.cantidad,
        notas: item.notas,
        estadoItem: item.estadoItem,
      })),
      estadoGeneral: doc.estadoGeneral,
      tipo: doc.tipo,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (doc.tipo === TipoOrden.COCINA) {
      return {
        ...base,
        notaChef: doc.notaChef,
        tiempoEstimadoMin: doc.tiempoEstimadoMin,
      };
    }

    return {
      ...base,
      temperatura: doc.temperatura,
      tamano: doc.tamano,
    };
  }

  private async _buscarOrdenPorId(id: string): Promise<OrdenDocument> {
    this._validarObjectId(id);

    const orden = await this.ordenModel.findById(id).exec();

    if (!orden) {
      throw new NotFoundException(`Orden con id ${id} no encontrada`);
    }

    return orden;
  }

  private _validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`El id "${id}" no es un ObjectId válido`);
    }
  }

  private async _validarProductos(
    items: CrearOrdenItemDto[],
  ): Promise<Map<string, ProductoDetalle>> {
    const lookup = new Map<string, ProductoDetalle>();

    for (const item of items) {
      this._validarObjectId(item.productoId);

      if (lookup.has(item.productoId)) {
        continue;
      }

      const producto = await this.productosService.buscarPorId(item.productoId);

      if (!producto.disponible) {
        throw new BadRequestException(
          `El producto "${producto.nombre}" no está disponible`,
        );
      }

      lookup.set(item.productoId, producto);
    }

    return lookup;
  }

  private _separarItemsPorTipo(
    items: CrearOrdenItemDto[],
    productosValidados: Map<string, ProductoDetalle>,
  ): GrupoItems[] {
    const grupos: GrupoItems[] = [];
    const itemsCocina: ItemProcesado[] = [];
    const itemsCafeteria: ItemProcesado[] = [];

    for (const item of items) {
      const producto = productosValidados.get(item.productoId);

      if (!producto) {
        continue;
      }

      const procesado: ItemProcesado = {
        productoId: new Types.ObjectId(item.productoId),
        cantidad: item.cantidad,
        notas: item.notas,
        estadoItem: ItemEstado.PENDIENTE,
        tiempoPreparacionMin: 0,
      };

      if (producto.tipo === ProductoTipo.COMIDA) {
        const comidaProducto = producto as ProductoComidaResponse;
        procesado.tiempoPreparacionMin =
          comidaProducto.tiempoPreparacionMin ?? 0;
        itemsCocina.push(procesado);
      } else {
        itemsCafeteria.push(procesado);
      }
    }

    if (itemsCocina.length > 0) {
      grupos.push({ tipo: TipoOrden.COCINA, items: itemsCocina });
    }
    if (itemsCafeteria.length > 0) {
      grupos.push({ tipo: TipoOrden.CAFETERIA, items: itemsCafeteria });
    }

    return grupos;
  }

  private async _verificarStock(grupos: GrupoItems[]): Promise<void> {
    const grupoCocina = grupos.find((g) => g.tipo === TipoOrden.COCINA);

    if (!grupoCocina) {
      return;
    }

    const ingredientesAgrupados = new Map<
      string,
      {
        nombre: string;
        cantidadTotal: number;
        faltante: number;
        unidad: string;
      }
    >();

    for (const item of grupoCocina.items) {
      const receta = await this.recetasService.buscarPorProducto(
        item.productoId.toString(),
      );

      for (const ing of receta.ingredientes) {
        const existente = ingredientesAgrupados.get(ing.inventarioItemId) ?? {
          nombre: '',
          cantidadTotal: 0,
          faltante: 0,
          unidad: '',
        };

        existente.cantidadTotal += ing.cantidad * item.cantidad;
        ingredientesAgrupados.set(ing.inventarioItemId, existente);
      }
    }

    const faltantes: string[] = [];

    for (const [inventarioItemId, data] of ingredientesAgrupados) {
      const inventarioItem =
        await this.inventarioService.buscarPorId(inventarioItemId);

      data.nombre = inventarioItem.nombre;
      data.unidad = inventarioItem.unidad;

      if (inventarioItem.stockActual < data.cantidadTotal) {
        data.faltante = data.cantidadTotal - inventarioItem.stockActual;
        faltantes.push(
          `Stock insuficiente para ${inventarioItem.nombre} (faltan ${data.faltante} ${inventarioItem.unidad})`,
        );
      }
    }

    if (faltantes.length > 0) {
      throw new BadRequestException(faltantes.join('. '));
    }
  }

  private async _descontarInventario(grupos: GrupoItems[]): Promise<void> {
    const grupoCocina = grupos.find((g) => g.tipo === TipoOrden.COCINA);

    if (!grupoCocina) {
      return;
    }

    for (const item of grupoCocina.items) {
      const receta = await this.recetasService.buscarPorProducto(
        item.productoId.toString(),
      );

      const ingredientesEscalados = receta.ingredientes.map((ing) => ({
        inventarioItemId: ing.inventarioItemId,
        cantidad: ing.cantidad * item.cantidad,
      }));

      await this.inventarioService.descontarPorReceta(ingredientesEscalados);
    }
  }

  private async _crearDocumentos(
    grupos: GrupoItems[],
    mesaId: string,
    meseroId: string,
  ): Promise<Types.ObjectId[]> {
    const ids: Types.ObjectId[] = [];
    const mesaObjectId = new Types.ObjectId(mesaId);
    const meseroObjectId = new Types.ObjectId(meseroId);

    for (const grupo of grupos) {
      const items = grupo.items.map((item) => ({
        producto: item.productoId,
        cantidad: item.cantidad,
        notas: item.notas,
        estadoItem: item.estadoItem,
      }));

      if (grupo.tipo === TipoOrden.COCINA) {
        const tiempoEstimadoMin = grupo.items.reduce(
          (sum, item) => sum + item.tiempoPreparacionMin * item.cantidad,
          0,
        );

        const datos = {
          mesa: mesaObjectId,
          mesero: meseroObjectId,
          items,
          estadoGeneral: OrdenEstado.PENDIENTE,
          tipo: TipoOrden.COCINA,
          tiempoEstimadoMin,
        } as Record<string, unknown>;

        const orden = await this.ordenModel.create(datos);

        ids.push(orden._id);
      } else {
        const datos = {
          mesa: mesaObjectId,
          mesero: meseroObjectId,
          items,
          estadoGeneral: OrdenEstado.PENDIENTE,
          tipo: TipoOrden.CAFETERIA,
        } as Record<string, unknown>;

        const orden = await this.ordenModel.create(datos);

        ids.push(orden._id);
      }
    }

    return ids;
  }
}
