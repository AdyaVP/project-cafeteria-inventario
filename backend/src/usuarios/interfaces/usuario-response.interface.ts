import { Role } from '../../common/constants/roles.enum.js';

export interface UsuarioResponse {
  id: string;
  nombre: string;
  email: string;
  roles: Role[];
  activo: boolean;
  createdAt: Date;
}
