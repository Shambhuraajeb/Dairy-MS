export const PERMISSIONS = {
  FARMER_VIEW: 'farmer.view',
  FARMER_CREATE: 'farmer.create',
  FARMER_UPDATE: 'farmer.update',

  LOAN_VIEW: 'loan.view',
  LOAN_CREATE: 'loan.create',
  LOAN_UPDATE: 'loan.update',

  ANIMAL_VIEW: 'animal.view',
  ANIMAL_CREATE: 'animal.create',
  ANIMAL_UPDATE: 'animal.update',

  COLLECTION_VIEW: 'collection.view',
  COLLECTION_CREATE: 'collection.create',
  COLLECTION_UPDATE: 'collection.update',
  COLLECTION_APPROVE: 'collection.approve',
  COLLECTION_REJECT: 'collection.reject',
  COLLECTION_QUALITY_RECORD: 'collection.quality.record',

  RATECHART_VIEW: 'ratechart.view',
  RATECHART_MANAGE: 'ratechart.manage',

  PAYMENT_VIEW: 'payment.view',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_APPROVE: 'payment.approve',

  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_ADJUST: 'inventory.adjust',

  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_MANAGE: 'supplier.manage',

  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_APPROVE: 'purchase.approve',
  PURCHASE_RECEIVE: 'purchase.receive',

  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',

  SUBSCRIPTION_VIEW: 'subscription.view',
  SUBSCRIPTION_CREATE: 'subscription.create',
  SUBSCRIPTION_UPDATE: 'subscription.update',

  COMPLAINT_VIEW: 'complaint.view',
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_UPDATE: 'complaint.update',

  PRODUCT_VIEW: 'product.view',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',

  ORDER_VIEW: 'order.view',
  ORDER_CREATE: 'order.create',
  ORDER_UPDATE: 'order.update',

  ROUTE_VIEW: 'route.view',
  ROUTE_MANAGE: 'route.manage',

  DELIVERY_VIEW: 'delivery.view',
  DELIVERY_UPDATE: 'delivery.update',
  DELIVERY_CONFIRM: 'delivery.confirm',

  INVOICE_VIEW: 'invoice.view',
  INVOICE_CREATE: 'invoice.create',

  CUSTPAYMENT_VIEW: 'custpayment.view',
  CUSTPAYMENT_CREATE: 'custpayment.create',

  EXPENSE_VIEW: 'expense.view',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_APPROVE: 'expense.approve',

  CASH_VIEW: 'cash.view',

  EMPLOYEE_VIEW: 'employee.view',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',

  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',

  LEAVE_VIEW: 'leave.view',
  LEAVE_CREATE: 'leave.create',
  LEAVE_APPROVE: 'leave.approve',

  SALARY_VIEW: 'salary.view',
  SALARY_MANAGE: 'salary.manage',

  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_UPDATE: 'maintenance.update',

  REPORT_VIEW: 'report.view',
  NOTIFICATION_VIEW: 'notification.view',
  DASHBOARD_VIEW: 'dashboard.view',

  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
