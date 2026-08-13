import { UpdateRecetaSchema } from './update-receta.dto';

describe('UpdateRecetaSchema', () => {
  const inventarioItemId = '507f1f77bcf86cd799439011';

  it('acepta una lista válida de ingredientes', () => {
    expect(
      UpdateRecetaSchema.safeParse({
        ingredientes: [{ inventarioItemId, cantidad: 0.01 }],
      }).success,
    ).toBe(true);
  });

  it.each([
    { ingredientes: [] },
    { ingredientes: [{ inventarioItemId: 'invalido', cantidad: 1 }] },
    { ingredientes: [{ inventarioItemId, cantidad: 0 }] },
    {
      ingredientes: [
        { inventarioItemId, cantidad: 1 },
        { inventarioItemId, cantidad: 2 },
      ],
    },
    { ingredientes: [{ inventarioItemId, cantidad: 1 }], productoId: 'x' },
  ])('rechaza el payload inválido %#', (payload) => {
    expect(UpdateRecetaSchema.safeParse(payload).success).toBe(false);
  });
});
