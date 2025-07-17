// Package management module for 20i MCP Server
import { TwentyIClient, Tool, ToolHandler, ModuleDefinition } from '../core/index.js';
import { 
  validateString, 
  validatePositiveNumber, 
  validateOptional 
} from '../core/validation.js';

export class PackagesModule {
  constructor(private client: TwentyIClient) {}

  /**
   * Package-related helper methods (extracted from original TwentyIClient)
   */
  async listHostingPackages() {
    return await this.client.get('/package');
  }

  async getHostingPackageInfo(packageId: string) {
    return await this.client.get(`/package/${packageId}`);
  }

  async getHostingPackageWebInfo(packageId: string) {
    return await this.client.get(`/package/${packageId}/web`);
  }

  async getHostingPackageLimits(packageId: string) {
    return await this.client.get(`/package/${packageId}/limits`);
  }

  async getHostingPackageUsage(packageId: string) {
    return await this.client.get(`/package/${packageId}/web/usage`);
  }

  async createHostingPackage(data: {
    domain_name: string;
    package_type: string;
    username: string;
    password: string;
    extra_domain_names?: string[];
    documentRoots?: Record<string, string>;
    stackUser?: string;
  }) {
    const resellerInfo = await this.client.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    return await this.client.post(`/reseller/${resellerId}/addWeb`, data);
  }

  async updateHostingPackage(packageId: string, updateData: any) {
    return await this.client.post(`/package/${packageId}`, updateData);
  }

  async deleteHostingPackage(packageId: string) {
    return await this.client.delete(`/package/${packageId}`);
  }

  async getPackageTypes() {
    const resellerInfo = await this.client.getResellerInfo();
    const resellerId = resellerInfo?.id;
    
    if (!resellerId) {
      throw new Error('Unable to determine reseller ID from account information');
    }
    
    return await this.client.get(`/reseller/${resellerId}/packageTypes`);
  }

  async getPackageConfiguration(packageId: string) {
    return await this.client.get(`/package/${packageId}/config`);
  }

  async updatePackageConfiguration(packageId: string, config: any) {
    return await this.client.post(`/package/${packageId}/config`, config);
  }

  async getPackageServices(packageId: string) {
    return await this.client.get(`/package/${packageId}/services`);
  }

  async getPackageDiskUsage(packageId: string) {
    return await this.client.get(`/package/${packageId}/web/diskUsage`);
  }

  async getPackageBandwidthUsage(packageId: string) {
    return await this.client.get(`/package/${packageId}/web/bandwidthUsage`);
  }

  async suspendPackage(packageId: string, reason?: string) {
    const data = reason ? { reason } : {};
    return await this.client.post(`/package/${packageId}/suspend`, data);
  }

  async unsuspendPackage(packageId: string) {
    return await this.client.post(`/package/${packageId}/unsuspend`, {});
  }

  async getPackageStackUsers(packageId: string) {
    return await this.client.get(`/package/${packageId}/stackUsers`);
  }

  async addStackUserToPackage(packageId: string, stackUser: string) {
    return await this.client.post(`/package/${packageId}/stackUsers`, { stackUser });
  }

  async removeStackUserFromPackage(packageId: string, stackUser: string) {
    return await this.client.delete(`/package/${packageId}/stackUsers/${stackUser}`);
  }

