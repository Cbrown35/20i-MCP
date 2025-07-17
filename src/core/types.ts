// Core type definitions for the 20i MCP Server

export interface ApiCredentials {
  apiKey: string;
  oauthKey: string;
  combinedKey: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolHandler {
  (args: Record<string, any>): Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

export interface ModuleDefinition {
  tools: Tool[];
  handlers: Record<string, ToolHandler>;
}

// Common API response structure patterns
export interface ApiResponse<T = any> {
  data?: T;
  status?: string;
  message?: string;
  error?: string;
}

// Package types
export interface PackageInfo {
  id: string;
  name: string;
  type: string;
  domain_name?: string;
  extra_domain_names?: string[];
  status?: string;
}

// Domain types
export interface DomainInfo {
  id: string;
  name: string;
  status: string;
  expiry_date?: string;
  auto_renew?: boolean;
}

// WordPress types
export interface WordPressInfo {
  id: string;
  package_id: string;
  domain: string;
  version?: string;
  status: string;
  admin_url?: string;
}

// Email types
export interface EmailAccount {
  id: string;
  email: string;
  package_id: string;
  quota?: number;
  used?: number;
}

// Database types
export interface DatabaseInfo {
  id: string;
  name: string;
  type: 'mysql' | 'mssql';
  package_id: string;
  size?: number;
}

// SSL Certificate types
export interface SSLCertificate {
  id: string;
  domain: string;
  type: string;
  status: string;
  expiry_date?: string;
}

// CDN types
export interface CDNConfig {
  enabled: boolean;
  cache_level?: string;
  minify?: boolean;
  gzip?: boolean;
}

// VPS types
export interface VPSInfo {
  id: string;
  name: string;
  status: string;
  ip_address?: string;
  memory?: number;
  storage?: number;
  cpu_cores?: number;
}

// Backup types
export interface BackupInfo {
  id: string;
  type: 'web' | 'database' | 'email';
  date: string;
  size?: number;
  package_id: string;
}