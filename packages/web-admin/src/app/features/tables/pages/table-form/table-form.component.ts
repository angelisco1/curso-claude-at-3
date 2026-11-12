import { Component, inject, OnInit, signal } from '@angular/core'
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'
import { tableErrorMessage, tableErrorName } from '../../services/table-error'
import { TABLE_STATUS_LABELS } from '../../models/table.model'
import type { Table, TableStatus } from '../../models/table.model'

const INTEGER_PATTERN = /^\d+$/

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId = ''
  readonly loading = signal(false)
  readonly error = signal<string | null>(null)
  readonly numberError = signal<string | null>(null)
  /** Estado actual de la mesa (solo lectura; se cambia desde web-empleados). */
  readonly currentStatus = signal<TableStatus | null>(null)
  readonly statusLabels = TABLE_STATUS_LABELS

  readonly form = new FormGroup({
    number: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.pattern(INTEGER_PATTERN)
    ]),
    capacity: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.pattern(INTEGER_PATTERN)
    ]),
    description: new FormControl<string>('', { nonNullable: true })
  })

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    // La ruta de mesas cuelga de restaurants/:restaurantId; buscamos el param en toda la jerarquía
    this.restaurantId = this.route.pathFromRoot
      .map(r => r.snapshot.params['restaurantId'] as string | undefined)
      .find(Boolean) ?? ''
    const id = this.route.snapshot.paramMap.get('id')

    if (id && this.restaurantId) {
      this.isEditing = true
      this.tableId = id
      this.loadTable()
    }
  }

  private async loadTable(): Promise<void> {
    this.loading.set(true)
    try {
      const table: Table = await firstValueFrom(this.service.getById(this.restaurantId, this.tableId!))
      this.form.setValue({
        number: table.number,
        capacity: table.capacity,
        description: table.description ?? ''
      })
      this.currentStatus.set(table.status)
    } catch (err) {
      this.error.set(tableErrorMessage(err, 'No se pudo cargar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)
    this.numberError.set(null)

    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    const value = this.form.getRawValue()
    const dto = {
      number: Number(value.number),
      capacity: Number(value.capacity),
      description: value.description.trim() || null
    }

    this.loading.set(true)
    try {
      if (this.isEditing && this.tableId) {
        await this.store.update(this.restaurantId, this.tableId, dto)
      } else {
        await this.store.create(this.restaurantId, dto)
      }
      this.router.navigate(['/restaurants', this.restaurantId, 'tables'])
    } catch (err) {
      const message = tableErrorMessage(err, 'Error al guardar la mesa.')
      if (tableErrorName(err) === 'DuplicatedTableNumberError') {
        this.numberError.set(message)
      } else {
        this.error.set(message)
      }
    } finally {
      this.loading.set(false)
    }
  }
}
