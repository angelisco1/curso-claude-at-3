import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { HttpErrorResponse } from '@angular/common/http'
import { TableService } from '../../core/services/table.service'
import { CartStore } from '../../core/store/cart.store'
import { RestaurantService } from '../../core/services/restaurant.service'
import { AvailableTable } from '../../core/models/table.model'
import { Restaurant } from '../../core/models/restaurant.model'

@Component({
  selector: 'app-table-selection',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
          <a routerLink="/restaurants" class="back-link">← Volver a restaurantes</a>
          <h1>{{ restaurant()?.name || 'Elige tu mesa' }}</h1>
          <p>Indica cuántas personas sois y elige una mesa</p>
        </div>
      </div>

      <div class="card people-form">
        <label for="people">Número de personas</label>
        <input id="people" type="number" min="1" step="1" [value]="people()"
               (input)="onPeopleInput($event)" (keyup.enter)="searchTables()" data-testid="people-input" />
        <button class="btn btn-primary" [disabled]="!validPeople() || loading()" (click)="searchTables()" data-testid="search-tables-button">
          Ver mesas
        </button>
      </div>

      @if (error()) {
        <div class="alert-error" role="alert" data-testid="table-selection-error">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="spinner"></div>
      } @else if (searched()) {
        @if (tables().length === 0) {
          <div class="empty-state" data-testid="no-tables-available">
            <p>No hay mesas disponibles para {{ searchedPeople() }} personas</p>
          </div>
        } @else {
          <div class="tables-grid" data-testid="available-tables">
            @for (table of tables(); track table.id) {
              <button type="button" class="table-card card" [class.selected]="selectedId() === table.id"
                      [attr.aria-pressed]="selectedId() === table.id"
                      [attr.data-testid]="'table-card-' + table.number"
                      (click)="select(table)">
                <strong>Mesa {{ table.number }}</strong>
                <span class="capacity">Hasta {{ table.capacity }} personas</span>
                @if (table.description) {
                  <span class="description">{{ table.description }}</span>
                }
                @if (table.occupiedByMe) {
                  <span class="badge">Tu mesa</span>
                } @else if (table.reservedForMe) {
                  <span class="badge">Reservada para ti</span>
                }
              </button>
            }
          </div>
        }

        <div class="actions">
          <button class="btn btn-primary" [disabled]="!selectedId() || occupying()" (click)="continue()" data-testid="continue-button">
            @if (occupying()) { Reservando mesa... } @else { Continuar }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { max-width: 900px; margin: 0 auto; }
    .back-link { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; display: inline-block; }
    .people-form { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .people-form input { width: 90px; }
    .tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .table-card { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 16px; text-align: left; cursor: pointer; border: 2px solid transparent; }
    .table-card.selected { border-color: var(--green-light); }
    .capacity, .description { color: var(--text-muted); font-size: 13px; }
    .actions { display: flex; justify-content: flex-end; }
  `]
})
export class TableSelectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)
  private readonly tableService = inject(TableService)
  private readonly restaurantService = inject(RestaurantService)
  private readonly cartStore = inject(CartStore)

  private restaurantId = ''

  readonly restaurant = signal<Restaurant | null>(null)
  readonly people = signal(2)
  readonly searchedPeople = signal(0)
  readonly tables = signal<AvailableTable[]>([])
  readonly selectedId = signal<string | null>(null)
  readonly searched = signal(false)
  readonly loading = signal(false)
  readonly occupying = signal(false)
  readonly error = signal<string | null>(null)

  ngOnInit(): void {
    this.restaurantId = this.route.snapshot.paramMap.get('id')!
    this.restaurantService.getById(this.restaurantId).subscribe({
      next: (restaurant) => this.restaurant.set(restaurant),
      error: () => {}
    })
  }

  validPeople(): boolean {
    const n = this.people()
    return Number.isInteger(n) && n >= 1
  }

  onPeopleInput(event: Event): void {
    this.people.set(Number((event.target as HTMLInputElement).value))
  }

  searchTables(): void {
    if (!this.validPeople()) return
    this.error.set(null)
    this.selectedId.set(null)
    this.load(this.people())
  }

  private load(people: number): void {
    this.loading.set(true)
    this.tableService.getAvailable(this.restaurantId, people).subscribe({
      next: (tables) => {
        this.tables.set(tables)
        this.searchedPeople.set(people)
        this.searched.set(true)
        this.loading.set(false)
        if (this.selectedId() && !tables.some(t => t.id === this.selectedId())) {
          this.selectedId.set(null)
        }
      },
      error: () => {
        this.error.set('Error al cargar las mesas disponibles')
        this.loading.set(false)
      }
    })
  }

  select(table: AvailableTable): void {
    this.selectedId.set(table.id)
  }

  continue(): void {
    const tableId = this.selectedId()
    if (!tableId) return
    const people = this.searchedPeople()

    this.occupying.set(true)
    this.error.set(null)
    this.tableService.occupy(this.restaurantId, tableId, people).subscribe({
      next: (table) => {
        this.cartStore.selectTable(this.restaurantId, table)
        this.occupying.set(false)
        this.router.navigate(['/restaurants', this.restaurantId])
      },
      error: (err: HttpErrorResponse) => {
        this.occupying.set(false)
        this.selectedId.set(null)
        if (err.status === 409) {
          this.error.set('La mesa ya no está disponible')
          this.load(people)
        } else {
          this.error.set('Error al ocupar la mesa. Inténtalo de nuevo.')
          this.load(people)
        }
      }
    })
  }
}