  /**
   * Tool handlers
   */
  getHandlers(): Record<string, ToolHandler> {
    return {
      list_hosting_packages: async () => {
        const packages = await this.listHostingPackages();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(packages, null, 2),
          }],
        };
      },

      get_hosting_package_info: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const packageInfo = await this.getHostingPackageInfo(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(packageInfo, null, 2),
          }],
        };
      },

      create_hosting_package: async (args) => {
        const domainName = validateString(args.domain_name, 'domain_name');
        const packageType = validateString(args.package_type, 'package_type');
        const username = validateString(args.username, 'username');
        const password = validateString(args.password, 'password');
        
        const packageData = {
          domain_name: domainName,
          package_type: packageType,
          username,
          password,
          extra_domain_names: validateOptional(
            args.extra_domain_names,
            (val) => Array.isArray(val) ? val : [], 
            'extra_domain_names'
          ),
          documentRoots: validateOptional(
            args.documentRoots,
            (val) => typeof val === 'object' ? val : {}, 
            'documentRoots'
          ),
          stackUser: validateOptional(
            args.stack_user,
            (val) => validateString(val, 'stack_user'), 
            'stack_user'
          ),
        };

        const newPackage = await this.createHostingPackage(packageData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(newPackage, null, 2),
          }],
        };
      },

      get_hosting_package_web_info: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const webInfo = await this.getHostingPackageWebInfo(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(webInfo, null, 2),
          }],
        };
      },

      get_hosting_package_limits: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const limits = await this.getHostingPackageLimits(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(limits, null, 2),
          }],
        };
      },

      get_hosting_package_usage: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const usage = await this.getHostingPackageUsage(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(usage, null, 2),
          }],
        };
      },

      update_hosting_package: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const updateData = args.update_data || {};
        
        const result = await this.updateHostingPackage(packageId, updateData);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      delete_hosting_package: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const result = await this.deleteHostingPackage(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      get_package_types: async () => {
        const types = await this.getPackageTypes();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(types, null, 2),
          }],
        };
      },

      get_package_configuration: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const config = await this.getPackageConfiguration(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(config, null, 2),
          }],
        };
      },

      update_package_configuration: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const config = args.configuration || {};
        
        const result = await this.updatePackageConfiguration(packageId, config);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      get_package_services: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const services = await this.getPackageServices(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(services, null, 2),
          }],
        };
      },

      get_package_disk_usage: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const diskUsage = await this.getPackageDiskUsage(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(diskUsage, null, 2),
          }],
        };
      },

      get_package_bandwidth_usage: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const bandwidthUsage = await this.getPackageBandwidthUsage(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(bandwidthUsage, null, 2),
          }],
        };
      },

      suspend_package: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const reason = validateOptional(args.reason, (val) => validateString(val, 'reason'), 'reason');
        
        const result = await this.suspendPackage(packageId, reason);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      unsuspend_package: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const result = await this.unsuspendPackage(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      get_package_stack_users: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const stackUsers = await this.getPackageStackUsers(packageId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stackUsers, null, 2),
          }],
        };
      },

      add_stack_user_to_package: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const stackUser = validateString(args.stack_user, 'stack_user');
        
        const result = await this.addStackUserToPackage(packageId, stackUser);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      },

      remove_stack_user_from_package: async (args) => {
        const packageId = validateString(args.package_id, 'package_id');
        const stackUser = validateString(args.stack_user, 'stack_user');
        
        const result = await this.removeStackUserFromPackage(packageId, stackUser);
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
              description: 'Primary domain name for the hosting package',
            },
            package_type: {
              type: 'string',
              description: 'Type of hosting package (get available types from get_package_types)',
            },
            username: {
              type: 'string',
              description: 'Username for the hosting account',
            },
            password: {
              type: 'string',
              description: 'Password for the hosting account',
            },
            extra_domain_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional domain names to add to the package',
            },
            documentRoots: {
              type: 'object',
              description: 'Document root mappings for domains',
            },
            stack_user: {
              type: 'string',
              description: 'Stack user to grant access to the package',
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
        name: 'update_hosting_package',
        description: 'Update hosting package settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update',
            },
            update_data: {
              type: 'object',
              description: 'Package settings to update',
            },
          },
          required: ['package_id', 'update_data'],
        },
      },
      {
        name: 'delete_hosting_package',
        description: 'Delete a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to delete',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_package_types',
        description: 'Get available hosting package types',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_package_configuration',
        description: 'Get hosting package configuration settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get configuration for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'update_package_configuration',
        description: 'Update hosting package configuration settings',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to update configuration for',
            },
            configuration: {
              type: 'object',
              description: 'Configuration settings to update',
            },
          },
          required: ['package_id', 'configuration'],
        },
      },
      {
        name: 'get_package_services',
        description: 'Get services enabled for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get services for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_package_disk_usage',
        description: 'Get disk usage statistics for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get disk usage for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_package_bandwidth_usage',
        description: 'Get bandwidth usage statistics for a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get bandwidth usage for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'suspend_package',
        description: 'Suspend a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to suspend',
            },
            reason: {
              type: 'string',
              description: 'Reason for suspension (optional)',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'unsuspend_package',
        description: 'Unsuspend a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to unsuspend',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'get_package_stack_users',
        description: 'Get Stack users with access to a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to get Stack users for',
            },
          },
          required: ['package_id'],
        },
      },
      {
        name: 'add_stack_user_to_package',
        description: 'Add a Stack user to a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to add Stack user to',
            },
            stack_user: {
              type: 'string',
              description: 'Stack username to add',
            },
          },
          required: ['package_id', 'stack_user'],
        },
      },
      {
        name: 'remove_stack_user_from_package',
        description: 'Remove a Stack user from a hosting package',
        inputSchema: {
          type: 'object',
          properties: {
            package_id: {
              type: 'string',
              description: 'The hosting package ID to remove Stack user from',
            },
            stack_user: {
              type: 'string',
              description: 'Stack username to remove',
            },
          },
          required: ['package_id', 'stack_user'],
        },
      },
    ];
  }
}

export function createPackagesModule(client: TwentyIClient): ModuleDefinition {
  const packagesModule = new PackagesModule(client);
  return {
    tools: packagesModule.getTools(),
    handlers: packagesModule.getHandlers(),
  };
}