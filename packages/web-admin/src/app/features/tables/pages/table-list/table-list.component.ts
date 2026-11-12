import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { TableStore } from '../../store/table.store'
import { tableErrorMessage } from '../../services/table-error'
import { TABLE_STATUS_LABELS } from '../../models/table.model'
import type { Table, TableStatus } from '../../models/table.model'

@Component({
  selector: 'app-table-list',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './table-list.component.html',
  styleUrl: './table-list.component.css'
})
export class TableListComponent implements OnInit {
  readonly store = inject(TableStore)
  private readonly route = inject(ActivatedRoute)
  private readonly destroyRef = inject(DestroyRef)
  restaurantId = ''

  readonly deleteError = signal<string | null>(null)

  readonly statusLabels = TABLE_STATUS_LABELS

  ngOnInit(): void {
    // Angular reutiliza el componente al cambiar de restaurante, así que hay que reaccionar a los params
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.restaurantId = params.get('restaurantId') ?? ''
        this.deleteError.set(null)
        if (this.restaurantId) {
          this.store.loadByRestaurant(this.restaurantId)
        }
      })
  }

  statusClass(status: TableStatus): string {
    return `badge status-${status}`
  }

  async onDelete(table: Table): Promise<void> {
    if (!this.restaurantId) return
    this.deleteError.set(null)
    if (!confirm(`¿Estás seguro de eliminar la mesa ${table.number}?`)) return
    try {
      await this.store.delete(this.restaurantId, table.id)
    } catch (err) {
      this.deleteError.set(tableErrorMessage(err, 'Error al eliminar la mesa.'))
    }
  }
}
