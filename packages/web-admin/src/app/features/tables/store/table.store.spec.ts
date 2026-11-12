import { TestBed } from '@angular/core/testing'
import { of, throwError, Subject } from 'rxjs'
import { TableService } from '../services/table.service'
import { TableStore } from './table.store'
import type { Table } from '../models/table.model'

const mk = (id: string, number: number, extra: Partial<Table> = {}): Table => ({
  id, restaurantId: 'rest-1', number, description: null, capacity: 4,
  status: 'libre', reservedFor: null, createdAt: '', updatedAt: '', ...extra
})

describe('TableStore', () => {
  let store: TableStore
  let service: { getAll: any; create: any; update: any; delete: any }

  beforeEach(() => {
    service = { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }
    TestBed.configureTestingModule({ providers: [{ provide: TableService, useValue: service }] })
    store = TestBed.inject(TableStore)
  })

  it('loadByRestaurant carga las mesas', async () => {
    service.getAll.mockReturnValue(of([mk('a', 1)]))
    await store.loadByRestaurant('rest-1')
    expect(store.tables().map(t => t.id)).toEqual(['a'])
    expect(store.loading()).toBe(false)
    expect(store.error()).toBeNull()
  })

  it('loadByRestaurant fija error si falla', async () => {
    service.getAll.mockReturnValue(throwError(() => new Error('x')))
    await store.loadByRestaurant('rest-1')
    expect(store.error()).toBe('No se pudieron cargar las mesas.')
  })

  it('ignora la respuesta de un restaurante que ya no es el actual', async () => {
    const first = new Subject<Table[]>()
    service.getAll.mockReturnValueOnce(first).mockReturnValueOnce(of([mk('b', 2)]))
    const p1 = store.loadByRestaurant('rest-1')
    await store.loadByRestaurant('rest-2')
    first.next([mk('a', 1)])
    first.complete()
    await p1
    expect(store.tables().map(t => t.id)).toEqual(['b'])
  })

  it('create añade y mantiene el orden por número', async () => {
    service.getAll.mockReturnValue(of([mk('a', 1), mk('c', 3)]))
    await store.loadByRestaurant('rest-1')
    service.create.mockReturnValue(of(mk('b', 2)))
    await store.create('rest-1', { number: 2, capacity: 4 })
    expect(store.tables().map(t => t.number)).toEqual([1, 2, 3])
  })

  it('update reemplaza la mesa', async () => {
    service.getAll.mockReturnValue(of([mk('a', 1)]))
    await store.loadByRestaurant('rest-1')
    service.update.mockReturnValue(of(mk('a', 1, { capacity: 6 })))
    await store.update('rest-1', 'a', { number: 1, capacity: 6 })
    expect(store.tables()[0].capacity).toBe(6)
  })

  it('delete elimina la mesa; si falla conserva la lista y propaga el error', async () => {
    service.getAll.mockReturnValue(of([mk('a', 1)]))
    await store.loadByRestaurant('rest-1')
    service.delete.mockReturnValue(throwError(() => ({ status: 409 })))
    await expect(store.delete('rest-1', 'a')).rejects.toEqual({ status: 409 })
    expect(store.tables().length).toBe(1)
    service.delete.mockReturnValue(of(undefined))
    await store.delete('rest-1', 'a')
    expect(store.tables()).toEqual([])
  })
})
