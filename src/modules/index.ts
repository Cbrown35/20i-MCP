// Modules index - exports all modules
export { createDomainsModule } from './domains.js';
export { createPackagesModule } from './packages.js';

// Module registry for easy module loading
import { TwentyIClient, ModuleDefinition } from '../core/index.js';
import { createDomainsModule } from './domains.js';
import { createPackagesModule } from './packages.js';

export interface ModuleRegistry {
  [moduleName: string]: (client: TwentyIClient) => ModuleDefinition;
}

export const moduleRegistry: ModuleRegistry = {
  domains: createDomainsModule,
  packages: createPackagesModule,
};

/**
 * Load all modules and return combined tools and handlers
 */
export function loadAllModules(client: TwentyIClient) {
  const allTools: any[] = [];
  const allHandlers: Record<string, any> = {};

  Object.entries(moduleRegistry).forEach(([moduleName, createModule]) => {
    const module = createModule(client);
    
    // Add tools
    allTools.push(...module.tools);
    
    // Add handlers with module prefix for debugging
    Object.entries(module.handlers).forEach(([handlerName, handler]) => {
      if (allHandlers[handlerName]) {
        console.error(`Warning: Handler '${handlerName}' already exists! Module: ${moduleName}`);
      }
      allHandlers[handlerName] = handler;
    });
  });

  return {
    tools: allTools,
    handlers: allHandlers,
  };
}