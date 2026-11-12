import { Component, inject, OnInit, signal } from '@angular/core'
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms'
import { LucideAngularModule } from 'lucide-angular'
import { DiscountStore } from '../../store/discount.store'
import { discountErrorMessage } from '../../services/discount-error'
import type { Discount } from '../../models/discount.model'

const CODE_PATTERN = /^\s*[A-Za-z0-9_-]{3,30}\s*$/
const INTEGER_PATTERN = /^\d+$/

@Component({
  selector: 'app-discount-list',
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './discount-list.component.html',
  styleUrl: './discount-list.component.css'
})
export class DiscountListComponent implements OnInit {
  readonly store = inject(DiscountStore)

  readonly saving = signal(false)
  readonly formError = signal<string | null>(null)
  readonly actionError = signal<string | null>(null)
  readonly busyId = signal<string | null>(null)

  readonly form = new FormGroup({
    code: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.pattern(CODE_PATTERN)] }),
    percentage: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(100),
      Validators.pattern(INTEGER_PATTERN)
    ])
  })

  ngOnInit(): void {
    this.store.loadAll()
  }

  async onCreate(): Promise<void> {
    this.formError.set(null)
    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }
    const value = this.form.getRawValue()
    this.saving.set(true)
    try {
      await this.store.create({ code: value.code.trim().toUpperCase(), percentage: Number(value.percentage) })
      this.form.reset()
    } catch (err) {
      this.formError.set(discountErrorMessage(err, 'Error al crear el descuento.'))
    } finally {
      this.saving.set(false)
    }
  }

  async onToggle(discount: Discount): Promise<void> {
    this.actionError.set(null)
    this.busyId.set(discount.id)
    try {
      await this.store.update(discount.id, { active: !discount.active })
    } catch (err) {
      this.actionError.set(discountErrorMessage(err, 'Error al cambiar el estado del descuento.'))
    } finally {
      this.busyId.set(null)
    }
  }

  async onDelete(discount: Discount): Promise<void> {
    this.actionError.set(null)
    if (!confirm(`¿Estás seguro de eliminar el código ${discount.code}?`)) return
    this.busyId.set(discount.id)
    try {
      await this.store.delete(discount.id)
    } catch (err) {
      this.actionError.set(discountErrorMessage(err, 'Error al eliminar el descuento.'))
    } finally {
      this.busyId.set(null)
    }
  }
}
