import { Component, computed, input, output } from '@angular/core';

/** <app-pagination [page]="1" [pageSize]="20" [total]="145" (pageChange)="go($event)" /> */
@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    <div class="pagination-bar">
      <div class="pagination-info text-muted small">
        @if (total() > 0) {
          Showing {{ from() }}–{{ to() }} of {{ total() }}
        } @else {
          No records
        }
      </div>
      @if (totalPages() > 1) {
        <nav aria-label="Pagination">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="page() <= 1">
              <button type="button" class="page-link" (click)="go(page() - 1)" aria-label="Previous">&laquo;</button>
            </li>
            @for (p of pages(); track $index) {
              @if (p !== null) {
                <li class="page-item" [class.active]="p === page()">
                  <button type="button" class="page-link" (click)="go(p)">{{ p }}</button>
                </li>
              } @else {
                <li class="page-item disabled"><span class="page-link">…</span></li>
              }
            }
            <li class="page-item" [class.disabled]="page() >= totalPages()">
              <button type="button" class="page-link" (click)="go(page() + 1)" aria-label="Next">&raquo;</button>
            </li>
          </ul>
        </nav>
      }
    </div>
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))));
  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

  readonly pages = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const cur = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const out: (number | null)[] = [1];
    const start = Math.max(2, cur - 1);
    const end = Math.min(total - 1, cur + 1);
    if (start > 2) {
      out.push(null);
    }
    for (let i = start; i <= end; i++) {
      out.push(i);
    }
    if (end < total - 1) {
      out.push(null);
    }
    out.push(total);
    return out;
  });

  go(p: number): void {
    if (p < 1 || p > this.totalPages() || p === this.page()) {
      return;
    }
    this.pageChange.emit(p);
  }
}
