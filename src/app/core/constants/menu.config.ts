import { PERMISSIONS as P } from './permissions';

export interface MenuItem {
  label: string;
  /** bootstrap-icons class, e.g. 'bi-people' */
  icon: string;
  route?: string;
  /** any-of permission code(s); omitted = visible to every signed-in user */
  permission?: string | string[];
  children?: MenuItem[];
}

export const MENU: MenuItem[] = [
  { label: 'Dashboard', icon: 'bi-speedometer2', route: '/dashboard' },
  {
    label: 'Farmers',
    icon: 'bi-people',
    children: [
      { label: 'Farmers', icon: 'bi-person', route: '/farmers', permission: P.FARMER_VIEW },
      { label: 'Advances & Loans', icon: 'bi-wallet2', route: '/farmers/loans', permission: P.LOAN_VIEW },
    ],
  },
  { label: 'Animals', icon: 'bi-clipboard2-pulse', route: '/animals', permission: P.ANIMAL_VIEW },
  { label: 'Breeds', icon: 'bi-diagram-3', route: '/animals/breeds', permission: P.ANIMAL_VIEW },
  {
    label: 'Milk Collection',
    icon: 'bi-droplet-half',
    children: [
      { label: 'Shift Dashboard', icon: 'bi-grid', route: '/collection', permission: P.COLLECTION_VIEW },
      { label: 'Collection Entry', icon: 'bi-pencil-square', route: '/collection/entry', permission: P.COLLECTION_CREATE },
      { label: 'History', icon: 'bi-clock-history', route: '/collection/history', permission: P.COLLECTION_VIEW },
      {
        label: 'Quality Tests',
        icon: 'bi-eyedropper',
        route: '/collection/quality',
        permission: [P.COLLECTION_QUALITY_RECORD, P.COLLECTION_VIEW],
      },
      { label: 'Rejections', icon: 'bi-x-octagon', route: '/collection/rejections', permission: P.COLLECTION_VIEW },
      {
        label: 'Approval',
        icon: 'bi-check2-square',
        route: '/collection/approval',
        permission: [P.COLLECTION_APPROVE, P.COLLECTION_REJECT],
      },
      { label: 'Rate Charts', icon: 'bi-table', route: '/collection/rate-charts', permission: P.RATECHART_VIEW },
      { label: 'Settlement', icon: 'bi-calculator', route: '/collection/settlement', permission: P.PAYMENT_VIEW },
      { label: 'Farmer Payments', icon: 'bi-cash-stack', route: '/collection/payments', permission: P.PAYMENT_VIEW },
      { label: 'Milk Tanks', icon: 'bi-moisture', route: '/collection/tanks', permission: P.COLLECTION_VIEW },
    ],
  },
  {
    label: 'Inventory',
    icon: 'bi-box-seam',
    children: [
      { label: 'Items', icon: 'bi-box', route: '/inventory/items', permission: P.INVENTORY_VIEW },
      { label: 'Categories', icon: 'bi-tags', route: '/inventory/categories', permission: P.INVENTORY_VIEW },
      { label: 'Units', icon: 'bi-rulers', route: '/inventory/units', permission: P.INVENTORY_VIEW },
      { label: 'Purchases', icon: 'bi-cart-plus', route: '/inventory/purchases', permission: P.PURCHASE_VIEW },
      { label: 'Batches', icon: 'bi-boxes', route: '/inventory/batches', permission: P.INVENTORY_VIEW },
      { label: 'Stock Ledger', icon: 'bi-journal-text', route: '/inventory/stock', permission: P.INVENTORY_VIEW },
      { label: 'Consumption', icon: 'bi-arrow-down-circle', route: '/inventory/consumption', permission: P.INVENTORY_VIEW },
      { label: 'Adjustments', icon: 'bi-sliders', route: '/inventory/adjustments', permission: P.INVENTORY_VIEW },
      { label: 'Alerts', icon: 'bi-exclamation-triangle', route: '/inventory/alerts', permission: P.INVENTORY_VIEW },
      { label: 'Suppliers', icon: 'bi-shop', route: '/suppliers', permission: P.SUPPLIER_VIEW },
    ],
  },
  {
    label: 'Customers',
    icon: 'bi-person-lines-fill',
    children: [
      { label: 'Customers', icon: 'bi-person-vcard', route: '/customers', permission: P.CUSTOMER_VIEW },
      { label: 'Complaints', icon: 'bi-chat-left-dots', route: '/customers/complaints', permission: P.COMPLAINT_VIEW },
      { label: 'Subscriptions', icon: 'bi-calendar-check', route: '/subscriptions', permission: P.SUBSCRIPTION_VIEW },
      { label: 'Subscription Plans', icon: 'bi-card-checklist', route: '/subscriptions/plans', permission: P.SUBSCRIPTION_VIEW },
    ],
  },
  {
    label: 'Sales',
    icon: 'bi-bag',
    children: [
      { label: 'Products', icon: 'bi-basket', route: '/products', permission: P.PRODUCT_VIEW },
      { label: 'Product Categories', icon: 'bi-tags', route: '/products/categories', permission: P.PRODUCT_VIEW },
      { label: 'Orders', icon: 'bi-receipt-cutoff', route: '/orders', permission: P.ORDER_VIEW },
    ],
  },
  {
    label: 'Delivery',
    icon: 'bi-truck',
    children: [
      { label: 'Deliveries', icon: 'bi-box-arrow-right', route: '/delivery', permission: P.DELIVERY_VIEW },
      { label: 'My Deliveries', icon: 'bi-person-check', route: '/delivery/my', permission: P.DELIVERY_CONFIRM },
      { label: 'Routes', icon: 'bi-signpost-split', route: '/delivery/routes', permission: P.ROUTE_VIEW },
      { label: 'Vehicles', icon: 'bi-truck-front', route: '/delivery/vehicles', permission: P.ROUTE_VIEW },
      { label: 'Schedules', icon: 'bi-calendar-week', route: '/delivery/schedules', permission: P.ROUTE_VIEW },
    ],
  },
  {
    label: 'Billing',
    icon: 'bi-receipt',
    children: [
      { label: 'Invoices', icon: 'bi-file-earmark-text', route: '/billing/invoices', permission: P.INVOICE_VIEW },
      { label: 'Customer Payments', icon: 'bi-credit-card', route: '/billing/payments', permission: P.CUSTPAYMENT_VIEW },
      { label: 'Outstanding', icon: 'bi-hourglass-split', route: '/billing/outstanding', permission: P.INVOICE_VIEW },
    ],
  },
  {
    label: 'Employees',
    icon: 'bi-person-badge',
    children: [
      { label: 'Employees', icon: 'bi-person-workspace', route: '/employees', permission: P.EMPLOYEE_VIEW },
      { label: 'Attendance', icon: 'bi-calendar2-check', route: '/employees/attendance', permission: P.ATTENDANCE_VIEW },
      { label: 'Leave', icon: 'bi-calendar-x', route: '/employees/leave', permission: P.LEAVE_VIEW },
      { label: 'Salary', icon: 'bi-cash-coin', route: '/employees/salary', permission: P.SALARY_VIEW },
      { label: 'Designations', icon: 'bi-award', route: '/employees/designations', permission: P.EMPLOYEE_VIEW },
    ],
  },
  {
    label: 'Maintenance',
    icon: 'bi-tools',
    children: [
      { label: 'Equipment', icon: 'bi-gear-wide-connected', route: '/maintenance/equipment', permission: P.MAINTENANCE_VIEW },
      { label: 'Schedules', icon: 'bi-calendar-event', route: '/maintenance/schedules', permission: P.MAINTENANCE_VIEW },
      { label: 'History', icon: 'bi-clock-history', route: '/maintenance/history', permission: P.MAINTENANCE_VIEW },
    ],
  },
  {
    label: 'Finance',
    icon: 'bi-cash-coin',
    children: [
      { label: 'Expenses', icon: 'bi-wallet', route: '/expenses', permission: P.EXPENSE_VIEW },
      { label: 'Expense Categories', icon: 'bi-tags', route: '/expenses/categories', permission: P.EXPENSE_VIEW },
      { label: 'Cash Book', icon: 'bi-journal-bookmark', route: '/expenses/cash', permission: P.CASH_VIEW },
    ],
  },
  { label: 'Reports', icon: 'bi-graph-up-arrow', route: '/reports', permission: P.REPORT_VIEW },
  { label: 'Notifications', icon: 'bi-bell', route: '/notifications', permission: P.NOTIFICATION_VIEW },
  {
    label: 'Administration',
    icon: 'bi-shield-lock',
    children: [
      { label: 'Users', icon: 'bi-people-fill', route: '/administration/users', permission: P.USER_MANAGE },
      { label: 'Roles', icon: 'bi-person-gear', route: '/administration/roles', permission: P.ROLE_MANAGE },
      { label: 'Permissions', icon: 'bi-key', route: '/administration/permissions', permission: P.ROLE_MANAGE },
      { label: 'Settings', icon: 'bi-sliders2', route: '/administration/settings', permission: P.SETTINGS_MANAGE },
      { label: 'Audit Log', icon: 'bi-journal-check', route: '/administration/audit-log', permission: P.AUDIT_VIEW },
    ],
  },
];

/** Returns a copy of the tree keeping only items the predicate allows; groups with no visible children are dropped. */
export function filterMenu(
  items: MenuItem[],
  allowed: (permission: string | string[] | undefined) => boolean,
): MenuItem[] {
  const result: MenuItem[] = [];
  for (const item of items) {
    if (item.children) {
      const children = filterMenu(item.children, allowed);
      if (children.length) {
        result.push({ ...item, children });
      }
    } else if (allowed(item.permission)) {
      result.push(item);
    }
  }
  return result;
}

export function flattenMenu(items: MenuItem[]): MenuItem[] {
  return items.flatMap((i) => (i.children ? flattenMenu(i.children) : [i]));
}
