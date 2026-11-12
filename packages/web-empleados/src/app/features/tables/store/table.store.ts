import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Table, TableStatus } from '../models/table.model';
import { TableService } from '../services/table.service';

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly tableService = inject(TableService);

  private readonly _tables = signal<Table[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly tables = this._tables.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  async loadTables(restaurantId: string): Promise<void> {
    this._loading.set(true);
    try {
      const tables = await firstValueFrom(this.tableService.getTables(restaurantId));
      this._tables.set(tables);
      this._error.set(null);
    } catch (err: any) {
      this._error.set(err.error?.message || err.message || 'Error al cargar mesas');
    } finally {
      this._loading.set(false);
    }
  }

  async updateStatus(
    restaurantId: string,
    tableId: string,
    status: TableStatus,
    reservedForEmail?: string | null
  ): Promise<boolean> {
    const previous = this._tables();
    this._error.set(null);
    // Actualización optimista
    this._tables.update(tables =>
      tables.map(t =>
        t.id === tableId
          ? {
              ...t,
              status,
              reservedForEmail: status === 'reservada' ? (reservedForEmail || null) : null,
              reservedForClientId: status === 'reservada' ? t.reservedForClientId : null,
              occupiedByClientId: null
            }
          : t
      )
    );
    try {
      const updated = await firstValueFrom(
        this.tableService.updateStatus(restaurantId, tableId, {
          status,
          ...(status === 'reservada' && reservedForEmail ? { reservedForEmail } : {})
        })
      );
      this._tables.update(tables => tables.map(t => (t.id === tableId ? updated : t)));
      return true;
    } catch (err: any) {
      this._tables.set(previous);
      this._error.set(err.error?.message || err.message || 'Error al actualizar la mesa');
      return false;
    }
  }
}
