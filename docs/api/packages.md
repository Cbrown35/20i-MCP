# Packages API Module

The Packages module provides comprehensive hosting package management capabilities for the 20i hosting platform.

## Overview

- **Module**: `packages`
- **Tools**: 18 package management tools
- **API Coverage**: Package CRUD operations, configuration, usage monitoring, Stack user management

## Available Tools

### Core Package Operations

#### `list_hosting_packages`
List all hosting packages in the reseller account.

**Parameters**: None

**Returns**: Array of hosting package objects

**Example**:
```json
[
  {
    "id": "package-123",
    "name": "example.com",
    "type": "shared",
    "status": "active",
    "domain_name": "example.com"
  }
]
```

#### `get_hosting_package_info`
Get detailed information about a specific hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get information for

**Returns**: Detailed package object with configuration and status

#### `create_hosting_package`
Create a new hosting package.

**Parameters**:
- `domain_name` (string, required): Primary domain name for the hosting package
- `package_type` (string, required): Type of hosting package (get available types from `get_package_types`)
- `username` (string, required): Username for the hosting account
- `password` (string, required): Password for the hosting account
- `extra_domain_names` (array, optional): Additional domain names to add to the package
- `documentRoots` (object, optional): Document root mappings for domains
- `stack_user` (string, optional): Stack user to grant access to the package

**Returns**: Created package object

#### `update_hosting_package`
Update hosting package settings.

**Parameters**:
- `package_id` (string, required): The hosting package ID to update
- `update_data` (object, required): Package settings to update

#### `delete_hosting_package`
Delete a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to delete

**Warning**: This operation is irreversible. Ensure you have backups if needed.

### Package Information

#### `get_hosting_package_web_info`
Get web-specific hosting package information.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get web information for

**Returns**: Web-specific configuration including document roots, PHP settings, and web features

#### `get_hosting_package_limits`
Get hosting package limits and quotas.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get limits for

**Returns**: Package limits including disk space, bandwidth, databases, email accounts, etc.

#### `get_hosting_package_usage`
Get hosting package usage statistics.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get usage statistics for

**Returns**: Current usage statistics for disk space, bandwidth, and other resources

### Package Configuration

#### `get_package_types`
Get available hosting package types.

**Parameters**: None

**Returns**: List of available package types with their features and limits

#### `get_package_configuration`
Get hosting package configuration settings.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get configuration for

#### `update_package_configuration`
Update hosting package configuration settings.

**Parameters**:
- `package_id` (string, required): The hosting package ID to update configuration for
- `configuration` (object, required): Configuration settings to update

#### `get_package_services`
Get services enabled for a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get services for

**Returns**: List of enabled services (email, databases, SSL, etc.)

### Usage Statistics

#### `get_package_disk_usage`
Get disk usage statistics for a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get disk usage for

**Returns**: Detailed disk usage breakdown by directory and file type

#### `get_package_bandwidth_usage`
Get bandwidth usage statistics for a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get bandwidth usage for

**Returns**: Bandwidth usage over time with detailed statistics

### Package Management

#### `suspend_package`
Suspend a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to suspend
- `reason` (string, optional): Reason for suspension

**Effect**: Disables access to the hosting package while preserving data

#### `unsuspend_package`
Unsuspend a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to unsuspend

**Effect**: Restores access to the hosting package

### Stack User Management

#### `get_package_stack_users`
Get Stack users with access to a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to get Stack users for

**Returns**: List of Stack users with access to the package

#### `add_stack_user_to_package`
Add a Stack user to a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to add Stack user to
- `stack_user` (string, required): Stack username to add

**Effect**: Grants Stack user access to manage the hosting package

#### `remove_stack_user_from_package`
Remove a Stack user from a hosting package.

**Parameters**:
- `package_id` (string, required): The hosting package ID to remove Stack user from
- `stack_user` (string, required): Stack username to remove

**Effect**: Revokes Stack user access to the hosting package

## Error Handling

All package operations include comprehensive error handling:

- **Authentication Errors**: Invalid API credentials
- **Validation Errors**: Invalid input parameters
- **Permission Errors**: Insufficient permissions for package operations
- **Resource Limits**: Package creation limits exceeded
- **Not Found Errors**: Package not found
- **Dependency Errors**: Cannot delete package with active dependencies

## Usage Examples

### Create a new hosting package
```typescript
await callTool('create_hosting_package', {
  domain_name: 'mynewsite.com',
  package_type: 'shared-basic',
  username: 'mynewsite',
  password: 'SecurePassword123!',
  extra_domain_names: ['www.mynewsite.com'],
  stack_user: 'myusername'
});
```

### Get package usage statistics
```typescript
await callTool('get_hosting_package_usage', {
  package_id: 'package-123'
});
```

### Update package configuration
```typescript
await callTool('update_package_configuration', {
  package_id: 'package-123',
  configuration: {
    php_version: '8.2',
    ssl_enabled: true,
    backup_enabled: true
  }
});
```

### Suspend a package temporarily
```typescript
await callTool('suspend_package', {
  package_id: 'package-123',
  reason: 'Maintenance required'
});
```

## Package Types

Common package types include:
- `shared-basic`: Basic shared hosting
- `shared-premium`: Premium shared hosting
- `reseller`: Reseller hosting package
- `vps`: Virtual Private Server
- `dedicated`: Dedicated server

Use `get_package_types` to get the current list of available types with their specific features and limits.

## Dependencies

The Packages module depends on:
- `TwentyIClient` from the core module
- Validation utilities from the core module
- Error handling from the core module

## Testing

Unit tests are available at `tests/unit/packages.test.ts` covering:
- Package listing and information retrieval
- Package creation and configuration
- Usage statistics retrieval
- Stack user management
- Error handling scenarios
- Input validation

## Related Modules

The Packages module works closely with:
- **Domains**: Packages contain domain configurations
- **Email**: Email accounts are managed per package
- **Databases**: Database instances are tied to packages
- **SSL**: SSL certificates are configured per package
- **Backups**: Backup policies are set per package