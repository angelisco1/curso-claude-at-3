import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { RestaurantService } from '../../core/services/restaurant.service'
import { CartStore } from '../../core/store/cart.store'
import { TableService } from '../../core/services/table.service'
import { Restaurant } from '../../core/models/restaurant.model'
import { Table } from '../../core/models/table.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>{{ restaurant()?.name || 'Cargando...' }}</h1>
          <p>Indica cuántos sois y elige una mesa</p>
        </div>
      </div>

      <form class="people-form card" (submit)="$event.preventDefault(); search()">
        <label for="people">Número de comensales</label>
        <input id="people" type="number" min="1" step="1" [value]="people()"
               (input)="onPeopleInput($event)" />
        <button type="submit" class="btn btn-primary" [disabled]="!isPeopleValid() || loading()">
          Ver mesas
        </button>
      </form>

      @if (error()) {
        <div class="alert-error">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (searched()) {
        @if (tables().length === 0) {
          <div class="empty-state card">
            <p>No hay mesas disponibles para {{ searchedPeople() }} personas</p>
          </div>
        } @else {
          <div class="tables-grid">
            @for (table of tables(); track table.id) {
              <button type="button" class="table-card card"
                      [class.selected]="selected()?.id === table.id"
                      (click)="select(table)">
                <h3>Mesa {{ table.number }}</h3>
                <p class="capacity">Hasta {{ table.capacity }} personas</p>
                @if (table.description) {
                  <p class="description">{{ table.description }}</p>
                }
                @if (table.reservedForMe) {
                  <span class="badge-reserved">Tu reserva</span>
                }
              </button>
            }
          </div>
        }

        <div class="actions">
          <button type="button" class="btn btn-primary" [disabled]="!selected() || occupying()"
                  (click)="continue()">
            Continuar
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .back-link {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 8px;
      display: inline-block;
    }
    .people-form {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .people-form input {
      width: 100px;
    }
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .table-card {
      text-align: left;
      padding: 16px 20px;
      cursor: pointer;
      transition: all var(--transition);
    }
    .table-card:hover,
    .table-card.selected {
      border-color: var(--green-medium);
    }
    .table-card.selected {
      background: var(--green-glow);
    }
    .table-card h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .capacity {
      color: var(--text-secondary);
      font-size: 13px;
    }
    .description {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 4px;
    }
    .badge-reserved {
      display: inline-block;
      margin-top: 8px;
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      background: var(--green-glow);
      color: var(--green-light);
      font-size: 12px;
      font-weight: 600;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly cartStore = inject(CartStore)
  private readonly restaurantService = inject(RestaurantService)
  private readonly tableService = inject(TableService)

  private restaurantId = ''

  readonly restaurant = signal<Restaurant | null>(null)
  readonly people = signal(2)
  readonly tables = signal<Table[]>([])
  readonly selected = signal<Table | null>(null)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly searched = signal(false)
  readonly searchedPeople = signal(0)
  readonly error = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    this.restaurantService.getById(this.restaurantId).subscribe({
      next: (restaurant) => this.restaurant.set(restaurant),
      error: () => {}
    })
  }

  isPeopleValid(): boolean {
    return Number.isInteger(this.people()) && this.people() >= 1
  }

  onPeopleInput(event: Event): void {
    this.people.set(Number((event.target as HTMLInputElement).value))
  }

  search(): void {
    if (!this.isPeopleValid()) return
    this.error.set(null)
    this.loadTables()
  }

  private loadTables(): void {
    const people = this.people()

    this.loading.set(true)
    this.selected.set(null)

    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedPeople.set(people)
        this.searched.set(true)
        this.loading.set(false)
      },
      error: () => {
        this.error.set('Error al cargar las mesas disponibles')
        this.loading.set(false)
      }
    })
  }

  select(table: Table): void {
    this.selected.set(table)
  }

  continue(): void {
    const table = this.selected()
    if (!table || this.occupying()) return

    this.occupying.set(true)
    this.error.set(null)

    this.tableService.occupy(this.restaurantId, table.id, this.people()).subscribe({
      next: (occupied) => {
        this.cartStore.selectTable(this.restaurantId, occupied)
        this.occupying.set(false)
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err) => {
        this.occupying.set(false)
        if (err.status === 409 || err.status === 404) {
          this.error.set('La mesa ya no está disponible')
          this.loadTables()
        } else if (err.status === 400) {
          this.error.set(err.error?.message ?? 'Número de comensales no válido')
        } else {
          this.error.set('Error al ocupar la mesa. Inténtalo de nuevo.')
        }
      }
    })
  }
}
