// Error handling utilities for the 20i MCP Server
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class TwentyIError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code = 'UNKNOWN_ERROR', statusCode?: number) {
    super(message);
    this.name = 'TwentyIError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends TwentyIError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class ValidationError extends TwentyIError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class ApiError extends TwentyIError {
  constructor(message: string, statusCode: number) {
    super(message, 'API_ERROR', statusCode);
  }
}

export class NotFoundError extends TwentyIError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends TwentyIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429);
  }
}

/**
 * Converts a regular Error to an McpError for MCP protocol compliance
 */
export function toMcpError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof TwentyIError) {
    switch (error.code) {
      case 'AUTHENTICATION_ERROR':
        return new McpError(ErrorCode.InvalidRequest, error.message);
      case 'VALIDATION_ERROR':
        return new McpError(ErrorCode.InvalidParams, error.message);
      case 'NOT_FOUND':
        return new McpError(ErrorCode.InvalidRequest, error.message);
      case 'RATE_LIMIT':
        return new McpError(ErrorCode.InvalidRequest, error.message);
      default:
        return new McpError(ErrorCode.InternalError, error.message);
    }
  }

  if (error instanceof Error) {
    return new McpError(ErrorCode.InternalError, error.message);
  }

  return new McpError(ErrorCode.InternalError, String(error));
}

/**
 * Enhanced error handler for API operations
 */
export function handleApiError(error: any, context: string): never {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.response.statusText || 'Unknown API error';
    
    switch (status) {
      case 401:
        throw new AuthenticationError(`Authentication failed in ${context}: ${message}`);
      case 404:
        throw new NotFoundError(`Resource in ${context}`);
      case 429:
        throw new RateLimitError(`Rate limit exceeded in ${context}: ${message}`);
      default:
        throw new ApiError(`API error in ${context}: ${message}`, status);
    }
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw new TwentyIError(`Network error in ${context}: ${error.message}`, 'NETWORK_ERROR');
  }

  if (error.code === 'ECONNABORTED') {
    throw new TwentyIError(`Request timeout in ${context}`, 'TIMEOUT_ERROR');
  }

  throw new TwentyIError(`Unexpected error in ${context}: ${error.message || error}`, 'UNKNOWN_ERROR');
}

/**
 * Validates API response format and throws appropriate errors
 */
export function validateApiResponse(response: any, context: string): void {
  if (!response) {
    throw new ApiError(`Empty response from ${context}`, 500);
  }

  // Check for common error response patterns
  if (response.error) {
    throw new ApiError(`API returned error in ${context}: ${response.error}`, response.status || 500);
  }

  if (response.status === 'error') {
    throw new ApiError(`API returned error status in ${context}: ${response.message || 'Unknown error'}`, 500);
  }
}