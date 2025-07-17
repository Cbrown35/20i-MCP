// Domain management module for 20i MCP Server
import { TwentyIClient, Tool, ToolHandler, ModuleDefinition } from '../core/index.js';
import { 
  validateString, 
  validateDomain, 
  validateEmail, 
  validatePositiveNumber, 
  validateBoolean, 
  validateOptional, 
  validateStringArray,
  validateEnum 
} from '../core/validation.js';

export class DomainsModule {
  constructor(private client: TwentyIClient) {}

  /**
   * Domain-related helper methods (extracted from original TwentyIClient)
   */
  async listDomains() {
    return await this.client.get('/domain');
  }

  async getDomainInfo(domainId: string) {
    const resellerInfo = await this.client.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    return await this.client.get(`/reseller/${resellerId}/domain/${domainId}`);
  }

  async getDnsRecords(domainId: string) {
    const resellerInfo = await this.client.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    return await this.client.get(`/reseller/${resellerId}/domain/${domainId}/dns`);
  }

  async updateDnsRecord(domainId: string, recordData: any) {
    const resellerInfo = await this.client.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    return await this.client.post(`/reseller/${resellerId}/domain/${domainId}/dns`, recordData);
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
    const resellerInfo = await this.client.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    return await this.client.post(`/reseller/${resellerId}/addDomain`, domainData);
  }

  async searchDomains(searchTerm: string, options?: {
    suggestions?: boolean;
    tlds?: string[];
  }) {
    const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
    
    const queryParams = new URLSearchParams();
    if (options?.suggestions !== undefined) {
      queryParams.set('suggestions', options.suggestions.toString());
    }
    if (options?.tlds && options.tlds.length > 0) {
      queryParams.set('tlds', options.tlds.join(','));
    }
    
    const queryString = queryParams.toString();
    const url = `/domain-search/${encodedSearchTerm}${queryString ? `?${queryString}` : ''}`;
    
    try {
      return await this.client.get(url);
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Domain search rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }

  async getDomainVerificationStatus() {
    try {
      return await this.client.get('/domainVerification');
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  async resendDomainVerificationEmail(packageId: string, domainId: string) {
    try {
      return await this.client.post(`/package/${packageId}/domain/${domainId}/resendVerificationEmail`, {});
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or verification email not applicable for this domain');
      }
      throw error;
    }
  }

  async transferDomain(packageId: string, domainId: string, transferData: any) {
    try {
      return await this.client.post(`/package/${packageId}/domain/${domainId}/transfer`, transferData);
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw new Error('Invalid domain transfer configuration. Check domain name, contact details, and auth code.');
      }
      throw error;
    }
  }

  async getDomainTransferStatus(packageId: string, domainId: string) {
    try {
      return await this.client.get(`/package/${packageId}/domain/${domainId}/pendingTransferStatus`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain or transfer status not found');
      }
      throw error;
    }
  }

  async getDomainAuthCode(packageId: string, domainId: string) {
    try {
      return await this.client.get(`/package/${packageId}/domain/${domainId}/authCode`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or auth code not available');
      }
      throw error;
    }
  }

  async getDomainWhois(packageId: string, domainId: string) {
    try {
      return await this.client.get(`/package/${packageId}/domain/${domainId}/whois`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or WHOIS data not available');
      }
      throw error;
    }
  }

  async setDomainTransferLock(packageId: string, domainId: string, enabled: boolean) {
    try {
      return await this.client.post(`/package/${packageId}/domain/${domainId}/canTransfer`, {
        enable: enabled
      });
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Domain not found or transfer lock not available');
      }
      throw error;
    }
  }

  async getDomainPeriods() {
    return await this.client.get('/domain-period');
  }

  async getDomainPremiumTypes() {
    return await this.client.get('/domainPremiumType');
  }

