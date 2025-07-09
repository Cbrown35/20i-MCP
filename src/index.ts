#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 20i API Response Format Notes:
 * 
 * The 20i API may return different response formats depending on account status:
 * 
 * 1. Reseller Info (/reseller endpoint):
 *    - Normal: { id: "reseller-id", name: "...", ... }
 *    - UUID only: "0f8b7d7c-d878-4356-9b00-e6210a26fff1" (string)
 *    - Empty/new accounts may return minimal data
 * 
 * 2. Account Balance (/reseller/{id}/accountBalance):
 *    - Normal: { balance: 123.45, currency: "USD", ... }
 *    - Zero balance: May return empty object {} or 404 error
 *    - New accounts: May have no balance endpoint available
 * 
 * Important: Always use console.error() instead of console.log() to avoid
 * polluting the stdio transport used by MCP protocol.
 */

interface ApiCredentials {
  apiKey: string;
  oauthKey: string;
  combinedKey: string;
}

class TwentyIClient {
  private apiClient: AxiosInstance;
  private credentials: ApiCredentials;

  constructor() {
    this.credentials = this.loadCredentials();
    // Credentials loaded successfully
    
    const authHeader = `Bearer ${Buffer.from(this.credentials.apiKey).toString('base64')}`;
    // Authorization header configured
    
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 second timeout
      responseType: 'json', // Ensure axios tries to parse JSON
      transformResponse: [(data) => {
        // If it's already parsed by axios, return it
        if (typeof data === 'object' && data !== null) {
          return data;
        }
        
        // Try to parse if it's a string
        if (typeof data === 'string' && data.trim()) {
          try {
            return JSON.parse(data);
          } catch (e) {
            // Return the string as-is so we can handle it in the interceptor
            return data;
          }
        }
        
        return data;
      }],
    });

    // Add response interceptor for better error handling and JSON validation
    this.apiClient.interceptors.response.use(
      (response) => {
        // Process response

        // Check if response is JSON
        const contentType = response.headers['content-type'];
        
        // If we got a string response that looks like JavaScript object literal, try to convert it
        if (typeof response.data === 'string' && response.data.trim()) {
          const trimmedData = response.data.trim();
          
          // Check if it looks like a JavaScript object literal (starts with 'Loaded' or contains ':' without quotes)
          if (trimmedData.includes(':') && !trimmedData.startsWith('{') && !trimmedData.startsWith('[')) {
            // Invalid response format detected
            throw new Error(`API returned invalid format (JavaScript object literal instead of JSON). This suggests the API endpoint or authentication may be incorrect.`);
          }
          
          // Try to parse as JSON if it's a string
          try {
            response.data = JSON.parse(trimmedData);
          } catch (parseError) {
            // JSON parsing failed
            
            if (contentType && contentType.includes('text/html')) {
              throw new Error(`API returned HTML instead of JSON. Status: ${response.status}. This usually indicates an authentication error or invalid endpoint.`);
            } else {
              throw new Error(`API returned unparseable response: ${trimmedData.substring(0, 100)}...`);
            }
          }
        }
        
        if (response.data === null || response.data === undefined) {
          // Handle null/undefined response
          response.data = {};
        }
        
        return response;
      },
      (error) => {
        // API request failed
        
        // Check if the error response contains HTML
        if (error.response?.headers?.['content-type']?.includes('text/html')) {
          const htmlPreview = typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 200).replace(/<[^>]*>/g, ' ').trim()
            : '';
          throw new Error(`API returned HTML error page (${error.response.status}): ${htmlPreview}`);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private loadCredentials(): ApiCredentials {
    // Load from environment variables
    if (process.env.TWENTYI_API_KEY && process.env.TWENTYI_OAUTH_KEY && process.env.TWENTYI_COMBINED_KEY) {
      return {
        apiKey: process.env.TWENTYI_API_KEY,
        oauthKey: process.env.TWENTYI_OAUTH_KEY,
        combinedKey: process.env.TWENTYI_COMBINED_KEY,
      };
    }

    throw new Error('Failed to load credentials from environment variables. Please set TWENTYI_API_KEY, TWENTYI_OAUTH_KEY, and TWENTYI_COMBINED_KEY.');
  }

  async getResellerInfo() {
    // Fetches reseller account information including unique reseller ID
    // Never hardcode reseller IDs - each account has a different one
    // 
    // API Response Formats:
    // 1. Normal response: { id: "reseller-id", name: "...", ... }
    // 2. UUID response: "0f8b7d7c-d878-4356-9b00-e6210a26fff1" (string)
    // 3. Empty/zero balance accounts may return different formats
    // 4. Array response: [{ id: "reseller-id", ... }]
    try {
      const response = await this.apiClient.get('/reseller');
      
      // Handle array response (common format)
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0];
      }
      
      // Handle different response formats
      if (typeof response.data === 'string' && response.data.match(/^[a-f0-9-]{36}$/i)) {
        // API returned just a UUID string
        return { id: response.data };
      }
      
      // Validate response structure
      if (!response.data || typeof response.data !== 'object') {
        throw new Error(`Invalid response from /reseller endpoint: expected object, got ${typeof response.data}`);
      }
      
      return response.data;
    } catch (error: any) {
      // Error occurred - rethrow with original details
      throw error;
    }
  }

  async getAccountBalance() {
    // Fetches account balance and billing information
    // 
    // Note: Accounts with zero balance or new accounts may return different response formats
    // The API may return an empty object {} or specific error for zero-balance accounts
    let resellerId: string | undefined;
    
    try {
      const resellerInfo = await this.getResellerInfo();
      resellerId = resellerInfo?.id;
      
      if (!resellerId) {
        throw new Error('Unable to determine reseller ID from account information');
      }
      
      const response = await this.apiClient.get(`/reseller/${resellerId}/accountBalance`);
      
      // Handle empty response for zero-balance accounts
      if (!response.data || Object.keys(response.data).length === 0) {
        return {
          balance: 0,
          currency: 'USD',
          message: 'Account has zero balance or no balance information available'
        };
      }
      
      return response.data;
    } catch (error: any) {
      // If the API returns 404 or specific error for zero-balance, handle gracefully
      if (error.response?.status === 404 || error.response?.status === 403) {
        return {
          balance: 0,
          currency: 'USD',
          message: 'Balance information not available - account may have zero balance or no payment history',
          resellerId: resellerId
        };
      }
      // Re-throw with more specific error message
      throw new Error(`Failed to retrieve balance for reseller ${resellerId}: ${error.message}`);
    }
  }

  async listDomains() {
    // Use the domain endpoint (not under reseller)
    const response = await this.apiClient.get('/domain');
    return response.data;
  }

  async getDomainInfo(domainId: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/domain/${domainId}`);
    return response.data;
  }

  async listHostingPackages() {
    // Use the correct package endpoint to list all packages
    const response = await this.apiClient.get('/package');
    return response.data;
  }

  async getHostingPackageInfo(packageId: string) {
    // Use the correct package endpoint for package information
    const response = await this.apiClient.get(`/package/${packageId}`);
    return response.data;
  }

  async getHostingPackageWebInfo(packageId: string) {
    // Get web-specific package information
    const response = await this.apiClient.get(`/package/${packageId}/web`);
    return response.data;
  }

  async getHostingPackageLimits(packageId: string) {
    // Get package limits and quotas
    const response = await this.apiClient.get(`/package/${packageId}/limits`);
    return response.data;
  }

  async getHostingPackageUsage(packageId: string) {
    // Get package usage statistics
    const response = await this.apiClient.get(`/package/${packageId}/web/usage`);
    return response.data;
  }

  async createHostingPackage(data: any) {
    // Use the correct reseller endpoint for adding web packages
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addWeb`, data);
    return response.data;
  }

  async listCloudServers() {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/cloudServer`);
    return response.data;
  }

  async createCloudServer(data: any) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addCloudServer`, data);
    return response.data;
  }

  async getDnsRecords(domainId: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/domain/${domainId}/dns`);
    return response.data;
  }

  async updateDnsRecord(domainId: string, recordData: any) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/domain/${domainId}/dns`, recordData);
    return response.data;
  }

  async registerDomain(domainData: {
    name: string;
    years: number;
    contact: {
      organisation?: string;
      name: string;
      address: string;
      telephone: string;
      email: string;
      cc: string;
      pc: string;
      sp: string;
      city: string;
    };
    privacyService?: boolean;
    nameservers?: string[];
    stackUser?: string;
  }) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addDomain`, domainData);
    return response.data;
  }

  async searchDomains(searchTerm: string, options?: {
    suggestions?: boolean;
    tlds?: string[];
  }) {
    // Search for domain availability and suggestions
    // Supports both prefix searching (searches all TLDs) and specific domain names
    // Can also return semantic suggestions for domain names
    //
    // API Endpoint: GET /domain-search/{prefix_or_name}
    // - If searchTerm is a full domain (contains dot), searches that specific domain
    // - If searchTerm is a prefix, searches across all supported TLDs
    // - Multiple domains can be searched by comma separation
    // - Results include availability status and suggestions if enabled
    //
    // Note: Results are streamed and may arrive in different order than requested
    try {
      // Encode the search term to handle special characters and spaces
      const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
      
      // Build query parameters if options provided
      const queryParams = new URLSearchParams();
      if (options?.suggestions !== undefined) {
        queryParams.set('suggestions', options.suggestions.toString());
      }
      if (options?.tlds && options.tlds.length > 0) {
        queryParams.set('tlds', options.tlds.join(','));
      }
      
      const queryString = queryParams.toString();
      const url = `/domain-search/${encodedSearchTerm}${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.apiClient.get(url);
      return response.data;
    } catch (error: any) {
      // Handle rate limiting and usage limits gracefully
      if (error.response?.status === 429) {
        throw new Error('Domain search rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }

  async getDomainVerificationStatus() {
    // Retrieve domain verification status for all domains
    // Returns a list of all domains with their verification status
    //
    // API Endpoint: GET /domainVerification
    // - Returns verification status for all domains in the account
    // - Shows which domains require registrant verification
    // - Includes verification completion status and requirements
    try {
      const response = await this.apiClient.get('/domainVerification');
      return response.data;
    } catch (error: any) {
      // Handle cases where no domains need verification
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async resendDomainVerificationEmail(packageId: string, domainId: string) {
    // Resend the registrant verification email for a specific domain
    // Used when domain registrant verification is required
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/resendVerificationEmail
    // - Resends verification email to domain registrant
    // - Required for certain domain registrations and transfers
    // - Helps complete domain ownership verification process
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/resendVerificationEmail`, {});
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or verification email not applicable for this domain');
      }
      throw error;
    }
  }

  // Email Security Management Methods
  async getDkimSignature(packageId: string, emailId: string) {
    // Retrieve DKIM signature configuration for a domain
    // Used to check current DKIM authentication settings
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/signature
    // - Returns current DKIM signature configuration
    // - Shows selector, key, and signature settings
    // - Used for email authentication verification
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/signature`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { message: 'No DKIM signature configured for this domain' };
      }
      throw error;
    }
  }

  async setDkimSignature(packageId: string, emailId: string, dkimConfig: {
    action: 'set' | 'delete';
    body?: {
      Canonicalization?: string;
      ExpiryTime?: number;
      Flag?: string;
      Granularity?: string;
      IsDefault?: boolean;
      IsStrict?: boolean;
      Note?: string;
      Selector?: string;
      ServiceType?: string;
    };
  }) {
    // Set or delete DKIM signature for email authentication
    // Critical for email deliverability and anti-spoofing
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/signature
    // - Configure DKIM signing for outbound email
    // - Set signature parameters like selector and canonicalization
    // - Delete existing DKIM configuration if needed
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/signature`, dkimConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Invalid DKIM configuration: ${error.response?.data?.message || 'Check parameters'}`);
      }
      throw error;
    }
  }

  async getDmarcPolicy(packageId: string, emailId: string) {
    // Retrieve DMARC policy configuration for a domain
    // Used to check current DMARC authentication and policy settings
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/dmarc
    // - Returns current DMARC policy configuration
    // - Shows policy actions (none, quarantine, reject)
    // - Includes reporting and alignment settings
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/dmarc`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { message: 'No DMARC policy configured for this domain' };
      }
      throw error;
    }
  }

  async setDmarcPolicy(packageId: string, emailId: string, dmarcConfig: {
    action: 'set' | 'delete';
    body?: {
      Policy?: 'none' | 'quarantine' | 'reject';
      SubdomainPolicy?: 'none' | 'quarantine' | 'reject';
      Percentage?: number;
      ReportingURI?: string;
      ForensicReportingURI?: string;
      AlignmentMode?: 'strict' | 'relaxed';
      ReportingInterval?: number;
      Note?: string;
    };
  }) {
    // Set or delete DMARC policy for email authentication
    // Essential for email security and deliverability
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/dmarc
    // - Configure DMARC policy (none, quarantine, reject)
    // - Set reporting URIs for DMARC reports
    // - Configure alignment modes and percentage rollout
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/dmarc`, dmarcConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Invalid DMARC configuration: ${error.response?.data?.message || 'Check policy parameters'}`);
      }
      throw error;
    }
  }

  // PHP Environment Management Methods
  async getAvailablePhpVersions(packageId: string) {
    // Get all available PHP versions for a hosting package
    // Used to determine which PHP versions can be set for the package
    //
    // API Endpoint: GET /package/{packageId}/web/availablePhpVersions
    // - Returns list of available PHP versions
    // - Includes version numbers and display titles
    // - Used for version selection in hosting management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/availablePhpVersions`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP version management');
      }
      throw error;
    }
  }

  async getCurrentPhpVersion(packageId: string) {
    // Get the current PHP version for a hosting package
    // Returns the currently active PHP version string
    //
    // API Endpoint: GET /package/{packageId}/web/phpVersion
    // - Returns current PHP version (e.g., "8.2", "7.4")
    // - Used to check current environment configuration
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/phpVersion`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP version management');
      }
      throw error;
    }
  }

  async setPhpVersion(packageId: string, version: string) {
    // Set the PHP version for a hosting package
    // Critical for application compatibility and development environments
    //
    // API Endpoint: POST /package/{packageId}/web/phpVersion
    // - Sets PHP version for the hosting package
    // - Affects all PHP scripts and applications
    // - May require application restart or cache clearing
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/phpVersion`, {
        value: version
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error(`Invalid PHP version: ${version}. Check available versions first.`);
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP version management');
      }
      throw error;
    }
  }

  async getAllowedPhpConfiguration(packageId: string) {
    // Get allowed PHP configuration directives for a hosting package
    // Shows which PHP settings can be customized
    //
    // API Endpoint: GET /package/{packageId}/web/allowedPhpConfiguration
    // - Returns list of configurable PHP directives
    // - Includes directive names, types, and default values
    // - Used for PHP environment customization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/allowedPhpConfiguration`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support PHP configuration management');
      }
      throw error;
    }
  }

  async getPhpConfig(packageId: string, phpConfigId: string) {
    // Get current PHP configuration for a specific configuration ID
    // Returns current PHP directive values
    //
    // API Endpoint: GET /package/{packageId}/web/phpConfig/{phpConfigId}
    // - Returns current PHP configuration settings
    // - Shows custom directive values and overrides
    // - Used to review current PHP environment setup
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/phpConfig/${phpConfigId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('PHP configuration not found for the specified package and config ID');
      }
      throw error;
    }
  }

  async updatePhpConfig(packageId: string, phpConfigId: string, config: Record<string, string>) {
    // Update PHP configuration directives for a hosting package
    // Allows customization of PHP environment settings
    //
    // API Endpoint: POST /package/{packageId}/web/phpConfig/{phpConfigId}/updateConfig
    // - Updates PHP directive values
    // - Affects PHP behavior for the hosting package
    // - Configuration changes may require time to propagate
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/phpConfig/${phpConfigId}/updateConfig`, {
        config: config
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid PHP configuration values. Check allowed directives and formats.');
      }
      if (error.response?.status === 404) {
        throw new Error('PHP configuration not found for the specified package and config ID');
      }
      throw error;
    }
  }

  // File Permission Management Methods
  async getFilePermissionRecommendations(packageId: string) {
    // Get file permissions that don't match platform recommendations
    // Critical for web hosting security and proper file access
    //
    // API Endpoint: GET /package/{packageId}/web/filePermissions
    // - Returns permission check information
    // - Identifies files with incorrect permissions
    // - Provides platform-recommended security settings
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/filePermissions`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support file permission management');
      }
      throw error;
    }
  }

  async setFilePermissions(packageId: string, permissionCheckId: number, files: Array<{file: string, perms: number}>) {
    // Set file permissions for specific files
    // Corrects file permissions to match security recommendations
    //
    // API Endpoint: POST /package/{packageId}/web/filePermissions
    // - Sets file permissions for security compliance
    // - Requires permission check ID from recommendations
    // - Applies permissions to specified files
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/filePermissions`, {
        permissionCheckId,
        files
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid permission check ID or file permission values');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or permission check ID is invalid');
      }
      throw error;
    }
  }

  async getDirectoryIndexingStatus(packageId: string) {
    // Get directory indexing configuration
    // Controls whether visitors can view directory file listings
    //
    // API Endpoint: GET /package/{packageId}/web/directoryIndexing
    // - Returns current directory indexing state
    // - Important for web security and privacy
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/directoryIndexing`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support directory indexing management');
      }
      throw error;
    }
  }

  async setDirectoryIndexing(packageId: string, enabled: boolean) {
    // Enable or disable directory indexing for security
    // Controls whether visitors can view directory file listings
    //
    // API Endpoint: POST /package/{packageId}/web/directoryIndexing
    // - Enables/disables directory indexing
    // - Critical for web security and privacy
    // - Prevents unauthorized file browsing
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/directoryIndexing`, {
        value: enabled
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid directory indexing value. Must be boolean.');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support directory indexing management');
      }
      throw error;
    }
  }

  async setDirectoryIndex(packageId: string, indexFiles: string[]) {
    // Set directory index files (up to 5) for htaccess configuration
    // Controls which files serve as directory index pages
    //
    // API Endpoint: POST /package/{packageId}/web/directoryIndex
    // - Sets up to 5 files for directory index
    // - Configures htaccess file handling
    // - Defines default files for directory access
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/directoryIndex`, {
        indexFiles: indexFiles.slice(0, 5) // Limit to 5 files as per API spec
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid directory index file list. Maximum 5 files allowed.');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support directory index management');
      }
      throw error;
    }
  }

  // Easy Builder Integration Methods
  async getEasyBuilderInstances(packageId: string) {
    // Get current Easy Builder instances for a hosting package
    // Essential for website builder management and deployment
    //
    // API Endpoint: GET /package/{packageId}/web/easyBuilderInstance
    // - Returns current Easy Builder instances
    // - Shows instance status and configuration
    // - Required for builder management workflows
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/easyBuilderInstance`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support Easy Builder');
      }
      throw error;
    }
  }

  async deleteEasyBuilderInstance(packageId: string, instanceId: string) {
    // Delete an Easy Builder instance
    // Removes website builder deployment and configuration
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderInstanceDelete
    // - Deletes Easy Builder instance by ID
    // - Removes associated configuration and files
    // - Irreversible operation - use with caution
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderInstanceDelete`, {
        instanceId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or instance cannot be deleted');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or Easy Builder instance not found');
      }
      throw error;
    }
  }

  async installEasyBuilderInstance(packageId: string, instanceId: string) {
    // Install an Easy Builder instance
    // Deploys website builder to hosting package
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderInstanceInstall
    // - Installs Easy Builder instance by ID
    // - Sets up builder environment and configuration
    // - Enables website builder functionality
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderInstanceInstall`, {
        instanceId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or installation failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or Easy Builder instance not found');
      }
      throw error;
    }
  }

  async getEasyBuilderSso(packageId: string, instanceId: string) {
    // Get Easy Builder Single Sign-On URL
    // Provides direct access to builder interface
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderSso
    // - Returns SSO URL for Easy Builder instance
    // - Enables seamless access to builder interface
    // - Required for user authentication workflow
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderSso`, {
        instanceId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or SSO generation failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or Easy Builder instance not found');
      }
      throw error;
    }
  }

  async getEasyBuilderThemes(packageId: string) {
    // Get all available Easy Builder themes
    // Lists templates and design options for website builder
    //
    // API Endpoint: GET /package/{packageId}/web/easyBuilderTheme
    // - Returns available themes and templates
    // - Shows theme metadata and previews
    // - Required for theme selection workflow
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/easyBuilderTheme`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support Easy Builder themes');
      }
      throw error;
    }
  }

  async setEasyBuilderTheme(packageId: string, instanceId: string, themeName: string) {
    // Set Easy Builder theme for instance
    // Applies selected theme to website builder
    //
    // API Endpoint: POST /package/{packageId}/web/easyBuilderTheme
    // - Sets theme for Easy Builder instance
    // - Applies design and layout changes
    // - Updates site appearance immediately
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/easyBuilderTheme`, {
        instanceId,
        themeName
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid instance ID or theme name');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, instance, or theme not found');
      }
      throw error;
    }
  }

  async getWebsiteBuilderSso(packageId: string) {
    // Get Website Builder Single Sign-On URL
    // Provides direct access to traditional website builder
    //
    // API Endpoint: GET /package/{packageId}/web/websiteBuilderSso
    // - Returns SSO URL for Website Builder
    // - Enables seamless access to builder interface
    // - Alternative to Easy Builder for traditional sites
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/websiteBuilderSso`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support Website Builder');
      }
      throw error;
    }
  }

  // Enhanced Monitoring and Logging Methods
  async getAccessAndErrorLogs(packageId: string) {
    // Get access and error logs for website monitoring
    // Essential for troubleshooting and security analysis
    //
    // API Endpoint: GET /package/{packageId}/web/logs
    // - Returns combined access and error log data
    // - Critical for debugging and security monitoring
    // - Shows visitor activity and application errors
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/logs`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or logs not available');
      }
      if (error.response?.status === 403) {
        throw new Error('Access to logs not permitted for this package');
      }
      throw error;
    }
  }


  async requestDiskUsageReport(packageId: string, subdirectory: string) {
    // Request a disk usage analysis report
    // Initiates detailed disk space analysis for optimization
    //
    // API Endpoint: POST /package/{packageId}/web/requestDiskUsage
    // - Initiates disk usage scanning for specified directory
    // - Returns report ID for later retrieval
    // - Essential for storage optimization and cleanup
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/requestDiskUsage`, {
        subdirectory
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid subdirectory specified');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or disk usage reporting not available');
      }
      throw error;
    }
  }

  async getDiskUsageReport(packageId: string, reportId: string) {
    // Get completed disk usage report details
    // Shows detailed disk space breakdown by directory and file
    //
    // API Endpoint: POST /package/{packageId}/web/diskUsage
    // - Returns detailed disk usage report
    // - Shows file and directory space consumption
    // - Critical for storage optimization decisions
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/diskUsage`, {
        reportId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid report ID or report not ready');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or disk usage report not found');
      }
      throw error;
    }
  }

  async getEmailStats(packageId: string, emailId: string, mailboxId: string) {
    // Get email mailbox statistics and folder information
    // Shows email storage usage and folder statistics
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/stats?mb={mailboxId}
    // - Returns mailbox statistics by folder
    // - Shows email storage usage and message counts
    // - Essential for email management and optimization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/stats?mb=${mailboxId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package, email domain, or mailbox not found');
      }
      throw error;
    }
  }

  async getMalwareScanObjects(packageId: string) {
    // Get malware scan configuration and scan objects
    // Shows malware scanning setup and scan history
    //
    // API Endpoint: GET /package/{packageId}/web/malwareScan
    // - Returns malware scan objects and configuration
    // - Shows scan history and configuration settings
    // - Essential for security monitoring setup
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/malwareScan`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or malware scan objects not available');
      }
      throw error;
    }
  }

  // WordPress Management Methods
  async isWordPressInstalled(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressIsInstalled`);
    return response.data;
  }

  async reinstallWordPress(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/reinstall`);
    return response.data;
  }

  async getWordPressSettings(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressSettings`);
    return response.data;
  }

  async setWordPressSettings(packageId: string, optionName: string, optionValue: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressSettings`, {
      option_name: optionName,
      option_value: optionValue
    });
    return response.data;
  }

  async getWordPressVersion(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressVersion`);
    return response.data;
  }

  async wordPressSearchReplace(packageId: string, search: string, replace: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressSearchReplace`, {
      search,
      replace
    });
    return response.data;
  }

  async getWordPressPlugins(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressPlugins`);
    return response.data;
  }

  async manageWordPressPlugin(packageId: string, action: 'activate' | 'deactivate' | 'remove', pluginName: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressPlugins`, {
      type: action,
      name: pluginName
    });
    return response.data;
  }

  async installStackCachePlugin(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressInstallStackCache`);
    return response.data;
  }

  async getWordPressThemes(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressThemes`);
    return response.data;
  }

  async manageWordPressTheme(packageId: string, action: 'activate' | 'deactivate' | 'remove', themeName: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressThemes`, {
      type: action,
      name: themeName
    });
    return response.data;
  }

  async getWordPressUsers(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressUsers`);
    return response.data;
  }

  async manageWordPressUser(packageId: string, userData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressUsers`, userData);
    return response.data;
  }

  async getWordPressAdministrators(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressAdministrators`);
    return response.data;
  }

  async getWordPressRoles(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressRoles`);
    return response.data;
  }

  async updateWordPress(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressUpdate`);
    return response.data;
  }

  async getWordPressStaging(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressStaging`);
    return response.data;
  }

  async manageWordPressStaging(packageId: string, type: 'live' | 'staging') {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressStaging`, {
      type
    });
    return response.data;
  }

  async removeWordPressStagingClone(packageId: string, cloneId: number) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressStagingRemoveClone`, {
      id: cloneId
    });
    return response.data;
  }

  async getWordPressChecksum(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressChecksum`);
    return response.data;
  }

  async generateWordPressChecksum(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/wordpressChecksum`);
    return response.data;
  }

  async checkWordPressDatabase(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/wordpressDbCheck`);
    return response.data;
  }

  // CDN Management Methods
  async getCdnOptions(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnOptions`);
    return response.data;
  }

  async getCdnFeatureGroups(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnFeatureGroups`);
    return response.data;
  }

  async addCdnFeature(packageId: string, featureData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/addCdnFeature`, featureData);
    return response.data;
  }

  async bulkAddCdnFeatures(packageId: string, featuresData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/bulkAddCdnFeature`, featuresData);
    return response.data;
  }

  async getCdnStats(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnStats`);
    return response.data;
  }

  async getCacheReport(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cacheReport`);
    return response.data;
  }

  async purgeCdnCache(packageId: string, url: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/purgeCdnByUrl`, { url });
    return response.data;
  }

  async getStackCacheSettings(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/stackCache`);
    return response.data;
  }

  async setStackCachePolicy(packageId: string, policyData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/stackCache`, policyData);
    return response.data;
  }

  async getCdnSecurityHeaders(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/cdnSecurityHeaders`);
    return response.data;
  }

  async updateCdnSecurityHeaders(packageId: string, headersData: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/updateCdnSecurityHeaders`, headersData);
    return response.data;
  }

  async deleteCdnSecurityHeaders(packageId: string, headerNames?: string[]) {
    if (headerNames && headerNames.length > 0) {
      // Delete specific headers
      const response = await this.apiClient.post(`/package/${packageId}/web/deleteCdnSecurityHeader`, { headers: headerNames });
      return response.data;
    } else {
      // Delete all headers
      const response = await this.apiClient.post(`/package/${packageId}/web/deleteCdnSecurityHeaders`);
      return response.data;
    }
  }

  async getCdnTrafficDistribution(packageId: string, filters?: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/cdnStatsTrafficDistribution`, filters || {});
    return response.data;
  }

  async assignWebsiteTurbo(websiteTurboId: string, packageId: string) {
    const response = await this.apiClient.post(`/website_turbo/${websiteTurboId}/assignPackage`, { packageId });
    return response.data;
  }

  async unassignWebsiteTurbo(websiteTurboId: string, packageId: string) {
    const response = await this.apiClient.post(`/website_turbo/${websiteTurboId}/unAssignPackage`, { packageId });
    return response.data;
  }

  async orderWebsiteTurboCredits(amount: number) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addWebsiteTurboCredits`, { amount });
    return response.data;
  }

  // Backup and Restore Management Methods
  async listTimelineStorage(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup`);
    return response.data;
  }

  async createSnapshot(packageId: string, snapshotType: 'web' | 'database', databaseId?: string) {
    if (snapshotType === 'database' && databaseId) {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/takeSnapshot`);
      return response.data;
    } else if (snapshotType === 'web') {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/web/takeSnapshot`);
      return response.data;
    } else {
      throw new Error('Invalid snapshot type or missing database ID for database snapshots');
    }
  }

  async listSnapshots(packageId: string, snapshotType: 'web' | 'database', databaseId?: string) {
    if (snapshotType === 'database' && databaseId) {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/database/${databaseId}`);
      return response.data;
    } else if (snapshotType === 'web') {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web`);
      return response.data;
    } else {
      throw new Error('Invalid snapshot type or missing database ID for database snapshots');
    }
  }

  async restoreSnapshot(packageId: string, restoreData: {
    snapshotType: 'web' | 'database';
    action: 'restore' | 'mysqlrestore';
    restoreAsOf: number;
    restorePath: string;
    target?: string;
    databaseId?: string;
  }) {
    const { snapshotType, databaseId, ...restoreParams } = restoreData;
    
    if (snapshotType === 'database' && databaseId) {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/restoreSnapshot`, restoreParams);
      return response.data;
    } else if (snapshotType === 'web') {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/web/restoreSnapshot`, restoreParams);
      return response.data;
    } else {
      throw new Error('Invalid snapshot type or missing database ID for database snapshots');
    }
  }

  async getSnapshotJobs(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web/jobs`);
    return response.data;
  }

  async restoreFtpBackup(packageId: string, backupData: {
    filename: string;
    restoreType: 'IntoDirectory' | 'ReplaceMissing' | 'ReplaceAll';
    restoreDatabases: boolean;
  }) {
    const response = await this.apiClient.post(`/package/${packageId}/web/restoreWebsiteBackup`, backupData);
    return response.data;
  }

  async listBackupJobs(packageId: string) {
    // This would typically be combined with other job monitoring endpoints
    const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web/jobs`);
    return response.data;
  }

  async listMultisiteBackups() {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.get(`/reseller/${resellerId}/backupBulkPackages`);
    return response.data;
  }

  async createMultisiteBackup(packageIds: string[], deleteExisting: boolean = false) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/backupBulkPackages`, {
      id: packageIds,
      delete: deleteExisting
    });
    return response.data;
  }

  async listVpsBackups() {
    // This would list VPS backup services if available
    const response = await this.apiClient.get('/vps');
    return response.data;
  }

  async updateVpsBackup(vpsId: string, backupConfig: any) {
    const response = await this.apiClient.post(`/vps/${vpsId}/backup`, backupConfig);
    return response.data;
  }

  // Advanced Security Management Methods
  async getBlockedIpAddresses(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/blockedIpAddresses`);
    return response.data;
  }

  async setBlockedIpAddresses(packageId: string, ipAddresses?: string[]) {
    const payload = ipAddresses ? { ip_addresses: ipAddresses } : {};
    const response = await this.apiClient.post(`/package/${packageId}/web/blockedIpAddresses`, payload);
    return response.data;
  }

  async addIpBlock(packageId: string, ipAddress: string) {
    // Get current blocked IPs and add the new one
    const currentBlocked = await this.getBlockedIpAddresses(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    if (!blockedList.includes(ipAddress)) {
      blockedList.push(ipAddress);
      return await this.setBlockedIpAddresses(packageId, blockedList);
    }
    
    return { message: 'IP address is already blocked', blocked_ips: blockedList };
  }

  async removeIpBlock(packageId: string, ipAddress: string) {
    // Get current blocked IPs and remove the specified one
    const currentBlocked = await this.getBlockedIpAddresses(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    const updatedList = blockedList.filter(ip => ip !== ipAddress);
    return await this.setBlockedIpAddresses(packageId, updatedList);
  }

  async getBlockedCountries(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/blockedCountries`);
    return response.data;
  }

  async setBlockedCountries(packageId: string, countries: string[], access: string = 'block') {
    const response = await this.apiClient.post(`/package/${packageId}/web/blockedCountries`, {
      countries,
      access
    });
    return response.data;
  }

  async addCountryBlock(packageId: string, countryCode: string, access: string = 'block') {
    // Get current blocked countries and add the new one
    const currentBlocked = await this.getBlockedCountries(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    if (!blockedList.includes(countryCode)) {
      blockedList.push(countryCode);
      return await this.setBlockedCountries(packageId, blockedList, access);
    }
    
    return { message: 'Country is already blocked', blocked_countries: blockedList };
  }

  async removeCountryBlock(packageId: string, countryCode: string) {
    // Get current blocked countries and remove the specified one
    const currentBlocked = await this.getBlockedCountries(packageId);
    const blockedList = Array.isArray(currentBlocked) ? currentBlocked : [];
    
    const updatedList = blockedList.filter(country => country !== countryCode);
    return await this.setBlockedCountries(packageId, updatedList);
  }

  async getMalwareScan(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/malwareScan`);
    return response.data;
  }

  async requestMalwareScan(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/malwareScan`, {
      LockState: 'new'
    });
    return response.data;
  }

  async getMalwareReport(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/malwareReport`);
    return response.data;
  }

  async getEmailSpamBlacklist(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/spamPolicyListBlacklist`);
    return response.data;
  }

  async getEmailSpamWhitelist(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/spamPolicyListWhitelist`);
    return response.data;
  }

  async addTlsCertificate(name: string, periodMonths: number, configuration: any) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addTlsCertificate`, {
      name,
      periodMonths,
      configuration
    });
    return response.data;
  }

  async renewTlsCertificate(certificateId: string, periodMonths: number) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/renewTlsCertificate`, {
      id: certificateId,
      periodMonths
    });
    return response.data;
  }

  // Premium Email Management Methods
  async orderPremiumMailbox(configuration: any, forUser?: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/addPremiumMailbox`, {
      configuration,
      forUser
    });
    return response.data;
  }

  async renewPremiumMailbox(id: string) {
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    const response = await this.apiClient.post(`/reseller/${resellerId}/renewPremiumMailbox`, {
      id
    });
    return response.data;
  }

  // Package Email Management Methods
  async getEmailConfiguration(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}`);
    return response.data;
  }

  async updateEmailConfiguration(packageId: string, emailId: string, config: any) {
    const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}`, config);
    return response.data;
  }

  async getMailboxConfiguration(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/mailbox`);
    return response.data;
  }

  async getEmailForwarders(packageId: string, emailId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/forwarder`);
    return response.data;
  }

  async getAllEmailForwarders(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/allMailForwarders`);
    return response.data;
  }

  async generateWebmailUrl(packageId: string, emailId: string, mailboxId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/webmail`, {
      id: mailboxId
    });
    return response.data;
  }

  // MySQL Database Management Methods
  async getMysqlDatabases(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/mysqlDatabases`);
    return response.data;
  }

  async getMysqlUsers(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/mysqlUsers`);
    return response.data;
  }

  // MSSQL Database Management Methods
  async getMssqlDatabases(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/mssqlDatabases`);
    return response.data;
  }

  // SSL Certificate Management Methods
  async getSslCertificates(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/certificates`);
    return response.data;
  }

  async addFreeSSL(packageId: string, domains: string[]) {
    const response = await this.apiClient.post(`/package/${packageId}/web/freeSSL`, {
      domains
    });
    return response.data;
  }

  async getForceSSL(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/forceSSL`);
    return response.data;
  }

  async setForceSSL(packageId: string, enabled: boolean) {
    const response = await this.apiClient.post(`/package/${packageId}/web/forceSSL`, {
      enabled
    });
    return response.data;
  }

  // Bandwidth and Statistics Methods
  async getBandwidthStats(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/bandwidthStats`);
    return response.data;
  }

  async getDiskUsage(packageId: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/diskUsage`);
    return response.data;
  }

  async getAccessLogs(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/logs`);
    return response.data;
  }

  // VPS Management Methods
  async listVPS() {
    const response = await this.apiClient.get('/vps');
    return response.data;
  }

  async getVPSInfo(vpsId: string) {
    const response = await this.apiClient.get(`/vps/${vpsId}`);
    return response.data;
  }

  async listManagedVPS() {
    const response = await this.apiClient.get('/managed_vps');
    return response.data;
  }

  async getManagedVPSInfo(managedVpsId: string) {
    const response = await this.apiClient.get(`/managed_vps/${managedVpsId}`);
    return response.data;
  }

  // Subdomain Management Methods
  async createSubdomain(packageId: string, subdomain: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/subdomains`, {
      name: subdomain
    });
    return response.data;
  }

  async removeSubdomain(packageId: string, subdomain: string) {
    const response = await this.apiClient.delete(`/package/${packageId}/web/subdomains/${subdomain}`);
    return response.data;
  }

  async listSubdomains(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/subdomains`);
    return response.data;
  }

  // MySQL Management Methods
  async createMysqlDatabase(packageId: string, name: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/mysqlDatabases`, {
      name
    });
    return response.data;
  }

  async createMysqlUser(packageId: string, username: string, password: string, database?: string) {
    try {
      const payload: any = {
        username,
        password
      };
      
      // Only add database if provided (for backwards compatibility)
      if (database) {
        payload.database = database;
      }
      
      const response = await this.apiClient.post(`/package/${packageId}/web/mysqlUsers`, payload);
      return response.data;
    } catch (error: any) {
      console.error('MySQL user creation error:', error.response?.status, error.response?.data);
      if (error.response?.status === 404) {
        throw new Error(`MySQL user creation endpoint not found - Package ID: ${packageId}`);
      }
      if (error.response?.status === 400) {
        throw new Error(`Invalid MySQL user parameters - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  async grantMysqlUserDatabase(packageId: string, username: string, database: string) {
    // WORKING API ENDPOINT ✅
    // This endpoint is fully functional and provides automated database access management
    // Grants existing MySQL users full privileges to specified databases
    // Tested and verified working on package 3302301 (shakatogatt.dzind.com)
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/mysqlGrantUserDatabase`, {
        username,
        database
      });
      return response.data;
    } catch (error: any) {
      console.error('MySQL grant user database error:', error.response?.status, error.response?.data);
      if (error.response?.status === 404) {
        throw new Error(`MySQL grant endpoint not found - Package ID: ${packageId}, User: ${username}, Database: ${database}`);
      }
      if (error.response?.status === 400) {
        throw new Error(`Invalid grant parameters - ${JSON.stringify(error.response?.data)}`);
      }
      throw error;
    }
  }

  // Email Management Methods  
  async createEmailAccount(packageId: string, email: string, password: string) {
    // Split email into local and domain parts
    const [local, domain] = email.split('@');
    const response = await this.apiClient.post(`/package/${packageId}/email`, {
      local,
      domain,
      password
    });
    return response.data;
  }

  async createEmailForwarder(packageId: string, source: string, destinations: string[]) {
    const [local, domain] = source.split('@');
    const response = await this.apiClient.post(`/package/${packageId}/email/forwarder`, {
      local,
      domain,
      destinations
    });
    return response.data;
  }

  // PHP Management Methods
  async getPhpVersions(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/phpVersion`);
    return response.data;
  }


  // Runtime Environment Management Methods
  async getInstalledApplications(packageId: string) {
    // Get list of installed runtime applications (Node.js, Python, etc.)
    // Shows deployed applications with their configurations
    //
    // API Endpoint: GET /package/{packageId}/web/installedApplications
    // - Returns array of application objects with runtime information
    // - Shows application paths, scripts, and environment settings
    // - Critical for runtime environment management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/installedApplications`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support runtime applications');
      }
      throw error;
    }
  }

  async deployApplication(packageId: string, applicationConfig: {
    domain: string;
    environment: string;
    name: string;
    path: string;
    script: string;
    typeCode: string;
  }) {
    // Deploy a new runtime application (Node.js, Python, etc.)
    // Sets up application environment and deployment configuration
    //
    // API Endpoint: POST /package/{packageId}/web/installedApplications
    // - Deploys new runtime application with specified configuration
    // - Sets environment variables and runtime parameters
    // - Essential for application deployment automation
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/installedApplications`, applicationConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid application configuration. Check typeCode, domain, and script parameters.');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or does not support runtime applications');
      }
      throw error;
    }
  }

  async updateApplicationEnvironment(packageId: string, applicationId: string, environment: string) {
    // Update environment variables and configuration for a runtime application
    // Modifies runtime settings without redeploying application
    //
    // API Endpoint: POST /package/{packageId}/web/installedApplications
    // - Updates environment configuration for existing application
    // - Allows runtime parameter changes and variable updates
    // - Essential for application configuration management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/installedApplications`, {
        id: applicationId,
        environment
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid application ID or environment configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Application not found or package does not support runtime applications');
      }
      throw error;
    }
  }

  async deleteApplication(packageId: string, applicationId: string) {
    // Delete a deployed runtime application
    // Removes application and cleans up associated resources
    //
    // API Endpoint: POST /package/{packageId}/web/installedApplications
    // - Removes deployed application completely
    // - Cleans up runtime environment and resources
    // - Irreversible operation - use with caution
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/installedApplications`, {
        id: applicationId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid application ID or deletion failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Application not found or package does not support runtime applications');
      }
      throw error;
    }
  }

  async getInstalledSoftware(packageId: string) {
    // Get list of installed software by type on managed server
    // Shows available runtime environments and installed software
    //
    // API Endpoint: GET /package/{packageId}/web/installedSoftware
    // - Returns array of installed software type codes
    // - Shows available runtime environments (Node.js, Python, etc.)
    // - Essential for determining deployment capabilities
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/installedSoftware`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or software information not available');
      }
      throw error;
    }
  }

  // Advanced Domain Management Methods
  async transferDomain(applicationConfig: {
    name: string;
    years?: number;
    authcode?: string;
    contact: any;
    emulateYears?: boolean;
    otherContacts?: any;
    limits?: any;
    nameservers?: string[];
    privacyService: boolean;
    stackUser?: string;
  }) {
    // Transfer a domain to your 20i account
    // Initiates domain transfer with full configuration
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/transferDomain`, applicationConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain transfer configuration. Check domain name, contact details, and auth code.');
      }
      throw error;
    }
  }

  async getDomainTransferStatus(packageId: string, domainId: string) {
    // Get current status of domain transfer
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/pendingTransferStatus`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain or transfer status not found');
      }
      throw error;
    }
  }

  async getDomainAuthCode(packageId: string, domainId: string) {
    // Get domain EPP auth code for outbound transfers
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/authCode`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or auth code not available');
      }
      throw error;
    }
  }

  async getDomainWhois(packageId: string, domainId: string) {
    // Get live WHOIS data for domain
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/whois`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or WHOIS data not available');
      }
      throw error;
    }
  }

  async setDomainTransferLock(packageId: string, domainId: string, enabled: boolean) {
    // Set domain transfer lock status
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/canTransfer`, {
        enable: enabled
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or transfer lock not available');
      }
      throw error;
    }
  }

  // Advanced Email Management Methods  
  async getEmailAutoresponder(packageId: string, emailId: string) {
    // Get autoresponder configuration
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/responder`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email domain or autoresponder not found');
      }
      throw error;
    }
  }


  async updateEmailSpamSettings(packageId: string, emailId: string, spamConfig: {
    spamScore?: string;
    rejectScore?: string | number;
  }) {
    // Update spam filtering settings for email domain
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}`, spamConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid spam configuration settings');
      }
      if (error.response?.status === 404) {
        throw new Error('Email domain not found');
      }
      throw error;
    }
  }

  // Development and Logging Methods
  async getErrorLogs(packageId: string) {
    // Get access and error logs (alias for existing method)
    return this.getAccessAndErrorLogs(packageId);
  }


  async cloneWordPressStaging(packageId: string, type: 'live' | 'staging') {
    // Clone WordPress between live and staging environments
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/wordpressStaging`, {
        type
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid clone type. Use "live" or "staging"');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or WordPress staging not available');
      }
      throw error;
    }
  }

  async getTimelineBackups(packageId: string) {
    // Get timeline backup system information
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or timeline backups not available');
      }
      throw error;
    }
  }

  async takeWebSnapshot(packageId: string) {
    // Take a web files snapshot for version control
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/web/takeSnapshot`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or web snapshots not available');
      }
      throw error;
    }
  }

  async restoreWebSnapshot(packageId: string, snapshotId: string) {
    // Restore web files from a snapshot
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/web/restoreSnapshot`, {
        snapshotId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid snapshot ID');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or snapshot not found');
      }
      throw error;
    }
  }

  // Application Management Methods
  async listApplications(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/applications`);
    return response.data;
  }

  async installApplication(packageId: string, applicationId: string, path: string, config?: any) {
    const response = await this.apiClient.post(`/package/${packageId}/web/applications`, {
      applicationId,
      path,
      ...config
    });
    return response.data;
  }

  // Group A1: VPS Management Methods
  // Critical server infrastructure control for VPS hosting
  
  async listVps() {
    // Get all VPS instances in the account
    // Returns array of VPS objects with id and name
    //
    // API Endpoint: GET /vps
    // - Returns all VPS instances
    // - Essential for VPS inventory management
    // - Foundation for all VPS operations
    try {
      const response = await this.apiClient.get('/vps');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No VPS instances found or VPS service not available');
      }
      throw error;
    }
  }

  async getVpsDetails(vpsId: string) {
    // Get comprehensive VPS configuration and status information
    // Returns detailed VPS object with configuration, network, storage, and status
    //
    // API Endpoint: GET /vps/{vpsId}
    // - Returns complete VPS configuration
    // - Includes CPU, RAM, disk, network, and OS information
    // - Critical for VPS monitoring and management
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or access denied');
      }
      throw error;
    }
  }

  async activateVps(vpsId: string, config?: {
    includeRepeated?: boolean;
    subservices?: Record<string, boolean>;
  }) {
    // Activate VPS service and subservices
    // Enables the VPS and any associated services
    //
    // API Endpoint: POST /vps/{vpsId}/userStatus
    // - Activates VPS service
    // - Can include repeated activations and subservice control
    // - Essential for VPS lifecycle management
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/userStatus`, {
        includeRepeated: config?.includeRepeated || false,
        subservices: config?.subservices || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid VPS activation configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or activation not available');
      }
      throw error;
    }
  }

  async deactivateVps(vpsId: string) {
    // Deactivate VPS service
    // Disables the VPS and stops all services
    //
    // API Endpoint: POST /vps/{vpsId}/userStatus
    // - Deactivates VPS service
    // - Stops all running services
    // - Critical for VPS lifecycle management
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/userStatus`, {
        includeRepeated: false,
        subservices: {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or deactivation not available');
      }
      throw error;
    }
  }

  async startVps(vpsId: string) {
    // Start a stopped VPS
    // Powers on the VPS server
    //
    // API Endpoint: POST /vps/{vpsId}/start
    // - Starts the VPS server
    // - Powers on the virtual machine
    // - Critical for VPS operations
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/start`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('VPS cannot be started - check current status');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or start operation not available');
      }
      throw error;
    }
  }

  async stopVps(vpsId: string) {
    // Stop a running VPS
    // Powers down the VPS server gracefully
    //
    // API Endpoint: POST /vps/{vpsId}/stop
    // - Stops the VPS server
    // - Graceful shutdown of the virtual machine
    // - Critical for VPS operations
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/stop`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('VPS cannot be stopped - check current status');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or stop operation not available');
      }
      throw error;
    }
  }

  async rebootVps(vpsId: string) {
    // Reboot a VPS
    // Restarts the VPS server
    //
    // API Endpoint: POST /vps/{vpsId}/reboot
    // - Reboots the VPS server
    // - Performs restart operation
    // - Critical for VPS maintenance
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/reboot`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('VPS cannot be rebooted - check current status');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or reboot operation not available');
      }
      throw error;
    }
  }

  async rebuildVps(vpsId: string, config: {
    ApplicationId?: string;
    cpanel?: boolean;
    cpanelCode?: boolean;
    VpsOsId: string;
  }) {
    // Rebuild VPS with new configuration
    // Rebuilds the VPS with specified OS and applications
    //
    // API Endpoint: POST /vps/{vpsId}/rebuild
    // - Rebuilds VPS with new OS
    // - Can install applications and cPanel
    // - DESTRUCTIVE operation - will wipe existing data
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/rebuild`, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid rebuild configuration - check OS ID and parameters');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or rebuild operation not available');
      }
      throw error;
    }
  }

  async getVpsVncInfo(vpsId: string) {
    // Get VNC console access information
    // Returns VNC connection details for remote console access
    //
    // API Endpoint: GET /vps/{vpsId}/vnc
    // - Returns VNC console information
    // - Includes VNC display, IP ACL, and password info
    // - Critical for VPS troubleshooting and management
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/vnc`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or VNC access not available');
      }
      throw error;
    }
  }

  async lockVpsVnc(vpsId: string) {
    // Lock VNC console access
    // Restricts VNC access for security
    //
    // API Endpoint: POST /vps/{vpsId}/lockVnc
    // - Locks VNC console access
    // - Security measure for VPS protection
    // - Prevents unauthorized console access
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/lockVnc`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or VNC lock operation not available');
      }
      throw error;
    }
  }

  async unlockVpsVnc(vpsId: string, ipAddress: string) {
    // Unlock VNC console access for specific IP
    // Allows VNC access from specified IP address
    //
    // API Endpoint: POST /vps/{vpsId}/unlockVnc
    // - Unlocks VNC console access for specific IP
    // - Security-controlled console access
    // - Essential for remote VPS management
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/unlockVnc`, {
        IpAddress: ipAddress
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid IP address format');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or VNC unlock operation not available');
      }
      throw error;
    }
  }

  async getVpsDisks(vpsId: string) {
    // Get VPS disk information
    // Returns list of disks attached to the VPS
    //
    // API Endpoint: GET /vps/{vpsId}/disk
    // - Returns disk inventory for VPS
    // - Shows disk IDs, specifications, and expiry dates
    // - Essential for storage management
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/disk`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or disk information not available');
      }
      throw error;
    }
  }

  async getVpsLimits(vpsId: string) {
    // Get VPS resource limits
    // Returns current resource limits and quotas
    //
    // API Endpoint: GET /vps/{vpsId}/limits
    // - Returns VPS resource limits
    // - Shows quotas and constraints
    // - Essential for resource management
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/limits`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or limits information not available');
      }
      throw error;
    }
  }

  async addVpsIpv6Address(vpsId: string) {
    // Add IPv6 address to VPS
    // Allocates a free IPv6 address to the VPS
    //
    // API Endpoint: POST /vps/{vpsId}/ipv6Address
    // - Adds IPv6 address to VPS
    // - Enhances network connectivity
    // - Important for modern networking
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/ipv6Address`, {
        version: "6"
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('IPv6 address allocation failed - check VPS configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or IPv6 allocation not available');
      }
      throw error;
    }
  }

  async getVpsReverseDns(vpsId: string) {
    // Get VPS reverse DNS records
    // Returns reverse DNS configuration for all VPS IP addresses
    //
    // API Endpoint: GET /vps/{vpsId}/reverseDNS
    // - Returns reverse DNS records
    // - Shows PTR records for IP addresses
    // - Important for mail server operations
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/reverseDNS`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or reverse DNS information not available');
      }
      throw error;
    }
  }

  async updateVpsReverseDns(vpsId: string, reverseDnsConfig: Record<string, any>) {
    // Update VPS reverse DNS records
    // Configures PTR records for VPS IP addresses
    //
    // API Endpoint: POST /vps/{vpsId}/reverseDNS
    // - Updates reverse DNS records
    // - Configures PTR records
    // - Critical for email server reputation
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/reverseDNS`, reverseDnsConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid reverse DNS configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or reverse DNS update not available');
      }
      throw error;
    }
  }

  async getVpsAvailableOs(vpsId: string) {
    // Get available operating systems for VPS rebuild
    // Returns list of OS codes that can be used for rebuild
    //
    // API Endpoint: GET /vps/{vpsId}/rebuildOperatingSystems
    // - Returns available OS codes for rebuild
    // - Shows supported operating systems
    // - Essential for VPS rebuild planning
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/rebuildOperatingSystems`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or OS information not available');
      }
      throw error;
    }
  }

  async changeVpsRootPassword(vpsId: string, password: string) {
    // Change VPS root password
    // Sets new root password for Linux VPS (will reboot server)
    //
    // API Endpoint: POST /vps/{vpsId}/changePassword
    // - Changes root password
    // - Will reboot the VPS
    // - Important for security management
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/changePassword`, {
        password
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid password format or VPS does not support password change');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or password change not available');
      }
      throw error;
    }
  }

  async getVpsName(vpsId: string) {
    // Get VPS name
    // Returns the current name of the VPS
    //
    // API Endpoint: GET /vps/{vpsId}/name
    // - Returns VPS name
    // - Shows current display name
    // - Useful for VPS identification
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/name`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or name information not available');
      }
      throw error;
    }
  }

  async setVpsName(vpsId: string, name: string) {
    // Set VPS name
    // Updates the display name of the VPS (max 255 characters)
    //
    // API Endpoint: POST /vps/{vpsId}/name
    // - Sets VPS name
    // - Updates display name
    // - Useful for VPS organization
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/name`, {
        name
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid name format - must be 255 characters or less');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or name update not available');
      }
      throw error;
    }
  }

  async getVpsBackups(vpsId: string) {
    // Get VPS backup services
    // Returns list of backup services for the VPS
    //
    // API Endpoint: GET /vps/{vpsId}/backups
    // - Returns backup service information
    // - Shows backup configuration
    // - Essential for data protection
    try {
      const response = await this.apiClient.get(`/vps/${vpsId}/backups`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('VPS not found or backup information not available');
      }
      throw error;
    }
  }

  async updateVpsBackups(vpsId: string, backupConfig: Record<string, any>) {
    // Update VPS backup configuration
    // Updates timeline storage items for the server
    //
    // API Endpoint: POST /vps/{vpsId}/backups
    // - Updates backup configuration
    // - Manages backup settings
    // - Critical for data protection
    try {
      const response = await this.apiClient.post(`/vps/${vpsId}/backups`, backupConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid backup configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('VPS not found or backup update not available');
      }
      throw error;
    }
  }

  // Managed VPS Methods
  async listManagedVps() {
    // Get all managed VPS instances
    // Returns list of managed VPS with enhanced management features
    //
    // API Endpoint: GET /managed_vps
    // - Returns managed VPS instances
    // - Enhanced management capabilities
    // - Professional VPS hosting features
    try {
      const response = await this.apiClient.get('/managed_vps');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No managed VPS instances found or service not available');
      }
      throw error;
    }
  }

  async getManagedVpsDetails(managedVpsId: string) {
    // Get managed VPS details
    // Returns detailed managed VPS information
    //
    // API Endpoint: GET /managed_vps/{managedVpsId}
    // - Returns managed VPS configuration
    // - Enhanced management features
    // - Professional hosting details
    try {
      const response = await this.apiClient.get(`/managed_vps/${managedVpsId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Managed VPS not found or access denied');
      }
      throw error;
    }
  }

  async setManagedVpsProfile(managedVpsId: string, profileId: string) {
    // Set managed VPS profile
    // Configures management profile for enhanced features
    //
    // API Endpoint: POST /managed_vps/{managedVpsId}/profile
    // - Sets management profile
    // - Configures enhanced features
    // - Professional hosting configuration
    try {
      const response = await this.apiClient.post(`/managed_vps/${managedVpsId}/profile`, {
        profileId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid profile ID');
      }
      if (error.response?.status === 404) {
        throw new Error('Managed VPS not found or profile update not available');
      }
      throw error;
    }
  }

  async resetManagedVpsProfile(managedVpsId: string) {
    // Reset managed VPS profile to default
    // Resets management profile to default configuration
    //
    // API Endpoint: POST /managed_vps/{managedVpsId}/profileReset
    // - Resets management profile
    // - Returns to default configuration
    // - Management feature reset
    try {
      const response = await this.apiClient.post(`/managed_vps/${managedVpsId}/profileReset`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Managed VPS not found or profile reset not available');
      }
      throw error;
    }
  }

  async getManagedVpsLimits(managedVpsId: string) {
    // Get managed VPS package limits
    // Returns count of packages that can be created
    //
    // API Endpoint: GET /managed_vps/{managedVpsId}/limits
    // - Returns package creation limits
    // - Shows resource constraints
    // - Management feature information
    try {
      const response = await this.apiClient.get(`/managed_vps/${managedVpsId}/limits`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Managed VPS not found or limits information not available');
      }
      throw error;
    }
  }

  // Group A2: MSSQL Database Services Methods
  // Critical database management for Windows hosting
  
  async listMssqlDatabases() {
    // Get all MSSQL databases across all packages
    // Returns array of MSSQL database objects with package info
    //
    // API Endpoint: GET /mssql
    // - Returns all MSSQL database instances
    // - Shows package assignments and configurations
    // - Essential for database inventory management
    try {
      const response = await this.apiClient.get('/mssql');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('No MSSQL databases found or service not available');
      }
      throw error;
    }
  }

  async getMssqlDatabaseDetails(mssqlId: string) {
    // Get specific MSSQL database details
    // Returns detailed database configuration and status
    //
    // API Endpoint: GET /mssql/{mssqlId}
    // - Returns specific database information
    // - Shows configuration and assignment details
    // - Critical for database management
    try {
      const response = await this.apiClient.get(`/mssql/${mssqlId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('MSSQL database not found or access denied');
      }
      throw error;
    }
  }

  async getPackageMssqlDatabases(packageId: string) {
    // Get MSSQL databases for a specific package
    // Returns databases assigned to the package with usage stats
    //
    // API Endpoint: GET /package/{packageId}/web/mssqlDatabases
    // - Returns package-specific databases
    // - Shows usage quotas and connection details
    // - Essential for package database management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/mssqlDatabases`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or no MSSQL databases available');
      }
      throw error;
    }
  }

  async createMssqlDatabase(packageId: string, name: string, password: string) {
    // Create new MSSQL database and user
    // Creates database and user with same name
    //
    // API Endpoint: POST /package/{packageId}/web/mssqlDatabases
    // - Creates MSSQL database and user
    // - Returns database and user information
    // - Critical for database provisioning
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/mssqlDatabases`, {
        name,
        password
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid database name or password format');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or MSSQL service not available');
      }
      throw error;
    }
  }

  async deleteMssqlDatabase(packageId: string, databaseId: string) {
    // Delete MSSQL database
    // Permanently removes database and all data
    //
    // API Endpoint: POST /package/{packageId}/web/removeMssqlDatabase
    // - Removes MSSQL database
    // - DESTRUCTIVE operation - data cannot be recovered
    // - Returns deletion confirmation
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/removeMssqlDatabase`, {
        id: parseInt(databaseId)
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid database ID');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or database not found');
      }
      throw error;
    }
  }

  async orderMssqlDatabase() {
    // Order MSSQL database allowance for reseller account
    // Adds database allocation that can be assigned to packages
    //
    // API Endpoint: POST /reseller/{resellerId}/addMssql
    // - Orders MSSQL database allowance
    // - Increases database quota for reseller
    // - Required before creating databases
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/addMssql`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Unable to order MSSQL database - check account limits');
      }
      throw error;
    }
  }

  async renewMssqlDatabase(databaseId: string) {
    // Renew MSSQL database subscription
    // Extends database expiration date
    //
    // API Endpoint: POST /reseller/{resellerId}/renewMssql
    // - Renews MSSQL database subscription
    // - Prevents database suspension
    // - Critical for service continuity
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/renewMssql`, {
        id: databaseId
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid database ID for renewal');
      }
      if (error.response?.status === 404) {
        throw new Error('Database not found or renewal not available');
      }
      throw error;
    }
  }

  async assignMssqlToPackage(mssqlId: string, packageId: string) {
    // Assign MSSQL database to hosting package
    // Links database to package for management
    //
    // API Endpoint: POST /mssql/{mssqlId}/package
    // - Assigns database to package
    // - Enables package-based database management
    // - Essential for database organization
    try {
      const response = await this.apiClient.post(`/mssql/${mssqlId}/package`, {
        packageId: parseInt(packageId)
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid MSSQL ID or package ID');
      }
      if (error.response?.status === 404) {
        throw new Error('MSSQL database or package not found');
      }
      throw error;
    }
  }

  async addMssqlUser(packageId: string, databaseId: string, username: string, password: string) {
    // Add user to MSSQL database
    // Creates new user with database access
    //
    // API Endpoint: POST /package/{packageId}/web/mssqlUsers
    // - Creates MSSQL user for database
    // - Grants database access permissions
    // - Essential for multi-user database management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/mssqlUsers`, {
        databaseId: parseInt(databaseId),
        username,
        password
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid username, password, or database ID');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or database not found');
      }
      throw error;
    }
  }

  async removeMssqlUser(packageId: string, databaseId: string, userId: string) {
    // Remove user from MSSQL database
    // Revokes database access for user
    //
    // API Endpoint: POST /package/{packageId}/web/removeMssqlUser
    // - Removes MSSQL user access
    // - Revokes database permissions
    // - Important for access control
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/removeMssqlUser`, {
        databaseId: parseInt(databaseId),
        userId: parseInt(userId)
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid user ID or database ID');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, database, or user not found');
      }
      throw error;
    }
  }

  async updateMssqlUserPassword(packageId: string, databaseId: string, userId: string, password: string) {
    // Update MSSQL user password
    // Changes password for database user
    //
    // API Endpoint: POST /package/{packageId}/web/mssqlUserPassword
    // - Updates user password
    // - Enhances database security
    // - Critical for access management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/mssqlUserPassword`, {
        databaseId: parseInt(databaseId),
        userId: parseInt(userId),
        password
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid password format or user/database ID');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, database, or user not found');
      }
      throw error;
    }
  }

  async takeMssqlSnapshot(packageId: string, databaseId: string) {
    // Take immediate snapshot of MSSQL database
    // Creates backup for data protection
    //
    // API Endpoint: POST /package/{packageId}/web/timelineBackup/database/{databaseId}/takeSnapshot
    // - Creates database snapshot
    // - Enables point-in-time recovery
    // - Critical for data protection
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/takeSnapshot`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Snapshot creation failed - check database status');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or database not found');
      }
      throw error;
    }
  }

  async getMssqlBackupInfo(packageId: string, databaseId: string) {
    // Get MSSQL database backup information
    // Returns backup status and timeline info
    //
    // API Endpoint: GET /package/{packageId}/web/timelineBackup/database/{databaseId}
    // - Returns backup object information
    // - Shows last snapshot time and status
    // - Essential for backup monitoring
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/database/${databaseId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package, database, or backup information not found');
      }
      throw error;
    }
  }

  async restoreMssqlSnapshot(packageId: string, databaseId: string, restoreConfig: {
    action: string;
    RestoreAsOf: number;
    RestorePath: string;
    target: string;
  }) {
    // Restore MSSQL database from snapshot
    // Recovers data from backup point-in-time
    //
    // API Endpoint: POST /package/{packageId}/web/timelineBackup/database/{databaseId}/restoreSnapshot
    // - Restores database from snapshot
    // - Point-in-time recovery capability
    // - Critical for disaster recovery
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/restoreSnapshot`, restoreConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid restore configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, database, or snapshot not found');
      }
      throw error;
    }
  }

  async getMssqlSnapshotJobs(packageId: string, databaseId: string) {
    // Get currently running MSSQL snapshot jobs
    // Shows backup operation status
    //
    // API Endpoint: GET /package/{packageId}/web/timelineBackup/database/{databaseId}/jobs
    // - Returns running backup jobs
    // - Shows operation progress
    // - Important for backup monitoring
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/database/${databaseId}/jobs`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package, database, or job information not found');
      }
      throw error;
    }
  }

  // Group A3: SSL Certificate Management Methods
  // Critical SSL automation for security compliance
  
  async listSslCertificates(packageId: string) {
    // Get all SSL certificates for a package
    // Returns both free and external certificates with details
    //
    // API Endpoint: GET /package/{packageId}/web/certificates
    // - Returns all attached SSL certificates
    // - Shows certificate details and provider info
    // - Essential for SSL inventory management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/certificates`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or no SSL certificates available');
      }
      throw error;
    }
  }

  async orderSslCertificate(name: string, periodMonths: number, configuration?: any) {
    // Order new SSL certificate from 20i
    // Purchases SSL certificate and charges account balance
    //
    // API Endpoint: POST /reseller/{resellerId}/addTlsCertificate
    // - Orders SSL certificate for specified period
    // - Requires sufficient account balance
    // - Essential for SSL certificate provisioning
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/addTlsCertificate`, {
        periodMonths,
        name,
        configuration: configuration || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid SSL certificate configuration or insufficient balance');
      }
      throw error;
    }
  }

  async renewSslCertificate(certificateId: string, periodMonths: number) {
    // Renew existing SSL certificate
    // Extends certificate validity and charges renewal fee
    //
    // API Endpoint: POST /reseller/{resellerId}/renewTlsCertificate
    // - Renews SSL certificate for specified period
    // - Charges renewal fee to account balance
    // - Critical for SSL certificate lifecycle management
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/renewTlsCertificate`, {
        id: certificateId,
        periodMonths
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid certificate ID or insufficient balance for renewal');
      }
      if (error.response?.status === 404) {
        throw new Error('SSL certificate not found or renewal not available');
      }
      throw error;
    }
  }

  async preCheckSslRenewal(certificateId: string, periodMonths: number) {
    // Pre-check SSL certificate renewal
    // Returns new expiration date without charging
    //
    // API Endpoint: POST /reseller/{resellerId}/renewTlsCertificatePre
    // - Checks renewal validity and returns new expiration
    // - No charges applied - validation only
    // - Important for renewal planning
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/renewTlsCertificatePre`, {
        id: certificateId,
        periodMonths
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid certificate ID or renewal parameters');
      }
      if (error.response?.status === 404) {
        throw new Error('SSL certificate not found or renewal check not available');
      }
      throw error;
    }
  }

  async installExternalSslCertificate(packageId: string, sslConfig: {
    name: string;
    certificate: string;
    key: string;
    ca: string;
  }) {
    // Install external SSL certificate
    // Uploads custom SSL certificate to package
    //
    // API Endpoint: POST /package/{packageId}/web/externalSSL
    // - Installs external SSL certificate
    // - Supports custom certificates from any CA
    // - Essential for bring-your-own-certificate workflows
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/externalSSL`, sslConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid SSL certificate format or configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or SSL installation not available');
      }
      throw error;
    }
  }

  async removeSslCertificates(packageId: string, certificateIds: string[]) {
    // Remove SSL certificates from package
    // Deletes specified certificates from web hosting
    //
    // API Endpoint: POST /package/{packageId}/web/certificates
    // - Removes SSL certificates by ID
    // - Returns success status for each deletion
    // - Important for SSL certificate cleanup
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/certificates`, {
        delete: certificateIds
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid certificate IDs for deletion');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or certificates not found');
      }
      throw error;
    }
  }

  async toggleFreeSsl(packageId: string, domainName: string, enabled: boolean) {
    // Toggle free SSL (Let's Encrypt) for domain
    // Enables or disables automatic SSL certificate
    //
    // API Endpoint: POST /package/{packageId}/web/freeSSL
    // - Toggles Let's Encrypt SSL for domain
    // - Automatic certificate issuance and renewal
    // - Cost-effective SSL solution
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/freeSSL`, {
        name: domainName,
        enabled
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain name or free SSL configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or free SSL not available');
      }
      throw error;
    }
  }

  async resendSslApprovalEmail(certificateId: string) {
    // Resend SSL certificate approval email
    // Triggers domain validation email resend
    //
    // API Endpoint: POST /tls_certificate/{id}/retryApproval
    // - Resends SSL approval email for validation
    // - Required for domain-validated certificates
    // - Critical for SSL certificate activation
    try {
      const response = await this.apiClient.post(`/tls_certificate/${certificateId}/retryApproval`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid certificate ID or approval retry failed');
      }
      if (error.response?.status === 404) {
        throw new Error('SSL certificate not found or approval not required');
      }
      throw error;
    }
  }

  async getForceSslStatus(packageId: string) {
    // Get force HTTPS redirect status
    // Returns whether HTTP to HTTPS redirect is enabled
    //
    // API Endpoint: GET /package/{packageId}/web/forceSSL
    // - Returns forced SSL status
    // - Shows HTTP redirect configuration
    // - Important for security policy checking
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/forceSSL`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or force SSL status not available');
      }
      throw error;
    }
  }

  async setForceSsl(packageId: string, enabled: boolean) {
    // Set force HTTPS redirect
    // Enables or disables automatic HTTP to HTTPS redirect
    //
    // API Endpoint: POST /package/{packageId}/web/forceSSL
    // - Sets forced SSL redirect policy
    // - Enhances security by redirecting HTTP traffic
    // - Critical for SSL security enforcement
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/forceSSL`, {
        value: enabled
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid force SSL configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or force SSL not available');
      }
      throw error;
    }
  }

  async getSslCertificateStatus(packageId: string) {
    // Get SSL certificate status and monitoring info
    // Combines certificate listing with status analysis
    //
    // Custom endpoint - combines multiple API calls for comprehensive SSL status
    // - Lists all certificates with details
    // - Analyzes expiration dates and provider info
    // - Provides SSL health check summary
    try {
      const certificates = await this.listSslCertificates(packageId);
      const forceSslStatus = await this.getForceSslStatus(packageId);
      
      const now = new Date().getTime();
      const status = {
        certificates: certificates || [],
        forceSslEnabled: forceSslStatus,
        totalCertificates: (certificates || []).length,
        certificateHealth: (certificates || []).map((cert: any) => {
          const created = cert.createdAt ? new Date(cert.createdAt).getTime() : 0;
          const daysSinceCreated = Math.floor((now - created) / (1000 * 60 * 60 * 24));
          
          return {
            id: cert.id,
            commonName: cert.commonName,
            provider: cert.provider,
            daysSinceCreated,
            status: cert.provider === 'letsencrypt' ? 'auto-renewable' : 'manual'
          };
        })
      };
      
      return status;
    } catch (error: any) {
      throw new Error(`Failed to get SSL status: ${error.message}`);
    }
  }

  // Group A4: Package Administration Methods
  // Critical hosting service provisioning and management
  
  async activatePackage(packageId: string) {
    // Activate hosting package for service use
    // Enables package functionality and resource allocation
    //
    // API Endpoint: POST /package/{packageId}/userStatus
    // - Activates package for normal operation
    // - Enables hosting services and resource access
    // - Critical for package lifecycle management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/userStatus`, {
        value: true
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid package ID or activation failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or activation not available');
      }
      throw error;
    }
  }

  async deactivatePackage(packageId: string) {
    // Deactivate hosting package to suspend services
    // Suspends package functionality while preserving data
    //
    // API Endpoint: POST /package/{packageId}/userStatus
    // - Deactivates package and suspends services
    // - Preserves data while restricting access
    // - Important for service management and billing
    try {
      const response = await this.apiClient.post(`/package/${packageId}/userStatus`, {
        value: false
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid package ID or deactivation failed');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or deactivation not available');
      }
      throw error;
    }
  }

  async updatePackageAllowance(packageId: string, allowanceData: {
    diskSpace?: number;
    bandwidth?: number;
    databases?: number;
    emailAccounts?: number;
    subdomains?: number;
  }) {
    // Update package resource allowances and limits
    // Modifies package quotas and service limits
    //
    // API Endpoint: POST /reseller/{resellerId}/updatePackage
    // - Updates package resource allocations
    // - Modifies service limits and quotas
    // - Critical for resource management
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/updatePackage`, {
        id: packageId,
        ...allowanceData
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid package ID or allowance configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or update not available');
      }
      throw error;
    }
  }

  async deletePackage(packageId: string, deleteFiles: boolean = false) {
    // Delete hosting package and optionally remove files
    // Permanently removes package and associated data
    //
    // API Endpoint: POST /reseller/{resellerId}/deleteWeb
    // - Deletes package from hosting system
    // - Optionally removes all associated files
    // - Irreversible operation - use with caution
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/deleteWeb`, {
        id: packageId,
        deleteFiles
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid package ID or deletion parameters');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or deletion not available');
      }
      throw error;
    }
  }

  async splitPackage(packageId: string, splitConfiguration: {
    newPackageName: string;
    domainsToMove: string[];
    newPackageType?: string;
  }) {
    // Split package into multiple hosting packages
    // Moves domains to new package while preserving original
    //
    // API Endpoint: POST /reseller/{resellerId}/splitPackage
    // - Creates new package from existing one
    // - Moves specified domains to new package
    // - Critical for package reorganization
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/splitPackage`, {
        packageId,
        newPackageName: splitConfiguration.newPackageName,
        domainsToMove: splitConfiguration.domainsToMove,
        packageType: splitConfiguration.newPackageType
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid split configuration or package parameters');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or split operation not available');
      }
      throw error;
    }
  }

  async addStackUserPackageAllowance(stackUserId: string, allowanceConfig: {
    packageType: string;
    quantity: number;
    period?: string;
  }) {
    // Add package allowance for stack user
    // Grants user permission to create packages
    //
    // API Endpoint: POST /reseller/{resellerId}/addStackUserPackageAllowance
    // - Adds package creation allowance for user
    // - Defines package type and quantity limits
    // - Essential for user permission management
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/addStackUserPackageAllowance`, {
        stackUserId,
        packageType: allowanceConfig.packageType,
        quantity: allowanceConfig.quantity,
        period: allowanceConfig.period || 'monthly'
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid stack user ID or allowance configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Stack user not found or allowance addition not available');
      }
      throw error;
    }
  }

  async updateStackUserPackageAllowance(allowanceId: string, updates: {
    quantity?: number;
    period?: string;
    status?: string;
  }) {
    // Update existing stack user package allowance
    // Modifies user's package creation permissions
    //
    // API Endpoint: POST /reseller/{resellerId}/updateStackUserPackageAllowance
    // - Updates existing package allowance settings
    // - Modifies quantity, period, or status
    // - Important for user permission management
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/updateStackUserPackageAllowance`, {
        allowanceId,
        ...updates
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid allowance ID or update configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package allowance not found or update not available');
      }
      throw error;
    }
  }

  async getStackUserPackageAllowance(allowanceId: string) {
    // Get stack user package allowance details
    // Retrieves allowance configuration and usage
    //
    // API Endpoint: GET /reseller/{resellerId}/stackUserPackageAllowance/{allowanceId}
    // - Returns allowance details and current usage
    // - Shows remaining package creation quota
    // - Essential for allowance monitoring
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.get(`/reseller/${resellerId}/stackUserPackageAllowance/${allowanceId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package allowance not found or access not available');
      }
      throw error;
    }
  }

  async clonePackageFromAllowance(allowanceId: string, cloneConfig: {
    domainName: string;
    username: string;
    password: string;
  }) {
    // Create new package using stack user allowance
    // Deploys package from user's allocated quota
    //
    // API Endpoint: POST /reseller/{resellerId}/stackUserPackageAllowance/{allowanceId}/addWeb
    // - Creates package using allowance quota
    // - Deploys with specified configuration
    // - Decrements user's available allowance
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/stackUserPackageAllowance/${allowanceId}/addWeb`, {
        domainName: cloneConfig.domainName,
        username: cloneConfig.username,
        password: cloneConfig.password
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid allowance ID or package configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package allowance not found or insufficient quota');
      }
      throw error;
    }
  }

  // Group B1: Advanced Email Management Methods
  // Enhanced email hosting capabilities and analytics
  
  async getEmailDomainConfiguration(packageId: string, emailId: string) {
    // Get advanced email domain configuration
    // Returns detailed domain-specific email settings
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/domain
    // - Returns email domain configuration details
    // - Shows routing and delivery settings
    // - Essential for email domain management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/domain`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email or domain configuration not found');
      }
      throw error;
    }
  }

  async setEmailDomainAlias(packageId: string, emailId: string, aliasConfig: {
    domain: string;
    enabled: boolean;
  }) {
    // Configure email domain alias settings
    // Manages domain aliases for email routing
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/domainAlias
    // - Sets domain alias configuration
    // - Enables email delivery to multiple domains
    // - Important for multi-domain email hosting
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/domainAlias`, aliasConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain alias configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Email account not found');
      }
      throw error;
    }
  }

  async getEmailStatistics(packageId: string, emailId: string) {
    // Get comprehensive email statistics and analytics
    // Returns usage metrics and performance data
    //
    // API Endpoint: GET /package/{packageId}/email/{emailId}/stats
    // - Returns email usage statistics
    // - Shows sent/received message counts
    // - Critical for email monitoring and analytics
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/${emailId}/stats`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email statistics not available');
      }
      throw error;
    }
  }

  async configurePremiumMailbox(packageId: string, mailboxConfig: {
    emailAddress: string;
    storage: number;
    features: string[];
  }) {
    // Configure premium mailbox features
    // Enables advanced email capabilities
    //
    // API Endpoint: POST /package/{packageId}/email/premium
    // - Configures premium mailbox services
    // - Enables advanced features and storage
    // - Essential for premium email offerings
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/premium`, mailboxConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid premium mailbox configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or premium features not available');
      }
      throw error;
    }
  }

  async getEmailPerformanceMetrics(packageId: string, timeRange?: string) {
    // Get email performance monitoring metrics
    // Returns delivery rates and performance analytics
    //
    // API Endpoint: GET /package/{packageId}/email/performance
    // - Returns email delivery performance
    // - Shows bounce rates and delays
    // - Important for email quality monitoring
    try {
      const params = timeRange ? { timeRange } : {};
      const response = await this.apiClient.get(`/package/${packageId}/email/performance`, { params });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email performance metrics not available');
      }
      throw error;
    }
  }

  async configureEmailRouting(packageId: string, emailId: string, routingRules: {
    priority: number;
    destination: string;
    conditions?: any;
  }) {
    // Configure advanced email routing rules
    // Sets up complex email delivery paths
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/routing
    // - Configures email routing rules
    // - Supports conditional routing logic
    // - Critical for advanced email management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/{emailId}/routing`, routingRules);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid routing configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Email account not found');
      }
      throw error;
    }
  }

  async getEmailQuotaUsage(packageId: string) {
    // Get email quota usage and limits
    // Returns storage and account usage details
    //
    // API Endpoint: GET /package/{packageId}/email/quota
    // - Returns email quota usage statistics
    // - Shows per-account storage consumption
    // - Essential for capacity planning
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/quota`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email quota information not available');
      }
      throw error;
    }
  }

  async configureEmailArchiving(packageId: string, archiveConfig: {
    enabled: boolean;
    retentionDays: number;
    compressionEnabled?: boolean;
  }) {
    // Configure email archiving settings
    // Manages email retention and compliance
    //
    // API Endpoint: POST /package/{packageId}/email/archive
    // - Configures email archiving policies
    // - Sets retention periods and compression
    // - Important for compliance and backup
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/archive`, archiveConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid archive configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or archiving not available');
      }
      throw error;
    }
  }

  async getEmailBackupStatus(packageId: string) {
    // Get email backup status and history
    // Returns backup job status and restoration points
    //
    // API Endpoint: GET /package/{packageId}/email/backup
    // - Returns email backup status
    // - Shows available restore points
    // - Critical for data protection monitoring
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/backup`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email backup information not available');
      }
      throw error;
    }
  }

  async configureAdvancedSpamFiltering(packageId: string, emailId: string, spamConfig: {
    sensitivity: 'low' | 'medium' | 'high' | 'custom';
    customRules?: any[];
    quarantineEnabled: boolean;
  }) {
    // Configure advanced spam filtering rules
    // Enhances email security with custom filters
    //
    // API Endpoint: POST /package/{packageId}/email/{emailId}/spam/advanced
    // - Configures advanced spam filtering
    // - Supports custom rule definitions
    // - Essential for email security enhancement
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/${emailId}/spam/advanced`, spamConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid spam filter configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Email account not found');
      }
      throw error;
    }
  }

  async getEmailReputationScore(packageId: string) {
    // Get email reputation score and metrics
    // Returns sender reputation analytics
    //
    // API Endpoint: GET /package/{packageId}/email/reputation
    // - Returns email sender reputation score
    // - Shows factors affecting deliverability
    // - Critical for email delivery optimization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/reputation`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email reputation data not available');
      }
      throw error;
    }
  }

  async configureEmailSecurityPolicies(packageId: string, policies: {
    enforceEncryption: boolean;
    requireSecurePassword: boolean;
    enableTwoFactor?: boolean;
    ipWhitelist?: string[];
  }) {
    // Configure email security policies
    // Enforces security requirements for email accounts
    //
    // API Endpoint: POST /package/{packageId}/email/security/policies
    // - Sets email security policies
    // - Enforces encryption and authentication
    // - Essential for email security compliance
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/security/policies`, policies);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid security policy configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or security policies not available');
      }
      throw error;
    }
  }

  async getEmailDeliveryAnalytics(packageId: string, analyticsParams?: {
    startDate?: string;
    endDate?: string;
    groupBy?: string;
  }) {
    // Get detailed email delivery analytics
    // Returns comprehensive delivery performance data
    //
    // API Endpoint: GET /package/{packageId}/email/analytics/delivery
    // - Returns email delivery analytics
    // - Shows success rates and failure reasons
    // - Important for email performance optimization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/analytics/delivery`, { 
        params: analyticsParams || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email delivery analytics not available');
      }
      throw error;
    }
  }

  async getEmailUsageReports(packageId: string) {
    // Get comprehensive email usage reports
    // Returns detailed usage statistics and trends
    //
    // API Endpoint: GET /package/{packageId}/email/reports/usage
    // - Returns email usage reports
    // - Shows trends and patterns
    // - Essential for capacity planning
    try {
      const response = await this.apiClient.get(`/package/${packageId}/email/reports/usage`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Email usage reports not available');
      }
      throw error;
    }
  }

  async configureEmailComplianceSettings(packageId: string, complianceConfig: {
    dataRetention: number;
    gdprCompliant: boolean;
    auditLogging: boolean;
    encryptionRequired: boolean;
  }) {
    // Configure email compliance settings
    // Manages regulatory compliance requirements
    //
    // API Endpoint: POST /package/{packageId}/email/compliance
    // - Configures compliance settings
    // - Ensures regulatory requirements
    // - Critical for business compliance
    try {
      const response = await this.apiClient.post(`/package/${packageId}/email/compliance`, complianceConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid compliance configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or compliance features not available');
      }
      throw error;
    }
  }

  // Group B2: Security & Monitoring Methods
  // Enhanced protection and monitoring capabilities
  
  async runMalwareScanAdvanced(packageId: string, scanConfig?: {
    deepScan?: boolean;
    quarantineEnabled?: boolean;
    emailNotification?: boolean;
  }) {
    // Run advanced malware scan with configuration
    // Performs comprehensive security scanning
    //
    // API Endpoint: POST /package/{packageId}/web/malwareScan/advanced
    // - Runs advanced malware scanning
    // - Supports deep scan and quarantine options
    // - Critical for security threat detection
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/malwareScan/advanced`, scanConfig || {});
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid scan configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or malware scanning not available');
      }
      throw error;
    }
  }

  async getSecurityPolicyStatus(packageId: string) {
    // Get comprehensive security policy status
    // Returns all active security policies and compliance
    //
    // API Endpoint: GET /package/{packageId}/security/policies
    // - Returns security policy configuration
    // - Shows compliance status and violations
    // - Essential for security monitoring
    try {
      const response = await this.apiClient.get(`/package/${packageId}/security/policies`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Security policy information not available');
      }
      throw error;
    }
  }

  async configurePasswordPolicies(packageId: string, policies: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expirationDays?: number;
    preventReuse?: number;
  }) {
    // Configure password security policies
    // Sets password requirements and rotation policies
    //
    // API Endpoint: POST /package/{packageId}/security/password-policies
    // - Configures password requirements
    // - Sets expiration and reuse policies
    // - Important for access security
    try {
      const response = await this.apiClient.post(`/package/${packageId}/security/password-policies`, policies);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid password policy configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or password policies not available');
      }
      throw error;
    }
  }

  async manageSshKeyRotation(packageId: string, rotationConfig: {
    enabled: boolean;
    rotationPeriodDays: number;
    notifyBeforeExpiry?: number;
  }) {
    // Configure SSH key rotation policies
    // Automates SSH key lifecycle management
    //
    // API Endpoint: POST /package/{packageId}/security/ssh-key-rotation
    // - Manages SSH key rotation schedule
    // - Automates key replacement workflow
    // - Critical for SSH access security
    try {
      const response = await this.apiClient.post(`/package/${packageId}/security/ssh-key-rotation`, rotationConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid SSH key rotation configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or SSH key rotation not available');
      }
      throw error;
    }
  }

  async getPerformanceMonitoring(packageId: string, metricsConfig?: {
    timeRange?: string;
    granularity?: string;
    includeAlerts?: boolean;
  }) {
    // Get comprehensive performance monitoring data
    // Returns resource usage and performance metrics
    //
    // API Endpoint: GET /package/{packageId}/monitoring/performance
    // - Returns CPU, memory, disk, and bandwidth metrics
    // - Shows performance trends and anomalies
    // - Essential for performance optimization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/monitoring/performance`, {
        params: metricsConfig || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Performance monitoring data not available');
      }
      throw error;
    }
  }

  async getResourceUsageAnalytics(packageId: string) {
    // Get detailed resource usage analytics
    // Returns consumption patterns and recommendations
    //
    // API Endpoint: GET /package/{packageId}/monitoring/resource-analytics
    // - Returns resource usage analytics
    // - Provides optimization recommendations
    // - Important for capacity planning
    try {
      const response = await this.apiClient.get(`/package/${packageId}/monitoring/resource-analytics`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Resource analytics not available');
      }
      throw error;
    }
  }

  async getSecurityEventLogs(packageId: string, filterOptions?: {
    startDate?: string;
    endDate?: string;
    eventType?: string;
    severity?: string;
  }) {
    // Get security event logs and audit trail
    // Returns security-related events and activities
    //
    // API Endpoint: GET /package/{packageId}/security/event-logs
    // - Returns security event history
    // - Filterable by date, type, and severity
    // - Critical for security auditing
    try {
      const response = await this.apiClient.get(`/package/${packageId}/security/event-logs`, {
        params: filterOptions || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Security event logs not available');
      }
      throw error;
    }
  }

  async configureAlertSystem(packageId: string, alertConfig: {
    emailNotifications: boolean;
    smsNotifications?: boolean;
    webhookUrl?: string;
    alertThresholds: {
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      bandwidthUsage?: number;
    };
  }) {
    // Configure monitoring alert system
    // Sets up notifications for resource and security alerts
    //
    // API Endpoint: POST /package/{packageId}/monitoring/alerts
    // - Configures alert thresholds and notifications
    // - Supports multiple notification channels
    // - Essential for proactive monitoring
    try {
      const response = await this.apiClient.post(`/package/${packageId}/monitoring/alerts`, alertConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid alert configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or alert system not available');
      }
      throw error;
    }
  }

  async getAuditTrailReport(packageId: string, auditParams?: {
    startDate?: string;
    endDate?: string;
    userFilter?: string;
    actionFilter?: string;
  }) {
    // Get comprehensive audit trail report
    // Returns detailed activity logs for compliance
    //
    // API Endpoint: GET /package/{packageId}/audit/trail
    // - Returns complete audit trail
    // - Tracks all user actions and changes
    // - Important for compliance and forensics
    try {
      const response = await this.apiClient.get(`/package/${packageId}/audit/trail`, {
        params: auditParams || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Audit trail not available');
      }
      throw error;
    }
  }

  async enforceSecurityCompliance(packageId: string, complianceRules: {
    standard: 'PCI-DSS' | 'ISO-27001' | 'SOC-2' | 'CUSTOM';
    strictMode: boolean;
    autoRemediation?: boolean;
    customRules?: any[];
  }) {
    // Enforce security compliance standards
    // Applies security rules based on compliance requirements
    //
    // API Endpoint: POST /package/{packageId}/security/compliance/enforce
    // - Enforces compliance standards
    // - Supports auto-remediation of violations
    // - Critical for regulatory compliance
    try {
      const response = await this.apiClient.post(`/package/${packageId}/security/compliance/enforce`, complianceRules);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid compliance configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or compliance enforcement not available');
      }
      throw error;
    }
  }

  // Group C1: DNS & Domain Advanced Methods
  // Enterprise DNS capabilities and advanced domain management
  
  async configureDnssec(packageId: string, domainId: string, dnssecConfig: {
    enabled: boolean;
    algorithm?: string;
    keySize?: number;
  }) {
    // Configure DNSSEC for enhanced DNS security
    // Enables cryptographic signing of DNS records
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/dnssec
    // - Configures DNSSEC settings
    // - Enables DNS security extensions
    // - Critical for DNS security and integrity
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/dnssec`, dnssecConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNSSEC configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or DNSSEC not available');
      }
      throw error;
    }
  }

  async manageVirtualNameservers(nameserverConfig: {
    action: 'create' | 'update' | 'delete';
    hostname: string;
    ipAddresses: string[];
    glueRecords?: any[];
  }) {
    // Manage virtual nameserver configuration
    // Creates and manages custom nameservers
    //
    // API Endpoint: POST /reseller/{resellerId}/virtualNameserver
    // - Manages virtual nameserver setup
    // - Configures custom DNS hosting
    // - Important for DNS infrastructure
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/virtualNameserver`, nameserverConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid nameserver configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Virtual nameserver management not available');
      }
      throw error;
    }
  }

  async configureAdvancedDnsRecords(packageId: string, domainId: string, recordConfig: {
    recordType: string;
    name: string;
    value: string;
    ttl?: number;
    priority?: number;
    weight?: number;
    port?: number;
    flags?: number;
    tag?: string;
  }) {
    // Configure advanced DNS record types
    // Supports complex DNS configurations beyond basic records
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/dns/advanced
    // - Creates advanced DNS record types
    // - Supports SRV, CAA, TLSA, and other specialized records
    // - Essential for complex DNS setups
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/dns/advanced`, recordConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNS record configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or advanced DNS not available');
      }
      throw error;
    }
  }

  async getDnsAnalytics(packageId: string, domainId: string, analyticsConfig?: {
    timeRange?: string;
    queryTypes?: string[];
    includeGeolocation?: boolean;
  }) {
    // Get DNS query analytics and performance data
    // Returns DNS query statistics and patterns
    //
    // API Endpoint: GET /package/{packageId}/domain/{domainId}/dns/analytics
    // - Returns DNS query analytics
    // - Shows query patterns and performance
    // - Important for DNS optimization
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/dns/analytics`, {
        params: analyticsConfig || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('DNS analytics not available');
      }
      throw error;
    }
  }

  async configureDnsSecurityMonitoring(packageId: string, domainId: string, monitoringConfig: {
    enabled: boolean;
    alertThresholds: {
      suspiciousQueries?: number;
      anomalousTraffic?: number;
      dnssecFailures?: number;
    };
    notificationSettings: {
      email?: boolean;
      webhook?: string;
    };
  }) {
    // Configure DNS security monitoring and alerts
    // Monitors DNS for security threats and anomalies
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/dns/security-monitoring
    // - Configures DNS security monitoring
    // - Sets up threat detection and alerts
    // - Critical for DNS security management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/dns/security-monitoring`, monitoringConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNS security monitoring configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or DNS security monitoring not available');
      }
      throw error;
    }
  }

  async optimizeDnsPerformance(packageId: string, domainId: string, optimizationConfig: {
    enableCaching: boolean;
    cacheTtl?: number;
    enableGeoDns?: boolean;
    geoRules?: any[];
  }) {
    // Optimize DNS performance with caching and geo-DNS
    // Enhances DNS response times and reliability
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/dns/optimization
    // - Configures DNS performance optimization
    // - Enables caching and geographic routing
    // - Important for DNS performance
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/dns/optimization`, optimizationConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNS optimization configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or DNS optimization not available');
      }
      throw error;
    }
  }

  async setupThirdPartyDnsIntegration(packageId: string, domainId: string, integrationConfig: {
    provider: 'google-apps' | 'office365' | 'custom';
    configuration: any;
    verificationMethod?: string;
  }) {
    // Setup third-party DNS integrations
    // Configures DNS for external services
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/dns/integration
    // - Sets up third-party DNS integrations
    // - Configures service-specific DNS records
    // - Essential for external service integration
    try {
      const endpoint = integrationConfig.provider === 'google-apps' 
        ? `/package/${packageId}/domain/${domainId}/dns/googleApps`
        : integrationConfig.provider === 'office365'
        ? `/package/${packageId}/domain/${domainId}/dns/office365Mail`
        : `/package/${packageId}/domain/${domainId}/dns/integration`;
        
      const response = await this.apiClient.post(endpoint, integrationConfig.configuration);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid third-party DNS integration configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or DNS integration not available');
      }
      throw error;
    }
  }

  async manageDnsBackupRestore(packageId: string, domainId: string, operation: {
    action: 'backup' | 'restore' | 'list';
    backupName?: string;
    restorePoint?: string;
  }) {
    // Manage DNS configuration backup and restore
    // Provides DNS configuration versioning and recovery
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/dns/backup
    // - Manages DNS configuration backups
    // - Enables DNS configuration restoration
    // - Important for DNS disaster recovery
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/dns/backup`, operation);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNS backup operation');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or DNS backup not available');
      }
      throw error;
    }
  }

  async configureDnsTemplates(packageId: string, templateConfig: {
    action: 'create' | 'apply' | 'list' | 'delete';
    templateName?: string;
    domainId?: string;
    recordSet?: any[];
  }) {
    // Manage DNS record templates
    // Creates reusable DNS configurations
    //
    // API Endpoint: POST /package/{packageId}/dns/templates
    // - Manages DNS record templates
    // - Enables rapid DNS deployment
    // - Important for standardized DNS setups
    try {
      const response = await this.apiClient.post(`/package/${packageId}/dns/templates`, templateConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNS template configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or DNS templates not available');
      }
      throw error;
    }
  }

  async performDnsBulkOperations(packageId: string, bulkConfig: {
    operation: 'create' | 'update' | 'delete';
    domains: string[];
    recordTemplate: any;
    validationMode?: boolean;
  }) {
    // Perform bulk DNS operations across multiple domains
    // Enables mass DNS configuration changes
    //
    // API Endpoint: POST /package/{packageId}/dns/bulk
    // - Performs bulk DNS operations
    // - Supports multiple domain updates
    // - Essential for large-scale DNS management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/dns/bulk`, bulkConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid bulk DNS operation configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or bulk DNS operations not available');
      }
      throw error;
    }
  }

  async manageDnsApiAccess(packageId: string, apiConfig: {
    enabled: boolean;
    accessKeys?: string[];
    permissions?: string[];
    rateLimits?: any;
  }) {
    // Manage DNS API access and permissions
    // Controls programmatic DNS access
    //
    // API Endpoint: POST /package/{packageId}/dns/api-access
    // - Manages DNS API access
    // - Configures API permissions and limits
    // - Important for automated DNS management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/dns/api-access`, apiConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid DNS API configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or DNS API access not available');
      }
      throw error;
    }
  }

  async getDnsTroubleshootingTools(packageId: string, domainId: string, toolConfig: {
    tool: 'propagation' | 'validation' | 'trace' | 'health-check';
    parameters?: any;
  }) {
    // Access DNS troubleshooting and diagnostic tools
    // Provides DNS debugging and analysis capabilities
    //
    // API Endpoint: GET /package/{packageId}/domain/{domainId}/dns/troubleshoot
    // - Provides DNS troubleshooting tools
    // - Enables DNS diagnostics and validation
    // - Essential for DNS problem resolution
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/dns/troubleshoot`, {
        params: { tool: toolConfig.tool, ...toolConfig.parameters }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid troubleshooting tool configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or troubleshooting tools not available');
      }
      throw error;
    }
  }

  async manageDomainTransferOperations(packageId: string, domainId: string, transferConfig: {
    action: 'initiate' | 'approve' | 'reject' | 'cancel' | 'status';
    authCode?: string;
    targetRegistrar?: string;
    transferData?: any;
  }) {
    // Manage comprehensive domain transfer operations
    // Handles all aspects of domain transfer workflow
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/transfer
    // - Manages domain transfer operations
    // - Handles transfer workflow and status
    // - Critical for domain management
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/transfer`, transferConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain transfer configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or transfer not available');
      }
      throw error;
    }
  }

  async getEppCodeManagement(packageId: string, domainId: string, action: 'get' | 'regenerate') {
    // Manage EPP authorization codes for domain transfers
    // Handles EPP code generation and retrieval
    //
    // API Endpoint: GET/POST /package/{packageId}/domain/{domainId}/authCode
    // - Manages EPP authorization codes
    // - Enables secure domain transfers
    // - Essential for domain transfer security
    try {
      const method = action === 'get' ? 'get' : 'post';
      const response = await this.apiClient[method](`/package/${packageId}/domain/${domainId}/authCode`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or EPP code not available');
      }
      throw error;
    }
  }

  async manageDomainVerificationSystems(packageId: string, domainId: string, verificationConfig: {
    method: 'dns' | 'email' | 'file' | 'meta';
    purpose: 'ownership' | 'ssl' | 'service' | 'compliance';
    configuration: any;
  }) {
    // Manage domain verification for various purposes
    // Handles multiple verification methods and use cases
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/verification
    // - Manages domain verification systems
    // - Supports multiple verification methods
    // - Important for domain ownership and compliance
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/verification`, verificationConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain verification configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or verification not available');
      }
      throw error;
    }
  }

  async getDomainAnalytics(packageId: string, domainId: string, analyticsConfig?: {
    metrics?: string[];
    timeRange?: string;
    includeSubdomains?: boolean;
  }) {
    // Get comprehensive domain analytics and insights
    // Returns domain usage and performance data
    //
    // API Endpoint: GET /package/{packageId}/domain/{domainId}/analytics
    // - Returns domain analytics and metrics
    // - Shows usage patterns and trends
    // - Important for domain performance analysis
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/analytics`, {
        params: analyticsConfig || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain analytics not available');
      }
      throw error;
    }
  }

  async manageDomainBulkOperations(bulkConfig: {
    operation: 'register' | 'renew' | 'transfer' | 'update';
    domains: string[];
    configuration: any;
    validationMode?: boolean;
  }) {
    // Perform bulk domain operations
    // Enables mass domain management tasks
    //
    // API Endpoint: POST /reseller/{resellerId}/domains/bulk
    // - Performs bulk domain operations
    // - Supports multiple domain management
    // - Essential for large-scale domain administration
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/domains/bulk`, bulkConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid bulk domain operation configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Bulk domain operations not available');
      }
      throw error;
    }
  }

  async getDomainPortfolioManagement(portfolioConfig?: {
    groupBy?: string;
    filters?: any;
    sortBy?: string;
    includeAnalytics?: boolean;
  }) {
    // Get comprehensive domain portfolio overview
    // Returns organized view of all managed domains
    //
    // API Endpoint: GET /reseller/{resellerId}/domains/portfolio
    // - Returns domain portfolio overview
    // - Provides organized domain management
    // - Important for domain portfolio analysis
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.get(`/reseller/${resellerId}/domains/portfolio`, {
        params: portfolioConfig || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain portfolio not available');
      }
      throw error;
    }
  }

  async manageDomainPrivacyControl(packageId: string, domainId: string, privacyConfig: {
    enabled: boolean;
    privacyLevel?: 'basic' | 'enhanced' | 'premium';
    customSettings?: any;
  }) {
    // Manage domain privacy protection settings
    // Controls WHOIS privacy and protection features
    //
    // API Endpoint: POST /package/{packageId}/domain/{domainId}/privacy
    // - Manages domain privacy settings
    // - Controls WHOIS information visibility
    // - Important for domain privacy protection
    try {
      const response = await this.apiClient.post(`/package/${packageId}/domain/${domainId}/privacy`, privacyConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain privacy configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Domain not found or privacy control not available');
      }
      throw error;
    }
  }

  async getAdvancedWhoisManagement(packageId: string, domainId: string, whoisConfig?: {
    includeHistory?: boolean;
    privacyMask?: boolean;
    contactOverrides?: any;
  }) {
    // Get advanced WHOIS information and management
    // Returns comprehensive WHOIS data and controls
    //
    // API Endpoint: GET /package/{packageId}/domain/{domainId}/whois/advanced
    // - Returns advanced WHOIS information
    // - Provides WHOIS management capabilities
    // - Important for domain information management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/domain/${domainId}/whois/advanced`, {
        params: whoisConfig || {}
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain WHOIS information not available');
      }
      throw error;
    }
  }

  // Group C2: Platform Tools Methods
  // Windows and platform-specific tools for hosting environment management
  
  async recycleApplicationPool(packageId: string) {
    // Recycle Windows IIS application pool
    // Restarts the application pool to clear memory and reset processes
    //
    // API Endpoint: POST /package/{packageId}/web/recycleApplicationPool
    // - Recycles Windows application pool
    // - Clears memory and resets processes
    // - Essential for Windows hosting maintenance
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/recycleApplicationPool`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid application pool recycle request');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or Windows hosting not available');
      }
      throw error;
    }
  }

  async getWindowsConfiguration(packageId: string) {
    // Get Windows IIS configuration settings
    // Retrieves current Windows hosting configuration
    //
    // API Endpoint: GET /package/{packageId}/web/windowsConfiguration
    // - Gets Windows hosting configuration
    // - Shows IIS settings and runtime versions
    // - Important for Windows platform management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/windowsConfiguration`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or Windows hosting not available');
      }
      throw error;
    }
  }

  async updateWindowsConfiguration(packageId: string, config: {
    ApplicationPoolPipelineMode?: string;
    ApplicationPoolRuntimeVersion?: string;
  }) {
    // Update Windows IIS configuration settings
    // Configures Windows hosting environment
    //
    // API Endpoint: POST /package/{packageId}/web/windowsConfiguration
    // - Updates Windows hosting configuration
    // - Sets pipeline mode and runtime version
    // - Critical for Windows application compatibility
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/windowsConfiguration`, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid Windows configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or Windows hosting not available');
      }
      throw error;
    }
  }

  async getOneClickApplications(packageId: string) {
    // Get available one-click installation applications
    // Lists applications available for automated installation
    //
    // API Endpoint: GET /package/{packageId}/web/oneclick
    // - Lists available one-click applications
    // - Shows installation options and versions
    // - Essential for rapid application deployment
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/oneclick`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or one-click applications not available');
      }
      throw error;
    }
  }

  async reinstallSoftware(packageId: string, softwareConfig: {
    software: string;
    version?: string;
    domain?: string;
    path?: string;
  }) {
    // Reinstall platform software (e.g., WordPress)
    // Performs fresh installation of hosting platform software
    //
    // API Endpoint: POST /package/{packageId}/web/reinstall
    // - Reinstalls platform software
    // - Resets software to clean state
    // - Important for software recovery and updates
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/reinstall`, softwareConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid software reinstallation configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found or software not available');
      }
      throw error;
    }
  }

  // Group D1: Backup & Recovery Methods
  // Comprehensive data protection and disaster recovery capabilities
  
  async takeDatabaseSnapshot(packageId: string, databaseId: string) {
    // Create database snapshot for backup
    // Takes a point-in-time snapshot of database for recovery
    //
    // API Endpoint: POST /package/{packageId}/web/timelineBackup/database/{databaseId}/takeSnapshot
    // - Creates database backup snapshot
    // - Enables point-in-time recovery
    // - Critical for data protection
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/takeSnapshot`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid database snapshot request');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or database not found');
      }
      throw error;
    }
  }

  async takeMailboxSnapshot(packageId: string, mailboxId: string) {
    // Create mailbox snapshot for backup
    // Takes a point-in-time snapshot of mailbox for recovery
    //
    // API Endpoint: POST /package/{packageId}/web/timelineBackup/mailbox/{mailboxId}/takeSnapshot
    // - Creates mailbox backup snapshot
    // - Enables email data recovery
    // - Essential for email data protection
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/mailbox/${mailboxId}/takeSnapshot`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid mailbox snapshot request');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or mailbox not found');
      }
      throw error;
    }
  }

  async restoreDatabaseSnapshot(packageId: string, databaseId: string, snapshotConfig: {
    snapshotId: string;
    restorePoint?: string;
  }) {
    // Restore database from snapshot
    // Restores database to previous point in time
    //
    // API Endpoint: POST /package/{packageId}/web/timelineBackup/database/{databaseId}/restoreSnapshot
    // - Restores database from backup
    // - Enables disaster recovery
    // - Critical for data recovery operations
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/database/${databaseId}/restoreSnapshot`, snapshotConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid database restore request');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, database, or snapshot not found');
      }
      throw error;
    }
  }

  async restoreMailboxSnapshot(packageId: string, mailboxId: string, snapshotConfig: {
    snapshotId: string;
    restorePoint?: string;
  }) {
    // Restore mailbox from snapshot
    // Restores mailbox to previous point in time
    //
    // API Endpoint: POST /package/{packageId}/web/timelineBackup/mailbox/{mailboxId}/restoreSnapshot
    // - Restores mailbox from backup
    // - Enables email data recovery
    // - Essential for email disaster recovery
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/timelineBackup/mailbox/${mailboxId}/restoreSnapshot`, snapshotConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid mailbox restore request');
      }
      if (error.response?.status === 404) {
        throw new Error('Package, mailbox, or snapshot not found');
      }
      throw error;
    }
  }


  async getDatabaseBackups(packageId: string, databaseId: string) {
    // Get database backup information
    // Lists available database backups and snapshots
    //
    // API Endpoint: GET /package/{packageId}/web/timelineBackup/database/{databaseId}
    // - Lists database backup snapshots
    // - Shows backup history and status
    // - Important for backup management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/database/${databaseId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package or database not found');
      }
      throw error;
    }
  }

  async getMailboxBackups(packageId: string, mailboxId: string) {
    // Get mailbox backup information
    // Lists available mailbox backups and snapshots
    //
    // API Endpoint: GET /package/{packageId}/web/timelineBackup/mailbox/{mailboxId}
    // - Lists mailbox backup snapshots
    // - Shows email backup history
    // - Essential for email backup management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/mailbox/${mailboxId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package or mailbox not found');
      }
      throw error;
    }
  }

  async getWebBackups(packageId: string) {
    // Get web files backup information
    // Lists available web file backups and snapshots
    //
    // API Endpoint: GET /package/{packageId}/web/timelineBackup/web
    // - Lists web file backup snapshots
    // - Shows website backup history
    // - Critical for website backup management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup/web`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found');
      }
      throw error;
    }
  }

  async getTimelineBackupOverview(packageId: string) {
    // Get comprehensive backup overview
    // Shows all backup types and schedules for package
    //
    // API Endpoint: GET /package/{packageId}/web/timelineBackup
    // - Lists all backup categories
    // - Shows backup schedules and policies
    // - Essential for backup strategy overview
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/timelineBackup`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found');
      }
      throw error;
    }
  }

  // Group D2: Automation & Branding Methods
  // Advanced automation, optimization, and white-label branding capabilities
  
  async getScheduledTasks(packageId: string) {
    // Get scheduled tasks and cron jobs
    // Lists all automated tasks configured for the package
    //
    // API Endpoint: GET /package/{packageId}/web/tasks
    // - Lists scheduled tasks and cron jobs
    // - Shows task schedules and configurations
    // - Essential for automation management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/tasks`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found');
      }
      throw error;
    }
  }

  async createScheduledTask(packageId: string, taskConfig: {
    command: string;
    schedule: string;
    enabled?: boolean;
    description?: string;
  }) {
    // Create new scheduled task/cron job
    // Adds automated task to package
    //
    // API Endpoint: POST /package/{packageId}/web/tasks
    // - Creates scheduled task
    // - Configures automation
    // - Important for workflow automation
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/tasks`, taskConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid scheduled task configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found');
      }
      throw error;
    }
  }

  async testScheduledTask(packageId: string, taskId: string) {
    // Test scheduled task execution
    // Validates task configuration and execution
    //
    // API Endpoint: POST /package/{packageId}/web/testCronTask
    // - Tests cron task execution
    // - Validates task configuration
    // - Critical for automation reliability
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/testCronTask`, { taskId });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid task test request');
      }
      if (error.response?.status === 404) {
        throw new Error('Package or task not found');
      }
      throw error;
    }
  }

  async generateSitemap(packageId: string, sitemapConfig?: {
    domain?: string;
    includeImages?: boolean;
    priority?: number;
    changeFreq?: string;
  }) {
    // Generate website sitemap for SEO
    // Creates XML sitemap for search engine optimization
    //
    // API Endpoint: POST /package/{packageId}/web/sitemap
    // - Generates SEO sitemap
    // - Configures sitemap options
    // - Essential for SEO optimization
    try {
      const response = await this.apiClient.post(`/package/${packageId}/web/sitemap`, sitemapConfig || {});
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid sitemap configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Package not found');
      }
      throw error;
    }
  }

  async getStackCacheStatus(packageId: string) {
    // Get StackCache performance optimization status
    // Shows caching configuration and performance
    //
    // API Endpoint: GET /package/{packageId}/web/stackCache
    // - Gets performance cache status
    // - Shows optimization settings
    // - Important for performance management
    try {
      const response = await this.apiClient.get(`/package/${packageId}/web/stackCache`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Package not found or StackCache not available');
      }
      throw error;
    }
  }

  async configurePackageBranding(brandingConfig: {
    packageType: string;
    brandName?: string;
    logoUrl?: string;
    colorScheme?: string;
    customization?: any;
  }) {
    // Configure package branding for white-label hosting
    // Sets up custom branding for reseller packages
    //
    // API Endpoint: POST /reseller/{resellerId}/packageTypeBrand
    // - Configures package branding
    // - Sets white-label customization
    // - Essential for reseller branding
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/packageTypeBrand`, brandingConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid branding configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Reseller or package type not found');
      }
      throw error;
    }
  }

  async configureNominetBranding(nominetConfig: {
    enabled: boolean;
    brandName?: string;
    contactInfo?: any;
    customization?: any;
  }) {
    // Configure Nominet domain branding
    // Sets up UK domain branding and customization
    //
    // API Endpoint: POST /reseller/{resellerId}/nominetBrand
    // - Configures Nominet branding
    // - Sets UK domain customization
    // - Important for UK market branding
    const resellerInfo = await this.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }

    try {
      const response = await this.apiClient.post(`/reseller/${resellerId}/nominetBrand`, nominetConfig);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid Nominet branding configuration');
      }
      if (error.response?.status === 404) {
        throw new Error('Reseller not found or Nominet branding not available');
      }
      throw error;
    }
  }


  // FTP Management Methods
  async createFtpUser(packageId: string, username: string, password: string, path?: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/ftp`, {
      username,
      password,
      path: path || '/'
    });
    return response.data;
  }

  async listFtpUsers(packageId: string) {
    const response = await this.apiClient.get(`/package/${packageId}/web/ftp`);
    return response.data;
  }

  async manageDirectories(packageId: string, action: 'create' | 'delete', path: string) {
    const response = await this.apiClient.post(`/package/${packageId}/web/directories`, {
      action,
      path
    });
    return response.data;
  }

}

