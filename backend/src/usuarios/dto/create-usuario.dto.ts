import { z } from 'zod';

import { Role } from '../../common/constants/roles.enum.js';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MESSAGE =
  'La contraseña debe contener al menos una mayúscula, una minúscula y un número';

export const CreateUsuarioSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).regex(PASSWORD_REGEX, PASSWORD_MESSAGE),
  roles: z
    .nativeEnum(Role)
    .array()
    .min(1)
    .default([Role.MESERO]),
});

export type CreateUsuarioDto = z.infer<typeof CreateUsuarioSchema>;
