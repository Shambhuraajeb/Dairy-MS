import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import { Supplier, SupplierRequest } from './supplier.model';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly api = inject(ApiService);
  private readonly path = 'suppliers';

  list(query: PagedQuery): Observable<PagedResult<Supplier>> {
    return this.api.getPaged<Supplier>(this.path, query, { skipErrorToast: true });
  }

  create(body: SupplierRequest): Observable<Supplier> {
    return this.api.post<Supplier>(this.path, body);
  }

  update(id: number, body: SupplierRequest): Observable<Supplier> {
    return this.api.put<Supplier>(`${this.path}/${id}`, body);
  }

  /** activate / deactivate = PUT the full record with the flipped flag */
  setActive(s: Supplier, isActive: boolean): Observable<Supplier> {
    return this.update(s.id, {
      supplierCode: s.supplierCode,
      name: s.name,
      contactPerson: s.contactPerson,
      mobile: s.mobile,
      email: s.email,
      addressLine: s.addressLine,
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      gstNumber: s.gstNumber,
      panNo: s.panNo,
      paymentTermsDays: s.paymentTermsDays,
      isActive,
    });
  }
}
