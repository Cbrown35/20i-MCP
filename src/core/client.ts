import axios, { AxiosInstance } from 'axios';
import { ApiCredentials } from './types.js';
import { handleApiError, validateApiResponse } from './errors.js';

/**
 * 20i API Client with comprehensive error handling and response validation
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
 */
export class TwentyIClient {
  public readonly apiClient: AxiosInstance;
  private readonly credentials: ApiCredentials;

  constructor() {
    this.credentials = this.loadCredentials();
    
    const authHeader = `Bearer ${Buffer.from(this.credentials.apiKey).toString('base64')}`;
    
    this.apiClient = axios.create({
      baseURL: 'https://api.20i.com',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 second timeout
      responseType: 'json',
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
        const contentType = response.headers['content-type'];
        
        // If we got a string response that looks like JavaScript object literal, try to convert it
        if (typeof response.data === 'string' && response.data.trim()) {
          const trimmedData = response.data.trim();
          
          // Check if it looks like a JavaScript object literal (starts with 'Loaded' or contains ':' without quotes)
          if (trimmedData.includes(':') && !trimmedData.startsWith('{') && !trimmedData.startsWith('[')) {
            throw new Error(`API returned invalid format (JavaScript object literal instead of JSON). This suggests the API endpoint or authentication may be incorrect.`);
          }
          
          // Try to parse as JSON if it's a string
          try {
            response.data = JSON.parse(trimmedData);
          } catch (parseError) {
            if (contentType && contentType.includes('text/html')) {
              throw new Error(`API returned HTML instead of JSON. Status: ${response.status}. This usually indicates an authentication error or invalid endpoint.`);
            } else {
              throw new Error(`API returned unparseable response: ${trimmedData.substring(0, 100)}...`);
            }
          }
        }
        
        if (response.data === null || response.data === undefined) {
          response.data = {};
        }
        
        return response;
      },
      (error) => {
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

  /**
   * Get reseller information
   * Handles various response formats from the API
   */
  async getResellerInfo() {
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
      handleApiError(error, 'getResellerInfo');
    }
  }

  /**
   * Get account balance information
   * Handles zero-balance accounts gracefully
   */
  async getAccountBalance() {
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
      handleApiError(error, 'getAccountBalance');
    }
  }

  /**
   * Generic GET request with error handling
   */
  async get(endpoint: string, config?: any) {
    try {
      const response = await this.apiClient.get(endpoint, config);
      validateApiResponse(response.data, `GET ${endpoint}`);
      return response.data;
    } catch (error) {
      handleApiError(error, `GET ${endpoint}`);
    }
  }

  /**
   * Generic POST request with error handling
   */
  async post(endpoint: string, data?: any, config?: any) {
    try {
      const response = await this.apiClient.post(endpoint, data, config);
      validateApiResponse(response.data, `POST ${endpoint}`);
      return response.data;
    } catch (error) {
      handleApiError(error, `POST ${endpoint}`);
    }
  }

  /**
   * Generic PUT request with error handling
   */
  async put(endpoint: string, data?: any, config?: any) {
    try {
      const response = await this.apiClient.put(endpoint, data, config);
      validateApiResponse(response.data, `PUT ${endpoint}`);
      return response.data;
    } catch (error) {
      handleApiError(error, `PUT ${endpoint}`);
    }
  }

  /**
   * Generic DELETE request with error handling
   */
  async delete(endpoint: string, config?: any) {
    try {
      const response = await this.apiClient.delete(endpoint, config);
      validateApiResponse(response.data, `DELETE ${endpoint}`);
      return response.data;
    } catch (error) {
      handleApiError(error, `DELETE ${endpoint}`);
    }
  }

  /**
   * Generic PATCH request with error handling
   */
  async patch(endpoint: string, data?: any, config?: any) {
    try {
      const response = await this.apiClient.patch(endpoint, data, config);
      validateApiResponse(response.data, `PATCH ${endpoint}`);
      return response.data;
    } catch (error) {
      handleApiError(error, `PATCH ${endpoint}`);
    }
  }
}