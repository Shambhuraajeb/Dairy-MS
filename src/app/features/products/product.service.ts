import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedQuery, PagedResult } from '../../core/models/api.model';
import { ApiService } from '../../core/services/api.service';
import {
  Product,
  ProductCategory,
  ProductCategoryRequest,
  ProductPrice,
  ProductPriceInfo,
  ProductPriceRequest,
  ProductRequest,
} from './product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = inject(ApiService);

  // products
  list(query: PagedQuery): Observable<PagedResult<Product>> {
    return this.api.getPaged<Product>('products', query, { skipErrorToast: true });
  }

  get(id: number): Observable<Product> {
    return this.api.get<Product>(`products/${id}`);
  }

  create(body: ProductRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('products', body);
  }

  update(id: number, body: ProductRequest): Observable<Product> {
    return this.api.put<Product>(`products/${id}`, body);
  }

  remove(id: number): Observable<unknown> {
    return this.api.delete(`products/${id}`);
  }

  /** price-list resolved price for a customer type on a date (yyyy-MM-dd) */
  priceFor(productId: number, customerType: string, date: string): Observable<ProductPriceInfo> {
    return this.api.get<ProductPriceInfo>(`products/${productId}/price`, { customerType, date }, { skipErrorToast: true });
  }

  // price list
  prices(productId: number): Observable<PagedResult<ProductPrice>> {
    return this.api.getPaged<ProductPrice>(
      'product-prices',
      { page: 1, pageSize: 100, productId, sortBy: 'effectiveFrom', sortDir: 'desc' },
      { skipErrorToast: true },
    );
  }

  addPrice(body: ProductPriceRequest): Observable<ProductPrice> {
    return this.api.post<ProductPrice>('product-prices', body);
  }

  removePrice(id: number): Observable<unknown> {
    return this.api.delete(`product-prices/${id}`);
  }

  // categories
  categories(query: PagedQuery): Observable<PagedResult<ProductCategory>> {
    return this.api.getPaged<ProductCategory>('product-categories', query, { skipErrorToast: true });
  }

  createCategory(body: ProductCategoryRequest): Observable<{ id: number }> {
    return this.api.post<{ id: number }>('product-categories', body);
  }

  updateCategory(id: number, body: ProductCategoryRequest): Observable<ProductCategory> {
    return this.api.put<ProductCategory>(`product-categories/${id}`, body);
  }

  removeCategory(id: number): Observable<unknown> {
    return this.api.delete(`product-categories/${id}`);
  }
}