  /**
   * Tool handlers
   */
  getHandlers(): Record<string, ToolHandler> {
    return {
      list_domains: async () => {
        const domains = await this.listDomains();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(domains, null, 2),
          }],
        };
      },

      get_domain_info: async (args) => {
        const domainId = validateString(args.domain_id, 'domain_id');
        const domainInfo = await this.getDomainInfo(domainId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(domainInfo, null, 2),
          }],
        };
      },

      register_domain: async (args) => {
        const name = validateDomain(args.name, 'name');
        const years = validatePositiveNumber(args.years, 'years');
        const contact = args.contact;
        
        // Validate contact information
        const validatedContact = {
          name: validateString(contact.name, 'contact.name'),
          address: validateString(contact.address, 'contact.address'),
          city: validateString(contact.city, 'contact.city'),
          sp: validateString(contact.sp, 'contact.sp'),
          pc: validateString(contact.pc, 'contact.pc'),
          cc: validateString(contact.cc, 'contact.cc'),
          telephone: validateString(contact.telephone, 'contact.telephone'),
          email: validateEmail(contact.email, 'contact.email'),
          organisation: validateOptional(contact.organisation, (val) => validateString(val, 'contact.organisation'), 'contact.organisation'),
        };

        const domainData = {
          name,
          years,
          contact: validatedContact,
          privacyService: validateOptional(args.privacy_service, (val) => validateBoolean(val, 'privacy_service'), 'privacy_service'),
          nameservers: validateOptional(args.nameservers, (val) => validateStringArray(val, 'nameservers'), 'nameservers'),
          stackUser: validateOptional(args.stack_user, (val) => validateString(val, 'stack_user'), 'stack_user'),
        };

        const registeredDomain = await this.registerDomain(domainData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(registeredDomain, null, 2),
          }],
        };
      },

      search_domains: async (args) => {
        const searchTerm = validateString(args.search_term, 'search_term');
        const suggestions = validateOptional(args.suggestions, (val) => validateBoolean(val, 'suggestions'), 'suggestions');
        const tlds = validateOptional(args.tlds, (val) => validateStringArray(val, 'tlds'), 'tlds');

        const searchResults = await this.searchDomains(searchTerm, { suggestions, tlds });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(searchResults, null, 2),
          }],
        };
      },

      get_domain_verification_status: async () => {
        const status = await this.getDomainVerificationStatus();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(status, null, 2),
          }],
        };
      },

      resend_domain_verification_email: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const domainId = validateString(args.domain_id, 'domain_id');
        
        const result = await this.resendDomainVerificationEmail(packageId, domainId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      get_dns_records: async (args) => {
        const domainId = validateString(args.domain_id, 'domain_id');
        const dnsRecords = await this.getDnsRecords(domainId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(dnsRecords, null, 2),
          }],
        };
      },

      update_dns_record: async (args) => {
        const domainId = validateString(args.domain_id, 'domain_id');
        const recordType = validateEnum(args.record_type, ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV'], 'record_type');
        const name = validateString(args.name, 'name');
        const value = validateString(args.value, 'value');
        const ttl = validateOptional(args.ttl, (val) => validatePositiveNumber(val, 'ttl'), 'ttl') || 3600;

        const recordData = { record_type: recordType, name, value, ttl };
        const updatedDns = await this.updateDnsRecord(domainId, recordData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(updatedDns, null, 2),
          }],
        };
      },

      get_domain_periods: async () => {
        const periods = await this.getDomainPeriods();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(periods, null, 2),
          }],
        };
      },

      get_domain_premium_types: async () => {
        const premiumTypes = await this.getDomainPremiumTypes();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(premiumTypes, null, 2),
          }],
        };
      },

      get_domain_transfer_status: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const domainId = validateString(args.domain_id, 'domain_id');
        
        const status = await this.getDomainTransferStatus(packageId, domainId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(status, null, 2),
          }],
        };
      },

      get_domain_auth_code: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const domainId = validateString(args.domain_id, 'domain_id');
        
        const authCode = await this.getDomainAuthCode(packageId, domainId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(authCode, null, 2),
          }],
        };
      },

      get_domain_whois: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const domainId = validateString(args.domain_id, 'domain_id');
        
        const whois = await this.getDomainWhois(packageId, domainId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(whois, null, 2),
          }],
        };
      },

      set_domain_transfer_lock: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const domainId = validateString(args.domain_id, 'domain_id');
        const enabled = validateBoolean(args.enabled, 'enabled');
        
        const result = await this.setDomainTransferLock(packageId, domainId, enabled);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      transfer_domain: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const domainId = validateString(args.domain_id, 'domain_id');
        
        const result = await this.transferDomain(packageId, domainId, args.transfer_data);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },
    };
  }

  /**
   * Tool definitions
   */
  getTools(): Tool[] {
    return [
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
                name: { type: 'string', description: 'Contact person name' },
                organisation: { type: 'string', description: 'Organisation name (optional)' },
                address: { type: 'string', description: 'Street address' },
                city: { type: 'string', description: 'City' },
                sp: { type: 'string', description: 'State/Province' },
                pc: { type: 'string', description: 'Postal code' },
                cc: { type: 'string', description: 'Country code (e.g., GB, US)' },
                telephone: { type: 'string', description: 'Phone number' },
                email: { type: 'string', description: 'Email address' },
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
              items: { type: 'string' },
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
              items: { type: 'string' },
              description: 'Specific TLDs to search (optional, defaults to all supported TLDs)',
            },
          },
          required: ['search_term'],
        },
      },
      {
        name: 'get_domain_verification_status',
        description: 'Get verification status for domains requiring verification',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'resend_domain_verification_email',
        description: 'Resend verification email for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to resend verification for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_dns_records',
        description: 'Get DNS records for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'Domain ID to get DNS records for',
            },
          },
          required: ['domain_id'],
        },
      },
      {
        name: 'update_dns_record',
        description: 'Update or add a DNS record for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain_id: {
              type: 'string',
              description: 'Domain ID to update DNS record for',
            },
            record_type: {
              type: 'string',
              enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV'],
              description: 'Type of DNS record',
            },
            name: {
              type: 'string',
              description: 'DNS record name (subdomain or @ for root)',
            },
            value: {
              type: 'string',
              description: 'DNS record value (IP address, hostname, etc.)',
            },
            ttl: {
              type: 'number',
              description: 'Time to live in seconds (default: 3600)',
              default: 3600,
            },
          },
          required: ['domain_id', 'record_type', 'name', 'value'],
        },
      },
      {
        name: 'get_domain_periods',
        description: 'List all possible domain periods supported for registration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_domain_premium_types',
        description: 'List all domain extensions with their associated premium group',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_domain_transfer_status',
        description: 'Get the transfer status of a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to check transfer status for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_domain_auth_code',
        description: 'Get the authorization code (EPP code) for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to get auth code for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'get_domain_whois',
        description: 'Get WHOIS information for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to get WHOIS for',
            },
          },
          required: ['package_id', 'domain_id'],
        },
      },
      {
        name: 'set_domain_transfer_lock',
        description: 'Enable or disable transfer lock for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Package ID containing the domain',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to set transfer lock for',
            },
            enabled: {
              type: 'boolean',
              description: 'Enable (true) or disable (false) transfer lock',
            },
          },
          required: ['package_id', 'domain_id', 'enabled'],
        },
      },
      {
        name: 'transfer_domain',
        description: 'Transfer a domain to this account',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'Package ID to transfer domain to',
            },
            domain_id: {
              type: 'string',
              description: 'Domain ID to transfer',
            },
            transfer_data: {
              type: 'object',
              description: 'Transfer configuration data including auth code and contact details',
            },
          },
          required: ['package_id', 'domain_id', 'transfer_data'],
        },
      },
    ];
  }
}

export function createDomainsModule(client: TwentyIClient): ModuleDefinition {
  const domainsModule = new DomainsModule(client);
  return {
    tools: domainsModule.getTools(),
    handlers: domainsModule.getHandlers(),
  };
}