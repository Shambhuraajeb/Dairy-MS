// ---- users
export interface UserAdmin {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  roleId: number;
  roleName: string;
  farmerId: number | null;
  farmerName: string | null;
  customerId: number | null;
  customerName: string | null;
  employeeId: number | null;
  employeeName: string | null;
  branchId: number | null;
  branchName: string | null;
  collectionCenterId: number | null;
  collectionCenterName: string | null;
  isActive: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  failedLoginCount: number;
  lastLoginDate: string | null;
  mustChangePassword: boolean;
  createdDate: string;
}

export interface UserUpdateRequest {
  displayName: string;
  email: string | null;
  mobile: string | null;
  roleId: number;
  farmerId: number | null;
  customerId: number | null;
  employeeId: number | null;
  branchId: number | null;
  collectionCenterId: number | null;
  isActive: boolean;
}

export interface UserCreateRequest extends UserUpdateRequest {
  username: string;
  password: string;
  mustChangePassword: boolean;
}

export interface ResetPasswordRequest {
  newPassword: string | null;
  mustChangePassword: boolean;
}

// ---- roles & permissions
export interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  permissionCount: number;
}

export interface RoleDetail extends Role {
  permissionCodes: string[];
  permissionIds: number[];
}

export interface RoleRequest {
  name: string;
  description: string | null;
  isActive?: boolean;
}

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
}

export interface PermissionGroup {
  module: string;
  permissions: PermissionItem[];
}

// ---- settings
export interface Setting {
  id: number;
  key: string;
  value: string | null;
  description: string | null;
  group: string | null;
  dataType: 'string' | 'number' | 'bool' | 'json';
  isActive: boolean;
  modifiedDate: string | null;
}

// ---- audit log
export interface AuditLogItem {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  entityName: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdDate: string;
}

export interface AuditLogDetail extends AuditLogItem {
  oldValues: string | null;
  newValues: string | null;
  userAgent: string | null;
}

export interface AuditFilterOptions {
  actions: string[];
  entities: string[];
}

// ---- organization master data
export interface Dairy {
  id: number;
  code: string;
  name: string;
  ownerName: string | null;
  mobile: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstNumber: string | null;
  licenseNo: string | null;
  registrationNo: string | null;
  isActive: boolean;
}
export type DairyRequest = Omit<Dairy, 'id'>;

export interface Branch {
  id: number;
  dairyId: number;
  dairyName: string | null;
  code: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  mobile: string | null;
  email: string | null;
  managerName: string | null;
  isActive: boolean;
}
export type BranchRequest = Omit<Branch, 'id' | 'dairyName'>;

export interface CollectionCenter {
  id: number;
  branchId: number;
  branchName: string | null;
  code: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  pincode: string | null;
  mobile: string | null;
  contactPerson: string | null;
  latitude: number | null;
  longitude: number | null;
  supervisorEmployeeId: number | null;
  supervisorName: string | null;
  capacityLiters: number | null;
  isActive: boolean;
}
export type CollectionCenterRequest = Omit<CollectionCenter, 'id' | 'branchName' | 'supervisorName'>;

export type OrgPath = 'dairy' | 'branches' | 'collection-centers';
