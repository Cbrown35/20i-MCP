# 20i API Endpoints Mind Map

This document provides a visual overview of the 20i Web Hosting API endpoints organized by functionality categories. The project implements 303 out of 335 total endpoints (90.4% coverage).

## Mermaid Mind Map

```mermaid
mindmap
  root((20i API Endpoints))
    Domains
      "Register & Transfer"
      "Renewal & Expiry"
      "Check Availability"
      "* Domain Locking (missing/partial)"
    SSL
      "Certificates Purchase"
      "Install & Renew"
    Hosting
      "Package Management"
      "FTP & File Manager"
      "CDN"
      "* Timeline Backups (missing/partial)"
    Databases
      "MySQL"
      "User Creation & Access"
    DNS
      "Records CRUD"
      "Zone Management"
      "* Advanced DNS Features (missing/partial)"
    Reseller
      "Manage Stack Users"
      "Package Branding"
      "Allowances & Splitting"
      "* 8 unimplemented endpoints"
    VPS
      "Rebuild OS Images"
      "Addons & IP Mgmt"
      "* Lock & Unlock VNC (missing)"
    Website Turbo
      "Enable/Disable"
      "Settings & Usage"
      "* Some unimplemented endpoints"
```

## ASCII Tree Representation

```
20i API Endpoints (303/335 implemented - 90.4% coverage)
├─ Domains
│  ├─ Register & Transfer
│  ├─ Renewal & Expiry
│  ├─ Check Availability
│  └─ * Domain Locking (missing/partial)
├─ SSL
│  ├─ Certificates Purchase
│  └─ Install & Renew
├─ Hosting
│  ├─ Package Management
│  ├─ FTP & File Manager
│  ├─ CDN
│  └─ * Timeline Backups (missing/partial)
├─ Databases
│  ├─ MySQL
│  └─ User Creation & Access
├─ DNS
│  ├─ Records CRUD
│  ├─ Zone Management
│  └─ * Advanced DNS Features (missing/partial)
├─ Reseller
│  ├─ Manage Stack Users
│  ├─ Package Branding
│  ├─ Allowances & Splitting
│  └─ * 8 unimplemented endpoints
├─ VPS
│  ├─ Rebuild OS Images
│  ├─ Addons & IP Mgmt
│  └─ * Lock & Unlock VNC (missing)
└─ Website Turbo
   ├─ Enable/Disable
   ├─ Settings & Usage
   └─ * Some unimplemented endpoints
```

## Category Breakdown

### 1. Domains
- **Register & Transfer**: Standard domain registration, transferring from another registrar
- **Renewal & Expiry**: Renewing domains, handling status changes
- **Check Availability**: Checking if a domain name is available
- **Domain Locking (Some missing endpoints)**: Some domain lock/unlock methods weren't located in `src/index.ts`

### 2. SSL
- **Certificates Purchase**: Ordering new SSL certificates
- **Install & Renew**: Installing certificates on hosting packages and renewing them when needed

### 3. Hosting
- **Package Management**: Creating, upgrading, or removing hosting packages
- **FTP & File Manager**: Operations for file uploads, creating directories or managing files
- **CDN**: Some endpoints for enabling or configuring content delivery networks
- **Timeline Backups (Missing or Partial)**: The set of endpoints for scheduling, retrieving, or restoring backups on a timeline-based system; at least a few are not implemented

### 4. Databases
- **MySQL**: Provisioning MySQL databases
- **User Creation & Access**: Managing MySQL user privileges, performing resets, etc.

### 5. DNS
- **Records CRUD**: Create, read, update, and delete DNS records
- **Zone Management**: Handling domain zones for multiple hosting packages
- **Advanced DNS Features (Missing/Partial)**: Some advanced or less common DNS endpoints remain unimplemented

### 6. Reseller
- **Manage Stack Users**: Includes listing, creating, or editing stack (reseller) users
- **Package Branding**: Branding or customizing hosting packages for resale
- **Allowances & Splitting**: Allocating package resources to stack users or splitting packages
- **8 unimplemented endpoints**: For example, updating package allowances or advanced branding tasks

### 7. VPS
- **Rebuild OS Images**: Selecting and applying new operating systems to a VPS
- **Addons & IP Mgmt**: Purchasing VPS addons (e.g., additional IPv4/IPv6) or assigning them
- **Lock & Unlock VNC (Missing)**: A set of endpoints to restrict or enable VNC access

### 8. Website Turbo
- **Enable/Disable**: Activating or deactivating the Website Turbo feature on a package
- **Settings & Usage**: Configuring Website Turbo parameters
- **Some unimplemented endpoints**: Certain advanced or specialized "turbo" tasks aren't found in `src/index.ts`

## Legend

- **Regular text**: Fully implemented endpoint categories
- **\* Asterisk**: Missing or partially implemented endpoints
- **Numbers**: Specific count of unimplemented endpoints where known

## Usage Notes

- Each branch represents a top-level group of endpoints from the official 20i API docs
- Sub-branches list the key operations or subcategories
- Items marked with asterisks (*) indicate missing or partially implemented endpoints
- For detailed endpoint lists and implementation status, refer to the main project documentation
- This mind map captures the logical organization of the endpoints; details on exact request/response parameters require referencing the `.apib` docs or the `src/index.ts` code

## Viewing the Mermaid Diagram

To properly view the Mermaid diagram in VSCode:

1. Install the "Markdown Preview Mermaid Support" extension
2. Reload VSCode window (Ctrl+Shift+P → "Developer: Reload Window")
3. Open this file and use "Open Preview" or "Open Preview to the Side"

Alternatively, you can use the ASCII tree representation above which displays in any text editor.