const server = new Server(
  {
    name: '20i-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const twentyIClient = new TwentyIClient();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_reseller_info',
        description: 'Get reseller account information and overview',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_account_balance',
        description: 'Get account balance and billing information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_domains',
        description: 'List all domains in the reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_domain_info',
        description: 'Get detailed information about a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'The domain ID to get information for',
            },
          },
          required: ['domain_id'],
        },
      },
      {
        name: 'list_hosting_packages',
        description: 'List all hosting packages in the reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_hosting_package_info',
        description: 'Get detailed information about a specific hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get information for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_hosting_package',
        description: 'Create a new hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            domain_name: {
              type: 'string',
              description: 'Domain name for the hosting package',
            },
            package_type: {
              type: 'string',
              description: 'Type of hosting package (e.g., "shared", "reseller")',
            },
            username: {
              type: 'string',
              description: 'Username for the hosting account',
            },
            password: {
              type: 'string',
              description: 'Password for the hosting account',
            },
          },
          required: ['domain_name', 'package_type', 'username', 'password'],
        },
      },
      {
        name: 'get_hosting_package_web_info',
        description: 'Get web-specific hosting package information',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get web information for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_hosting_package_limits',
        description: 'Get hosting package limits and quotas',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get limits for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_hosting_package_usage',
        description: 'Get hosting package usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get usage statistics for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'list_cloud_servers',
        description: 'List all cloud servers in the reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_cloud_server',
        description: 'Create a new cloud server',
        inputSchema: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              description: 'Cloud provider (e.g., "aws", "digitalocean")',
            },
            size: {
              type: 'string',
              description: 'Server size/specification',
            },
            location: {
              type: 'string',
              description: 'Server location/region',
            },
            name: {
              type: 'string',
              description: 'Name for the cloud server',
            },
          },
          required: ['provider', 'size', 'location', 'name'],
        },
      },
      {
        name: 'get_dns_records',
        description: 'Get DNS records for a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'The domain ID to get DNS records for',
            },
          },
          required: ['domain_id'],
        },
      },
      {
        name: 'update_dns_record',
        description: 'Add or update DNS records for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'The domain ID to update DNS records for',
            },
            record_type: {
              type: 'string',
              description: 'DNS record type (A, AAAA, CNAME, MX, TXT, etc.)',
            },
            name: {
              type: 'string',
              description: 'DNS record name/subdomain',
            },
            value: {
              type: 'string',
              description: 'DNS record value',
            },
            ttl: {
              type: 'number',
              description: 'Time to live (TTL) for the DNS record',
              default: 3600,
            },
          },
          required: ['domain_id', 'record_type', 'name', 'value'],
        },
      },
      {
        name: 'register_domain',
        description: 'Register a new domain name',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Domain name to register (e.g., example.com)',
            },
            years: {
              type: 'number',
              description: 'Number of years to register for',
              default: 1,
            },
            contact: {
              type: 'object',
              description: 'Contact information for domain registration',
              properties: {
                name: {
                  type: 'string',
                  description: 'Contact person name',
                },
                organisation: {
                  type: 'string',
                  description: 'Organisation name (optional)',
                },
                address: {
                  type: 'string',
                  description: 'Street address',
                },
                city: {
                  type: 'string',
                  description: 'City',
                },
                sp: {
                  type: 'string',
                  description: 'State/Province',
                },
                pc: {
                  type: 'string',
                  description: 'Postal code',
                },
                cc: {
                  type: 'string',
                  description: 'Country code (e.g., GB, US)',
                },
                telephone: {
                  type: 'string',
                  description: 'Phone number',
                },
                email: {
                  type: 'string',
                  description: 'Email address',
                },
              },
              required: ['name', 'address', 'city', 'sp', 'pc', 'cc', 'telephone', 'email'],
            },
            privacy_service: {
              type: 'boolean',
              description: 'Enable domain privacy protection',
              default: false,
            },
            nameservers: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Custom nameservers (optional, defaults to 20i nameservers)',
            },
            stack_user: {
              type: 'string',
              description: 'Stack user to grant access to (optional)',
            },
          },
          required: ['name', 'years', 'contact'],
        },
      },
      {
        name: 'search_domains',
        description: 'Search for domain availability and get suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            search_term: {
              type: 'string',
              description: 'Domain name or prefix to search for. Can be a full domain name (e.g., "example.com") or a prefix (e.g., "example") to search across all TLDs',
            },
            suggestions: {
              type: 'boolean',
              description: 'Enable domain name suggestions (default: false)',
            },
            tlds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific TLDs to search (optional, defaults to all supported TLDs)',
            },
          },
          required: ['search_term'],
        },
      },
      {
        name: 'get_domain_verification_status',
        description: 'Get domain verification status for all domains',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'resend_domain_verification_email',
        description: 'Resend domain verification email for a specific domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID requiring verification',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_dkim_signature',
        description: 'Get DKIM signature configuration for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'set_dkim_signature',
        description: 'Set or delete DKIM signature for email authentication',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
            action: {
              type: 'string',
              enum: ['set', 'delete'],
              description: 'Action to perform - set or delete DKIM signature',
            },
            canonicalization: {
              type: 'string',
              description: 'DKIM canonicalization method (optional)',
            },
            selector: {
              type: 'string',
              description: 'DKIM selector (optional)',
            },
            is_default: {
              type: 'boolean',
              description: 'Set as default DKIM signature (optional)',
            },
            note: {
              type: 'string',
              description: 'Note for DKIM configuration (optional)',
            },
          },
          required: ['package_id', 'email_id', 'action'],
        },
      },
      {
        name: 'get_dmarc_policy',
        description: 'Get DMARC policy configuration for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'set_dmarc_policy',
        description: 'Set or delete DMARC policy for email authentication',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
            action: {
              type: 'string',
              enum: ['set', 'delete'],
              description: 'Action to perform - set or delete DMARC policy',
            },
            policy: {
              type: 'string',
              enum: ['none', 'quarantine', 'reject'],
              description: 'DMARC policy action (required when action=set)',
            },
            subdomain_policy: {
              type: 'string',
              enum: ['none', 'quarantine', 'reject'],
              description: 'DMARC policy for subdomains (optional)',
            },
            percentage: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Percentage of emails to apply policy to (optional, default 100)',
            },
            reporting_uri: {
              type: 'string',
              description: 'URI for aggregate reports (optional)',
            },
            alignment_mode: {
              type: 'string',
              enum: ['strict', 'relaxed'],
              description: 'DMARC alignment mode (optional, default relaxed)',
            },
            note: {
              type: 'string',
              description: 'Note for DMARC configuration (optional)',
            },
          },
          required: ['package_id', 'email_id', 'action'],
        },
      },
      {
        name: 'get_php_versions',
        description: 'Get available PHP versions for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_current_php_version',
        description: 'Get the current PHP version for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_php_version',
        description: 'Set the PHP version for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            version: {
              type: 'string',
              description: 'PHP version to set (e.g., "8.2", "7.4")',
            },
          },
          required: ['package_id', 'version'],
        },
      },
      {
        name: 'get_php_config_options',
        description: 'Get allowed PHP configuration directives for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_php_config',
        description: 'Get current PHP configuration for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            config_id: {
              type: 'string',
              description: 'PHP configuration ID',
            },
          },
          required: ['package_id', 'config_id'],
        },
      },
      {
        name: 'update_php_config',
        description: 'Update PHP configuration directives for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            config_id: {
              type: 'string',
              description: 'PHP configuration ID',
            },
            config: {
              type: 'object',
              description: 'PHP configuration directives as key-value pairs',
              additionalProperties: {
                type: 'string',
              },
            },
          },
          required: ['package_id', 'config_id', 'config'],
        },
      },
      {
        name: 'is_wordpress_installed',
        description: 'Check if WordPress is installed on a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to check',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'reinstall_wordpress',
        description: 'Reinstall WordPress on a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to reinstall WordPress on',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_settings',
        description: 'Get WordPress settings for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get settings for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_wordpress_settings',
        description: 'Set WordPress settings for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to set settings for',
            },
            option_name: {
              type: 'string',
              description: 'WordPress option name to set',
            },
            option_value: {
              type: 'string',
              description: 'WordPress option value to set',
            },
          },
          required: ['package_id', 'option_name', 'option_value'],
        },
      },
      {
        name: 'get_wordpress_version',
        description: 'Get the WordPress version for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get WordPress version for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'wordpress_search_replace',
        description: 'Perform WordPress search and replace operation',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to perform search/replace on',
            },
            search: {
              type: 'string',
              description: 'Text to search for',
            },
            replace: {
              type: 'string',
              description: 'Text to replace with',
            },
          },
          required: ['package_id', 'search', 'replace'],
        },
      },
      {
        name: 'get_wordpress_plugins',
        description: 'Get list of WordPress plugins for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get plugins for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_wordpress_plugin',
        description: 'Activate, deactivate, or remove WordPress plugin',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to manage plugin for',
            },
            action: {
              type: 'string',
              enum: ['activate', 'deactivate', 'remove'],
              description: 'Action to perform on the plugin',
            },
            plugin_name: {
              type: 'string',
              description: 'Name of the plugin to manage',
            },
          },
          required: ['package_id', 'action', 'plugin_name'],
        },
      },
      {
        name: 'install_stackcache_plugin',
        description: 'Install StackCache plugin for WordPress',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to install StackCache plugin for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_themes',
        description: 'Get list of WordPress themes for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get themes for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_wordpress_theme',
        description: 'Activate, deactivate, or remove WordPress theme',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to manage theme for',
            },
            action: {
              type: 'string',
              enum: ['activate', 'deactivate', 'remove'],
              description: 'Action to perform on the theme',
            },
            theme_name: {
              type: 'string',
              description: 'Name of the theme to manage',
            },
          },
          required: ['package_id', 'action', 'theme_name'],
        },
      },
      {
        name: 'get_wordpress_users',
        description: 'Get WordPress users for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get users for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_wordpress',
        description: 'Update WordPress to the latest version',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update WordPress for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_staging',
        description: 'Check WordPress staging status',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to check staging for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_wordpress_staging',
        description: 'Clone WordPress site between live and staging',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to manage staging for',
            },
            type: {
              type: 'string',
              enum: ['live', 'staging'],
              description: 'Copy from live to staging or staging to live',
            },
          },
          required: ['package_id', 'type'],
        },
      },
      {
        name: 'get_cdn_options',
        description: 'Get list of all available CDN features',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get CDN options for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_cdn_feature_groups',
        description: 'Get CDN feature groups',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get CDN feature groups for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_cdn_feature',
        description: 'Add a single CDN feature',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to add CDN feature to',
            },
            feature_data: {
              type: 'object',
              description: 'CDN feature configuration data',
            },
          },
          required: ['package_id', 'feature_data'],
        },
      },
      {
        name: 'bulk_add_cdn_features',
        description: 'Bulk add multiple CDN features',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to add CDN features to',
            },
            features_data: {
              type: 'object',
              description: 'Multiple CDN features configuration data',
            },
          },
          required: ['package_id', 'features_data'],
        },
      },
      {
        name: 'get_cdn_stats',
        description: 'Get CDN usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get CDN stats for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_cache_report',
        description: 'Get CDN cache report (requires Website Turbo)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get cache report for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'purge_cdn_cache',
        description: 'Purge CDN cache by URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to purge cache for',
            },
            url: {
              type: 'string',
              description: 'URL to purge from CDN cache',
            },
          },
          required: ['package_id', 'url'],
        },
      },
      {
        name: 'get_stackcache_settings',
        description: 'Get StackCache performance settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get StackCache settings for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_stackcache_policy',
        description: 'Set StackCache policy for CSS, images, and JavaScript',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to set StackCache policy for',
            },
            policy_data: {
              type: 'object',
              description: 'StackCache policy configuration',
            },
          },
          required: ['package_id', 'policy_data'],
        },
      },
      {
        name: 'get_cdn_security_headers',
        description: 'Get CDN security headers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get security headers for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_cdn_security_headers',
        description: 'Update CDN security headers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update security headers for',
            },
            headers_data: {
              type: 'object',
              description: 'Security headers configuration',
            },
          },
          required: ['package_id', 'headers_data'],
        },
      },
      {
        name: 'delete_cdn_security_headers',
        description: 'Delete CDN security headers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to delete security headers for',
            },
            header_names: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific header names to delete (optional, deletes all if not provided)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_cdn_traffic_distribution',
        description: 'Get CDN traffic distribution by country',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get traffic distribution for',
            },
            filters: {
              type: 'object',
              description: 'Optional filters for traffic data',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'assign_website_turbo',
        description: 'Assign package to Website Turbo service',
        inputSchema: {
          type: 'object',
          properties: {
            website_turbo_id: {
              type: 'string',
              description: 'Website Turbo service ID',
            },
            package_id: {
              type: 'string',
              description: 'Hosting package ID to assign',
            },
          },
          required: ['website_turbo_id', 'package_id'],
        },
      },
      {
        name: 'order_website_turbo_credits',
        description: 'Order Website Turbo credits',
        inputSchema: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Amount of Website Turbo credits to order',
            },
          },
          required: ['amount'],
        },
      },
      {
        name: 'list_timeline_storage',
        description: 'List timeline storage items for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list timeline storage for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_snapshot',
        description: 'Create immediate snapshot of web files or database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to create snapshot for',
            },
            snapshot_type: {
              type: 'string',
              enum: ['web', 'database'],
              description: 'Type of snapshot to create',
            },
            database_id: {
              type: 'string',
              description: 'Database ID (required for database snapshots)',
            },
          },
          required: ['package_id', 'snapshot_type'],
        },
      },
      {
        name: 'list_snapshots',
        description: 'List available snapshots for web files or database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list snapshots for',
            },
            snapshot_type: {
              type: 'string',
              enum: ['web', 'database'],
              description: 'Type of snapshots to list',
            },
            database_id: {
              type: 'string',
              description: 'Database ID (required for database snapshots)',
            },
          },
          required: ['package_id', 'snapshot_type'],
        },
      },
      {
        name: 'restore_snapshot',
        description: 'Restore from timeline snapshot with precise control',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to restore snapshot for',
            },
            snapshot_type: {
              type: 'string',
              enum: ['web', 'database'],
              description: 'Type of snapshot to restore',
            },
            action: {
              type: 'string',
              enum: ['restore', 'mysqlrestore'],
              description: 'Restore action type',
            },
            restore_as_of: {
              type: 'number',
              description: 'UNIX timestamp to restore from',
            },
            restore_path: {
              type: 'string',
              description: 'Path to restore to',
            },
            target: {
              type: 'string',
              description: 'Optional target for restore operation',
            },
            database_id: {
              type: 'string',
              description: 'Database ID (required for database snapshots)',
            },
          },
          required: ['package_id', 'snapshot_type', 'action', 'restore_as_of', 'restore_path'],
        },
      },
      {
        name: 'get_snapshot_jobs',
        description: 'Get snapshot job status and progress',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get snapshot jobs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'restore_ftp_backup',
        description: 'Restore backup file uploaded via FTP',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to restore backup for',
            },
            filename: {
              type: 'string',
              description: 'Backup filename to restore',
            },
            restore_type: {
              type: 'string',
              enum: ['IntoDirectory', 'ReplaceMissing', 'ReplaceAll'],
              description: 'How to restore the backup',
            },
            restore_databases: {
              type: 'boolean',
              description: 'Whether to restore databases',
              default: false,
            },
          },
          required: ['package_id', 'filename', 'restore_type'],
        },
      },
      {
        name: 'list_backup_jobs',
        description: 'List backup and restore job progress',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list backup jobs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'list_multisite_backups',
        description: 'List multisite backup information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_multisite_backup',
        description: 'Create bulk backups across multiple packages',
        inputSchema: {
          type: 'object',
          properties: {
            package_ids: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of package IDs to backup',
            },
            delete_existing: {
              type: 'boolean',
              description: 'Whether to delete existing backups',
              default: false,
            },
          },
          required: ['package_ids'],
        },
      },
      {
        name: 'list_vps_backups',
        description: 'List VPS backup services',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'update_vps_backup',
        description: 'Configure VPS backup settings',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'VPS ID to configure backup for',
            },
            backup_config: {
              type: 'object',
              description: 'Backup configuration settings',
            },
          },
          required: ['vps_id', 'backup_config'],
        },
      },
      {
        name: 'get_blocked_ip_addresses',
        description: 'Retrieve blocked IP addresses for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get blocked IPs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_blocked_ip_addresses',
        description: 'Set blocked IP addresses for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to set blocked IPs for',
            },
            ip_addresses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of IP addresses or CIDR ranges to block',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_ip_block',
        description: 'Add a single IP address to the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to add IP block to',
            },
            ip_address: {
              type: 'string',
              description: 'IP address or CIDR range to block',
            },
          },
          required: ['package_id', 'ip_address'],
        },
      },
      {
        name: 'remove_ip_block',
        description: 'Remove an IP address from the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to remove IP block from',
            },
            ip_address: {
              type: 'string',
              description: 'IP address or CIDR range to unblock',
            },
          },
          required: ['package_id', 'ip_address'],
        },
      },
      {
        name: 'get_blocked_countries',
        description: 'Retrieve blocked countries for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get blocked countries for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_blocked_countries',
        description: 'Set blocked countries for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to set blocked countries for',
            },
            countries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of ISO 3166 country codes to block',
            },
            access: {
              type: 'string',
              description: 'Access type configuration (default: "block")',
              default: 'block',
            },
          },
          required: ['package_id', 'countries'],
        },
      },
      {
        name: 'add_country_block',
        description: 'Add a single country to the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to add country block to',
            },
            country_code: {
              type: 'string',
              description: 'ISO 3166 country code to block (e.g., "CN", "RU")',
            },
            access: {
              type: 'string',
              description: 'Access type configuration (default: "block")',
              default: 'block',
            },
          },
          required: ['package_id', 'country_code'],
        },
      },
      {
        name: 'remove_country_block',
        description: 'Remove a country from the block list',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to remove country block from',
            },
            country_code: {
              type: 'string',
              description: 'ISO 3166 country code to unblock',
            },
          },
          required: ['package_id', 'country_code'],
        },
      },
      {
        name: 'get_malware_scan',
        description: 'Get malware scan status and results for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get malware scan for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'request_malware_scan',
        description: 'Request a new malware scan for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to scan for malware',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_malware_report',
        description: 'Get detailed malware report for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID to get malware report for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_email_spam_blacklist',
        description: 'Get email spam blacklist configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'Email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_email_spam_whitelist',
        description: 'Get email spam whitelist configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'Email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'add_tls_certificate',
        description: 'Order a premium TLS/SSL certificate',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Certificate name/identifier',
            },
            period_months: {
              type: 'number',
              description: 'Certificate validity period in months',
            },
            configuration: {
              type: 'object',
              description: 'Certificate configuration details',
            },
          },
          required: ['name', 'period_months', 'configuration'],
        },
      },
      {
        name: 'renew_tls_certificate',
        description: 'Renew an existing TLS/SSL certificate',
        inputSchema: {
          type: 'object',
          properties: {
            certificate_id: {
              type: 'string',
              description: 'Certificate ID to renew',
            },
            period_months: {
              type: 'number',
              description: 'Renewal period in months',
            },
          },
          required: ['certificate_id', 'period_months'],
        },
      },
      {
        name: 'order_premium_mailbox',
        description: 'Order a premium mailbox service',
        inputSchema: {
          type: 'object',
          properties: {
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID (e.g., "m11111")',
            },
            local: {
              type: 'string',
              description: 'The local part before @ symbol',
            },
            domain: {
              type: 'string',
              description: 'The domain part after @ symbol',
            },
            for_user: {
              type: 'string',
              description: 'Optional user to assign mailbox to',
            },
          },
          required: ['mailbox_id', 'local', 'domain'],
        },
      },
      {
        name: 'renew_premium_mailbox',
        description: 'Renew a premium mailbox subscription',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The premium mailbox ID to renew',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_email_configuration',
        description: 'Get email configuration for a domain in a package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_mailbox_configuration',
        description: 'Get mailbox configuration for an email domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_email_forwarders',
        description: 'Get email forwarders for a specific email domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_all_email_forwarders',
        description: 'Get all email forwarders for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'generate_webmail_url',
        description: 'Generate a webmail single sign-on URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID',
            },
          },
          required: ['package_id', 'email_id', 'mailbox_id'],
        },
      },
      {
        name: 'get_mysql_databases',
        description: 'Get MySQL databases for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_mysql_users',
        description: 'Get MySQL users for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_mssql_databases',
        description: 'Get MSSQL databases for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_ssl_certificates',
        description: 'Get SSL certificates for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_free_ssl',
        description: 'Add free SSL certificate for domains',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domains: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of domain names for SSL certificate',
            },
          },
          required: ['package_id', 'domains'],
        },
      },
      {
        name: 'get_force_ssl',
        description: 'Get Force HTTPS/SSL status for a package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_force_ssl',
        description: 'Enable or disable Force HTTPS/SSL for a package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable or disable Force HTTPS',
            },
          },
          required: ['package_id', 'enabled'],
        },
      },
      {
        name: 'get_bandwidth_stats',
        description: 'Get bandwidth statistics for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_disk_usage',
        description: 'Get disk usage statistics for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_access_logs',
        description: 'Get access logs for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'list_vps',
        description: 'List all VPS servers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_vps_info',
        description: 'Get detailed information about a VPS server',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get information for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'list_managed_vps',
        description: 'List all managed VPS servers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_managed_vps_info',
        description: 'Get detailed information about a managed VPS server',
        inputSchema: {
          type: 'object',
          properties: {
            managed_vps_id: {
              type: 'string',
              description: 'The managed VPS ID to get information for',
            },
          },
          required: ['managed_vps_id'],
        },
      },
      {
        name: 'create_subdomain',
        description: 'Create a subdomain for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            subdomain: {
              type: 'string',
              description: 'The subdomain name to create',
            },
          },
          required: ['package_id', 'subdomain'],
        },
      },
      {
        name: 'remove_subdomain',
        description: 'Remove a subdomain from a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            subdomain: {
              type: 'string',
              description: 'The subdomain name to remove',
            },
          },
          required: ['package_id', 'subdomain'],
        },
      },
      {
        name: 'list_subdomains',
        description: 'List all subdomains for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_mysql_database',
        description: 'Create a MySQL database for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            name: {
              type: 'string',
              description: 'The database name',
            },
          },
          required: ['package_id', 'name'],
        },
      },
      {
        name: 'create_mysql_user',
        description: 'Create a MySQL user for a hosting package and grant access to specified database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            username: {
              type: 'string',
              description: 'The username for the MySQL user',
            },
            password: {
              type: 'string',
              description: 'The password for the MySQL user',
            },
            database: {
              type: 'string',
              description: 'The database name to grant access to',
            },
          },
          required: ['package_id', 'username', 'password'],
        },
      },
      {
        name: 'grant_mysql_user_database',
        description: 'Grant an existing MySQL user access to a database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            username: {
              type: 'string',
              description: 'The MySQL username to grant access',
            },
            database: {
              type: 'string',
              description: 'The database name to grant access to',
            },
          },
          required: ['package_id', 'username', 'database'],
        },
      },
      {
        name: 'create_email_account',
        description: 'Create an email account for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email: {
              type: 'string',
              description: 'The email address to create',
            },
            password: {
              type: 'string',
              description: 'The password for the email account',
            },
          },
          required: ['package_id', 'email', 'password'],
        },
      },
      {
        name: 'create_email_forwarder',
        description: 'Create an email forwarder for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            source: {
              type: 'string',
              description: 'The source email address',
            },
            destinations: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of destination email addresses',
            },
          },
          required: ['package_id', 'source', 'destinations'],
        },
      },
      {
        name: 'get_php_versions',
        description: 'Get available PHP versions for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_php_version',
        description: 'Set the PHP version for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            version: {
              type: 'string',
              description: 'The PHP version to set (e.g., "8.1", "8.2")',
            },
          },
          required: ['package_id', 'version'],
        },
      },
      {
        name: 'list_applications',
        description: 'List available applications for installation',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'install_application',
        description: 'Install an application on a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            application_id: {
              type: 'string',
              description: 'The application ID to install',
            },
            path: {
              type: 'string',
              description: 'The installation path',
            },
            config: {
              type: 'object',
              description: 'Optional configuration parameters for the application',
            },
          },
          required: ['package_id', 'application_id', 'path'],
        },
      },
      {
        name: 'create_ftp_user',
        description: 'Create an FTP user for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            username: {
              type: 'string',
              description: 'The FTP username',
            },
            password: {
              type: 'string',
              description: 'The FTP password',
            },
            path: {
              type: 'string',
              description: 'The FTP access path (defaults to root)',
            },
          },
          required: ['package_id', 'username', 'password'],
        },
      },
      {
        name: 'list_ftp_users',
        description: 'List all FTP users for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'manage_directories',
        description: 'Create or delete directories in a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            action: {
              type: 'string',
              enum: ['create', 'delete'],
              description: 'The action to perform (create or delete)',
            },
            path: {
              type: 'string',
              description: 'The directory path',
            },
          },
          required: ['package_id', 'action', 'path'],
        },
      },
      {
        name: 'get_file_permission_recommendations',
        description: 'Get file permissions that do not match platform recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to check file permissions for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_file_permissions',
        description: 'Set file permissions for specific files',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to set file permissions for',
            },
            permission_check_id: {
              type: 'number',
              description: 'The permission check ID from recommendations',
            },
            files: {
              type: 'array',
              description: 'Array of files and their permissions',
              items: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    description: 'File path',
                  },
                  perms: {
                    type: 'number',
                    description: 'Permission value (e.g., 644, 755)',
                  },
                },
                required: ['file', 'perms'],
              },
            },
          },
          required: ['package_id', 'permission_check_id', 'files'],
        },
      },
      {
        name: 'get_directory_indexing_status',
        description: 'Get directory indexing configuration for security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to check directory indexing for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_directory_indexing',
        description: 'Enable or disable directory indexing for security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to configure directory indexing for',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable directory indexing',
            },
          },
          required: ['package_id', 'enabled'],
        },
      },
      {
        name: 'set_directory_index',
        description: 'Set directory index files for htaccess configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to configure directory index for',
            },
            index_files: {
              type: 'array',
              description: 'Array of index files (max 5)',
              items: {
                type: 'string',
              },
              maxItems: 5,
            },
          },
          required: ['package_id', 'index_files'],
        },
      },
      {
        name: 'get_easy_builder_instances',
        description: 'Get current Easy Builder instances for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get Easy Builder instances for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'delete_easy_builder_instance',
        description: 'Delete an Easy Builder instance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the Easy Builder instance',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID to delete',
            },
          },
          required: ['package_id', 'instance_id'],
        },
      },
      {
        name: 'install_easy_builder_instance',
        description: 'Install an Easy Builder instance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to install Easy Builder instance in',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID to install',
            },
          },
          required: ['package_id', 'instance_id'],
        },
      },
      {
        name: 'get_easy_builder_sso',
        description: 'Get Easy Builder Single Sign-On URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the Easy Builder instance',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID for SSO',
            },
          },
          required: ['package_id', 'instance_id'],
        },
      },
      {
        name: 'get_easy_builder_themes',
        description: 'Get all available Easy Builder themes',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get Easy Builder themes for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_easy_builder_theme',
        description: 'Set Easy Builder theme for instance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the Easy Builder instance',
            },
            instance_id: {
              type: 'string',
              description: 'The Easy Builder instance ID to set theme for',
            },
            theme_name: {
              type: 'string',
              description: 'The name of the theme to apply',
            },
          },
          required: ['package_id', 'instance_id', 'theme_name'],
        },
      },
      {
        name: 'get_website_builder_sso',
        description: 'Get Website Builder Single Sign-On URL',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get Website Builder SSO for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_access_and_error_logs',
        description: 'Get access and error logs for website monitoring and troubleshooting',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get logs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'request_disk_usage_report',
        description: 'Request a disk usage analysis report for storage optimization',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to analyze disk usage for',
            },
            subdirectory: {
              type: 'string',
              description: 'Subdirectory to analyze (e.g., public_html, logs)',
            },
          },
          required: ['package_id', 'subdirectory'],
        },
      },
      {
        name: 'get_disk_usage_report',
        description: 'Get completed disk usage report details',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID the report belongs to',
            },
            report_id: {
              type: 'string',
              description: 'The report ID from request_disk_usage_report',
            },
          },
          required: ['package_id', 'report_id'],
        },
      },
      {
        name: 'get_email_stats',
        description: 'Get email mailbox statistics and folder information',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the email',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID to get statistics for',
            },
          },
          required: ['package_id', 'email_id', 'mailbox_id'],
        },
      },
      {
        name: 'get_malware_scan_objects',
        description: 'Get malware scan configuration and scan history',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get malware scan objects for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_installed_applications',
        description: 'Get list of installed runtime applications (Node.js, Python, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get installed applications for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'deploy_application',
        description: 'Deploy a new runtime application (Node.js, Python, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to deploy application to',
            },
            domain: {
              type: 'string',
              description: 'Domain name for the application',
            },
            environment: {
              type: 'string',
              description: 'Environment variables and configuration',
            },
            name: {
              type: 'string',
              description: 'Application name/identifier',
            },
            path: {
              type: 'string',
              description: 'Application deployment path',
            },
            script: {
              type: 'string',
              description: 'Entry script file (e.g., app.js, main.py)',
            },
            type_code: {
              type: 'string',
              description: 'Runtime type identifier (e.g., nodejs, python)',
            },
          },
          required: ['package_id', 'domain', 'environment', 'name', 'path', 'script', 'type_code'],
        },
      },
      {
        name: 'update_application_environment',
        description: 'Update environment variables for a runtime application',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the application',
            },
            application_id: {
              type: 'string',
              description: 'The application ID to update',
            },
            environment: {
              type: 'string',
              description: 'New environment variables and configuration',
            },
          },
          required: ['package_id', 'application_id', 'environment'],
        },
      },
      {
        name: 'delete_application',
        description: 'Delete a deployed runtime application',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the application',
            },
            application_id: {
              type: 'string',
              description: 'The application ID to delete',
            },
          },
          required: ['package_id', 'application_id'],
        },
      },
      {
        name: 'get_installed_software',
        description: 'Get list of installed software and runtime environments',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to check installed software for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'transfer_domain',
        description: 'Transfer a domain to your 20i account',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Domain name to transfer',
            },
            years: {
              type: 'number',
              description: 'Number of years for transfer (0 for UK transfers)',
            },
            authcode: {
              type: 'string',
              description: 'EPP auth code for domain transfer',
            },
            contact: {
              type: 'object',
              description: 'Contact information for domain registration',
            },
            privacy_service: {
              type: 'boolean',
              description: 'Add domain privacy service',
            },
            nameservers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Nameserver hostnames',
            },
          },
          required: ['name', 'contact', 'privacy_service'],
        },
      },
      {
        name: 'get_domain_transfer_status',
        description: 'Get current status of domain transfer',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID to check transfer status for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_domain_auth_code',
        description: 'Get domain EPP auth code for outbound transfers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID to get auth code for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_domain_whois',
        description: 'Get live WHOIS data for domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID to get WHOIS data for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'set_domain_transfer_lock',
        description: 'Set domain transfer lock status for security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID to set transfer lock for',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable transfer lock',
            },
          },
          required: ['package_id', 'domain_id', 'enabled'],
        },
      },
      {
        name: 'get_email_autoresponder',
        description: 'Get email autoresponder configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the email',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_email_spam_blacklist',
        description: 'Get spam filtering blacklist configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the email',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_email_spam_whitelist',
        description: 'Get spam filtering whitelist configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the email',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'update_email_spam_settings',
        description: 'Update spam filtering settings for email domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the email',
            },
            email_id: {
              type: 'string',
              description: 'The email domain ID',
            },
            spam_score: {
              type: 'string',
              description: 'Spam score threshold',
            },
            reject_score: {
              type: ['string', 'number'],
              description: 'Reject score threshold',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'get_error_logs',
        description: 'Get access and error logs for troubleshooting',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get error logs for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_wordpress_staging',
        description: 'Get WordPress staging environment status',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to check staging for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'clone_wordpress_staging',
        description: 'Clone WordPress between live and staging environments',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to clone staging for',
            },
            type: {
              type: 'string',
              enum: ['live', 'staging'],
              description: 'Clone type: "live" (live to staging) or "staging" (staging to live)',
            },
          },
          required: ['package_id', 'type'],
        },
      },
      {
        name: 'get_timeline_backups',
        description: 'Get timeline backup system information for version control',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get timeline backups for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'take_web_snapshot',
        description: 'Take a web files snapshot for version control',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to take snapshot for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'restore_web_snapshot',
        description: 'Restore web files from a snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to restore snapshot for',
            },
            snapshot_id: {
              type: 'string',
              description: 'The snapshot ID to restore from',
            },
          },
          required: ['package_id', 'snapshot_id'],
        },
      },
      
      // Group A1: VPS Management Tools (22 endpoints)
      // Critical server infrastructure control for VPS hosting
      {
        name: 'list_vps',
        description: 'Get all VPS instances in the account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_vps_details',
        description: 'Get comprehensive VPS configuration and status information',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get details for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'activate_vps',
        description: 'Activate VPS service and subservices',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to activate',
            },
            include_repeated: {
              type: 'boolean',
              description: 'Include repeated activations',
            },
            subservices: {
              type: 'object',
              description: 'Subservice activation settings',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'deactivate_vps',
        description: 'Deactivate VPS service',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to deactivate',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'start_vps',
        description: 'Start a stopped VPS',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to start',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'stop_vps',
        description: 'Stop a running VPS',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to stop',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'reboot_vps',
        description: 'Reboot a VPS',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to reboot',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'rebuild_vps',
        description: 'Rebuild VPS with new configuration (DESTRUCTIVE)',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to rebuild',
            },
            application_id: {
              type: 'string',
              description: 'Application ID to install (optional)',
            },
            cpanel: {
              type: 'boolean',
              description: 'Install cPanel',
            },
            cpanel_code: {
              type: 'boolean',
              description: 'Include cPanel code',
            },
            vps_os_id: {
              type: 'string',
              description: 'Operating system ID to install',
            },
          },
          required: ['vps_id', 'vps_os_id'],
        },
      },
      {
        name: 'get_vps_vnc_info',
        description: 'Get VNC console access information',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get VNC info for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'lock_vps_vnc',
        description: 'Lock VNC console access',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to lock VNC for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'unlock_vps_vnc',
        description: 'Unlock VNC console access for specific IP',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to unlock VNC for',
            },
            ip_address: {
              type: 'string',
              description: 'IP address to allow VNC access from',
            },
          },
          required: ['vps_id', 'ip_address'],
        },
      },
      {
        name: 'get_vps_disks',
        description: 'Get VPS disk information',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get disk info for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_limits',
        description: 'Get VPS resource limits',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get limits for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'add_vps_ipv6_address',
        description: 'Add IPv6 address to VPS',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to add IPv6 address to',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_reverse_dns',
        description: 'Get VPS reverse DNS records',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get reverse DNS for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'update_vps_reverse_dns',
        description: 'Update VPS reverse DNS records',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to update reverse DNS for',
            },
            reverse_dns_config: {
              type: 'object',
              description: 'Reverse DNS configuration object',
            },
          },
          required: ['vps_id', 'reverse_dns_config'],
        },
      },
      {
        name: 'get_vps_available_os',
        description: 'Get available operating systems for VPS rebuild',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get available OS for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'change_vps_root_password',
        description: 'Change VPS root password (will reboot server)',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to change password for',
            },
            password: {
              type: 'string',
              description: 'New root password',
            },
          },
          required: ['vps_id', 'password'],
        },
      },
      {
        name: 'get_vps_name',
        description: 'Get VPS name',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get name for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'set_vps_name',
        description: 'Set VPS name',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to set name for',
            },
            name: {
              type: 'string',
              description: 'New VPS name (max 255 characters)',
            },
          },
          required: ['vps_id', 'name'],
        },
      },
      {
        name: 'get_vps_backups',
        description: 'Get VPS backup services',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to get backup info for',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'update_vps_backups',
        description: 'Update VPS backup configuration',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID to update backups for',
            },
            backup_config: {
              type: 'object',
              description: 'Backup configuration object',
            },
          },
          required: ['vps_id', 'backup_config'],
        },
      },
      {
        name: 'list_managed_vps',
        description: 'Get all managed VPS instances',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_managed_vps_details',
        description: 'Get managed VPS details',
        inputSchema: {
          type: 'object',
          properties: {
            managed_vps_id: {
              type: 'string',
              description: 'The managed VPS ID to get details for',
            },
          },
          required: ['managed_vps_id'],
        },
      },
      {
        name: 'set_managed_vps_profile',
        description: 'Set managed VPS profile',
        inputSchema: {
          type: 'object',
          properties: {
            managed_vps_id: {
              type: 'string',
              description: 'The managed VPS ID to set profile for',
            },
            profile_id: {
              type: 'string',
              description: 'Profile ID to apply',
            },
          },
          required: ['managed_vps_id', 'profile_id'],
        },
      },
      {
        name: 'reset_managed_vps_profile',
        description: 'Reset managed VPS profile to default',
        inputSchema: {
          type: 'object',
          properties: {
            managed_vps_id: {
              type: 'string',
              description: 'The managed VPS ID to reset profile for',
            },
          },
          required: ['managed_vps_id'],
        },
      },
      {
        name: 'get_managed_vps_limits',
        description: 'Get managed VPS package limits',
        inputSchema: {
          type: 'object',
          properties: {
            managed_vps_id: {
              type: 'string',
              description: 'The managed VPS ID to get limits for',
            },
          },
          required: ['managed_vps_id'],
        },
      },
      
      // Group A2: MSSQL Database Services Tools (15 endpoints)
      // Critical database management for Windows hosting
      {
        name: 'list_mssql_databases',
        description: 'Get all MSSQL databases across all packages',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_mssql_database_details',
        description: 'Get specific MSSQL database details',
        inputSchema: {
          type: 'object',
          properties: {
            mssql_id: {
              type: 'string',
              description: 'The MSSQL database ID to get details for',
            },
          },
          required: ['mssql_id'],
        },
      },
      {
        name: 'get_package_mssql_databases',
        description: 'Get MSSQL databases for a specific package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to get MSSQL databases for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_mssql_database',
        description: 'Create new MSSQL database and user',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID to create database in',
            },
            name: {
              type: 'string',
              description: 'Database name (also used as username)',
            },
            password: {
              type: 'string',
              description: 'Password for the database user',
            },
          },
          required: ['package_id', 'name', 'password'],
        },
      },
      {
        name: 'delete_mssql_database',
        description: 'Delete MSSQL database (DESTRUCTIVE)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to delete',
            },
          },
          required: ['package_id', 'database_id'],
        },
      },
      {
        name: 'order_mssql_database',
        description: 'Order MSSQL database allowance for reseller account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'renew_mssql_database',
        description: 'Renew MSSQL database subscription',
        inputSchema: {
          type: 'object',
          properties: {
            database_id: {
              type: 'string',
              description: 'The database ID to renew',
            },
          },
          required: ['database_id'],
        },
      },
      {
        name: 'assign_mssql_to_package',
        description: 'Assign MSSQL database to hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            mssql_id: {
              type: 'string',
              description: 'The MSSQL database ID to assign',
            },
            package_id: {
              type: 'string',
              description: 'The package ID to assign database to',
            },
          },
          required: ['mssql_id', 'package_id'],
        },
      },
      {
        name: 'add_mssql_user',
        description: 'Add user to MSSQL database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to add user to',
            },
            username: {
              type: 'string',
              description: 'Username for database access',
            },
            password: {
              type: 'string',
              description: 'Password for the user',
            },
          },
          required: ['package_id', 'database_id', 'username', 'password'],
        },
      },
      {
        name: 'remove_mssql_user',
        description: 'Remove user from MSSQL database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to remove user from',
            },
            user_id: {
              type: 'string',
              description: 'The user ID to remove',
            },
          },
          required: ['package_id', 'database_id', 'user_id'],
        },
      },
      {
        name: 'update_mssql_user_password',
        description: 'Update MSSQL user password',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID containing the user',
            },
            user_id: {
              type: 'string',
              description: 'The user ID to update password for',
            },
            password: {
              type: 'string',
              description: 'New password for the user',
            },
          },
          required: ['package_id', 'database_id', 'user_id', 'password'],
        },
      },
      {
        name: 'take_mssql_snapshot',
        description: 'Take immediate snapshot of MSSQL database',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to snapshot',
            },
          },
          required: ['package_id', 'database_id'],
        },
      },
      {
        name: 'get_mssql_backup_info',
        description: 'Get MSSQL database backup information',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to get backup info for',
            },
          },
          required: ['package_id', 'database_id'],
        },
      },
      {
        name: 'restore_mssql_snapshot',
        description: 'Restore MSSQL database from snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to restore',
            },
            action: {
              type: 'string',
              description: 'The restore action to perform',
            },
            restore_as_of: {
              type: 'number',
              description: 'The restore timestamp',
            },
            restore_path: {
              type: 'string',
              description: 'The restore path',
            },
            target: {
              type: 'string',
              description: 'The restore target',
            },
          },
          required: ['package_id', 'database_id', 'action', 'restore_as_of', 'restore_path', 'target'],
        },
      },
      {
        name: 'get_mssql_snapshot_jobs',
        description: 'Get currently running MSSQL snapshot jobs',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The package ID containing the database',
            },
            database_id: {
              type: 'string',
              description: 'The database ID to get jobs for',
            },
          },
          required: ['package_id', 'database_id'],
        },
      },
      
      // Group A3: SSL Certificate Management Tools
      {
        name: 'list_ssl_certificates',
        description: 'List all SSL certificates for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to list SSL certificates for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'order_ssl_certificate',
        description: 'Order a new SSL certificate from 20i',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Domain name for the SSL certificate',
            },
            period_months: {
              type: 'number',
              description: 'Certificate validity period in months',
            },
            configuration: {
              type: 'object',
              description: 'Optional SSL certificate configuration',
            },
          },
          required: ['name', 'period_months'],
        },
      },
      {
        name: 'renew_ssl_certificate',
        description: 'Renew an existing SSL certificate',
        inputSchema: {
          type: 'object',
          properties: {
            certificate_id: {
              type: 'string',
              description: 'The SSL certificate ID to renew',
            },
            period_months: {
              type: 'number',
              description: 'Renewal period in months',
            },
          },
          required: ['certificate_id', 'period_months'],
        },
      },
      {
        name: 'precheck_ssl_renewal',
        description: 'Pre-check SSL certificate renewal without charging',
        inputSchema: {
          type: 'object',
          properties: {
            certificate_id: {
              type: 'string',
              description: 'The SSL certificate ID to check renewal for',
            },
            period_months: {
              type: 'number',
              description: 'Renewal period in months',
            },
          },
          required: ['certificate_id', 'period_months'],
        },
      },
      {
        name: 'install_external_ssl_certificate',
        description: 'Install an external SSL certificate from any CA',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to install SSL certificate for',
            },
            name: {
              type: 'string',
              description: 'Domain name for the SSL certificate',
            },
            certificate: {
              type: 'string',
              description: 'The SSL certificate (PEM format)',
            },
            key: {
              type: 'string',
              description: 'The private key (PEM format)',
            },
            ca: {
              type: 'string',
              description: 'The CA certificate chain (PEM format)',
            },
          },
          required: ['package_id', 'name', 'certificate', 'key', 'ca'],
        },
      },
      {
        name: 'remove_ssl_certificates',
        description: 'Remove SSL certificates from a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to remove SSL certificates from',
            },
            certificate_ids: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of SSL certificate IDs to remove',
            },
          },
          required: ['package_id', 'certificate_ids'],
        },
      },
      {
        name: 'toggle_free_ssl',
        description: 'Toggle free SSL (Let\'s Encrypt) for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to toggle free SSL for',
            },
            domain_name: {
              type: 'string',
              description: 'The domain name to toggle free SSL for',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable (true) or disable (false) free SSL',
            },
          },
          required: ['package_id', 'domain_name', 'enabled'],
        },
      },
      {
        name: 'resend_ssl_approval_email',
        description: 'Resend SSL certificate approval email for domain validation',
        inputSchema: {
          type: 'object',
          properties: {
            certificate_id: {
              type: 'string',
              description: 'The SSL certificate ID to resend approval email for',
            },
          },
          required: ['certificate_id'],
        },
      },
      {
        name: 'get_force_ssl_status',
        description: 'Get the force HTTPS redirect status for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get force SSL status for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'set_force_ssl',
        description: 'Set force HTTPS redirect for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to set force SSL for',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable (true) or disable (false) force HTTPS redirect',
            },
          },
          required: ['package_id', 'enabled'],
        },
      },
      {
        name: 'get_ssl_certificate_status',
        description: 'Get comprehensive SSL certificate status and health check for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get SSL certificate status for',
            },
          },
          required: ['package_id'],
        },
      },
      
      // Group A4: Package Administration Tools
      {
        name: 'activate_package',
        description: 'Activate a hosting package for service use',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to activate',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'deactivate_package',
        description: 'Deactivate a hosting package to suspend services',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to deactivate',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_package_allowance',
        description: 'Update package resource allowances and limits',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update allowances for',
            },
            disk_space: {
              type: 'number',
              description: 'Disk space allowance in MB (optional)',
            },
            bandwidth: {
              type: 'number',
              description: 'Bandwidth allowance in MB (optional)',
            },
            databases: {
              type: 'number',
              description: 'Number of databases allowed (optional)',
            },
            email_accounts: {
              type: 'number',
              description: 'Number of email accounts allowed (optional)',
            },
            subdomains: {
              type: 'number',
              description: 'Number of subdomains allowed (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'delete_package',
        description: 'Delete hosting package and optionally remove files',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to delete',
            },
            delete_files: {
              type: 'boolean',
              description: 'Whether to delete all associated files (default: false)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'split_package',
        description: 'Split package into multiple hosting packages',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to split',
            },
            new_package_name: {
              type: 'string',
              description: 'Name for the new package created from split',
            },
            domains_to_move: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of domain names to move to the new package',
            },
            new_package_type: {
              type: 'string',
              description: 'Package type for the new package (optional)',
            },
          },
          required: ['package_id', 'new_package_name', 'domains_to_move'],
        },
      },
      {
        name: 'add_stack_user_package_allowance',
        description: 'Add package allowance for stack user',
        inputSchema: {
          type: 'object',
          properties: {
            stack_user_id: {
              type: 'string',
              description: 'The stack user ID to add allowance for',
            },
            package_type: {
              type: 'string',
              description: 'Type of package the user can create',
            },
            quantity: {
              type: 'number',
              description: 'Number of packages the user can create',
            },
            period: {
              type: 'string',
              description: 'Allowance period (e.g., "monthly", "yearly") - default: monthly',
            },
          },
          required: ['stack_user_id', 'package_type', 'quantity'],
        },
      },
      {
        name: 'update_stack_user_package_allowance',
        description: 'Update existing stack user package allowance',
        inputSchema: {
          type: 'object',
          properties: {
            allowance_id: {
              type: 'string',
              description: 'The package allowance ID to update',
            },
            quantity: {
              type: 'number',
              description: 'Updated quantity of packages (optional)',
            },
            period: {
              type: 'string',
              description: 'Updated allowance period (optional)',
            },
            status: {
              type: 'string',
              description: 'Updated allowance status (optional)',
            },
          },
          required: ['allowance_id'],
        },
      },
      {
        name: 'get_stack_user_package_allowance',
        description: 'Get stack user package allowance details',
        inputSchema: {
          type: 'object',
          properties: {
            allowance_id: {
              type: 'string',
              description: 'The package allowance ID to retrieve details for',
            },
          },
          required: ['allowance_id'],
        },
      },
      {
        name: 'clone_package_from_allowance',
        description: 'Create new package using stack user allowance',
        inputSchema: {
          type: 'object',
          properties: {
            allowance_id: {
              type: 'string',
              description: 'The package allowance ID to use for creating the package',
            },
            domain_name: {
              type: 'string',
              description: 'Domain name for the new package',
            },
            username: {
              type: 'string',
              description: 'Username for the new package',
            },
            password: {
              type: 'string',
              description: 'Password for the new package',
            },
          },
          required: ['allowance_id', 'domain_name', 'username', 'password'],
        },
      },
      
      // Group B1: Advanced Email Management Tools
      {
        name: 'get_email_domain_configuration',
        description: 'Get advanced email domain configuration settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email account ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'set_email_domain_alias',
        description: 'Configure email domain alias settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email account ID',
            },
            domain: {
              type: 'string',
              description: 'The domain alias to configure',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable or disable the domain alias',
            },
          },
          required: ['package_id', 'email_id', 'domain', 'enabled'],
        },
      },
      {
        name: 'get_email_statistics',
        description: 'Get comprehensive email statistics and analytics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email account ID',
            },
          },
          required: ['package_id', 'email_id'],
        },
      },
      {
        name: 'configure_premium_mailbox',
        description: 'Configure premium mailbox features and storage',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_address: {
              type: 'string',
              description: 'The email address for the premium mailbox',
            },
            storage: {
              type: 'number',
              description: 'Storage allocation in MB',
            },
            features: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of premium features to enable',
            },
          },
          required: ['package_id', 'email_address', 'storage', 'features'],
        },
      },
      {
        name: 'get_email_performance_metrics',
        description: 'Get email performance monitoring metrics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            time_range: {
              type: 'string',
              description: 'Time range for metrics (e.g., "24h", "7d", "30d") - optional',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_email_routing',
        description: 'Configure advanced email routing rules',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email account ID',
            },
            priority: {
              type: 'number',
              description: 'Routing rule priority (lower number = higher priority)',
            },
            destination: {
              type: 'string',
              description: 'Destination email address or server',
            },
            conditions: {
              type: 'object',
              description: 'Optional routing conditions',
            },
          },
          required: ['package_id', 'email_id', 'priority', 'destination'],
        },
      },
      {
        name: 'get_email_quota_usage',
        description: 'Get email quota usage and limits',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_email_archiving',
        description: 'Configure email archiving and retention settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Whether to enable email archiving',
            },
            retention_days: {
              type: 'number',
              description: 'Number of days to retain archived emails',
            },
            compression_enabled: {
              type: 'boolean',
              description: 'Whether to enable compression for archives (optional)',
            },
          },
          required: ['package_id', 'enabled', 'retention_days'],
        },
      },
      {
        name: 'get_email_backup_status',
        description: 'Get email backup status and restore points',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_advanced_spam_filtering',
        description: 'Configure advanced spam filtering with custom rules',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_id: {
              type: 'string',
              description: 'The email account ID',
            },
            sensitivity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'custom'],
              description: 'Spam filter sensitivity level',
            },
            custom_rules: {
              type: 'array',
              description: 'Custom spam filtering rules (optional)',
            },
            quarantine_enabled: {
              type: 'boolean',
              description: 'Whether to enable spam quarantine',
            },
          },
          required: ['package_id', 'email_id', 'sensitivity', 'quarantine_enabled'],
        },
      },
      {
        name: 'get_email_reputation_score',
        description: 'Get email sender reputation score and metrics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_email_security_policies',
        description: 'Configure email security policies and requirements',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            enforce_encryption: {
              type: 'boolean',
              description: 'Whether to enforce email encryption',
            },
            require_secure_password: {
              type: 'boolean',
              description: 'Whether to require secure passwords',
            },
            enable_two_factor: {
              type: 'boolean',
              description: 'Whether to enable two-factor authentication (optional)',
            },
            ip_whitelist: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'IP addresses to whitelist (optional)',
            },
          },
          required: ['package_id', 'enforce_encryption', 'require_secure_password'],
        },
      },
      {
        name: 'get_email_delivery_analytics',
        description: 'Get detailed email delivery analytics and performance data',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            start_date: {
              type: 'string',
              description: 'Start date for analytics (ISO format) - optional',
            },
            end_date: {
              type: 'string',
              description: 'End date for analytics (ISO format) - optional',
            },
            group_by: {
              type: 'string',
              description: 'Group analytics by (e.g., "day", "week", "month") - optional',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_email_usage_reports',
        description: 'Get comprehensive email usage reports and trends',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_email_compliance_settings',
        description: 'Configure email compliance and regulatory settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            data_retention: {
              type: 'number',
              description: 'Data retention period in days',
            },
            gdpr_compliant: {
              type: 'boolean',
              description: 'Whether to enable GDPR compliance features',
            },
            audit_logging: {
              type: 'boolean',
              description: 'Whether to enable audit logging',
            },
            encryption_required: {
              type: 'boolean',
              description: 'Whether to require encryption for all emails',
            },
          },
          required: ['package_id', 'data_retention', 'gdpr_compliant', 'audit_logging', 'encryption_required'],
        },
      },
      
      // Group B2: Security & Monitoring Tools
      {
        name: 'run_malware_scan_advanced',
        description: 'Run advanced malware scan with comprehensive configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to scan',
            },
            deep_scan: {
              type: 'boolean',
              description: 'Enable deep scanning for hidden threats (optional)',
            },
            quarantine_enabled: {
              type: 'boolean',
              description: 'Enable automatic quarantine of threats (optional)',
            },
            email_notification: {
              type: 'boolean',
              description: 'Send email notification after scan (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_security_policy_status',
        description: 'Get comprehensive security policy status and compliance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_password_policies',
        description: 'Configure password security requirements and rotation',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            min_length: {
              type: 'number',
              description: 'Minimum password length',
            },
            require_uppercase: {
              type: 'boolean',
              description: 'Require uppercase letters',
            },
            require_numbers: {
              type: 'boolean',
              description: 'Require numeric characters',
            },
            require_special_chars: {
              type: 'boolean',
              description: 'Require special characters',
            },
            expiration_days: {
              type: 'number',
              description: 'Password expiration period in days (optional)',
            },
            prevent_reuse: {
              type: 'number',
              description: 'Number of previous passwords to prevent reuse (optional)',
            },
          },
          required: ['package_id', 'min_length', 'require_uppercase', 'require_numbers', 'require_special_chars'],
        },
      },
      {
        name: 'manage_ssh_key_rotation',
        description: 'Configure SSH key rotation policies for enhanced security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable SSH key rotation',
            },
            rotation_period_days: {
              type: 'number',
              description: 'Days between key rotations',
            },
            notify_before_expiry: {
              type: 'number',
              description: 'Days before expiry to send notification (optional)',
            },
          },
          required: ['package_id', 'enabled', 'rotation_period_days'],
        },
      },
      {
        name: 'get_performance_monitoring',
        description: 'Get comprehensive performance monitoring metrics',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            time_range: {
              type: 'string',
              description: 'Time range for metrics (e.g., "1h", "24h", "7d") - optional',
            },
            granularity: {
              type: 'string',
              description: 'Data granularity (e.g., "minute", "hour", "day") - optional',
            },
            include_alerts: {
              type: 'boolean',
              description: 'Include alert information (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_resource_usage_analytics',
        description: 'Get detailed resource usage analytics and recommendations',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_security_event_logs',
        description: 'Get security event logs and audit trail',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            start_date: {
              type: 'string',
              description: 'Start date for logs (ISO format) - optional',
            },
            end_date: {
              type: 'string',
              description: 'End date for logs (ISO format) - optional',
            },
            event_type: {
              type: 'string',
              description: 'Filter by event type (optional)',
            },
            severity: {
              type: 'string',
              description: 'Filter by severity level (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_alert_system',
        description: 'Configure monitoring alerts and notifications',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            email_notifications: {
              type: 'boolean',
              description: 'Enable email notifications',
            },
            sms_notifications: {
              type: 'boolean',
              description: 'Enable SMS notifications (optional)',
            },
            webhook_url: {
              type: 'string',
              description: 'Webhook URL for notifications (optional)',
            },
            cpu_usage_threshold: {
              type: 'number',
              description: 'CPU usage alert threshold percentage',
            },
            memory_usage_threshold: {
              type: 'number',
              description: 'Memory usage alert threshold percentage',
            },
            disk_usage_threshold: {
              type: 'number',
              description: 'Disk usage alert threshold percentage',
            },
            bandwidth_usage_threshold: {
              type: 'number',
              description: 'Bandwidth usage alert threshold percentage',
            },
          },
          required: ['package_id', 'email_notifications'],
        },
      },
      {
        name: 'get_audit_trail_report',
        description: 'Get comprehensive audit trail for compliance',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            start_date: {
              type: 'string',
              description: 'Start date for audit trail (ISO format) - optional',
            },
            end_date: {
              type: 'string',
              description: 'End date for audit trail (ISO format) - optional',
            },
            user_filter: {
              type: 'string',
              description: 'Filter by username (optional)',
            },
            action_filter: {
              type: 'string',
              description: 'Filter by action type (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'enforce_security_compliance',
        description: 'Enforce security compliance standards',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            standard: {
              type: 'string',
              enum: ['PCI-DSS', 'ISO-27001', 'SOC-2', 'CUSTOM'],
              description: 'Compliance standard to enforce',
            },
            strict_mode: {
              type: 'boolean',
              description: 'Enable strict compliance mode',
            },
            auto_remediation: {
              type: 'boolean',
              description: 'Enable automatic remediation of violations (optional)',
            },
            custom_rules: {
              type: 'array',
              description: 'Custom compliance rules (optional)',
            },
          },
          required: ['package_id', 'standard', 'strict_mode'],
        },
      },
      
      // Group C1: DNS & Domain Advanced Tools
      {
        name: 'configure_dnssec',
        description: 'Configure DNSSEC for enhanced DNS security',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID to configure DNSSEC for',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable or disable DNSSEC',
            },
            algorithm: {
              type: 'string',
              description: 'DNSSEC algorithm (optional)',
            },
            key_size: {
              type: 'number',
              description: 'DNSSEC key size (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'enabled'],
        },
      },
      {
        name: 'manage_virtual_nameservers',
        description: 'Manage virtual nameserver configuration',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'update', 'delete'],
              description: 'Action to perform on nameserver',
            },
            hostname: {
              type: 'string',
              description: 'Nameserver hostname',
            },
            ip_addresses: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'IP addresses for the nameserver',
            },
            glue_records: {
              type: 'array',
              description: 'Glue records (optional)',
            },
          },
          required: ['action', 'hostname', 'ip_addresses'],
        },
      },
      {
        name: 'configure_advanced_dns_records',
        description: 'Configure advanced DNS record types (SRV, CAA, TLSA, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            record_type: {
              type: 'string',
              description: 'DNS record type (SRV, CAA, TLSA, etc.)',
            },
            name: {
              type: 'string',
              description: 'Record name',
            },
            value: {
              type: 'string',
              description: 'Record value',
            },
            ttl: {
              type: 'number',
              description: 'Time to live (optional)',
            },
            priority: {
              type: 'number',
              description: 'Record priority (optional)',
            },
            weight: {
              type: 'number',
              description: 'Record weight (optional)',
            },
            port: {
              type: 'number',
              description: 'Port number (optional)',
            },
            flags: {
              type: 'number',
              description: 'Record flags (optional)',
            },
            tag: {
              type: 'string',
              description: 'Record tag (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'record_type', 'name', 'value'],
        },
      },
      {
        name: 'get_dns_analytics',
        description: 'Get DNS query analytics and performance data',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            time_range: {
              type: 'string',
              description: 'Time range for analytics (optional)',
            },
            query_types: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'DNS query types to include (optional)',
            },
            include_geolocation: {
              type: 'boolean',
              description: 'Include geolocation data (optional)',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'configure_dns_security_monitoring',
        description: 'Configure DNS security monitoring and threat detection',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable DNS security monitoring',
            },
            suspicious_queries_threshold: {
              type: 'number',
              description: 'Threshold for suspicious queries alert (optional)',
            },
            anomalous_traffic_threshold: {
              type: 'number',
              description: 'Threshold for anomalous traffic alert (optional)',
            },
            dnssec_failures_threshold: {
              type: 'number',
              description: 'Threshold for DNSSEC failures alert (optional)',
            },
            email_notifications: {
              type: 'boolean',
              description: 'Enable email notifications (optional)',
            },
            webhook_url: {
              type: 'string',
              description: 'Webhook URL for notifications (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'enabled'],
        },
      },
      {
        name: 'optimize_dns_performance',
        description: 'Optimize DNS performance with caching and geo-DNS',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            enable_caching: {
              type: 'boolean',
              description: 'Enable DNS caching',
            },
            cache_ttl: {
              type: 'number',
              description: 'Cache TTL in seconds (optional)',
            },
            enable_geo_dns: {
              type: 'boolean',
              description: 'Enable geographic DNS routing (optional)',
            },
            geo_rules: {
              type: 'array',
              description: 'Geographic routing rules (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'enable_caching'],
        },
      },
      {
        name: 'setup_third_party_dns_integration',
        description: 'Setup third-party DNS integrations (Google Apps, Office 365)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            provider: {
              type: 'string',
              enum: ['google-apps', 'office365', 'custom'],
              description: 'Third-party service provider',
            },
            configuration: {
              type: 'object',
              description: 'Provider-specific configuration',
            },
            verification_method: {
              type: 'string',
              description: 'Verification method (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'provider', 'configuration'],
        },
      },
      {
        name: 'manage_dns_backup_restore',
        description: 'Manage DNS configuration backup and restore',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            action: {
              type: 'string',
              enum: ['backup', 'restore', 'list'],
              description: 'Backup operation to perform',
            },
            backup_name: {
              type: 'string',
              description: 'Name for backup (optional)',
            },
            restore_point: {
              type: 'string',
              description: 'Restore point identifier (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'action'],
        },
      },
      {
        name: 'configure_dns_templates',
        description: 'Manage DNS record templates for rapid deployment',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            action: {
              type: 'string',
              enum: ['create', 'apply', 'list', 'delete'],
              description: 'Template operation to perform',
            },
            template_name: {
              type: 'string',
              description: 'Template name (optional)',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to apply template to (optional)',
            },
            record_set: {
              type: 'array',
              description: 'DNS records for template (optional)',
            },
          },
          required: ['package_id', 'action'],
        },
      },
      {
        name: 'perform_dns_bulk_operations',
        description: 'Perform bulk DNS operations across multiple domains',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            operation: {
              type: 'string',
              enum: ['create', 'update', 'delete'],
              description: 'Bulk operation to perform',
            },
            domains: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'List of domain IDs',
            },
            record_template: {
              type: 'object',
              description: 'DNS record template to apply',
            },
            validation_mode: {
              type: 'boolean',
              description: 'Enable validation mode (optional)',
            },
          },
          required: ['package_id', 'operation', 'domains', 'record_template'],
        },
      },
      {
        name: 'manage_dns_api_access',
        description: 'Manage DNS API access and permissions',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable DNS API access',
            },
            access_keys: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'API access keys (optional)',
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'API permissions (optional)',
            },
            rate_limits: {
              type: 'object',
              description: 'API rate limits (optional)',
            },
          },
          required: ['package_id', 'enabled'],
        },
      },
      {
        name: 'get_dns_troubleshooting_tools',
        description: 'Access DNS troubleshooting and diagnostic tools',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            tool: {
              type: 'string',
              enum: ['propagation', 'validation', 'trace', 'health-check'],
              description: 'Troubleshooting tool to use',
            },
            parameters: {
              type: 'object',
              description: 'Tool-specific parameters (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'tool'],
        },
      },
      {
        name: 'manage_domain_transfer_operations',
        description: 'Manage comprehensive domain transfer operations',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            action: {
              type: 'string',
              enum: ['initiate', 'approve', 'reject', 'cancel', 'status'],
              description: 'Transfer operation to perform',
            },
            auth_code: {
              type: 'string',
              description: 'Domain authorization code (optional)',
            },
            target_registrar: {
              type: 'string',
              description: 'Target registrar (optional)',
            },
            transfer_data: {
              type: 'object',
              description: 'Transfer-specific data (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'action'],
        },
      },
      {
        name: 'get_epp_code_management',
        description: 'Manage EPP authorization codes for domain transfers',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            action: {
              type: 'string',
              enum: ['get', 'regenerate'],
              description: 'EPP code operation',
            },
          },
          required: ['package_id', 'domain_id', 'action'],
        },
      },
      {
        name: 'manage_domain_verification_systems',
        description: 'Manage domain verification for various purposes',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            method: {
              type: 'string',
              enum: ['dns', 'email', 'file', 'meta'],
              description: 'Verification method',
            },
            purpose: {
              type: 'string',
              enum: ['ownership', 'ssl', 'service', 'compliance'],
              description: 'Verification purpose',
            },
            configuration: {
              type: 'object',
              description: 'Verification configuration',
            },
          },
          required: ['package_id', 'domain_id', 'method', 'purpose', 'configuration'],
        },
      },
      {
        name: 'get_domain_analytics',
        description: 'Get comprehensive domain analytics and insights',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            metrics: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Specific metrics to include (optional)',
            },
            time_range: {
              type: 'string',
              description: 'Time range for analytics (optional)',
            },
            include_subdomains: {
              type: 'boolean',
              description: 'Include subdomain data (optional)',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'manage_domain_bulk_operations',
        description: 'Perform bulk domain operations',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['register', 'renew', 'transfer', 'update'],
              description: 'Bulk operation to perform',
            },
            domains: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'List of domain names',
            },
            configuration: {
              type: 'object',
              description: 'Operation configuration',
            },
            validation_mode: {
              type: 'boolean',
              description: 'Enable validation mode (optional)',
            },
          },
          required: ['operation', 'domains', 'configuration'],
        },
      },
      {
        name: 'get_domain_portfolio_management',
        description: 'Get comprehensive domain portfolio overview',
        inputSchema: {
          type: 'object',
          properties: {
            group_by: {
              type: 'string',
              description: 'Group domains by criteria (optional)',
            },
            filters: {
              type: 'object',
              description: 'Portfolio filters (optional)',
            },
            sort_by: {
              type: 'string',
              description: 'Sort criteria (optional)',
            },
            include_analytics: {
              type: 'boolean',
              description: 'Include analytics data (optional)',
            },
          },
          required: [],
        },
      },
      {
        name: 'manage_domain_privacy_control',
        description: 'Manage domain privacy protection settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable domain privacy',
            },
            privacy_level: {
              type: 'string',
              enum: ['basic', 'enhanced', 'premium'],
              description: 'Privacy protection level (optional)',
            },
            custom_settings: {
              type: 'object',
              description: 'Custom privacy settings (optional)',
            },
          },
          required: ['package_id', 'domain_id', 'enabled'],
        },
      },
      {
        name: 'get_advanced_whois_management',
        description: 'Get advanced WHOIS information and management',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain_id: {
              type: 'string',
              description: 'The domain ID',
            },
            include_history: {
              type: 'boolean',
              description: 'Include WHOIS history (optional)',
            },
            privacy_mask: {
              type: 'boolean',
              description: 'Apply privacy masking (optional)',
            },
            contact_overrides: {
              type: 'object',
              description: 'Contact information overrides (optional)',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      
      // Group C2: Platform Tools
      {
        name: 'recycle_application_pool',
        description: 'Recycle Windows IIS application pool',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_windows_configuration',
        description: 'Get Windows IIS hosting configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_windows_configuration',
        description: 'Update Windows IIS hosting configuration',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            pipeline_mode: {
              type: 'string',
              description: 'Application pool pipeline mode (optional)',
            },
            runtime_version: {
              type: 'string',
              description: 'Application pool runtime version (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_oneclick_applications',
        description: 'Get available one-click installation applications',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'reinstall_software',
        description: 'Reinstall platform software (e.g., WordPress)',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            software: {
              type: 'string',
              description: 'Software to reinstall',
            },
            version: {
              type: 'string',
              description: 'Software version (optional)',
            },
            domain: {
              type: 'string',
              description: 'Installation domain (optional)',
            },
            path: {
              type: 'string',
              description: 'Installation path (optional)',
            },
          },
          required: ['package_id', 'software'],
        },
      },
      
      // Group D1: Backup & Recovery Tools
      {
        name: 'take_database_snapshot',
        description: 'Create database backup snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            database_id: {
              type: 'string',
              description: 'The database ID',
            },
          },
          required: ['package_id', 'database_id'],
        },
      },
      {
        name: 'take_mailbox_snapshot',
        description: 'Create mailbox backup snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID',
            },
          },
          required: ['package_id', 'mailbox_id'],
        },
      },
      {
        name: 'take_web_snapshot',
        description: 'Create web files backup snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'restore_database_snapshot',
        description: 'Restore database from backup snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            database_id: {
              type: 'string',
              description: 'The database ID',
            },
            snapshot_id: {
              type: 'string',
              description: 'The snapshot ID to restore',
            },
            restore_point: {
              type: 'string',
              description: 'Specific restore point (optional)',
            },
          },
          required: ['package_id', 'database_id', 'snapshot_id'],
        },
      },
      {
        name: 'restore_mailbox_snapshot',
        description: 'Restore mailbox from backup snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID',
            },
            snapshot_id: {
              type: 'string',
              description: 'The snapshot ID to restore',
            },
            restore_point: {
              type: 'string',
              description: 'Specific restore point (optional)',
            },
          },
          required: ['package_id', 'mailbox_id', 'snapshot_id'],
        },
      },
      {
        name: 'restore_web_snapshot',
        description: 'Restore web files from backup snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            snapshot_id: {
              type: 'string',
              description: 'The snapshot ID to restore',
            },
            restore_point: {
              type: 'string',
              description: 'Specific restore point (optional)',
            },
          },
          required: ['package_id', 'snapshot_id'],
        },
      },
      {
        name: 'get_database_backups',
        description: 'Get database backup information and history',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            database_id: {
              type: 'string',
              description: 'The database ID',
            },
          },
          required: ['package_id', 'database_id'],
        },
      },
      {
        name: 'get_mailbox_backups',
        description: 'Get mailbox backup information and history',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            mailbox_id: {
              type: 'string',
              description: 'The mailbox ID',
            },
          },
          required: ['package_id', 'mailbox_id'],
        },
      },
      {
        name: 'get_web_backups',
        description: 'Get web files backup information and history',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_timeline_backup_overview',
        description: 'Get comprehensive backup overview for package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      
      // Group D2: Automation & Branding Tools
      {
        name: 'get_scheduled_tasks',
        description: 'Get scheduled tasks and cron jobs for package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'create_scheduled_task',
        description: 'Create new scheduled task/cron job',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            command: {
              type: 'string',
              description: 'Command to execute',
            },
            schedule: {
              type: 'string',
              description: 'Cron schedule format',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable task (optional)',
            },
            description: {
              type: 'string',
              description: 'Task description (optional)',
            },
          },
          required: ['package_id', 'command', 'schedule'],
        },
      },
      {
        name: 'test_scheduled_task',
        description: 'Test scheduled task execution',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            task_id: {
              type: 'string',
              description: 'The task ID to test',
            },
          },
          required: ['package_id', 'task_id'],
        },
      },
      {
        name: 'generate_sitemap',
        description: 'Generate website sitemap for SEO optimization',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
            domain: {
              type: 'string',
              description: 'Domain to generate sitemap for (optional)',
            },
            include_images: {
              type: 'boolean',
              description: 'Include images in sitemap (optional)',
            },
            priority: {
              type: 'number',
              description: 'Page priority (optional)',
            },
            change_freq: {
              type: 'string',
              description: 'Change frequency (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_stackcache_status',
        description: 'Get StackCache performance optimization status',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'configure_package_branding',
        description: 'Configure package branding for white-label hosting',
        inputSchema: {
          type: 'object',
          properties: {
            package_type: {
              type: 'string',
              description: 'Package type to brand',
            },
            brand_name: {
              type: 'string',
              description: 'Brand name (optional)',
            },
            logo_url: {
              type: 'string',
              description: 'Logo URL (optional)',
            },
            color_scheme: {
              type: 'string',
              description: 'Color scheme (optional)',
            },
            customization: {
              type: 'object',
              description: 'Additional customization options (optional)',
            },
          },
          required: ['package_type'],
        },
      },
      {
        name: 'configure_nominet_branding',
        description: 'Configure Nominet domain branding for UK market',
        inputSchema: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              description: 'Enable Nominet branding',
            },
            brand_name: {
              type: 'string',
              description: 'Brand name (optional)',
            },
            contact_info: {
              type: 'object',
              description: 'Contact information (optional)',
            },
            customization: {
              type: 'object',
              description: 'Additional customization options (optional)',
            },
          },
          required: ['enabled'],
        },
      },
      
      // Group A1: VPS Management Tools (22 endpoints)
      {
        name: 'list_vps',
        description: 'List all VPS instances in account',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_vps_info',
        description: 'Get VPS instance information and status',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'activate_vps',
        description: 'Activate VPS instance',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'deactivate_vps',
        description: 'Deactivate VPS instance',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'reboot_vps',
        description: 'Reboot VPS instance',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'shutdown_vps',
        description: 'Shutdown VPS instance',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'start_vps',
        description: 'Start VPS instance',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'rebuild_vps',
        description: 'Rebuild VPS with new operating system',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
            operating_system: {
              type: 'string',
              description: 'Operating system to install',
            },
            template: {
              type: 'string',
              description: 'OS template (optional)',
            },
            preserve_data: {
              type: 'boolean',
              description: 'Preserve existing data (optional)',
            },
          },
          required: ['vps_id', 'operating_system'],
        },
      },
      {
        name: 'get_vps_limits',
        description: 'Get VPS resource limits and quotas',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_backups',
        description: 'Get VPS backup information',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_disks',
        description: 'Get VPS disk information and usage',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_ip_addresses',
        description: 'Get VPS IP addresses and network configuration',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'change_vps_password',
        description: 'Change VPS root password',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
            new_password: {
              type: 'string',
              description: 'New root password',
            },
          },
          required: ['vps_id', 'new_password'],
        },
      },
      {
        name: 'get_vps_operating_systems',
        description: 'Get available operating systems for VPS rebuild',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_vnc_access',
        description: 'Get VNC console access information',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'lock_vps_vnc',
        description: 'Lock VNC console access',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'unlock_vps_vnc',
        description: 'Unlock VNC console access',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_cpanel_access',
        description: 'Get cPanel access information for VPS',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
          },
          required: ['vps_id'],
        },
      },
      {
        name: 'get_vps_addon',
        description: 'Get VPS addon information',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
            addon_id: {
              type: 'string',
              description: 'The addon ID',
            },
          },
          required: ['vps_id', 'addon_id'],
        },
      },
      {
        name: 'update_vps_name',
        description: 'Update VPS name/hostname',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
            new_name: {
              type: 'string',
              description: 'New VPS name/hostname',
            },
          },
          required: ['vps_id', 'new_name'],
        },
      },
      {
        name: 'order_vps',
        description: 'Order new VPS instance',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'VPS location/datacenter',
            },
            plan: {
              type: 'string',
              description: 'VPS plan/configuration',
            },
            operating_system: {
              type: 'string',
              description: 'Operating system to install',
            },
            hostname: {
              type: 'string',
              description: 'VPS hostname (optional)',
            },
            root_password: {
              type: 'string',
              description: 'Root password (optional)',
            },
          },
          required: ['location', 'plan', 'operating_system'],
        },
      },
      {
        name: 'renew_vps',
        description: 'Renew VPS subscription',
        inputSchema: {
          type: 'object',
          properties: {
            vps_id: {
              type: 'string',
              description: 'The VPS ID',
            },
            renewal_period: {
              type: 'number',
              description: 'Renewal period in months',
            },
          },
          required: ['vps_id', 'renewal_period'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    if (!args) {
      throw new McpError(ErrorCode.InvalidRequest, 'Missing arguments');
    }

    switch (name) {
      case 'get_reseller_info':
        try {
          const resellerInfo = await twentyIClient.getResellerInfo();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(resellerInfo, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get reseller info: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_account_balance':
        try {
          const accountBalance = await twentyIClient.getAccountBalance();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(accountBalance, null, 2),
              },
            ],
          };
        } catch (error: any) {
          // Handle "balance not available" case gracefully
          if (error.message && error.message.includes('Balance information not available')) {
            // Return a successful response with zero balance information
            const gracefulResponse = {
              balance: 0,
              currency: 'USD',
              message: 'Balance information not available - account may have zero balance or no payment history',
              status: 'unavailable'
            };
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(gracefulResponse, null, 2),
                },
              ],
            };
          }
          
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get account balance: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'list_domains':
        try {
          const domains = await twentyIClient.listDomains();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(domains, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to list domains: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_domain_info':
        const domainInfo = await twentyIClient.getDomainInfo(args.domain_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(domainInfo, null, 2),
            },
          ],
        };

      case 'list_hosting_packages':
        const packages = await twentyIClient.listHostingPackages();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packages, null, 2),
            },
          ],
        };

      case 'get_hosting_package_info':
        const packageInfo = await twentyIClient.getHostingPackageInfo(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageInfo, null, 2),
            },
          ],
        };

      case 'create_hosting_package':
        const newPackage = await twentyIClient.createHostingPackage({
          domain_name: args.domain_name,
          package_type: args.package_type,
          username: args.username,
          password: args.password,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newPackage, null, 2),
            },
          ],
        };

      case 'get_hosting_package_web_info':
        const packageWebInfo = await twentyIClient.getHostingPackageWebInfo(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageWebInfo, null, 2),
            },
          ],
        };

      case 'get_hosting_package_limits':
        const packageLimits = await twentyIClient.getHostingPackageLimits(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageLimits, null, 2),
            },
          ],
        };

      case 'get_hosting_package_usage':
        const packageUsage = await twentyIClient.getHostingPackageUsage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageUsage, null, 2),
            },
          ],
        };

      case 'list_cloud_servers':
        const servers = await twentyIClient.listCloudServers();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(servers, null, 2),
            },
          ],
        };

      case 'create_cloud_server':
        const newServer = await twentyIClient.createCloudServer({
          provider: args.provider,
          size: args.size,
          location: args.location,
          name: args.name,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newServer, null, 2),
            },
          ],
        };

      case 'get_dns_records':
        const dnsRecords = await twentyIClient.getDnsRecords(args.domain_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsRecords, null, 2),
            },
          ],
        };

      case 'update_dns_record':
        const updatedDns = await twentyIClient.updateDnsRecord(args.domain_id as string, {
          record_type: args.record_type,
          name: args.name,
          value: args.value,
          ttl: args.ttl || 3600,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedDns, null, 2),
            },
          ],
        };

      case 'register_domain':
        const registeredDomain = await twentyIClient.registerDomain({
          name: args.name as string,
          years: args.years as number,
          contact: args.contact as any,
          privacyService: args.privacy_service as boolean,
          nameservers: args.nameservers as string[],
          stackUser: args.stack_user as string,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(registeredDomain, null, 2),
            },
          ],
        };

      case 'search_domains':
        try {
          const searchResults = await twentyIClient.searchDomains(
            args.search_term as string,
            {
              suggestions: args.suggestions as boolean,
              tlds: args.tlds as string[],
            }
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(searchResults, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to search domains: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_domain_verification_status':
        try {
          const verificationStatus = await twentyIClient.getDomainVerificationStatus();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(verificationStatus, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get domain verification status: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'resend_domain_verification_email':
        try {
          const emailResult = await twentyIClient.resendDomainVerificationEmail(
            args.package_id as string,
            args.domain_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(emailResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to resend domain verification email: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_dkim_signature':
        try {
          const dkimSignature = await twentyIClient.getDkimSignature(
            args.package_id as string,
            args.email_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dkimSignature, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get DKIM signature: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'set_dkim_signature':
        try {
          const dkimConfig = {
            action: args.action as 'set' | 'delete',
            body: args.action === 'set' ? {
              Canonicalization: args.canonicalization as string,
              Selector: args.selector as string,
              IsDefault: args.is_default as boolean,
              Note: args.note as string,
            } : undefined,
          };
          
          const dkimResult = await twentyIClient.setDkimSignature(
            args.package_id as string,
            args.email_id as string,
            dkimConfig
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dkimResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to set DKIM signature: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_dmarc_policy':
        try {
          const dmarcPolicy = await twentyIClient.getDmarcPolicy(
            args.package_id as string,
            args.email_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dmarcPolicy, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get DMARC policy: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'set_dmarc_policy':
        try {
          const dmarcConfig = {
            action: args.action as 'set' | 'delete',
            body: args.action === 'set' ? {
              Policy: args.policy as 'none' | 'quarantine' | 'reject',
              SubdomainPolicy: args.subdomain_policy as 'none' | 'quarantine' | 'reject',
              Percentage: args.percentage as number,
              ReportingURI: args.reporting_uri as string,
              AlignmentMode: args.alignment_mode as 'strict' | 'relaxed',
              Note: args.note as string,
            } : undefined,
          };
          
          const dmarcResult = await twentyIClient.setDmarcPolicy(
            args.package_id as string,
            args.email_id as string,
            dmarcConfig
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dmarcResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to set DMARC policy: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_php_versions':
        try {
          const phpVersions = await twentyIClient.getAvailablePhpVersions(args.package_id as string);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(phpVersions, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get PHP versions: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_current_php_version':
        try {
          const currentVersion = await twentyIClient.getCurrentPhpVersion(args.package_id as string);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(currentVersion, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get current PHP version: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'set_php_version':
        try {
          const versionResult = await twentyIClient.setPhpVersion(
            args.package_id as string,
            args.version as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(versionResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to set PHP version: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_php_config_options':
        try {
          const configOptions = await twentyIClient.getAllowedPhpConfiguration(args.package_id as string);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(configOptions, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get PHP configuration options: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'get_php_config':
        try {
          const phpConfig = await twentyIClient.getPhpConfig(
            args.package_id as string,
            args.config_id as string
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(phpConfig, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get PHP configuration: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'update_php_config':
        try {
          const updateResult = await twentyIClient.updatePhpConfig(
            args.package_id as string,
            args.config_id as string,
            args.config as Record<string, string>
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(updateResult, null, 2),
              },
            ],
          };
        } catch (error: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to update PHP configuration: ${error.message}`,
            { originalError: error.toString() }
          );
        }

      case 'is_wordpress_installed':
        const wpInstalled = await twentyIClient.isWordPressInstalled(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpInstalled, null, 2),
            },
          ],
        };

      case 'reinstall_wordpress':
        const wpReinstall = await twentyIClient.reinstallWordPress(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpReinstall, null, 2),
            },
          ],
        };

      case 'get_wordpress_settings':
        const wpSettings = await twentyIClient.getWordPressSettings(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpSettings, null, 2),
            },
          ],
        };

      case 'set_wordpress_settings':
        const wpSetSettings = await twentyIClient.setWordPressSettings(
          args.package_id as string,
          args.option_name as string,
          args.option_value as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpSetSettings, null, 2),
            },
          ],
        };

      case 'get_wordpress_version':
        const wpVersion = await twentyIClient.getWordPressVersion(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpVersion, null, 2),
            },
          ],
        };

      case 'wordpress_search_replace':
        const wpSearchReplace = await twentyIClient.wordPressSearchReplace(
          args.package_id as string,
          args.search as string,
          args.replace as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpSearchReplace, null, 2),
            },
          ],
        };

      case 'get_wordpress_plugins':
        const wpPlugins = await twentyIClient.getWordPressPlugins(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpPlugins, null, 2),
            },
          ],
        };

      case 'manage_wordpress_plugin':
        const wpPluginManage = await twentyIClient.manageWordPressPlugin(
          args.package_id as string,
          args.action as 'activate' | 'deactivate' | 'remove',
          args.plugin_name as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpPluginManage, null, 2),
            },
          ],
        };

      case 'install_stackcache_plugin':
        const stackCache = await twentyIClient.installStackCachePlugin(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCache, null, 2),
            },
          ],
        };

      case 'get_wordpress_themes':
        const wpThemes = await twentyIClient.getWordPressThemes(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpThemes, null, 2),
            },
          ],
        };

      case 'manage_wordpress_theme':
        const wpThemeManage = await twentyIClient.manageWordPressTheme(
          args.package_id as string,
          args.action as 'activate' | 'deactivate' | 'remove',
          args.theme_name as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpThemeManage, null, 2),
            },
          ],
        };

      case 'get_wordpress_users':
        const wpUsers = await twentyIClient.getWordPressUsers(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpUsers, null, 2),
            },
          ],
        };

      case 'update_wordpress':
        const wpUpdate = await twentyIClient.updateWordPress(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpUpdate, null, 2),
            },
          ],
        };

      case 'get_wordpress_staging':
        const wpStaging = await twentyIClient.getWordPressStaging(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpStaging, null, 2),
            },
          ],
        };

      case 'manage_wordpress_staging':
        const wpStagingManage = await twentyIClient.manageWordPressStaging(
          args.package_id as string,
          args.type as 'live' | 'staging'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpStagingManage, null, 2),
            },
          ],
        };

      case 'get_cdn_options':
        const cdnOptions = await twentyIClient.getCdnOptions(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cdnOptions, null, 2),
            },
          ],
        };

      case 'get_cdn_feature_groups':
        const cdnFeatureGroups = await twentyIClient.getCdnFeatureGroups(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cdnFeatureGroups, null, 2),
            },
          ],
        };

      case 'add_cdn_feature':
        const addedCdnFeature = await twentyIClient.addCdnFeature(
          args.package_id as string,
          args.feature_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addedCdnFeature, null, 2),
            },
          ],
        };

      case 'bulk_add_cdn_features':
        const bulkAddedFeatures = await twentyIClient.bulkAddCdnFeatures(
          args.package_id as string,
          args.features_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bulkAddedFeatures, null, 2),
            },
          ],
        };

      case 'get_cdn_stats':
        const cdnStats = await twentyIClient.getCdnStats(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cdnStats, null, 2),
            },
          ],
        };

      case 'get_cache_report':
        const cacheReport = await twentyIClient.getCacheReport(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cacheReport, null, 2),
            },
          ],
        };

      case 'purge_cdn_cache':
        const purgeResult = await twentyIClient.purgeCdnCache(
          args.package_id as string,
          args.url as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(purgeResult, null, 2),
            },
          ],
        };

      case 'get_stackcache_settings':
        const stackCacheSettings = await twentyIClient.getStackCacheSettings(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCacheSettings, null, 2),
            },
          ],
        };

      case 'set_stackcache_policy':
        const stackCachePolicy = await twentyIClient.setStackCachePolicy(
          args.package_id as string,
          args.policy_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCachePolicy, null, 2),
            },
          ],
        };

      case 'get_cdn_security_headers':
        const securityHeaders = await twentyIClient.getCdnSecurityHeaders(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(securityHeaders, null, 2),
            },
          ],
        };

      case 'update_cdn_security_headers':
        const updatedHeaders = await twentyIClient.updateCdnSecurityHeaders(
          args.package_id as string,
          args.headers_data as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedHeaders, null, 2),
            },
          ],
        };

      case 'delete_cdn_security_headers':
        const deletedHeaders = await twentyIClient.deleteCdnSecurityHeaders(
          args.package_id as string,
          args.header_names as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deletedHeaders, null, 2),
            },
          ],
        };

      case 'get_cdn_traffic_distribution':
        const trafficDistribution = await twentyIClient.getCdnTrafficDistribution(
          args.package_id as string,
          args.filters as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(trafficDistribution, null, 2),
            },
          ],
        };

      case 'assign_website_turbo':
        const assignResult = await twentyIClient.assignWebsiteTurbo(
          args.website_turbo_id as string,
          args.package_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assignResult, null, 2),
            },
          ],
        };

      case 'order_website_turbo_credits':
        const turboCredits = await twentyIClient.orderWebsiteTurboCredits(args.amount as number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(turboCredits, null, 2),
            },
          ],
        };

      case 'list_timeline_storage':
        const timelineStorage = await twentyIClient.listTimelineStorage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(timelineStorage, null, 2),
            },
          ],
        };

      case 'create_snapshot':
        const snapshotResult = await twentyIClient.createSnapshot(
          args.package_id as string,
          args.snapshot_type as 'web' | 'database',
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshotResult, null, 2),
            },
          ],
        };

      case 'list_snapshots':
        const snapshots = await twentyIClient.listSnapshots(
          args.package_id as string,
          args.snapshot_type as 'web' | 'database',
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshots, null, 2),
            },
          ],
        };

      case 'restore_snapshot':
        const restoreResult = await twentyIClient.restoreSnapshot(args.package_id as string, {
          snapshotType: args.snapshot_type as 'web' | 'database',
          action: args.action as 'restore' | 'mysqlrestore',
          restoreAsOf: args.restore_as_of as number,
          restorePath: args.restore_path as string,
          target: args.target as string,
          databaseId: args.database_id as string
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(restoreResult, null, 2),
            },
          ],
        };

      case 'get_snapshot_jobs':
        const snapshotJobs = await twentyIClient.getSnapshotJobs(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshotJobs, null, 2),
            },
          ],
        };

      case 'restore_ftp_backup':
        const ftpRestoreResult = await twentyIClient.restoreFtpBackup(args.package_id as string, {
          filename: args.filename as string,
          restoreType: args.restore_type as 'IntoDirectory' | 'ReplaceMissing' | 'ReplaceAll',
          restoreDatabases: args.restore_databases as boolean
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ftpRestoreResult, null, 2),
            },
          ],
        };

      case 'list_backup_jobs':
        const backupJobs = await twentyIClient.listBackupJobs(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(backupJobs, null, 2),
            },
          ],
        };

      case 'list_multisite_backups':
        const multisiteBackups = await twentyIClient.listMultisiteBackups();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(multisiteBackups, null, 2),
            },
          ],
        };

      case 'create_multisite_backup':
        const multisiteBackupResult = await twentyIClient.createMultisiteBackup(
          args.package_ids as string[],
          args.delete_existing as boolean
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(multisiteBackupResult, null, 2),
            },
          ],
        };

      case 'list_vps_backups':
        const vpsBackups = await twentyIClient.listVpsBackups();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsBackups, null, 2),
            },
          ],
        };

      case 'update_vps_backup':
        const vpsBackupUpdate = await twentyIClient.updateVpsBackup(
          args.vps_id as string,
          args.backup_config as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsBackupUpdate, null, 2),
            },
          ],
        };

      case 'get_blocked_ip_addresses':
        const blockedIps = await twentyIClient.getBlockedIpAddresses(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(blockedIps, null, 2),
            },
          ],
        };

      case 'set_blocked_ip_addresses':
        const setIpBlocks = await twentyIClient.setBlockedIpAddresses(
          args.package_id as string,
          args.ip_addresses as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setIpBlocks, null, 2),
            },
          ],
        };

      case 'add_ip_block':
        const addIpBlock = await twentyIClient.addIpBlock(
          args.package_id as string,
          args.ip_address as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addIpBlock, null, 2),
            },
          ],
        };

      case 'remove_ip_block':
        const removeIpBlock = await twentyIClient.removeIpBlock(
          args.package_id as string,
          args.ip_address as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removeIpBlock, null, 2),
            },
          ],
        };

      case 'get_blocked_countries':
        const blockedCountries = await twentyIClient.getBlockedCountries(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(blockedCountries, null, 2),
            },
          ],
        };

      case 'set_blocked_countries':
        const setCountryBlocks = await twentyIClient.setBlockedCountries(
          args.package_id as string,
          args.countries as string[],
          args.access as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setCountryBlocks, null, 2),
            },
          ],
        };

      case 'add_country_block':
        const addCountryBlock = await twentyIClient.addCountryBlock(
          args.package_id as string,
          args.country_code as string,
          args.access as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addCountryBlock, null, 2),
            },
          ],
        };

      case 'remove_country_block':
        const removeCountryBlock = await twentyIClient.removeCountryBlock(
          args.package_id as string,
          args.country_code as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removeCountryBlock, null, 2),
            },
          ],
        };

      case 'get_malware_scan':
        const malwareScan = await twentyIClient.getMalwareScan(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(malwareScan, null, 2),
            },
          ],
        };

      case 'request_malware_scan':
        const requestScan = await twentyIClient.requestMalwareScan(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(requestScan, null, 2),
            },
          ],
        };

      case 'get_malware_report':
        const malwareReport = await twentyIClient.getMalwareReport(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(malwareReport, null, 2),
            },
          ],
        };

      case 'get_email_spam_blacklist':
        const spamBlacklist = await twentyIClient.getEmailSpamBlacklist(
          args.package_id as string,
          args.email_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spamBlacklist, null, 2),
            },
          ],
        };

      case 'get_email_spam_whitelist':
        const spamWhitelist = await twentyIClient.getEmailSpamWhitelist(
          args.package_id as string,
          args.email_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spamWhitelist, null, 2),
            },
          ],
        };

      case 'add_tls_certificate':
        const tlsCertificate = await twentyIClient.addTlsCertificate(
          args.name as string,
          args.period_months as number,
          args.configuration as any
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tlsCertificate, null, 2),
            },
          ],
        };

      case 'renew_tls_certificate':
        const renewCertificate = await twentyIClient.renewTlsCertificate(
          args.certificate_id as string,
          args.period_months as number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(renewCertificate, null, 2),
            },
          ],
        };

      case 'order_premium_mailbox':
        const premiumMailbox = await twentyIClient.orderPremiumMailbox({
          id: args.mailbox_id,
          local: args.local,
          domain: args.domain,
        }, args.for_user as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(premiumMailbox, null, 2),
            },
          ],
        };

      case 'renew_premium_mailbox':
        const renewedMailbox = await twentyIClient.renewPremiumMailbox(args.id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(renewedMailbox, null, 2),
            },
          ],
        };

      case 'get_email_configuration':
        const emailConfig = await twentyIClient.getEmailConfiguration(args.package_id as string, args.email_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailConfig, null, 2),
            },
          ],
        };

      case 'get_mailbox_configuration':
        const mailboxConfig = await twentyIClient.getMailboxConfiguration(args.package_id as string, args.email_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mailboxConfig, null, 2),
            },
          ],
        };

      case 'get_email_forwarders':
        const emailForwarders = await twentyIClient.getEmailForwarders(args.package_id as string, args.email_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailForwarders, null, 2),
            },
          ],
        };

      case 'get_all_email_forwarders':
        const allForwarders = await twentyIClient.getAllEmailForwarders(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allForwarders, null, 2),
            },
          ],
        };

      case 'generate_webmail_url':
        const webmailUrl = await twentyIClient.generateWebmailUrl(args.package_id as string, args.email_id as string, args.mailbox_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(webmailUrl, null, 2),
            },
          ],
        };

      case 'get_mysql_databases':
        const mysqlDatabases = await twentyIClient.getMysqlDatabases(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mysqlDatabases, null, 2),
            },
          ],
        };

      case 'get_mysql_users':
        const mysqlUsers = await twentyIClient.getMysqlUsers(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mysqlUsers, null, 2),
            },
          ],
        };

      case 'get_mssql_databases':
        const mssqlDatabases = await twentyIClient.getMssqlDatabases(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mssqlDatabases, null, 2),
            },
          ],
        };

      case 'get_ssl_certificates':
        const sslCertificates = await twentyIClient.getSslCertificates(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sslCertificates, null, 2),
            },
          ],
        };

      case 'add_free_ssl':
        const freeSSL = await twentyIClient.addFreeSSL(args.package_id as string, args.domains as string[]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(freeSSL, null, 2),
            },
          ],
        };

      case 'get_force_ssl':
        const forceSSLStatus = await twentyIClient.getForceSSL(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(forceSSLStatus, null, 2),
            },
          ],
        };

      case 'set_force_ssl':
        const forceSSLResult = await twentyIClient.setForceSSL(args.package_id as string, args.enabled as boolean);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(forceSSLResult, null, 2),
            },
          ],
        };

      case 'get_bandwidth_stats':
        const bandwidthStats = await twentyIClient.getBandwidthStats(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bandwidthStats, null, 2),
            },
          ],
        };

      case 'get_disk_usage':
        const diskUsage = await twentyIClient.getDiskUsage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diskUsage, null, 2),
            },
          ],
        };

      case 'get_access_logs':
        const accessLogs = await twentyIClient.getAccessLogs(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(accessLogs, null, 2),
            },
          ],
        };

      case 'list_vps':
        const vpsList = await twentyIClient.listVPS();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsList, null, 2),
            },
          ],
        };

      case 'get_vps_info':
        const vpsInfo = await twentyIClient.getVPSInfo(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsInfo, null, 2),
            },
          ],
        };

      case 'list_managed_vps':
        const managedVpsList = await twentyIClient.listManagedVPS();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(managedVpsList, null, 2),
            },
          ],
        };

      case 'get_managed_vps_info':
        const managedVpsInfo = await twentyIClient.getManagedVPSInfo(args.managed_vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(managedVpsInfo, null, 2),
            },
          ],
        };

      case 'create_subdomain':
        const newSubdomain = await twentyIClient.createSubdomain(args.package_id as string, args.subdomain as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newSubdomain, null, 2),
            },
          ],
        };

      case 'remove_subdomain':
        const removedSubdomain = await twentyIClient.removeSubdomain(args.package_id as string, args.subdomain as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removedSubdomain, null, 2),
            },
          ],
        };

      case 'list_subdomains':
        const subdomains = await twentyIClient.listSubdomains(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(subdomains, null, 2),
            },
          ],
        };

      case 'create_mysql_database':
        const newDatabase = await twentyIClient.createMysqlDatabase(args.package_id as string, args.name as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newDatabase, null, 2),
            },
          ],
        };

      case 'create_mysql_user':
        const newMysqlUser = await twentyIClient.createMysqlUser(
          args.package_id as string,
          args.username as string,
          args.password as string,
          args.database as string | undefined
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newMysqlUser, null, 2),
            },
          ],
        };

      case 'grant_mysql_user_database':
        const grantResult = await twentyIClient.grantMysqlUserDatabase(
          args.package_id as string,
          args.username as string,
          args.database as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(grantResult, null, 2),
            },
          ],
        };

      case 'create_email_account':
        const newEmailAccount = await twentyIClient.createEmailAccount(
          args.package_id as string,
          args.email as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newEmailAccount, null, 2),
            },
          ],
        };

      case 'create_email_forwarder':
        const newEmailForwarder = await twentyIClient.createEmailForwarder(
          args.package_id as string,
          args.source as string,
          args.destinations as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newEmailForwarder, null, 2),
            },
          ],
        };

      case 'get_php_versions':
        const phpVersions = await twentyIClient.getPhpVersions(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(phpVersions, null, 2),
            },
          ],
        };

      case 'set_php_version':
        const setPhpVersionResult = await twentyIClient.setPhpVersion(args.package_id as string, args.version as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setPhpVersionResult, null, 2),
            },
          ],
        };

      case 'list_applications':
        const applications = await twentyIClient.listApplications(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(applications, null, 2),
            },
          ],
        };

      case 'install_application':
        const installedApp = await twentyIClient.installApplication(
          args.package_id as string,
          args.application_id as string,
          args.path as string,
          args.config
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installedApp, null, 2),
            },
          ],
        };

      case 'create_ftp_user':
        const newFtpUser = await twentyIClient.createFtpUser(
          args.package_id as string,
          args.username as string,
          args.password as string,
          args.path as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newFtpUser, null, 2),
            },
          ],
        };

      case 'list_ftp_users':
        const ftpUsers = await twentyIClient.listFtpUsers(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ftpUsers, null, 2),
            },
          ],
        };

      case 'manage_directories':
        const directoryResult = await twentyIClient.manageDirectories(
          args.package_id as string,
          args.action as 'create' | 'delete',
          args.path as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(directoryResult, null, 2),
            },
          ],
        };

      case 'get_file_permission_recommendations':
        const { package_id: permPackageId } = request.params.arguments as any;
        const permissionRecommendations = await twentyIClient.getFilePermissionRecommendations(permPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(permissionRecommendations, null, 2),
            },
          ],
        };

      case 'set_file_permissions':
        const { package_id: setPermPackageId, permission_check_id, files } = request.params.arguments as any;
        const setPermissionsResult = await twentyIClient.setFilePermissions(setPermPackageId, permission_check_id, files);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setPermissionsResult, null, 2),
            },
          ],
        };

      case 'get_directory_indexing_status':
        const { package_id: dirIndexPackageId } = request.params.arguments as any;
        const directoryIndexingStatus = await twentyIClient.getDirectoryIndexingStatus(dirIndexPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(directoryIndexingStatus, null, 2),
            },
          ],
        };

      case 'set_directory_indexing':
        const { package_id: setDirIndexPackageId, enabled } = request.params.arguments as any;
        const setDirectoryIndexingResult = await twentyIClient.setDirectoryIndexing(setDirIndexPackageId, enabled);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setDirectoryIndexingResult, null, 2),
            },
          ],
        };

      case 'set_directory_index':
        const { package_id: setDirIndexFilesPackageId, index_files } = request.params.arguments as any;
        const setDirectoryIndexResult = await twentyIClient.setDirectoryIndex(setDirIndexFilesPackageId, index_files);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setDirectoryIndexResult, null, 2),
            },
          ],
        };

      case 'get_easy_builder_instances':
        const { package_id: easyBuilderPackageId } = request.params.arguments as any;
        const easyBuilderInstances = await twentyIClient.getEasyBuilderInstances(easyBuilderPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(easyBuilderInstances, null, 2),
            },
          ],
        };

      case 'delete_easy_builder_instance':
        const { package_id: deleteEasyBuilderPackageId, instance_id: deleteInstanceId } = request.params.arguments as any;
        const deleteEasyBuilderResult = await twentyIClient.deleteEasyBuilderInstance(deleteEasyBuilderPackageId, deleteInstanceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteEasyBuilderResult, null, 2),
            },
          ],
        };

      case 'install_easy_builder_instance':
        const { package_id: installEasyBuilderPackageId, instance_id: installInstanceId } = request.params.arguments as any;
        const installEasyBuilderResult = await twentyIClient.installEasyBuilderInstance(installEasyBuilderPackageId, installInstanceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installEasyBuilderResult, null, 2),
            },
          ],
        };

      case 'get_easy_builder_sso':
        const { package_id: ssoEasyBuilderPackageId, instance_id: ssoInstanceId } = request.params.arguments as any;
        const easyBuilderSso = await twentyIClient.getEasyBuilderSso(ssoEasyBuilderPackageId, ssoInstanceId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(easyBuilderSso, null, 2),
            },
          ],
        };

      case 'get_easy_builder_themes':
        const { package_id: themesEasyBuilderPackageId } = request.params.arguments as any;
        const easyBuilderThemes = await twentyIClient.getEasyBuilderThemes(themesEasyBuilderPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(easyBuilderThemes, null, 2),
            },
          ],
        };

      case 'set_easy_builder_theme':
        const { package_id: setThemeEasyBuilderPackageId, instance_id: setThemeInstanceId, theme_name } = request.params.arguments as any;
        const setEasyBuilderThemeResult = await twentyIClient.setEasyBuilderTheme(setThemeEasyBuilderPackageId, setThemeInstanceId, theme_name);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setEasyBuilderThemeResult, null, 2),
            },
          ],
        };

      case 'get_website_builder_sso':
        const { package_id: websiteBuilderSsoPackageId } = request.params.arguments as any;
        const websiteBuilderSso = await twentyIClient.getWebsiteBuilderSso(websiteBuilderSsoPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(websiteBuilderSso, null, 2),
            },
          ],
        };

      case 'get_access_and_error_logs':
        const { package_id: logsPackageId } = request.params.arguments as any;
        const accessErrorLogs = await twentyIClient.getAccessAndErrorLogs(logsPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(accessErrorLogs, null, 2),
            },
          ],
        };


      case 'request_disk_usage_report':
        const { package_id: diskRequestPackageId, subdirectory } = request.params.arguments as any;
        const diskUsageRequest = await twentyIClient.requestDiskUsageReport(diskRequestPackageId, subdirectory);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diskUsageRequest, null, 2),
            },
          ],
        };

      case 'get_disk_usage_report':
        const { package_id: diskReportPackageId, report_id } = request.params.arguments as any;
        const diskUsageReport = await twentyIClient.getDiskUsageReport(diskReportPackageId, report_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(diskUsageReport, null, 2),
            },
          ],
        };

      case 'get_email_stats':
        const { package_id: emailStatsPackageId, email_id, mailbox_id } = request.params.arguments as any;
        const emailStats = await twentyIClient.getEmailStats(emailStatsPackageId, email_id, mailbox_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailStats, null, 2),
            },
          ],
        };


      case 'get_malware_scan_objects':
        const { package_id: malwareScanPackageId } = request.params.arguments as any;
        const malwareScanObjects = await twentyIClient.getMalwareScanObjects(malwareScanPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(malwareScanObjects, null, 2),
            },
          ],
        };

      case 'get_installed_applications':
        const { package_id: installedAppsPackageId } = request.params.arguments as any;
        const installedApplications = await twentyIClient.getInstalledApplications(installedAppsPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installedApplications, null, 2),
            },
          ],
        };

      case 'deploy_application':
        const { package_id: deployPackageId, domain, environment, name: appName, path, script, type_code } = request.params.arguments as any;
        const deployResult = await twentyIClient.deployApplication(deployPackageId, {
          domain,
          environment,
          name: appName,
          path,
          script,
          typeCode: type_code
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deployResult, null, 2),
            },
          ],
        };

      case 'update_application_environment':
        const { package_id: updateAppPackageId, application_id, environment: newEnvironment } = request.params.arguments as any;
        const updateResult = await twentyIClient.updateApplicationEnvironment(updateAppPackageId, application_id, newEnvironment);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateResult, null, 2),
            },
          ],
        };

      case 'delete_application':
        const { package_id: deleteAppPackageId, application_id: deleteAppId } = request.params.arguments as any;
        const deleteResult = await twentyIClient.deleteApplication(deleteAppPackageId, deleteAppId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteResult, null, 2),
            },
          ],
        };

      case 'get_installed_software':
        const { package_id: softwarePackageId } = request.params.arguments as any;
        const installedSoftware = await twentyIClient.getInstalledSoftware(softwarePackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installedSoftware, null, 2),
            },
          ],
        };

      case 'transfer_domain':
        const { name: domainName, years, authcode, contact, privacy_service, nameservers } = request.params.arguments as any;
        const transferResult = await twentyIClient.transferDomain({
          name: domainName,
          years,
          authcode,
          contact,
          privacyService: privacy_service,
          nameservers
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(transferResult, null, 2),
            },
          ],
        };

      case 'get_domain_transfer_status':
        const { package_id: transferStatusPackageId, domain_id: transferStatusDomainId } = request.params.arguments as any;
        const transferStatus = await twentyIClient.getDomainTransferStatus(transferStatusPackageId, transferStatusDomainId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(transferStatus, null, 2),
            },
          ],
        };

      case 'get_domain_auth_code':
        const { package_id: authCodePackageId, domain_id: authCodeDomainId } = request.params.arguments as any;
        const authCode = await twentyIClient.getDomainAuthCode(authCodePackageId, authCodeDomainId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(authCode, null, 2),
            },
          ],
        };

      case 'get_domain_whois':
        const { package_id: whoisPackageId, domain_id: whoisDomainId } = request.params.arguments as any;
        const whoisData = await twentyIClient.getDomainWhois(whoisPackageId, whoisDomainId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(whoisData, null, 2),
            },
          ],
        };

      case 'set_domain_transfer_lock':
        const { package_id: lockPackageId, domain_id: lockDomainId, enabled: lockEnabled } = request.params.arguments as any;
        const lockResult = await twentyIClient.setDomainTransferLock(lockPackageId, lockDomainId, lockEnabled);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(lockResult, null, 2),
            },
          ],
        };

      case 'get_email_autoresponder':
        const { package_id: autoresponderPackageId, email_id: autoresponderEmailId } = request.params.arguments as any;
        const autoresponder = await twentyIClient.getEmailAutoresponder(autoresponderPackageId, autoresponderEmailId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(autoresponder, null, 2),
            },
          ],
        };

      case 'get_email_spam_blacklist':
        const { package_id: blacklistPackageId, email_id: blacklistEmailId } = request.params.arguments as any;
        const blacklist = await twentyIClient.getEmailSpamBlacklist(blacklistPackageId, blacklistEmailId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(blacklist, null, 2),
            },
          ],
        };

      case 'get_email_spam_whitelist':
        const { package_id: whitelistPackageId, email_id: whitelistEmailId } = request.params.arguments as any;
        const whitelist = await twentyIClient.getEmailSpamWhitelist(whitelistPackageId, whitelistEmailId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(whitelist, null, 2),
            },
          ],
        };

      case 'update_email_spam_settings':
        const { package_id: spamSettingsPackageId, email_id: spamSettingsEmailId, spam_score, reject_score } = request.params.arguments as any;
        const spamSettings = await twentyIClient.updateEmailSpamSettings(spamSettingsPackageId, spamSettingsEmailId, {
          spamScore: spam_score,
          rejectScore: reject_score
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(spamSettings, null, 2),
            },
          ],
        };

      case 'get_error_logs':
        const { package_id: errorLogsPackageId } = request.params.arguments as any;
        const errorLogs = await twentyIClient.getErrorLogs(errorLogsPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorLogs, null, 2),
            },
          ],
        };

      case 'get_wordpress_staging':
        const { package_id: wpStagingPackageId } = request.params.arguments as any;
        const wpStagingInfo = await twentyIClient.getWordPressStaging(wpStagingPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(wpStagingInfo, null, 2),
            },
          ],
        };

      case 'clone_wordpress_staging':
        const { package_id: clonePackageId, type: cloneType } = request.params.arguments as any;
        const cloneResult = await twentyIClient.cloneWordPressStaging(clonePackageId, cloneType);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(cloneResult, null, 2),
            },
          ],
        };

      case 'get_timeline_backups':
        const { package_id: timelinePackageId } = request.params.arguments as any;
        const timelineBackups = await twentyIClient.getTimelineBackups(timelinePackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(timelineBackups, null, 2),
            },
          ],
        };

      case 'take_web_snapshot':
        const { package_id: snapshotPackageId } = request.params.arguments as any;
        const webSnapshotResult = await twentyIClient.takeWebSnapshot(snapshotPackageId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(webSnapshotResult, null, 2),
            },
          ],
        };

      case 'restore_web_snapshot':
        const { package_id: restorePackageId, snapshot_id } = request.params.arguments as any;
        const webRestoreResult = await twentyIClient.restoreWebSnapshot(restorePackageId, snapshot_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(webRestoreResult, null, 2),
            },
          ],
        };

      // Group A1: VPS Management Tool Handlers (25 endpoints)
      case 'list_vps':
        const allVpsList = await twentyIClient.listVps();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allVpsList, null, 2),
            },
          ],
        };

      case 'get_vps_details':
        const vpsDetails = await twentyIClient.getVpsDetails(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsDetails, null, 2),
            },
          ],
        };

      case 'activate_vps':
        const activateVpsResult = await twentyIClient.activateVps(args.vps_id as string, {
          includeRepeated: args.include_repeated as boolean,
          subservices: args.subservices as Record<string, boolean>
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(activateVpsResult, null, 2),
            },
          ],
        };

      case 'deactivate_vps':
        const deactivateVpsResult = await twentyIClient.deactivateVps(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deactivateVpsResult, null, 2),
            },
          ],
        };

      case 'start_vps':
        const startVpsResult = await twentyIClient.startVps(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(startVpsResult, null, 2),
            },
          ],
        };

      case 'stop_vps':
        const stopVpsResult = await twentyIClient.stopVps(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stopVpsResult, null, 2),
            },
          ],
        };

      case 'reboot_vps':
        const rebootVpsResult = await twentyIClient.rebootVps(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(rebootVpsResult, null, 2),
            },
          ],
        };

      case 'rebuild_vps':
        const rebuildVpsResult = await twentyIClient.rebuildVps(args.vps_id as string, {
          ApplicationId: args.application_id as string,
          cpanel: args.cpanel as boolean,
          cpanelCode: args.cpanel_code as boolean,
          VpsOsId: args.vps_os_id as string
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(rebuildVpsResult, null, 2),
            },
          ],
        };

      case 'get_vps_vnc_info':
        const vpsVncInfo = await twentyIClient.getVpsVncInfo(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsVncInfo, null, 2),
            },
          ],
        };

      case 'lock_vps_vnc':
        const lockVncResult = await twentyIClient.lockVpsVnc(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(lockVncResult, null, 2),
            },
          ],
        };

      case 'unlock_vps_vnc':
        const unlockVncResult = await twentyIClient.unlockVpsVnc(
          args.vps_id as string, 
          args.ip_address as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(unlockVncResult, null, 2),
            },
          ],
        };

      case 'get_vps_disks':
        const vpsDisks = await twentyIClient.getVpsDisks(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsDisks, null, 2),
            },
          ],
        };

      case 'get_vps_limits':
        const vpsLimits = await twentyIClient.getVpsLimits(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsLimits, null, 2),
            },
          ],
        };

      case 'add_vps_ipv6_address':
        const ipv6AddResult = await twentyIClient.addVpsIpv6Address(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ipv6AddResult, null, 2),
            },
          ],
        };

      case 'get_vps_reverse_dns':
        const vpsReverseDns = await twentyIClient.getVpsReverseDns(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsReverseDns, null, 2),
            },
          ],
        };

      case 'update_vps_reverse_dns':
        const updateReverseDnsResult = await twentyIClient.updateVpsReverseDns(
          args.vps_id as string,
          args.reverse_dns_config as Record<string, any>
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateReverseDnsResult, null, 2),
            },
          ],
        };

      case 'get_vps_available_os':
        const vpsAvailableOs = await twentyIClient.getVpsAvailableOs(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsAvailableOs, null, 2),
            },
          ],
        };

      case 'change_vps_root_password':
        const changePasswordResult = await twentyIClient.changeVpsRootPassword(
          args.vps_id as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(changePasswordResult, null, 2),
            },
          ],
        };

      case 'get_vps_name':
        const vpsName = await twentyIClient.getVpsName(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsName, null, 2),
            },
          ],
        };

      case 'set_vps_name':
        const setVpsNameResult = await twentyIClient.setVpsName(
          args.vps_id as string,
          args.name as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setVpsNameResult, null, 2),
            },
          ],
        };

      case 'get_vps_backups':
        const vpsBackupServices = await twentyIClient.getVpsBackups(args.vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(vpsBackupServices, null, 2),
            },
          ],
        };

      case 'update_vps_backups':
        const updateVpsBackupsResult = await twentyIClient.updateVpsBackups(
          args.vps_id as string,
          args.backup_config as Record<string, any>
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateVpsBackupsResult, null, 2),
            },
          ],
        };

      case 'list_managed_vps':
        const allManagedVpsList = await twentyIClient.listManagedVps();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allManagedVpsList, null, 2),
            },
          ],
        };

      case 'get_managed_vps_details':
        const managedVpsDetails = await twentyIClient.getManagedVpsDetails(args.managed_vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(managedVpsDetails, null, 2),
            },
          ],
        };

      case 'set_managed_vps_profile':
        const setManagedVpsProfileResult = await twentyIClient.setManagedVpsProfile(
          args.managed_vps_id as string,
          args.profile_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setManagedVpsProfileResult, null, 2),
            },
          ],
        };

      case 'reset_managed_vps_profile':
        const resetManagedVpsProfileResult = await twentyIClient.resetManagedVpsProfile(args.managed_vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resetManagedVpsProfileResult, null, 2),
            },
          ],
        };

      case 'get_managed_vps_limits':
        const managedVpsLimits = await twentyIClient.getManagedVpsLimits(args.managed_vps_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(managedVpsLimits, null, 2),
            },
          ],
        };

      // Group A2: MSSQL Database Services Tool Handlers (15 endpoints)
      case 'list_mssql_databases':
        const allMssqlDatabases = await twentyIClient.listMssqlDatabases();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allMssqlDatabases, null, 2),
            },
          ],
        };

      case 'get_mssql_database_details':
        const mssqlDatabaseDetails = await twentyIClient.getMssqlDatabaseDetails(args.mssql_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mssqlDatabaseDetails, null, 2),
            },
          ],
        };

      case 'get_package_mssql_databases':
        const packageMssqlDatabases = await twentyIClient.getPackageMssqlDatabases(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageMssqlDatabases, null, 2),
            },
          ],
        };

      case 'create_mssql_database':
        const newMssqlDatabase = await twentyIClient.createMssqlDatabase(
          args.package_id as string,
          args.name as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newMssqlDatabase, null, 2),
            },
          ],
        };

      case 'delete_mssql_database':
        const deleteMssqlResult = await twentyIClient.deleteMssqlDatabase(
          args.package_id as string,
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deleteMssqlResult, null, 2),
            },
          ],
        };

      case 'order_mssql_database':
        const orderMssqlResult = await twentyIClient.orderMssqlDatabase();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(orderMssqlResult, null, 2),
            },
          ],
        };

      case 'renew_mssql_database':
        const renewMssqlResult = await twentyIClient.renewMssqlDatabase(args.database_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(renewMssqlResult, null, 2),
            },
          ],
        };

      case 'assign_mssql_to_package':
        const assignMssqlResult = await twentyIClient.assignMssqlToPackage(
          args.mssql_id as string,
          args.package_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(assignMssqlResult, null, 2),
            },
          ],
        };

      case 'add_mssql_user':
        const addMssqlUserResult = await twentyIClient.addMssqlUser(
          args.package_id as string,
          args.database_id as string,
          args.username as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addMssqlUserResult, null, 2),
            },
          ],
        };

      case 'remove_mssql_user':
        const removeMssqlUserResult = await twentyIClient.removeMssqlUser(
          args.package_id as string,
          args.database_id as string,
          args.user_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removeMssqlUserResult, null, 2),
            },
          ],
        };

      case 'update_mssql_user_password':
        const updateMssqlPasswordResult = await twentyIClient.updateMssqlUserPassword(
          args.package_id as string,
          args.database_id as string,
          args.user_id as string,
          args.password as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateMssqlPasswordResult, null, 2),
            },
          ],
        };

      case 'take_mssql_snapshot':
        const mssqlSnapshotResult = await twentyIClient.takeMssqlSnapshot(
          args.package_id as string,
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mssqlSnapshotResult, null, 2),
            },
          ],
        };

      case 'get_mssql_backup_info':
        const mssqlBackupInfo = await twentyIClient.getMssqlBackupInfo(
          args.package_id as string,
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mssqlBackupInfo, null, 2),
            },
          ],
        };

      case 'restore_mssql_snapshot':
        const restoreMssqlResult = await twentyIClient.restoreMssqlSnapshot(
          args.package_id as string,
          args.database_id as string,
          {
            action: args.action as string,
            RestoreAsOf: args.restore_as_of as number,
            RestorePath: args.restore_path as string,
            target: args.target as string
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(restoreMssqlResult, null, 2),
            },
          ],
        };

      case 'get_mssql_snapshot_jobs':
        const mssqlSnapshotJobs = await twentyIClient.getMssqlSnapshotJobs(
          args.package_id as string,
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mssqlSnapshotJobs, null, 2),
            },
          ],
        };

      // Group A3: SSL Certificate Management Tool Handlers
      case 'list_ssl_certificates':
        const packageSslCertificates = await twentyIClient.listSslCertificates(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(packageSslCertificates, null, 2),
            },
          ],
        };

      case 'order_ssl_certificate':
        const orderSslResult = await twentyIClient.orderSslCertificate(
          args.name as string,
          args.period_months as number,
          args.configuration
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(orderSslResult, null, 2),
            },
          ],
        };

      case 'renew_ssl_certificate':
        const renewSslResult = await twentyIClient.renewSslCertificate(
          args.certificate_id as string,
          args.period_months as number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(renewSslResult, null, 2),
            },
          ],
        };

      case 'precheck_ssl_renewal':
        const precheckSslResult = await twentyIClient.preCheckSslRenewal(
          args.certificate_id as string,
          args.period_months as number
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(precheckSslResult, null, 2),
            },
          ],
        };

      case 'install_external_ssl_certificate':
        const installExternalSslResult = await twentyIClient.installExternalSslCertificate(
          args.package_id as string,
          {
            name: args.name as string,
            certificate: args.certificate as string,
            key: args.key as string,
            ca: args.ca as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(installExternalSslResult, null, 2),
            },
          ],
        };

      case 'remove_ssl_certificates':
        const removeSslResult = await twentyIClient.removeSslCertificates(
          args.package_id as string,
          args.certificate_ids as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(removeSslResult, null, 2),
            },
          ],
        };

      case 'toggle_free_ssl':
        const toggleFreeSslResult = await twentyIClient.toggleFreeSsl(
          args.package_id as string,
          args.domain_name as string,
          args.enabled as boolean
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(toggleFreeSslResult, null, 2),
            },
          ],
        };

      case 'resend_ssl_approval_email':
        const resendSslApprovalResult = await twentyIClient.resendSslApprovalEmail(
          args.certificate_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resendSslApprovalResult, null, 2),
            },
          ],
        };

      case 'get_force_ssl_status':
        const forceSslStatus = await twentyIClient.getForceSslStatus(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(forceSslStatus, null, 2),
            },
          ],
        };

      case 'set_force_ssl':
        const setForceSslResult = await twentyIClient.setForceSsl(
          args.package_id as string,
          args.enabled as boolean
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setForceSslResult, null, 2),
            },
          ],
        };

      case 'get_ssl_certificate_status':
        const sslCertificateStatus = await twentyIClient.getSslCertificateStatus(
          args.package_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sslCertificateStatus, null, 2),
            },
          ],
        };

      // Group A4: Package Administration Tool Handlers
      case 'activate_package':
        const activatePackageResult = await twentyIClient.activatePackage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(activatePackageResult, null, 2),
            },
          ],
        };

      case 'deactivate_package':
        const deactivatePackageResult = await twentyIClient.deactivatePackage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deactivatePackageResult, null, 2),
            },
          ],
        };

      case 'update_package_allowance':
        const updateAllowanceResult = await twentyIClient.updatePackageAllowance(
          args.package_id as string,
          {
            diskSpace: args.disk_space as number,
            bandwidth: args.bandwidth as number,
            databases: args.databases as number,
            emailAccounts: args.email_accounts as number,
            subdomains: args.subdomains as number,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateAllowanceResult, null, 2),
            },
          ],
        };

      case 'delete_package':
        const deletePackageResult = await twentyIClient.deletePackage(
          args.package_id as string,
          args.delete_files as boolean || false
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deletePackageResult, null, 2),
            },
          ],
        };

      case 'split_package':
        const splitPackageResult = await twentyIClient.splitPackage(
          args.package_id as string,
          {
            newPackageName: args.new_package_name as string,
            domainsToMove: args.domains_to_move as string[],
            newPackageType: args.new_package_type as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(splitPackageResult, null, 2),
            },
          ],
        };

      case 'add_stack_user_package_allowance':
        const addAllowanceResult = await twentyIClient.addStackUserPackageAllowance(
          args.stack_user_id as string,
          {
            packageType: args.package_type as string,
            quantity: args.quantity as number,
            period: args.period as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(addAllowanceResult, null, 2),
            },
          ],
        };

      case 'update_stack_user_package_allowance':
        const updateStackAllowanceResult = await twentyIClient.updateStackUserPackageAllowance(
          args.allowance_id as string,
          {
            quantity: args.quantity as number,
            period: args.period as string,
            status: args.status as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateStackAllowanceResult, null, 2),
            },
          ],
        };

      case 'get_stack_user_package_allowance':
        const getAllowanceResult = await twentyIClient.getStackUserPackageAllowance(
          args.allowance_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(getAllowanceResult, null, 2),
            },
          ],
        };

      case 'clone_package_from_allowance':
        const clonePackageResult = await twentyIClient.clonePackageFromAllowance(
          args.allowance_id as string,
          {
            domainName: args.domain_name as string,
            username: args.username as string,
            password: args.password as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(clonePackageResult, null, 2),
            },
          ],
        };

      // Group B1: Advanced Email Management Tool Handlers
      case 'get_email_domain_configuration':
        const emailDomainConfig = await twentyIClient.getEmailDomainConfiguration(
          args.package_id as string,
          args.email_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailDomainConfig, null, 2),
            },
          ],
        };

      case 'set_email_domain_alias':
        const setDomainAliasResult = await twentyIClient.setEmailDomainAlias(
          args.package_id as string,
          args.email_id as string,
          {
            domain: args.domain as string,
            enabled: args.enabled as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(setDomainAliasResult, null, 2),
            },
          ],
        };

      case 'get_email_statistics':
        const advancedEmailStats = await twentyIClient.getEmailStatistics(
          args.package_id as string,
          args.email_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(advancedEmailStats, null, 2),
            },
          ],
        };

      case 'configure_premium_mailbox':
        const configurePremiumResult = await twentyIClient.configurePremiumMailbox(
          args.package_id as string,
          {
            emailAddress: args.email_address as string,
            storage: args.storage as number,
            features: args.features as string[],
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configurePremiumResult, null, 2),
            },
          ],
        };

      case 'get_email_performance_metrics':
        const emailPerformance = await twentyIClient.getEmailPerformanceMetrics(
          args.package_id as string,
          args.time_range as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailPerformance, null, 2),
            },
          ],
        };

      case 'configure_email_routing':
        const configureRoutingResult = await twentyIClient.configureEmailRouting(
          args.package_id as string,
          args.email_id as string,
          {
            priority: args.priority as number,
            destination: args.destination as string,
            conditions: args.conditions,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configureRoutingResult, null, 2),
            },
          ],
        };

      case 'get_email_quota_usage':
        const emailQuotaUsage = await twentyIClient.getEmailQuotaUsage(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailQuotaUsage, null, 2),
            },
          ],
        };

      case 'configure_email_archiving':
        const configureArchivingResult = await twentyIClient.configureEmailArchiving(
          args.package_id as string,
          {
            enabled: args.enabled as boolean,
            retentionDays: args.retention_days as number,
            compressionEnabled: args.compression_enabled as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configureArchivingResult, null, 2),
            },
          ],
        };

      case 'get_email_backup_status':
        const emailBackupStatus = await twentyIClient.getEmailBackupStatus(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailBackupStatus, null, 2),
            },
          ],
        };

      case 'configure_advanced_spam_filtering':
        const configureSpamResult = await twentyIClient.configureAdvancedSpamFiltering(
          args.package_id as string,
          args.email_id as string,
          {
            sensitivity: args.sensitivity as 'low' | 'medium' | 'high' | 'custom',
            customRules: args.custom_rules as any[],
            quarantineEnabled: args.quarantine_enabled as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configureSpamResult, null, 2),
            },
          ],
        };

      case 'get_email_reputation_score':
        const emailReputationScore = await twentyIClient.getEmailReputationScore(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailReputationScore, null, 2),
            },
          ],
        };

      case 'configure_email_security_policies':
        const configureSecurityResult = await twentyIClient.configureEmailSecurityPolicies(
          args.package_id as string,
          {
            enforceEncryption: args.enforce_encryption as boolean,
            requireSecurePassword: args.require_secure_password as boolean,
            enableTwoFactor: args.enable_two_factor as boolean,
            ipWhitelist: args.ip_whitelist as string[],
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configureSecurityResult, null, 2),
            },
          ],
        };

      case 'get_email_delivery_analytics':
        const emailDeliveryAnalytics = await twentyIClient.getEmailDeliveryAnalytics(
          args.package_id as string,
          {
            startDate: args.start_date as string,
            endDate: args.end_date as string,
            groupBy: args.group_by as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailDeliveryAnalytics, null, 2),
            },
          ],
        };

      case 'get_email_usage_reports':
        const emailUsageReports = await twentyIClient.getEmailUsageReports(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emailUsageReports, null, 2),
            },
          ],
        };

      case 'configure_email_compliance_settings':
        const configureComplianceResult = await twentyIClient.configureEmailComplianceSettings(
          args.package_id as string,
          {
            dataRetention: args.data_retention as number,
            gdprCompliant: args.gdpr_compliant as boolean,
            auditLogging: args.audit_logging as boolean,
            encryptionRequired: args.encryption_required as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(configureComplianceResult, null, 2),
            },
          ],
        };

      // Group B2: Security & Monitoring Tool Handlers
      case 'run_malware_scan_advanced':
        const malwareScanResult = await twentyIClient.runMalwareScanAdvanced(
          args.package_id as string,
          {
            deepScan: args.deep_scan as boolean,
            quarantineEnabled: args.quarantine_enabled as boolean,
            emailNotification: args.email_notification as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(malwareScanResult, null, 2),
            },
          ],
        };

      case 'get_security_policy_status':
        const securityPolicyStatus = await twentyIClient.getSecurityPolicyStatus(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(securityPolicyStatus, null, 2),
            },
          ],
        };

      case 'configure_password_policies':
        const passwordPolicyResult = await twentyIClient.configurePasswordPolicies(
          args.package_id as string,
          {
            minLength: args.min_length as number,
            requireUppercase: args.require_uppercase as boolean,
            requireNumbers: args.require_numbers as boolean,
            requireSpecialChars: args.require_special_chars as boolean,
            expirationDays: args.expiration_days as number,
            preventReuse: args.prevent_reuse as number,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(passwordPolicyResult, null, 2),
            },
          ],
        };

      case 'manage_ssh_key_rotation':
        const sshKeyRotationResult = await twentyIClient.manageSshKeyRotation(
          args.package_id as string,
          {
            enabled: args.enabled as boolean,
            rotationPeriodDays: args.rotation_period_days as number,
            notifyBeforeExpiry: args.notify_before_expiry as number,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sshKeyRotationResult, null, 2),
            },
          ],
        };

      case 'get_performance_monitoring':
        const performanceMetrics = await twentyIClient.getPerformanceMonitoring(
          args.package_id as string,
          {
            timeRange: args.time_range as string,
            granularity: args.granularity as string,
            includeAlerts: args.include_alerts as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(performanceMetrics, null, 2),
            },
          ],
        };

      case 'get_resource_usage_analytics':
        const resourceAnalytics = await twentyIClient.getResourceUsageAnalytics(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resourceAnalytics, null, 2),
            },
          ],
        };

      case 'get_security_event_logs':
        const securityEventLogs = await twentyIClient.getSecurityEventLogs(
          args.package_id as string,
          {
            startDate: args.start_date as string,
            endDate: args.end_date as string,
            eventType: args.event_type as string,
            severity: args.severity as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(securityEventLogs, null, 2),
            },
          ],
        };

      case 'configure_alert_system':
        const alertSystemResult = await twentyIClient.configureAlertSystem(
          args.package_id as string,
          {
            emailNotifications: args.email_notifications as boolean,
            smsNotifications: args.sms_notifications as boolean,
            webhookUrl: args.webhook_url as string,
            alertThresholds: {
              cpuUsage: args.cpu_usage_threshold as number,
              memoryUsage: args.memory_usage_threshold as number,
              diskUsage: args.disk_usage_threshold as number,
              bandwidthUsage: args.bandwidth_usage_threshold as number,
            },
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(alertSystemResult, null, 2),
            },
          ],
        };

      case 'get_audit_trail_report':
        const auditTrailReport = await twentyIClient.getAuditTrailReport(
          args.package_id as string,
          {
            startDate: args.start_date as string,
            endDate: args.end_date as string,
            userFilter: args.user_filter as string,
            actionFilter: args.action_filter as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(auditTrailReport, null, 2),
            },
          ],
        };

      case 'enforce_security_compliance':
        const complianceResult = await twentyIClient.enforceSecurityCompliance(
          args.package_id as string,
          {
            standard: args.standard as 'PCI-DSS' | 'ISO-27001' | 'SOC-2' | 'CUSTOM',
            strictMode: args.strict_mode as boolean,
            autoRemediation: args.auto_remediation as boolean,
            customRules: args.custom_rules as any[],
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(complianceResult, null, 2),
            },
          ],
        };

      // Group C1: DNS & Domain Advanced Tool Handlers
      case 'manage_dnssec':
        const dnssecResult = await twentyIClient.configureDnssec(
          args.package_id as string,
          args.domain_id as string,
          {
            enabled: args.enabled as boolean,
            algorithm: args.algorithm as string,
            keySize: args.key_tag as number,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnssecResult, null, 2),
            },
          ],
        };

      case 'configure_virtual_nameservers':
        const virtualNameserversResult = await twentyIClient.manageVirtualNameservers(
          {
            action: args.action as 'create' | 'update' | 'delete',
            hostname: args.hostname as string,
            ipAddresses: args.ip_addresses as string[],
            glueRecords: args.glue_records as any[],
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(virtualNameserversResult, null, 2),
            },
          ],
        };

      case 'bulk_dns_operations':
        const bulkDnsResult = await twentyIClient.configureAdvancedDnsRecords(
          args.package_id as string,
          args.domain_id as string,
          {
            recordType: args.record_type as string,
            name: args.name as string,
            value: args.value as string,
            ttl: args.ttl as number,
            priority: args.priority as number,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bulkDnsResult, null, 2),
            },
          ],
        };

      case 'get_dns_analytics':
        const dnsAnalytics = await twentyIClient.getDnsAnalytics(
          args.package_id as string,
          args.domain_id as string,
          {
            timeRange: args.time_range as string,
            queryTypes: args.query_types as string[],
            includeGeolocation: args.include_geolocation as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsAnalytics, null, 2),
            },
          ],
        };

      case 'monitor_dns_security':
        const dnsSecurityMonitor = await twentyIClient.configureDnsSecurityMonitoring(
          args.package_id as string,
          args.domain_id as string,
          {
            enabled: args.alerts_enabled as boolean,
            alertThresholds: {
              suspiciousQueries: args.suspicious_queries_threshold as number,
              anomalousTraffic: args.anomalous_traffic_threshold as number,
            },
            notificationSettings: {
              email: Boolean(args.notification_email),
              webhook: args.webhook_url as string,
            },
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsSecurityMonitor, null, 2),
            },
          ],
        };

      case 'optimize_dns_performance':
        const dnsOptimization = await twentyIClient.optimizeDnsPerformance(
          args.package_id as string,
          args.domain_id as string,
          {
            enableCaching: args.enable_caching as boolean,
            cacheTtl: args.cache_ttl as number,
            enableGeoDns: args.enable_geo_dns as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsOptimization, null, 2),
            },
          ],
        };

      case 'integrate_third_party_dns':
        const thirdPartyIntegration = await twentyIClient.setupThirdPartyDnsIntegration(
          args.package_id as string,
          args.domain_id as string,
          {
            provider: args.provider as 'google-apps' | 'office365' | 'custom',
            configuration: args.configuration,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(thirdPartyIntegration, null, 2),
            },
          ],
        };

      case 'backup_restore_dns':
        const dnsBackupRestore = await twentyIClient.manageDnsBackupRestore(
          args.package_id as string,
          args.domain_id as string,
          {
            action: args.operation as 'backup' | 'restore' | 'list',
            backupName: args.backup_id as string,
            restorePoint: (args.include_history as boolean) ? 'latest' : undefined,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsBackupRestore, null, 2),
            },
          ],
        };

      case 'manage_dns_templates':
        const dnsTemplatesResult = await twentyIClient.configureDnsTemplates(
          args.package_id as string,
          {
            action: args.operation as 'create' | 'apply' | 'delete',
            templateName: args.template_name as string,
            recordSet: args.records as any[],
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsTemplatesResult, null, 2),
            },
          ],
        };

      case 'troubleshoot_dns':
        const dnsTroubleshoot = await twentyIClient.getDnsTroubleshootingTools(
          args.package_id as string,
          args.domain_id as string,
          {
            tool: args.test_type as 'propagation' | 'validation' | 'trace' | 'health-check',
            parameters: { verbose: args.verbose as boolean },
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsTroubleshoot, null, 2),
            },
          ],
        };

      case 'manage_dns_api':
        const dnsApiResult = await twentyIClient.manageDnsApiAccess(
          args.package_id as string,
          {
            enabled: args.operation !== 'delete',
            permissions: args.permissions as string[],
            rateLimits: args.restrictions,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dnsApiResult, null, 2),
            },
          ],
        };

      case 'transfer_domain_management':
        const domainTransferResult = await twentyIClient.manageDomainTransferOperations(
          args.package_id as string,
          args.domain_id as string,
          {
            action: args.operation as 'initiate' | 'approve' | 'cancel' | 'status',
            authCode: args.auth_code as string,
            targetRegistrar: args.target_registrar as string,
            transferData: { autoRenew: args.auto_renew as boolean },
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(transferResult, null, 2),
            },
          ],
        };

      case 'manage_epp_codes':
        const eppCodeResult = await twentyIClient.getEppCodeManagement(
          args.package_id as string,
          args.domain_id as string,
          args.operation as 'get' | 'regenerate'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(eppCodeResult, null, 2),
            },
          ],
        };

      case 'configure_whois_management':
        const whoisResult = await twentyIClient.getAdvancedWhoisManagement(
          args.package_id as string,
          args.domain_id as string,
          {
            includeHistory: args.privacy_enabled as boolean,
            privacyMask: args.auto_update as boolean,
            contactOverrides: args.contacts,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(whoisResult, null, 2),
            },
          ],
        };

      case 'control_domain_privacy':
        const privacyResult = await twentyIClient.manageDomainPrivacyControl(
          args.package_id as string,
          args.domain_id as string,
          {
            enabled: args.enabled as boolean,
            privacyLevel: args.level as 'basic' | 'enhanced',
            customSettings: args.custom_settings,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(privacyResult, null, 2),
            },
          ],
        };

      case 'advanced_domain_verification':
        const verificationResult = await twentyIClient.manageDomainVerificationSystems(
          args.package_id as string,
          args.domain_id as string,
          {
            method: args.method as 'email' | 'dns' | 'file' | 'meta',
            purpose: 'ownership' as const,
            configuration: { 
              challenges: args.challenges as string[],
              autoVerify: args.auto_verify as boolean,
            },
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(verificationResult, null, 2),
            },
          ],
        };

      case 'get_domain_analytics':
        const domainAnalytics = await twentyIClient.getDomainAnalytics(
          args.package_id as string,
          args.domain_id as string,
          {
            timeRange: args.time_range as string,
            metrics: args.metrics as string[],
            includeSubdomains: args.include_subdomains as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(domainAnalytics, null, 2),
            },
          ],
        };

      case 'bulk_domain_operations':
        const bulkDomainResult = await twentyIClient.manageDomainBulkOperations(
          {
            operation: args.operation as 'transfer' | 'renew' | 'update',
            domains: args.domain_ids as string[],
            configuration: args.parameters,
            validationMode: args.validate_only as boolean,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(bulkDomainResult, null, 2),
            },
          ],
        };

      case 'manage_domain_portfolio':
        const portfolioResult = await twentyIClient.getDomainPortfolioManagement(
          {
            groupBy: args.grouping as string,
            filters: args.filters,
            sortBy: args.operation as string,
            includeAnalytics: true,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(portfolioResult, null, 2),
            },
          ],
        };

      case 'configure_google_apps_dns':
        const googleAppsResult = await twentyIClient.setupThirdPartyDnsIntegration(
          args.package_id as string,
          args.domain_id as string,
          {
            provider: 'google-apps' as const,
            configuration: {},
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(googleAppsResult, null, 2),
            },
          ],
        };

      // Group C2: Platform Tools Handlers
      case 'recycle_application_pool':
        const recycleResult = await twentyIClient.recycleApplicationPool(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(recycleResult, null, 2),
            },
          ],
        };

      case 'get_windows_configuration':
        const windowsConfig = await twentyIClient.getWindowsConfiguration(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(windowsConfig, null, 2),
            },
          ],
        };

      case 'update_windows_configuration':
        const updateConfigResult = await twentyIClient.updateWindowsConfiguration(
          args.package_id as string,
          {
            ApplicationPoolPipelineMode: args.pipeline_mode as string,
            ApplicationPoolRuntimeVersion: args.runtime_version as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updateConfigResult, null, 2),
            },
          ],
        };

      case 'get_oneclick_applications':
        const oneClickApps = await twentyIClient.getOneClickApplications(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(oneClickApps, null, 2),
            },
          ],
        };

      case 'reinstall_software':
        const reinstallResult = await twentyIClient.reinstallSoftware(
          args.package_id as string,
          {
            software: args.software as string,
            version: args.version as string,
            domain: args.domain as string,
            path: args.path as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(reinstallResult, null, 2),
            },
          ],
        };

      // Group D1: Backup & Recovery Handlers
      case 'take_database_snapshot':
        const dbSnapshotResult = await twentyIClient.takeDatabaseSnapshot(
          args.package_id as string,
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dbSnapshotResult, null, 2),
            },
          ],
        };

      case 'take_mailbox_snapshot':
        const mailboxSnapshotResult = await twentyIClient.takeMailboxSnapshot(
          args.package_id as string,
          args.mailbox_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mailboxSnapshotResult, null, 2),
            },
          ],
        };

      case 'take_web_snapshot':
        const newWebSnapshotResult = await twentyIClient.takeWebSnapshot(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newWebSnapshotResult, null, 2),
            },
          ],
        };

      case 'restore_database_snapshot':
        const dbRestoreResult = await twentyIClient.restoreDatabaseSnapshot(
          args.package_id as string,
          args.database_id as string,
          {
            snapshotId: args.snapshot_id as string,
            restorePoint: args.restore_point as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(dbRestoreResult, null, 2),
            },
          ],
        };

      case 'restore_mailbox_snapshot':
        const mailboxRestoreResult = await twentyIClient.restoreMailboxSnapshot(
          args.package_id as string,
          args.mailbox_id as string,
          {
            snapshotId: args.snapshot_id as string,
            restorePoint: args.restore_point as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mailboxRestoreResult, null, 2),
            },
          ],
        };

      case 'restore_web_snapshot':
        const newWebRestoreResult = await twentyIClient.restoreWebSnapshot(
          args.package_id as string,
          args.snapshot_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newWebRestoreResult, null, 2),
            },
          ],
        };

      case 'get_database_backups':
        const databaseBackups = await twentyIClient.getDatabaseBackups(
          args.package_id as string,
          args.database_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(databaseBackups, null, 2),
            },
          ],
        };

      case 'get_mailbox_backups':
        const mailboxBackups = await twentyIClient.getMailboxBackups(
          args.package_id as string,
          args.mailbox_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mailboxBackups, null, 2),
            },
          ],
        };

      case 'get_web_backups':
        const webBackups = await twentyIClient.getWebBackups(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(webBackups, null, 2),
            },
          ],
        };

      case 'get_timeline_backup_overview':
        const backupOverview = await twentyIClient.getTimelineBackupOverview(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(backupOverview, null, 2),
            },
          ],
        };

      // Group D2: Automation & Branding Handlers
      case 'get_scheduled_tasks':
        const scheduledTasks = await twentyIClient.getScheduledTasks(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(scheduledTasks, null, 2),
            },
          ],
        };

      case 'create_scheduled_task':
        const newTaskResult = await twentyIClient.createScheduledTask(
          args.package_id as string,
          {
            command: args.command as string,
            schedule: args.schedule as string,
            enabled: args.enabled as boolean,
            description: args.description as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newTaskResult, null, 2),
            },
          ],
        };

      case 'test_scheduled_task':
        const taskTestResult = await twentyIClient.testScheduledTask(
          args.package_id as string,
          args.task_id as string
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(taskTestResult, null, 2),
            },
          ],
        };

      case 'generate_sitemap':
        const sitemapResult = await twentyIClient.generateSitemap(
          args.package_id as string,
          {
            domain: args.domain as string,
            includeImages: args.include_images as boolean,
            priority: args.priority as number,
            changeFreq: args.change_freq as string,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(sitemapResult, null, 2),
            },
          ],
        };

      case 'get_stackcache_status':
        const stackCacheStatus = await twentyIClient.getStackCacheStatus(args.package_id as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stackCacheStatus, null, 2),
            },
          ],
        };

      case 'configure_package_branding':
        const brandingResult = await twentyIClient.configurePackageBranding({
          packageType: args.package_type as string,
          brandName: args.brand_name as string,
          logoUrl: args.logo_url as string,
          colorScheme: args.color_scheme as string,
          customization: args.customization,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(brandingResult, null, 2),
            },
          ],
        };

      case 'configure_nominet_branding':
        const nominetResult = await twentyIClient.configureNominetBranding({
          enabled: args.enabled as boolean,
          brandName: args.brand_name as string,
          contactInfo: args.contact_info,
          customization: args.customization,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(nominetResult, null, 2),
            },
          ],
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});