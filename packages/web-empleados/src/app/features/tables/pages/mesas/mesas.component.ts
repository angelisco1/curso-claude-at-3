import { Component, computed, inject, OnInit } from '@angular/core';
import { AuthStore } from '@resttek/web-shared';
import { TableStore } from '../../store/table.store';
import { TABLE_STATUSES, Table, TableStatus } from '../../models/table.model';

const ROLES_CAN_CHANGE_STATUS = ['admin', 'manager', 'camarero'];

@Component({
  selector: 'app-mesas',
  standalone: true,
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  readonly tableStore = inject(TableStore);

  private readonly restaurantId = computed(() => this.authStore.user()?.restaurantId);

  /** El cocinero solo consulta: la API devuelve 403 en el PATCH de estado. */
  readonly canChangeStatus = computed(() =>
    ROLES_CAN_CHANGE_STATUS.includes(this.authStore.userRole() ?? '')
  );

  ngOnInit(): void {
    const restaurantId = this.restaurantId();
    if (restaurantId) {
      this.tableStore.loadTables(restaurantId);
    }
  }

  /** Estados a los que se puede pasar: todos menos el actual. */
  otherStatuses(table: Table): TableStatus[] {
    return TABLE_STATUSES.filter(s => s !== table.status);
  }

  changeStatus(table: Table, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const status = select.value as TableStatus;
    select.value = '';
    const restaurantId = this.restaurantId();
    if (restaurantId && status) {
      this.tableStore.updateStatus(restaurantId, table.id, status);
    }
  }

  getStatusClass(status: TableStatus): string {
    return `badge badge-mesa-${status}`;
  }
}
