import { UsuarioResponse } from '../../usuarios/interfaces/usuario-response.interface.js';

export interface AuthResponse {
  user: UsuarioResponse;
  message: string;
}
