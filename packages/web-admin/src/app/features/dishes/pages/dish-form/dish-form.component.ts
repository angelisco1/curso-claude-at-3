import { afterNextRender, Component, computed, ElementRef, inject, Injector, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { DishStore } from '../../store/dish.store'
import { DishService } from '../../services/dish.service'
import { IngredientStore } from '../../../ingredients/store/ingredient.store'
import type { CreateDishDto, DishCategory } from '../../models/dish.model'
import {
  validateDishForm,
  validateNewIngredient,
  type DishFormErrors,
  type NewIngredientErrors,
} from './dish-form.validation'

@Component({
  selector: 'app-dish-form',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './dish-form.component.html',
  styleUrl: './dish-form.component.css',
})
export class DishFormComponent implements OnInit {
  private readonly store = inject(DishStore)
  private readonly service = inject(DishService)
  readonly ingredientStore = inject(IngredientStore)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly injector = inject(Injector)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  isEditing = false
  dishId: string | null = null
  restaurantId: string = ''
  loading = signal(false)
  error = signal<string | null>(null)
  errors = signal<DishFormErrors>({})
  submitted = signal(false)
  ingredientErrors = signal<NewIngredientErrors>({})
  liveMessage = signal('')

  readonly errorList = computed(() => {
    const errors = this.errors()
    const fields = [
      { id: 'dish-name', message: errors.name },
      { id: 'dish-price', message: errors.price },
    ]
    return fields.filter((f): f is { id: string; message: string } => !!f.message)
  })

  readonly errorSummary = computed(() => {
    const count = this.errorList().length
    return `Revisa los campos marcados: ${count} ${count === 1 ? 'error' : 'errores'}`
  })

  categories: DishCategory[] = ['entrante', 'principal', 'postre', 'bebida']

  form: CreateDishDto = {
    name: '',
    description: null,
    price: 0,
    category: 'principal',
    available: true,
    ingredients: [],
  }

  newIngredientId = ''
  newIngredientQty = 1

  get pageTitle(): string {
    return this.isEditing ? 'Editar plato' : 'Nuevo plato'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/dishes`
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      entrante: 'Entrante',
      principal: 'Principal',
      postre: 'Postre',
      bebida: 'Bebida',
    }
    return labels[category] ?? category
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (this.restaurantId) {
      this.ingredientStore.loadByRestaurant(this.restaurantId)
    }

    if (id && this.restaurantId) {
      this.isEditing = true
      this.dishId = id
      this.loadDish()
    }
  }

  private async loadDish(): Promise<void> {
    this.loading.set(true)
    try {
      const dish = await firstValueFrom(this.service.getById(this.restaurantId, this.dishId!))
      this.form = {
        name: dish.name,
        description: dish.description,
        price: dish.price,
        category: dish.category,
        available: dish.available,
        ingredients: [...dish.ingredients],
      }
    } catch {
      this.error.set('No se pudo cargar el plato.')
    } finally {
      this.loading.set(false)
    }
  }

  addIngredient(): void {
    const errors = validateNewIngredient(this.newIngredientId, this.newIngredientQty, this.form.ingredients)
    this.ingredientErrors.set(errors)
    if (errors.ingredient || errors.quantity) {
      const fieldId = errors.ingredient ? 'new-ingredient' : 'new-ingredient-qty'
      afterNextRender(() => this.focusField(fieldId), { injector: this.injector })
      return
    }

    this.form.ingredients = [
      ...this.form.ingredients,
      { ingredientId: this.newIngredientId, quantity: this.newIngredientQty },
    ]
    this.liveMessage.set(`${this.getIngredientName(this.newIngredientId)} añadido`)
    this.newIngredientId = ''
    this.newIngredientQty = 1
    afterNextRender(() => this.focusField('new-ingredient'), { injector: this.injector })
  }

  removeIngredient(ingredientId: string): void {
    const index = this.form.ingredients.findIndex((i) => i.ingredientId === ingredientId)
    if (index === -1) return

    const name = this.getIngredientName(ingredientId)
    this.form.ingredients = this.form.ingredients.filter((i) => i.ingredientId !== ingredientId)
    this.liveMessage.set(`${name} eliminado`)

    // El botón enfocado desaparece: el foco pasa al siguiente "Quitar" (o al anterior, o al select si no quedan)
    const remaining = this.form.ingredients.length
    afterNextRender(
      () => {
        if (remaining === 0) {
          this.focusField('new-ingredient')
          return
        }
        const buttons = this.host.nativeElement.querySelectorAll<HTMLElement>('.chip-remove')
        buttons[Math.min(index, remaining - 1)]?.focus()
      },
      { injector: this.injector },
    )
  }

  getIngredientName(ingredientId: string): string {
    const ingredient = this.ingredientStore.ingredients().find((i) => i.id === ingredientId)
    return ingredient ? `${ingredient.name} (${ingredient.unit})` : ingredientId
  }

  focusField(id: string, event?: Event): void {
    event?.preventDefault()
    this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus()
  }

  async onSubmit(): Promise<void> {
    this.submitted.set(true)
    const errors = validateDishForm(this.form)
    this.errors.set(errors)
    if (Object.keys(errors).length > 0) {
      afterNextRender(() => this.focusField(this.errorList()[0].id), { injector: this.injector })
      return
    }

    this.error.set(null)
    this.loading.set(true)
    try {
      if (this.isEditing && this.dishId) {
        await this.store.update(this.restaurantId, this.dishId, this.form)
      } else {
        await this.store.create(this.restaurantId, this.form)
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'dishes'])
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al guardar el plato.')
    } finally {
      this.loading.set(false)
    }
  }
}
