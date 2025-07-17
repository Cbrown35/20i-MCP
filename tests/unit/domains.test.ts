// Unit tests for the domains module
import { DomainsModule, createDomainsModule } from '../../src/modules/domains';
import { TwentyIClient } from '../../src/core/client';
import { createMockTwentyIClient, createMockAxiosResponse } from '../helpers/mockClient';

describe('DomainsModule', () => {
  let mockClient: any;
  let domainsModule: DomainsModule;

  beforeEach(() => {
    mockClient = createMockTwentyIClient();
    domainsModule = new DomainsModule(mockClient);
  });

  describe('listDomains', () => {
    it('should fetch domains from the API', async () => {
      const mockDomains = [
        { id: '1', name: 'example.com', status: 'active' },
        { id: '2', name: 'example.org', status: 'active' }
      ];
      
      mockClient.get.mockResolvedValue(mockDomains);

      const result = await domainsModule.listDomains();

      expect(mockClient.get).toHaveBeenCalledWith('/domain');
      expect(result).toEqual(mockDomains);
    });
  });

  describe('searchDomains', () => {
    it('should search for domain availability', async () => {
      const mockSearchResults = {
        'example.com': { available: false },
        'example.net': { available: true }
      };
      
      mockClient.get.mockResolvedValue(mockSearchResults);

      const result = await domainsModule.searchDomains('example');

      expect(mockClient.get).toHaveBeenCalledWith('/domain-search/example');
      expect(result).toEqual(mockSearchResults);
    });

    it('should handle search with suggestions and TLDs', async () => {
      const mockSearchResults = { 'example.com': { available: true } };
      
      mockClient.get.mockResolvedValue(mockSearchResults);

      await domainsModule.searchDomains('example', {
        suggestions: true,
        tlds: ['com', 'org']
      });

      expect(mockClient.get).toHaveBeenCalledWith('/domain-search/example?suggestions=true&tlds=com%2Corg');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        response: { status: 429 }
      };
      
      mockClient.get.mockRejectedValue(rateLimitError);

      await expect(domainsModule.searchDomains('example'))
        .rejects.toThrow('Domain search rate limit exceeded. Please try again later.');
    });
  });

  describe('getDomainInfo', () => {
    it('should get domain information with reseller ID', async () => {
      const mockResellerInfo = { id: 'reseller-123' };
      const mockDomainInfo = { id: 'domain-456', name: 'example.com' };
      
      mockClient.getResellerInfo = jest.fn().mockResolvedValue(mockResellerInfo);
      mockClient.get.mockResolvedValue(mockDomainInfo);

      const result = await domainsModule.getDomainInfo('domain-456');

      expect(mockClient.getResellerInfo).toHaveBeenCalled();
      expect(mockClient.get).toHaveBeenCalledWith('/reseller/reseller-123/domain/domain-456');
      expect(result).toEqual(mockDomainInfo);
    });

    it('should throw error if reseller ID is not available', async () => {
      mockClient.getResellerInfo = jest.fn().mockResolvedValue({});

      await expect(domainsModule.getDomainInfo('domain-456'))
        .rejects.toThrow('Unable to determine reseller ID from account information');
    });
  });

  describe('tool handlers', () => {
    let handlers: any;

    beforeEach(() => {
      handlers = domainsModule.getHandlers();
    });

    describe('list_domains handler', () => {
      it('should return formatted domain list', async () => {
        const mockDomains = [{ id: '1', name: 'example.com' }];
        jest.spyOn(domainsModule, 'listDomains').mockResolvedValue(mockDomains);

        const result = await handlers.list_domains({});

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(JSON.parse(result.content[0].text)).toEqual(mockDomains);
      });
    });

    describe('search_domains handler', () => {
      it('should validate search term and return results', async () => {
        const mockResults = { 'example.com': { available: true } };
        jest.spyOn(domainsModule, 'searchDomains').mockResolvedValue(mockResults);

        const result = await handlers.search_domains({ search_term: 'example' });

        expect(domainsModule.searchDomains).toHaveBeenCalledWith('example', {
          suggestions: undefined,
          tlds: undefined
        });
        expect(JSON.parse(result.content[0].text)).toEqual(mockResults);
      });

      it('should throw validation error for empty search term', async () => {
        await expect(handlers.search_domains({ search_term: '' }))
          .rejects.toThrow('search_term must be a non-empty string');
      });
    });

    describe('get_domain_info handler', () => {
      it('should validate domain ID and return domain info', async () => {
        const mockDomainInfo = { id: 'domain-123', name: 'example.com' };
        jest.spyOn(domainsModule, 'getDomainInfo').mockResolvedValue(mockDomainInfo);

        const result = await handlers.get_domain_info({ domain_id: 'domain-123' });

        expect(domainsModule.getDomainInfo).toHaveBeenCalledWith('domain-123');
        expect(JSON.parse(result.content[0].text)).toEqual(mockDomainInfo);
      });
    });
  });

  describe('module creation', () => {
    it('should create module definition with tools and handlers', () => {
      const moduleDefinition = createDomainsModule(mockClient);

      expect(moduleDefinition.tools).toBeDefined();
      expect(moduleDefinition.handlers).toBeDefined();
      expect(moduleDefinition.tools.length).toBeGreaterThan(0);
      expect(Object.keys(moduleDefinition.handlers).length).toBeGreaterThan(0);
    });

    it('should have matching tool names and handlers', () => {
      const moduleDefinition = createDomainsModule(mockClient);
      const toolNames = moduleDefinition.tools.map(tool => tool.name);
      const handlerNames = Object.keys(moduleDefinition.handlers);

      expect(toolNames.sort()).toEqual(handlerNames.sort());
    });
  });
});