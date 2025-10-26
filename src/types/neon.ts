export interface User {
  id: number;
  name: string;
  email: string;
  createdAt?: Date;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: number;
}