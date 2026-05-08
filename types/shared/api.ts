export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: unknown;
  metadata?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    totalPages?: number;
  };
}

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  metadata: NonNullable<ApiResponse<T>["metadata"]>;
};

export interface ApiError {
  error: string;
  details?: unknown;
}
