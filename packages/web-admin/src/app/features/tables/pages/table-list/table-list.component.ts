import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { TableStore } from '../../store/table.store'
import { tableErrorMessage } from '../../table-errors'

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
  readonly actionError = signal<string | null>(null)

  ngOnInit(): void {
    // Angular reutiliza el componente al cambiar de restaurante, así que hay que reaccionar a los params
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.restaurantId = params.get('restaurantId') ?? ''
        this.actionError.set(null)
        if (this.restaurantId) {
          this.store.loadByRestaurant(this.restaurantId)
        }
      })
  }

  async onDelete(id: string): Promise<void> {
    if (!this.restaurantId) return
    this.actionError.set(null)
    if (confirm('¿Estás seguro de eliminar esta mesa?')) {
      try {
        await this.store.delete(this.restaurantId, id)
      } catch (err) {
        this.actionError.set(tableErrorMessage(err, 'Error al eliminar la mesa.'))
      }
    }
  }
}
