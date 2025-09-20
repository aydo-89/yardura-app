// Standardized API response format for all endpoints
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: PaginationMeta;
    timestamp: string;
    requestId?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}

// Utility functions for creating standardized responses
export class ApiResponseUtil {
  static success<T>(data: T, meta?: ApiResponse["meta"]): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
  }

  static error(
    code: string,
    message: string,
    details?: any,
    statusCode?: number,
  ): ApiResponse<null> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Common error responses
  static badRequest(message: string, details?: any): ApiResponse<null> {
    return this.error("BAD_REQUEST", message, details, 400);
  }

  static unauthorized(message = "Unauthorized access"): ApiResponse<null> {
    return this.error("UNAUTHORIZED", message, undefined, 401);
  }

  static forbidden(message = "Access forbidden"): ApiResponse<null> {
    return this.error("FORBIDDEN", message, undefined, 403);
  }

  static notFound(message = "Resource not found"): ApiResponse<null> {
    return this.error("NOT_FOUND", message, undefined, 404);
  }

  static conflict(message: string, details?: any): ApiResponse<null> {
    return this.error("CONFLICT", message, details, 409);
  }

  static validationError(details: any): ApiResponse<null> {
    return this.error("VALIDATION_ERROR", "Validation failed", details, 422);
  }

  static internalError(message = "Internal server error"): ApiResponse<null> {
    return this.error("INTERNAL_ERROR", message, undefined, 500);
  }

  // Pagination helper
  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
  ): ApiResponse<T[]> {
    const totalPages = Math.ceil(total / limit);

    return this.success(data, {
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

// Type guard for checking if response is successful
export function isSuccessResponse<T>(
  response: ApiResponse<T>,
): response is ApiResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined;
}

// Type guard for checking if response has an error
export function isErrorResponse<T>(
  response: ApiResponse<T>,
): response is ApiResponse<T> & { error: ApiError } {
  return response.success === false && response.error !== undefined;
}

// Hook for handling API responses in React components
export function useApiResponse<T>() {
  return {
    handleResponse: (response: ApiResponse<T>) => {
      if (isSuccessResponse(response)) {
        return { data: response.data, error: null };
      }

      if (isErrorResponse(response)) {
        return { data: null, error: response.error };
      }

      return {
        data: null,
        error: { code: "UNKNOWN", message: "Unknown response format" },
      };
    },
  };
}
