import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  AnimalDetail,
  AnimalDueItem,
  AnimalListItem,
  AnimalRequest,
  Breed,
  BreedRequest,
  DeathRequest,
  LifecycleEvent,
  SaleRequest,
} from './animal.model';

export type AnimalRecordRow = Record<string, unknown> & { id: number; animalId: number };

@Injectable({ providedIn: 'root' })
export class AnimalService {
  private readonly api = inject(ApiService);

  list(q: PagedQuery): Observable<PagedResult<AnimalListItem>> {
    return this.api.getPaged<AnimalListItem>('animals', q, { skipErrorToast: true });
  }

  due(q: PagedQuery): Observable<PagedResult<AnimalDueItem>> {
    return this.api.getPaged<AnimalDueItem>('animals/due', q, { skipErrorToast: true }).pipe(
      map((r) => ({
        ...r,
        items: r.items.map((x, i) => ({ ...x, id: `${x.dueType}-${x.refId ?? x.animalId}-${i}` })),
      })),
    );
  }

  get(id: number | string): Observable<AnimalDetail> {
    return this.api.get<AnimalDetail>(`animals/${id}`, undefined, { skipErrorToast: true });
  }

  create(body: AnimalRequest): Observable<AnimalDetail> {
    return this.api.post<AnimalDetail>('animals', body);
  }

  update(id: number | string, body: AnimalRequest): Observable<AnimalDetail> {
    return this.api.put<AnimalDetail>(`animals/${id}`, body);
  }

  sell(id: number, body: SaleRequest): Observable<AnimalDetail> {
    return this.api.post<AnimalDetail>(`animals/${id}/sale`, body);
  }

  markDead(id: number, body: DeathRequest): Observable<AnimalDetail> {
    return this.api.post<AnimalDetail>(`animals/${id}/death`, body);
  }

  archive(id: number, reason: string | null): Observable<AnimalDetail> {
    return this.api.post<AnimalDetail>(`animals/${id}/archive`, reason ? { reason } : {});
  }

  lifecycle(id: number): Observable<LifecycleEvent[]> {
    return this.api.get<LifecycleEvent[]>(`animals/${id}/lifecycle`, undefined, { skipErrorToast: true });
  }

  // ---- per-animal records (health, vaccinations, ...) ------------------------
  records(animalId: number, resource: string, q: PagedQuery): Observable<PagedResult<AnimalRecordRow>> {
    return this.api.getPaged<AnimalRecordRow>(`animals/${animalId}/${resource}`, q, { skipErrorToast: true });
  }

  createRecord(animalId: number, resource: string, body: object): Observable<AnimalRecordRow> {
    return this.api.post<AnimalRecordRow>(`animals/${animalId}/${resource}`, body);
  }

  updateRecord(animalId: number, resource: string, id: number, body: object): Observable<AnimalRecordRow> {
    return this.api.put<AnimalRecordRow>(`animals/${animalId}/${resource}/${id}`, body);
  }

  deleteRecord(animalId: number, resource: string, id: number): Observable<unknown> {
    return this.api.delete(`animals/${animalId}/${resource}/${id}`);
  }

  // ---- breeds ---------------------------------------------------------------
  breeds(q: PagedQuery): Observable<PagedResult<Breed>> {
    return this.api.getPaged<Breed>('breeds', q, { skipErrorToast: true });
  }

  createBreed(body: BreedRequest): Observable<Breed> {
    return this.api.post<Breed>('breeds', body);
  }

  updateBreed(id: number, body: BreedRequest): Observable<Breed> {
    return this.api.put<Breed>(`breeds/${id}`, body);
  }

  deactivateBreed(id: number): Observable<Breed> {
    return this.api.delete<Breed>(`breeds/${id}`);
  }
}
