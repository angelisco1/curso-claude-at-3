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
      const tables = await firstValueFrom(this.tableService.getAll(restaurantId));
      this._tables.set(tables);
      this._error.set(null);
    } catch (err: any) {
      this._error.set(this.errorMessage(err, 'Error al cargar mesas'));
    } finally {
      this._loading.set(false);
    }
  }

  async updateStatus(restaurantId: string, tableId: string, status: TableStatus): Promise<void> {
    const previous = this._tables();
    this._error.set(null);
    this._tables.update(tables =>
      tables.map(t => (t.id === tableId ? { ...t, status, reservedFor: null } : t))
    );
    try {
      const updated = await firstValueFrom(
        this.tableService.updateStatus(restaurantId, tableId, { status })
      );
      this._tables.update(tables => tables.map(t => (t.id === tableId ? updated : t)));
    } catch (err: any) {
      this._tables.set(previous);
      this._error.set(this.errorMessage(err, 'Error al actualizar el estado de la mesa'));
    }
  }

  clear(): void {
    this._tables.set([]);
    this._error.set(null);
  }

  private errorMessage(err: any, fallback: string): string {
    return err?.error?.message ?? err?.error?.error ?? err?.message ?? fallback;
  }
}
