import { NextResponse } from "next/server";
import { ApiResponse, ApiError } from "@/types/shared/api";
import { z } from "zod";

export function successResponse<T>(data: T, status = 200, metadata?: ApiResponse<T>["metadata"]) {
  return NextResponse.json({ data, metadata } as ApiResponse<T>, { status });
}

export function errorResponse(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details } as ApiError, { status });
}

export function validationErrorResponse(error: z.ZodError) {
  return errorResponse("Validation failed", 400, error.issues);
}

export function unauthorizedResponse() {
  return errorResponse("Unauthorized", 401);
}

export function forbiddenResponse(message = "Forbidden") {
  return errorResponse(message, 403);
}

export function notFoundResponse(message = "Resource not found") {
  return errorResponse(message, 404);
}
