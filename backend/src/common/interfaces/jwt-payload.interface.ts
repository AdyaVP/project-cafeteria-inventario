import { Role } from '../constants/roles.enum.js';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
}
