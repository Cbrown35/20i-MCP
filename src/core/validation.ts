// Input validation utilities for the 20i MCP Server
import { ValidationError } from './errors.js';

/**
 * Validates that a value is a non-empty string
 */
export function validateString(value: any, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${fieldName} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validates that a value is a positive number
 */
export function validatePositiveNumber(value: any, fieldName: string): number {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  return num;
}

/**
 * Validates that a value is a valid boolean
 */
export function validateBoolean(value: any, fieldName: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  throw new ValidationError(`${fieldName} must be a boolean value`);
}

/**
 * Validates email format
 */
export function validateEmail(value: any, fieldName: string): string {
  const email = validateString(value, fieldName);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError(`${fieldName} must be a valid email address`);
  }
  return email;
}

/**
 * Validates domain name format
 */
export function validateDomain(value: any, fieldName: string): string {
  const domain = validateString(value, fieldName);
  // Basic domain validation - allows subdomains
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw new ValidationError(`${fieldName} must be a valid domain name`);
  }
  return domain.toLowerCase();
}

/**
 * Validates that a value exists in a predefined set of options
 */
export function validateEnum<T extends string>(value: any, options: T[], fieldName: string): T {
  const str = validateString(value, fieldName);
  if (!options.includes(str as T)) {
    throw new ValidationError(`${fieldName} must be one of: ${options.join(', ')}`);
  }
  return str as T;
}

/**
 * Validates array of strings
 */
export function validateStringArray(value: any, fieldName: string, minLength = 0): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }
  if (value.length < minLength) {
    throw new ValidationError(`${fieldName} must contain at least ${minLength} items`);
  }
  return value.map((item, index) => validateString(item, `${fieldName}[${index}]`));
}

/**
 * Validates object structure
 */
export function validateObject(value: any, fieldName: string): Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an object`);
  }
  return value;
}

/**
 * Validates optional field (allows undefined/null but validates if present)
 */
export function validateOptional<T>(
  value: any,
  validator: (val: any, field: string) => T,
  fieldName: string
): T | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return validator(value, fieldName);
}

/**
 * Validates required parameter existence
 */
export function validateRequired<T>(value: T | undefined | null, fieldName: string): T {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return value;
}

/**
 * Validates password strength
 */
export function validatePassword(value: any, fieldName: string, minLength = 8): string {
  const password = validateString(value, fieldName);
  if (password.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
  }
  return password;
}

/**
 * Validates IP address format
 */
export function validateIPAddress(value: any, fieldName: string): string {
  const ip = validateString(value, fieldName);
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    throw new ValidationError(`${fieldName} must be a valid IP address`);
  }
  
  // Additional IPv4 range validation
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.some(part => part > 255)) {
      throw new ValidationError(`${fieldName} must be a valid IP address`);
    }
  }
  
  return ip;
}

/**
 * Validates URL format
 */
export function validateURL(value: any, fieldName: string): string {
  const url = validateString(value, fieldName);
  try {
    new URL(url);
    return url;
  } catch {
    throw new ValidationError(`${fieldName} must be a valid URL`);
  }
}