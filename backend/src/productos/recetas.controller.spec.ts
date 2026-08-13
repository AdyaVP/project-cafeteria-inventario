import { Role } from '../common/constants/roles.enum';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { RecetasController } from './recetas.controller';

describe('RecetasController', () => {
  it('restringe la actualización de recetas al rol ADMIN', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      RecetasController.prototype.actualizar,
    ) as Role[] | undefined;

    expect(roles).toEqual([Role.ADMIN]);
  });
});
