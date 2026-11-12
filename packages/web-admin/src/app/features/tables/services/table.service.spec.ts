import { TestBed } from '@angular/core/testing'
import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { environment } from '../../../../environments/environment'
import { TableService } from './table.service'

describe('TableService', () => {
  let service: TableService
  let http: HttpTestingController
  const base = `${environment.apiUrl}/restaurants/rest-1/tables`

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] })
    service = TestBed.inject(TableService)
    http = TestBed.inject(HttpTestingController)
  })

  afterEach(() => http.verify())

  it('getAll hace GET a restaurants/:id/tables', () => {
    service.getAll('rest-1').subscribe()
    const req = http.expectOne(base)
    expect(req.request.method).toBe('GET')
    req.flush([])
  })

  it('create hace POST con el dto', () => {
    const dto = { number: 7, capacity: 4, description: null, status: 'libre' as const }
    service.create('rest-1', dto).subscribe()
    const req = http.expectOne(base)
    expect(req.request.method).toBe('POST')
    expect(req.request.body).toEqual(dto)
    req.flush({})
  })

  it('update hace PUT a /:id con el dto', () => {
    const dto = { number: 7, capacity: 6, description: 'Terraza', status: 'reservada' as const }
    service.update('rest-1', 't1', dto).subscribe()
    const req = http.expectOne(`${base}/t1`)
    expect(req.request.method).toBe('PUT')
    expect(req.request.body).toEqual(dto)
    req.flush({})
  })

  it('delete hace DELETE a /:id', () => {
    service.delete('rest-1', 't1').subscribe()
    const req = http.expectOne(`${base}/t1`)
    expect(req.request.method).toBe('DELETE')
    req.flush(null)
  })
})
