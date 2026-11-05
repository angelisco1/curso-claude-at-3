import { importProvidersFrom, provideZonelessChangeDetection, signal } from '@angular/core'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { ActivatedRoute, provideRouter } from '@angular/router'
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
})
