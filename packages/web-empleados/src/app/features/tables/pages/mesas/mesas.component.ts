import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AuthStore } from '@resttek/web-shared';
import { OrderStore } from '../../../orders/store/order.store';
import { TableStore } from '../../store/table.store';
import { Table, TableStatus } from '../../models/table.model';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);
  readonly orderStore = inject(OrderStore);

  readonly statuses: TableStatus[] = ['libre', 'ocupada', 'reservada'];
  /** Mesa a la que se le está pidiendo el email de la reserva. */
  readonly reserving = signal<string | null>(null);
  readonly reservationEmail = signal('');

  private intervalId: ReturnType<typeof setInterval> | null = null;

  private get restaurantId(): string | undefined {
    return this.authStore.user()?.restaurantId ?? undefined;
  }

  ngOnInit(): void {
    const restaurantId = this.restaurantId;
    if (!restaurantId) return;
    this.orderStore.startPolling(restaurantId);
    this.tableStore.loadTables(restaurantId);
    this.intervalId = setInterval(() => this.tableStore.loadTables(restaurantId), 30000);
  }

  ngOnDestroy(): void {
    this.orderStore.stopPolling();
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  ordersFor(table: Table) {
    return this.orderStore.orders().filter(o => o.tableId === table.id);
  }

  onStatusChange(table: Table, status: TableStatus): void {
    if (status === table.status) return;
    if (status === 'reservada') {
      this.reservationEmail.set('');
      this.reserving.set(table.id);
      return;
    }
    this.reserving.set(null);
    this.change(table, status);
  }

  confirmReservation(table: Table): void {
    this.reserving.set(null);
    this.change(table, 'reservada', this.reservationEmail().trim() || null);
  }

  cancelReservation(): void {
    this.reserving.set(null);
  }

  onEmailInput(event: Event): void {
    this.reservationEmail.set((event.target as HTMLInputElement).value);
  }

  private change(table: Table, status: TableStatus, email?: string | null): void {
    const restaurantId = this.restaurantId;
    if (restaurantId) this.tableStore.updateStatus(restaurantId, table.id, status, email);
  }
}
