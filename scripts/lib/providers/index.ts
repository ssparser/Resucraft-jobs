import type { JobProvider } from '../types.js';
import { FreeHireProvider } from './freehire.js';

class ProviderRegistry {
  private providers: Map<string, JobProvider> = new Map();

  public register(provider: JobProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider '${provider.name}' is already registered.`);
    }
    this.providers.set(provider.name, provider);
  }

  public getProviders(): JobProvider[] {
    return Array.from(this.providers.values());
  }

  public getProvider(name: string): JobProvider | undefined {
    return this.providers.get(name);
  }
}

export const registry = new ProviderRegistry();

// Register initial provider(s)
registry.register(new FreeHireProvider());

export type { JobProvider };
export { FreeHireProvider };
