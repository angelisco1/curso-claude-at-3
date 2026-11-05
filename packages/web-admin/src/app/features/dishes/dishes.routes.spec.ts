import { DISH_ROUTES } from './dishes.routes'

describe('DISH_ROUTES', () => {
  it('la ruta "new" tiene el título "Nuevo plato · RestTek"', () => {
    expect(DISH_ROUTES.find((r) => r.path === 'new')?.title).toBe('Nuevo plato · RestTek')
  })

  it('la ruta ":id/edit" tiene el título "Editar plato · RestTek"', () => {
    expect(DISH_ROUTES.find((r) => r.path === ':id/edit')?.title).toBe('Editar plato · RestTek')
  })
})
