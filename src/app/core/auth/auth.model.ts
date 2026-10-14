export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  permissions: string[];
  mustChangePassword?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

/** Shape of ApiResponse<LoginResponse>.data returned by POST /api/auth/login */
export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
