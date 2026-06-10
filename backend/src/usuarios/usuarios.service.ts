import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { Usuario, UsuarioDocument } from './schemas/usuario.schema.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioRolesDto } from './dto/update-usuario.dto.js';
import { UsuarioResponse } from './interfaces/usuario-response.interface.js';

const SALT_ROUNDS = 12;

const MSG_EMAIL_DUPLICADO = 'Ya existe un usuario con este email';
const MSG_USUARIO_NO_ENCONTRADO = 'Usuario no encontrado';
const MSG_ID_INVALIDO = 'ID de usuario inválido';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  async crear(dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    const existente = await this.usuarioModel.findOne({ email: dto.email });
    if (existente) {
      throw new ConflictException(MSG_EMAIL_DUPLICADO);
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = await this.usuarioModel.create({
      ...dto,
      password: hashedPassword,
    });

    return this._toResponse(usuario);
  }

  async buscarPorEmail(email: string): Promise<UsuarioDocument> {
    const usuario = await this.usuarioModel
      .findOne({ email })
      .select('+password');

    if (!usuario) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    return usuario;
  }

  async buscarPorId(id: string): Promise<UsuarioResponse> {
    this._validarObjectId(id);

    const usuario = await this.usuarioModel.findById(id);
    if (!usuario) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    return this._toResponse(usuario);
  }

  async listarTodos(): Promise<UsuarioResponse[]> {
    const usuarios = await this.usuarioModel
      .find({ activo: true })
      .sort({ nombre: 1 });

    return usuarios.map((doc) => this._toResponse(doc));
  }

  async actualizarRoles(
    id: string,
    dto: UpdateUsuarioRolesDto,
  ): Promise<UsuarioResponse> {
    this._validarObjectId(id);

    const usuario = await this.usuarioModel.findByIdAndUpdate(
      id,
      { roles: dto.roles },
      { new: true },
    );

    if (!usuario) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }

    return this._toResponse(usuario);
  }

  async desactivar(id: string): Promise<void> {
    this._validarObjectId(id);

    const usuario = await this.usuarioModel.findByIdAndUpdate(id, {
      activo: false,
    });

    if (!usuario) {
      throw new NotFoundException(MSG_USUARIO_NO_ENCONTRADO);
    }
  }

  private _toResponse(doc: UsuarioDocument): UsuarioResponse {
    return {
      id: doc._id.toString(),
      nombre: doc.nombre,
      email: doc.email,
      roles: doc.roles,
      activo: doc.activo,
      createdAt: doc.createdAt,
    };
  }

  private _validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(MSG_ID_INVALIDO);
    }
  }
}
