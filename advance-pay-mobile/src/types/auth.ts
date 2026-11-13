export interface OwnerUser {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  businessName?: string | null;
  role: "owner";
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: OwnerUser | null;
  token: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  phone?: string | null;
  businessName?: string | null;
  password: string;
  confirmPassword: string;
}

