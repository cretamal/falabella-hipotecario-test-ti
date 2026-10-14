import { test as base, expect } from '@playwright/test';

/**
 * Cada test registra las peticiones del navegador: ninguna puede ir a pokeapi.co (todo pasa por el BFF, sin excepción).
 */
export const test = base.extend<{ pokeapiRequests: string[] }>({
  pokeapiRequests: [
    async ({ page }, use) => {
      const requests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).hostname.endsWith('pokeapi.co')) requests.push(request.url());
      });
      await use(requests);
      expect(requests, 'el navegador no debe consultar PokéAPI directamente').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
