import { z } from 'zod';

import { Role } from '../../common/constants/roles.enum.js';

export const UpdateUsuarioRolesSchema = z.object({
  roles: z.nativeEnum(Role).array().min(1),
});

export type UpdateUsuarioRolesDto = z.infer<typeof UpdateUsuarioRolesSchema>;
