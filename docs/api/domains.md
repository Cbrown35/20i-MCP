# Domains API Module

The Domains module provides comprehensive domain management capabilities for the 20i hosting platform.

## Overview

- **Module**: `domains`
- **Tools**: 16 domain management tools
- **API Coverage**: Domain search, registration, DNS management, transfers, verification

## Available Tools

### Core Domain Operations

#### `list_domains`
List all domains in the reseller account.

**Parameters**: None

**Returns**: Array of domain objects with basic information

**Example**:
```json
[
  {
    "id": "domain-123",
    "name": "example.com",
    "status": "active",
    "expiry_date": "2025-12-31"
  }
]
```

#### `get_domain_info`
Get detailed information about a specific domain.

**Parameters**:
- `domain_id` (string, required): The domain ID to get information for

**Returns**: Detailed domain object

#### `register_domain`
Register a new domain name.

**Parameters**:
- `name` (string, required): Domain name to register (e.g., "example.com")
- `years` (number, required): Number of years to register for
- `contact` (object, required): Contact information for domain registration
  - `name` (string, required): Contact person name
  - `address` (string, required): Street address
  - `city` (string, required): City
  - `sp` (string, required): State/Province
  - `pc` (string, required): Postal code
  - `cc` (string, required): Country code (e.g., "GB", "US")
  - `telephone` (string, required): Phone number
  - `email` (string, required): Email address
  - `organisation` (string, optional): Organisation name
- `privacy_service` (boolean, optional): Enable domain privacy protection
- `nameservers` (array, optional): Custom nameservers
- `stack_user` (string, optional): Stack user to grant access to

#### `search_domains`
Search for domain availability and get suggestions.

**Parameters**:
- `search_term` (string, required): Domain name or prefix to search for
- `suggestions` (boolean, optional): Enable domain name suggestions
- `tlds` (array, optional): Specific TLDs to search

**Returns**: Domain availability results

### DNS Management

#### `get_dns_records`
Get DNS records for a domain.

**Parameters**:
- `domain_id` (string, required): Domain ID to get DNS records for

#### `update_dns_record`
Update or add a DNS record for a domain.

**Parameters**:
- `domain_id` (string, required): Domain ID to update DNS record for
- `record_type` (string, required): Type of DNS record (A, AAAA, CNAME, MX, TXT, NS, SRV)
- `name` (string, required): DNS record name (subdomain or @ for root)
- `value` (string, required): DNS record value
- `ttl` (number, optional): Time to live in seconds (default: 3600)

### Domain Verification

#### `get_domain_verification_status`
Get verification status for domains requiring verification.

**Parameters**: None

#### `resend_domain_verification_email`
Resend verification email for a domain.

**Parameters**:
- `package_id` (string, required): Package ID containing the domain
- `domain_id` (string, required): Domain ID to resend verification for

### Domain Transfer Operations

#### `get_domain_transfer_status`
Get the transfer status of a domain.

**Parameters**:
- `package_id` (string, required): Package ID containing the domain
- `domain_id` (string, required): Domain ID to check transfer status for

#### `get_domain_auth_code`
Get the authorization code (EPP code) for a domain.

**Parameters**:
- `package_id` (string, required): Package ID containing the domain
- `domain_id` (string, required): Domain ID to get auth code for

#### `set_domain_transfer_lock`
Enable or disable transfer lock for a domain.

**Parameters**:
- `package_id` (string, required): Package ID containing the domain
- `domain_id` (string, required): Domain ID to set transfer lock for
- `enabled` (boolean, required): Enable (true) or disable (false) transfer lock

#### `transfer_domain`
Transfer a domain to this account.

**Parameters**:
- `package_id` (string, required): Package ID to transfer domain to
- `domain_id` (string, required): Domain ID to transfer
- `transfer_data` (object, required): Transfer configuration data

### Domain Information Tools

#### `get_domain_periods`
List all possible domain periods supported for registration.

**Parameters**: None

#### `get_domain_premium_types`
List all domain extensions with their associated premium group.

**Parameters**: None

#### `get_domain_whois`
Get WHOIS information for a domain.

**Parameters**:
- `package_id` (string, required): Package ID containing the domain
- `domain_id` (string, required): Domain ID to get WHOIS for

## Error Handling

All domain operations include comprehensive error handling:

- **Authentication Errors**: Invalid API credentials
- **Validation Errors**: Invalid input parameters
- **Rate Limiting**: Domain search rate limits
- **Not Found Errors**: Domain or resource not found
- **API Errors**: 20i API-specific errors

## Usage Examples

### Register a new domain
```typescript
await callTool('register_domain', {
  name: 'mynewdomain.com',
  years: 2,
  contact: {
    name: 'John Doe',
    address: '123 Main St',
    city: 'London',
    sp: 'England',
    pc: 'SW1A 1AA',
    cc: 'GB',
    telephone: '+44 20 7946 0958',
    email: 'john@example.com'
  },
  privacy_service: true
});
```

### Search for domain availability
```typescript
await callTool('search_domains', {
  search_term: 'mycompany',
  suggestions: true,
  tlds: ['com', 'org', 'net']
});
```

### Update DNS record
```typescript
await callTool('update_dns_record', {
  domain_id: 'domain-123',
  record_type: 'A',
  name: '@',
  value: '192.168.1.1',
  ttl: 3600
});
```

## Dependencies

The Domains module depends on:
- `TwentyIClient` from the core module
- Validation utilities from the core module
- Error handling from the core module

## Testing

Unit tests are available at `tests/unit/domains.test.ts` covering:
- Domain listing and information retrieval
- Domain search functionality
- DNS record management
- Error handling scenarios
- Input validation