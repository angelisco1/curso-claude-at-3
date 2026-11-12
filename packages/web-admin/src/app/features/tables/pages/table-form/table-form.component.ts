import { Component, inject, OnInit, signal } from '@angular/core'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { LucideAngularModule } from 'lucide-angular'
import { firstValueFrom } from 'rxjs'
import { TableStore } from '../../store/table.store'
import { TableService } from '../../services/table.service'
import { tableErrorMessage } from '../../table-errors'
import { TABLE_STATUSES } from '../../models/table.model'
import type { CreateTableDto, TableStatus } from '../../models/table.model'

@Component({
  selector: 'app-table-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LucideAngularModule],
  templateUrl: './table-form.component.html',
  styleUrl: './table-form.component.css'
})
export class TableFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder)
  private readonly store = inject(TableStore)
  private readonly service = inject(TableService)
  private readonly route = inject(ActivatedRoute)
  private readonly router = inject(Router)

  isEditing = false
  tableId: string | null = null
  restaurantId = ''
  loading = signal(false)
  error = signal<string | null>(null)

  readonly statuses = TABLE_STATUSES

  readonly form = this.fb.nonNullable.group({
    number: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    capacity: [2, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    description: [''],
    status: ['libre' as TableStatus, Validators.required]
  })

  get pageTitle(): string {
    return this.isEditing ? 'Editar mesa' : 'Nueva mesa'
  }

  get listUrl(): string {
    return `/restaurants/${this.restaurantId}/tables`
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.params['restaurantId'] ?? ''
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
      const tables = await firstValueFrom(this.service.getAll(this.restaurantId))
      const found = tables.find(t => t.id === this.tableId)
      if (found) {
        this.form.setValue({
          number: found.number,
          capacity: found.capacity,
          description: found.description ?? '',
          status: found.status
        })
      } else {
        this.error.set('La mesa no existe.')
      }
    } catch {
      this.error.set('No se pudo cargar la mesa.')
    } finally {
      this.loading.set(false)
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set(null)
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    const raw = this.form.getRawValue()
    const dto: CreateTableDto = {
      number: Number(raw.number),
      capacity: Number(raw.capacity),
      description: raw.description.trim() || null,
      status: raw.status
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
      this.error.set(tableErrorMessage(err, 'Error al guardar la mesa.'))
    } finally {
      this.loading.set(false)
    }
  }
}
