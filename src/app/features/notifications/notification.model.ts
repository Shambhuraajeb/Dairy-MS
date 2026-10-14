export type NotificationSeverity = 'info' | 'warning' | 'danger' | 'success';

export const NOTIFICATION_SEVERITIES: NotificationSeverity[] = ['info', 'success', 'warning', 'danger'];

export interface AppNotification {
  id: number;
  userId: number | null;
  roleId: number | null;
  title: string;
  message: string;
  severity: NotificationSeverity;
  link: string | null;
  isRead: boolean;
  createdDate: string;
  readDate: string | null;
}
