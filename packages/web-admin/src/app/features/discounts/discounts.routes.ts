import type { Routes } from '@angular/router'

export const DISCOUNT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/discount-list/discount-list.component').then(m => m.DiscountListComponent)
  }
]
