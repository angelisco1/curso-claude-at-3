import { importProvidersFrom, provideZonelessChangeDetection, signal } from '@angular/core'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { ActivatedRoute, Router, provideRouter } from '@angular/router'
import { LucideAngularModule, ChevronLeft, Plus, Trash2, CircleAlert } from 'lucide-angular'
import { DishFormComponent } from './dish-form.component'
import { DishStore } from '../../store/dish.store'
import { DishService } from '../../services/dish.service'
import { IngredientStore } from '../../../ingredients/store/ingredient.store'
import type { Ingredient } from '../../../ingredients/models/ingredient.model'

export const INGREDIENTS: Ingredient[] = [
  { id: 'ing-1', name: 'Tomate', unit: 'kg', currentStock: 10, restaurantId: 'rest-1', createdAt: '', updatedAt: '' },
  { id: 'ing-2', name: 'Queso', unit: 'kg', currentStock: 5, restaurantId: 'rest-1', createdAt: '', updatedAt: '' }
] as Ingredient[]

async function setup() {
  const dishStore = { create: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) }
  const dishService = { getById: vi.fn() }
  const ingredientStore = { ingredients: signal(INGREDIENTS), loadByRestaurant: vi.fn() }

  TestBed.configureTestingModule({
    imports: [DishFormComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { parent: { snapshot: { params: { restaurantId: 'rest-1' } } }, snapshot: { paramMap: { get: () => null } } } },
      { provide: DishStore, useValue: dishStore },
      { provide: DishService, useValue: dishService },
      { provide: IngredientStore, useValue: ingredientStore },
      importProvidersFrom(LucideAngularModule.pick({ ChevronLeft, Plus, Trash2, CircleAlert }))
    ]
  })

  const fixture: ComponentFixture<DishFormComponent> = TestBed.createComponent(DishFormComponent)
  fixture.detectChanges()
  await fixture.whenStable()
  const el: HTMLElement = fixture.nativeElement
  return { fixture, el, component: fixture.componentInstance, dishStore, dishService, ingredientStore }
}

describe('DishFormComponent', () => {
  describe('estructura semántica', () => {
    it('renderiza un h1 "Nuevo plato" y un h2 "Ingredientes del plato"', async () => {
      const { el } = await setup()

      expect(el.querySelector('h1')?.textContent?.trim()).toBe('Nuevo plato')
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Ingredientes del plato')
    })
  })

  describe('etiquetas', () => {
    it.each([
      ['dish-name', 'Nombre del plato'],
      ['dish-price', 'Precio (€)'],
      ['dish-category', 'Categoría'],
      ['dish-available', 'Disponible'],
      ['dish-description', 'Descripción (opcional)'],
      ['new-ingredient', 'Ingrediente'],
      ['new-ingredient-qty', 'Cantidad']
    ])('el control #%s está asociado a su label "%s"', async (id, text) => {
      const { el } = await setup()

      const label = el.querySelector(`label[for="${id}"]`)
      expect(label?.textContent).toContain(text)
      expect(el.querySelector(`#${id}`)).not.toBeNull()
    })

    it.each(['dish-name', 'dish-price'])('#%s es obligatorio (required y aria-required)', async (id) => {
      const { el } = await setup()

      const input = el.querySelector(`#${id}`)!
      expect(input.hasAttribute('required')).toBe(true)
      expect(input.getAttribute('aria-required')).toBe('true')
      expect(el.querySelector(`label[for="${id}"]`)?.textContent).toContain('(obligatorio)')
    })

    it('el precio es decimal, con paso 0.01 y mínimo 0; el nombre no autocompleta', async () => {
      const { el } = await setup()

      const price = el.querySelector('#dish-price')!
      expect(price.getAttribute('step')).toBe('0.01')
      expect(price.getAttribute('min')).toBe('0')
      expect(price.getAttribute('inputmode')).toBe('decimal')
      expect(el.querySelector('#dish-name')!.getAttribute('autocomplete')).toBe('off')
    })
  })

  describe('formulario y acciones', () => {
    it('envuelve los campos en un <form> con "Guardar" como botón submit', async () => {
      const { el } = await setup()

      expect(el.querySelector('form')).not.toBeNull()
      const save = el.querySelector('form button[type="submit"]')
      expect(save?.textContent?.trim()).toBe('Guardar')
    })

    it('"Cancelar" es un enlace a la lista de platos', async () => {
      const { el } = await setup()

      const cancel = Array.from(el.querySelectorAll('a')).find(a => a.textContent?.trim() === 'Cancelar')
      expect(cancel).toBeDefined()
      expect(cancel!.getAttribute('href')).toBe('/restaurants/rest-1/dishes')
    })

    it('el enlace "volver" tiene nombre accesible', async () => {
      const { el } = await setup()

      const back = el.querySelector('a.back-link')
      expect(back?.getAttribute('aria-label')).toBe('Volver a la lista de platos')
    })

    it('todos los iconos están ocultos para tecnologías de apoyo', async () => {
      const { el } = await setup()

      const icons = Array.from(el.querySelectorAll('lucide-icon'))
      expect(icons.length).toBeGreaterThan(0)
      icons.forEach(icon => expect(icon.getAttribute('aria-hidden')).toBe('true'))
    })

    it('al enviar el <form> se llama a onSubmit', async () => {
      const { el, component } = await setup()
      const spy = vi.spyOn(component, 'onSubmit').mockResolvedValue()

      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }))

      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('botones de ingredientes', () => {
    it('el botón de añadir es un button con nombre accesible y llama a addIngredient', async () => {
      const { el, component } = await setup()
      const spy = vi.spyOn(component, 'addIngredient')

      const add = el.querySelector<HTMLButtonElement>('button[type="button"][aria-label="Añadir ingrediente"]')
      expect(add).not.toBeNull()
      add!.click()

      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('agrupa el bloque de añadir en un fieldset con legend oculta', async () => {
      const { el } = await setup()

      const legend = el.querySelector('fieldset > legend.visually-hidden')
      expect(legend?.textContent?.trim()).toBe('Añadir ingrediente')
    })

    it('lista los ingredientes en una ul con un botón "Quitar" accesible por chip', async () => {
      const { fixture, el, component } = await setup()
      const spy = vi.spyOn(component, 'removeIngredient')
      component.form.ingredients = [{ ingredientId: 'ing-1', quantity: 2 }]
      fixture.detectChanges()

      expect(el.querySelectorAll('ul.ingredient-chips > li.ingredient-chip')).toHaveLength(1)
      const remove = el.querySelector<HTMLButtonElement>('li button[type="button"][aria-label="Quitar Tomate (kg)"]')
      expect(remove).not.toBeNull()
      remove!.click()

      expect(spy).toHaveBeenCalledWith('ing-1')
    })
  })

  describe('envío', () => {
    it('no llama al store si hay errores y los expone en errors()', async () => {
      const { component, dishStore } = await setup()
      component.form.name = ''

      await component.onSubmit()

      expect(dishStore.create).not.toHaveBeenCalled()
      expect(component.errors().name).toBe('El nombre es obligatorio')
      expect(component.submitted()).toBe(true)
    })

    it('con datos válidos crea el plato y navega a la lista', async () => {
      const { component, dishStore } = await setup()
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
      component.form.name = 'Pizza'
      component.form.price = 10

      await component.onSubmit()

      expect(dishStore.create).toHaveBeenCalledWith('rest-1', component.form)
      expect(component.errors()).toEqual({})
      expect(navigate).toHaveBeenCalledWith(['/restaurants', 'rest-1', 'dishes'])
    })
  })
})
