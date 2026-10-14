import { Component, computed, input } from '@angular/core';

export type BadgeColor = 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'primary';

const COLORS: Record<string, BadgeColor> = {
  // success
  active: 'success', approved: 'success', paid: 'success', delivered: 'success', completed: 'success', complete: 'success',
  resolved: 'success', received: 'success', verified: 'success', accepted: 'success', confirmed: 'success', success: 'success',
  present: 'success', healthy: 'success', good: 'success', ok: 'success', running: 'success', yes: 'success', available: 'success',
  // warning
  pending: 'warning', partial: 'warning', partiallypaid: 'warning', scheduled: 'warning', inprogress: 'warning', processing: 'warning',
  assigned: 'warning', paused: 'warning', due: 'warning', low: 'warning', onhold: 'warning', late: 'warning', halfday: 'warning',
  expiring: 'warning', warning: 'warning', outfordelivery: 'warning', underreview: 'warning', lowstock: 'warning',
  // danger
  rejected: 'danger', cancelled: 'danger', canceled: 'danger', failed: 'danger', overdue: 'danger', expired: 'danger', absent: 'danger',
  sick: 'danger', critical: 'danger', danger: 'danger', deceased: 'danger', dead: 'danger', unpaid: 'danger', blocked: 'danger',
  locked: 'danger', outofstock: 'danger', no: 'danger',
  // info
  info: 'info', new: 'info', open: 'info', dispatched: 'info', generated: 'info', submitted: 'info', sent: 'info', intransit: 'info',
  pregnant: 'info', planned: 'info', ordered: 'info', unread: 'info', issued: 'info', onroute: 'info', maintenance: 'warning',
  // secondary
  inactive: 'secondary', closed: 'secondary', archived: 'secondary', draft: 'secondary', none: 'secondary', unknown: 'secondary',
  sold: 'secondary', left: 'secondary', read: 'secondary',
};

/** <app-status-badge [status]="row.status" /> ; booleans render Active/Inactive. Optional [color] and [label] overrides. */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge rounded-pill badge-soft badge-soft-{{ resolvedColor() }}">{{ text() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input<string | number | boolean | null | undefined>('');
  readonly color = input<BadgeColor | null>(null);
  readonly label = input<string | null>(null);

  readonly text = computed(() => {
    if (this.label()) {
      return this.label();
    }
    const s = this.status();
    if (typeof s === 'boolean') {
      return s ? 'Active' : 'Inactive';
    }
    if (s === null || s === undefined || s === '') {
      return '—';
    }
    return String(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  });

  readonly resolvedColor = computed<BadgeColor>(() => {
    const override = this.color();
    if (override) {
      return override;
    }
    const s = this.status();
    if (typeof s === 'boolean') {
      return s ? 'success' : 'secondary';
    }
    const key = String(s ?? '').toLowerCase().replace(/[\s_-]+/g, '');
    return COLORS[key] ?? 'secondary';
  });
}
