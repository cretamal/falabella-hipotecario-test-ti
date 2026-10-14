import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/** Las tarjetas del catálogo que hay en pantalla en este momento. */
const cards = (page: import('@playwright/test').Page) => page.locator('app-pokemon-card');

test.describe('catálogo', () => {
  test('muestra la primera página con imagen, número, nombre y tipos', async ({ page }) => {
    await page.goto('/es/');
    await expect(cards(page)).toHaveCount(24);
    const first = cards(page).first();
    await expect(first).toContainText('#001');
    await expect(first).toContainText('Bulbasaur');
    await expect(first).toContainText('Planta');
    await expect(first.locator('img')).toHaveAttribute('src', /\/1\.png$/);
    await expect(page.getByRole('status')).toContainText('resultados');
  });

  test('pagina con enlaces y conserva la página al recargar', async ({ page }) => {
    await page.goto('/es/');
    await page.getByRole('link', { name: 'Siguiente' }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(cards(page).first()).toContainText('#025');
    await page.reload();
    await expect(page.getByText('Página 2 de')).toBeVisible();
    await expect(cards(page).first()).toContainText('#025');
    await page.getByRole('link', { name: 'Anterior' }).click();
    await expect(cards(page).first()).toContainText('#001');
  });

  test('busca por nombre parcial sin pulsar Enter y vuelve al catálogo al borrar', async ({
    page,
  }) => {
    await page.goto('/es/');
    await page.getByLabel('Buscar por nombre').fill('pika');
    await expect(page).toHaveURL(/\?q=pika$/);
    await expect(cards(page).first()).toContainText('Pikachu');
    await expect(page.getByRole('status')).toContainText('17 resultados');
    await page.getByLabel('Buscar por nombre').fill('');
    await expect(page).not.toHaveURL(/q=/);
    await expect(cards(page)).toHaveCount(24);
  });

  test('la búsqueda ignora mayúsculas y acentos', async ({ page }) => {
    await page.goto('/es/?q=MR.%20MIME');
    await expect(cards(page).first()).toContainText('Mr Mime');
  });

  test('combina tipo y generación', async ({ page }) => {
    await page.goto('/es/');
    await page.getByLabel('Tipo').selectOption('fire');
    await page.getByLabel('Generación').selectOption('1');
    await expect(page).toHaveURL(/type=fire/);
    await expect(page).toHaveURL(/gen=1/);
    await expect(page.getByRole('status')).toContainText(/\d+ resultados/);
    await expect(cards(page).first()).toContainText('Charmander');
    const names = await cards(page).locator('.name').allTextContents();
    for (const expected of [
      'Charmander',
      'Charizard',
      'Vulpix',
      'Ninetales',
      'Growlithe',
      'Arcanine',
      'Ponyta',
      'Rapidash',
      'Magmar',
      'Flareon',
      'Moltres',
    ]) {
      expect(names).toContain(expected);
    }
    expect(names).not.toContain('Cyndaquil');
  });

  test('sin resultados: estado vacío y limpiar filtros', async ({ page }) => {
    await page.goto('/es/?q=zzzzzz');
    await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros' }).last().click();
    await expect(cards(page)).toHaveCount(24);
  });

  test('error recuperable con "Reintentar"', async ({ page }) => {
    await page.goto('/es/');
    await expect(cards(page)).toHaveCount(24);
    await page.route('**/api/pokemon?*', (route) => route.abort());
    await page.getByLabel('Buscar por nombre').fill('char');
    await expect(page.getByRole('alert')).toContainText('No pudimos cargar');
    await page.unroute('**/api/pokemon?*');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(cards(page).first()).toContainText('Charmander');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('búsqueda', () => {
  /** Va anotando las peticiones de búsqueda que el navegador le hace al catálogo. */
  const searchRequests = (page: import('@playwright/test').Page) => {
    const urls: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/pokemon' && url.searchParams.has('q')) urls.push(request.url());
    });
    return urls;
  };

  test('ordena por relevancia: el prefijo gana a la palabra interior', async ({ page }) => {
    await page.goto('/es/?q=mime');
    await expect(cards(page).first()).toContainText('Mime Jr');
    await expect(cards(page).filter({ hasText: 'Mr Mime' }).first()).toBeVisible();
  });

  test('un número encuentra ese Pokémon primero', async ({ page }) => {
    await page.goto('/es/?q=25');
    await expect(cards(page).first()).toContainText('Pikachu');
    await expect(cards(page).first()).toContainText('#025');
  });

  test('tolera erratas y avisa de que los resultados son aproximados', async ({ page }) => {
    await page.goto('/es/?q=pikchu');
    await expect(cards(page).first()).toContainText('Pikachu');
    await expect(page.getByRole('status')).toContainText('Sin coincidencias exactas para «pikchu»');
    await page.goto('/es/?q=pika');
    await expect(cards(page).first()).toContainText('Pikachu');
    await expect(page.getByRole('status')).not.toContainText('Sin coincidencias exactas');
  });

  test('una consulta de solo símbolos no devuelve el catálogo', async ({ page }) => {
    await page.goto('/es/?q=!!!');
    await expect(page.getByRole('status')).toContainText('Sin resultados');
    await expect(cards(page)).toHaveCount(0);
  });

  test('un solo carácter avisa del mínimo y no consulta', async ({ page }) => {
    await page.goto('/es/');
    await expect(cards(page)).toHaveCount(24);
    const requests = searchRequests(page);
    await page.getByLabel('Buscar por nombre').fill('p');
    await expect(page.getByText('Escribe al menos 2 caracteres')).toBeVisible();
    await page.waitForTimeout(600);
    expect(requests).toEqual([]);
    await expect(page).not.toHaveURL(/q=/);
  });

  test('escribir una palabra seguida hace una sola consulta y repetirla ninguna', async ({
    page,
  }) => {
    await page.goto('/es/');
    await expect(cards(page)).toHaveCount(24);
    const requests = searchRequests(page);
    const field = page.getByLabel('Buscar por nombre');
    await field.pressSequentially('pikachu', { delay: 40 });
    await expect(page).toHaveURL(/\?q=pikachu$/);
    await expect(cards(page).first()).toContainText('Pikachu');
    expect(requests).toHaveLength(1);

    await field.fill('');
    await expect(page).not.toHaveURL(/q=/);
    await field.fill('PIKACHU ');
    await expect(page).toHaveURL(/q=PIKACHU/);
    await expect(cards(page).first()).toContainText('Pikachu');
    expect(requests).toHaveLength(1); // la segunda vez ya sale de la caché del cliente
  });

  test('Enter busca al instante y Escape vacía el campo', async ({ page }) => {
    await page.goto('/es/');
    const field = page.getByLabel('Buscar por nombre');
    await field.fill('eevee');
    await field.press('Enter');
    await expect(page).toHaveURL(/\?q=eevee$/);
    await expect(cards(page).first()).toContainText('Eevee'); // el valor ya llegó al formulario
    await field.press('Escape');
    await expect(field).toHaveValue('');
    await expect(page).not.toHaveURL(/q=/);
  });

  test('al refinar no vuelve el esqueleto: se conservan los resultados anteriores', async ({
    page,
  }) => {
    await page.route('**/api/pokemon?*q=eevee*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto('/es/');
    await expect(cards(page)).toHaveCount(24);
    await page.getByLabel('Buscar por nombre').fill('eevee');
    await expect(page.getByRole('status')).toContainText('Buscando');
    await expect(page.locator('app-skeleton')).toHaveCount(0);
    await expect(cards(page)).toHaveCount(24);
    await expect(page.locator('ul.grid')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('status')).toContainText('resultado');
    await expect(cards(page).first()).toContainText('Eevee');
  });

  test('resultados aproximados: sin violaciones de accesibilidad', async ({ page }) => {
    await page.goto('/es/?q=pikchu');
    await cards(page).first().waitFor();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe('detalle', () => {
  test('flujo completo: buscar, abrir, ver la ficha y volver con el estado', async ({ page }) => {
    await page.goto('/es/');
    await page.getByLabel('Buscar por nombre').fill('pikachu');
    await expect(cards(page)).toHaveCount(17);
    await cards(page).first().click();

    await expect(page).toHaveURL(/\/es\/pokemon\/pikachu$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu');
    await expect(page.getByText('Pokémon Ratón')).toBeVisible();
    await expect(page.locator('app-type-chip').first()).toHaveText('Eléctrico');
    await expect(page.getByText('Generación I', { exact: true })).toBeVisible();
    await expect(page.getByText('Electricidad Estática')).toBeVisible();
    await expect(page.getByText('Pararrayos')).toBeVisible();
    await expect(page.locator('app-stat-bar')).toHaveCount(6);
    await expect(page.getByText('Ataque Especial')).toBeVisible();

    const stages = page.locator('div.stage');
    await expect(stages).toHaveText([/Pichu/, /Pikachu/, /Raichu/]);
    await expect(page.getByText('Piedra Trueno')).toBeVisible();
    await expect(stages.nth(1)).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: /Volver al catálogo/ }).click();
    await expect(page).toHaveURL(/\/es\/\?q=pikachu$/);
    await expect(page.getByLabel('Buscar por nombre')).toHaveValue('pikachu');
    await expect(cards(page)).toHaveCount(17);
  });

  test('la cadena evolutiva navega a otra etapa', async ({ page }) => {
    await page.goto('/es/pokemon/pikachu');
    await page.locator('div.stage', { hasText: 'Raichu' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Raichu');
  });

  test('muestra ramas de evolución (Eevee)', async ({ page }) => {
    await page.goto('/es/pokemon/eevee');
    await expect(page.locator('div.stage')).toHaveCount(9);
  });

  test('acepta el número del Pokémon en la URL', async ({ page }) => {
    await page.goto('/es/pokemon/6');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Charizard');
  });

  test('Pokémon inexistente: mensaje y status 404 real', async ({ page }) => {
    const response = await page.goto('/es/pokemon/no-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Pokémon no encontrado' })).toBeVisible();
    await page.getByRole('link', { name: 'Ir al catálogo' }).click();
    await expect(cards(page)).toHaveCount(24);
  });

  test('ruta desconocida: 404', async ({ page }) => {
    const response = await page.goto('/es/no/existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  });
});

test.describe('carga del detalle', () => {
  /** El tipo de la página de Playwright, para no repetirlo. */
  type Page = import('@playwright/test').Page;
  /** Anota las rutas `/api/pokemon/…` que pide el navegador, para cachar qué viaja y qué no, y con eso decidir si hubo peticiones de más. */
  const apiCalls = (page: Page) => {
    const urls: string[] = [];
    page.on('request', (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith('/api/pokemon/')) urls.push(pathname);
    });
    return urls;
  };
  /**
   * Retrasa las respuestas que calzan con el patrón, para ver cómo se porta la pantalla cuando el BFF se pone lento.
   */
  const delay = (page: Page, pattern: RegExp, ms: number) =>
    page.route(pattern, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    });

  test('clic → título al instante aunque el BFF tarde 1,5 s (navegación optimista)', async ({
    page,
  }) => {
    await delay(page, /\/api\/pokemon\/dragonite(\?|$)/, 1500);
    await page.goto('/es/?q=dragonite');
    await expect(cards(page).first()).toContainText('Dragonite');
    const start = Date.now();
    await cards(page).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragonite');
    expect(Date.now() - start).toBeLessThan(600); // margen para CI; sin el resumen serían más de 1.500 ms (ahí se nota la diferencia)
    await expect(page.locator('app-type-chip').first()).toBeVisible();
    await expect(page.locator('app-stat-bar')).toHaveCount(0); // el resto sigue cargando
    await expect(page.locator('app-stat-bar')).toHaveCount(6); // y al final llega, no pasa nada
  });

  test('Eevee (8 ramas): rejilla con condiciones plegables, hero contenido y sin desbordar', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/es/pokemon/eevee');
    const aside = page.locator('app-pokemon-hero app-evolution-panel');
    await expect(aside.locator('div.stage')).toHaveCount(9);
    const hero = await page.locator('app-pokemon-hero').boundingBox();
    expect(hero!.height).toBeLessThan(560); // antes, en fila, eran ≈ 620 px
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const more = aside.getByRole('button', { name: /^\+\d+ más$/ }).first();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(aside.getByRole('button', { name: 'Ocultar' }).first()).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('Eevee en móvil: rejilla de 2 columnas, mucho más corta que la pila vertical', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/es/pokemon/eevee');
    await expect(page.locator('app-evolution-panel div.stage')).toHaveCount(9);
    const hero = await page.locator('app-pokemon-hero').boundingBox();
    expect(hero!.height).toBeLessThan(1500); // la pila vertical llegaba a ≈ 2.100 px, una barbaridad
  });

  test('el estado intermedio (cabecera parcial + marcadores) no tiene violaciones axe', async ({
    page,
  }) => {
    await delay(page, /\/api\/pokemon\/dragonite(\?|$)/, 2500);
    await page.goto('/es/?q=dragonite');
    await cards(page).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dragonite');
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test('reabrir un Pokémon ya visto no repite peticiones', async ({ page }) => {
    const calls = apiCalls(page);
    await page.goto('/es/?q=pikachu');
    await cards(page).first().click();
    await expect(page.locator('app-stat-bar')).toHaveCount(6);
    await expect(page.locator('div.stage')).toHaveCount(3);
    // La precarga de las etapas (Pichu y Raichu) es parte de la primera visita: hay que esperarla antes de medir.
    await expect.poll(() => calls.filter((c) => /\/(172|26)$/.test(c)).length).toBe(2);
    await page.waitForLoadState('networkidle');
    const before = calls.length;
    await page.getByRole('link', { name: /Volver al catálogo/ }).click();
    await cards(page).first().click();
    await expect(page.locator('app-stat-bar')).toHaveCount(6);
    await expect(page.locator('div.stage')).toHaveCount(3);
    expect(calls.slice(before)).toEqual([]);
  });

  test('pasar el cursor por una tarjeta precarga su detalle (y no la evolución)', async ({
    page,
  }) => {
    await page.goto('/es/?q=charmander');
    await expect(cards(page).first()).toContainText('Charmander');
    const calls = apiCalls(page);
    await cards(page).first().hover();
    await expect.poll(() => calls.some((c) => c.endsWith('/charmander'))).toBe(true);
    expect(calls.some((c) => c.endsWith('/evolution'))).toBe(false);
  });

  test('pasar de largo (sin llegar al retardo) no precarga', async ({ page }) => {
    await page.goto('/es/?q=charmander');
    await expect(cards(page).first()).toContainText('Charmander');
    const calls = apiCalls(page);
    await cards(page).first().hover();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);
    expect(calls).toEqual([]);
  });

  test('la evolución carga aparte: marcador primero y error recuperable', async ({ page }) => {
    let fail = true;
    await page.route(/\/api\/pokemon\/pikachu\/evolution/, async (route) => {
      if (fail) await route.fulfill({ status: 502, json: { statusCode: 502, message: 'x' } });
      else await route.continue();
    });
    await page.goto('/es/pokemon/pikachu');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu');
    await expect(page.locator('app-stat-bar')).toHaveCount(6); // el detalle no depende de la evolución
    await expect(page.getByText('No pudimos cargar la evolución')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('div.stage')).toHaveCount(3);
  });

  test('carga directa: el HTML trae el detalle y el marcador de evolución; la evolución se pide en el navegador', async ({
    page,
    request,
  }) => {
    const html = await (await request.get('/es/pokemon/pikachu')).text();
    expect(html).toContain('Pikachu');
    expect(html).not.toContain('app-evolution-tree');
    expect(html).toContain('app-skeleton');

    const calls = apiCalls(page);
    await page.goto('/es/pokemon/pikachu');
    await expect(page.locator('div.stage')).toHaveCount(3);
    expect(calls.filter((c) => c.endsWith('/evolution'))).toHaveLength(1);
    // El detalle viajó en el HTML: lo único que se pide además es la precarga de las etapas vecinas.
    await expect.poll(() => calls.filter((c) => /\/(172|26)$/.test(c)).length).toBe(2);
    expect(calls.filter((c) => !c.endsWith('/evolution') && !/\/(172|26)$/.test(c))).toEqual([]);
  });

  test('la evolución va en la cabecera, a la derecha de la identidad, y no hay otro panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/es/pokemon/pikachu');
    const aside = page.locator('app-pokemon-hero app-evolution-panel');
    await expect(aside.locator('div.stage')).toHaveCount(3);
    await expect(aside.getByRole('heading', { name: 'Evolución' })).toBeVisible();
    const identity = await page.locator('app-pokemon-hero .identity').boundingBox();
    const evolution = await aside.boundingBox();
    expect(evolution!.x).toBeGreaterThan(identity!.x + 200); // columna aparte, a la derecha de la identidad
    expect(Math.abs(evolution!.y - identity!.y)).toBeLessThan(200); // en la misma franja
    await expect(page.getByRole('heading', { name: 'Evolución' })).toHaveCount(1); // y sin panel duplicado más abajo
  });

  test('un Pokémon sin evolución no deja columna vacía', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/es/pokemon/mew');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mew');
    await expect(page.locator('app-pokemon-hero app-evolution-panel')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Evolución' })).toHaveCount(0);
  });

  test('en una pantalla estrecha la evolución baja bajo la identidad', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/es/pokemon/pikachu');
    const identity = await page.locator('app-pokemon-hero .identity').boundingBox();
    const aside = page.locator('app-pokemon-hero app-evolution-panel');
    await expect(aside.locator('div.stage')).toHaveCount(3);
    expect((await aside.boundingBox())!.y).toBeGreaterThan(identity!.y + identity!.height - 1);
  });

  test('Eevee muestra sus 8 ramas en la cabecera sin desbordar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/es/pokemon/eevee');
    const aside = page.locator('app-pokemon-hero app-evolution-panel');
    await expect(aside.locator('div.stage')).toHaveCount(9);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('la API separa núcleo y evolución, con miniatura y caché larga', async ({ request }) => {
    const core = await request.get('/api/pokemon/pikachu?lang=es');
    const body = await core.json();
    expect(body).not.toHaveProperty('evolution');
    expect(body.thumbUrl).toMatch(/\/25\.png$/);
    expect(core.headers()['cache-control']).toContain('max-age=3600');
    const evolution = await request.get('/api/pokemon/pikachu/evolution?lang=es');
    expect((await evolution.json()).name).toBe('pichu');
    // da lo mismo si se pide por número o por nombre
    expect((await (await request.get('/api/pokemon/25?lang=es')).json()).name).toBe('pikachu');
  });

  test('el servidor comprime HTML, JS y CSS', async ({ request }) => {
    const gzip = { 'accept-encoding': 'gzip' };
    const page = await request.get('/es/pokemon/pikachu', { headers: gzip });
    expect(page.headers()['content-encoding']).toBe('gzip');
    const doc = await (await request.get('/es/pokemon/pikachu')).text();
    /** Saca del HTML el nombre del archivo (con su hash) que calza con el patrón, porque el hash cambia en cada build. */
    const asset = (re: RegExp) => doc.match(re)![0];
    for (const file of [asset(/main-[A-Z0-9]+\.js/), asset(/styles-[A-Z0-9]+\.css/)]) {
      const res = await request.get(`/es/${file}`, { headers: gzip });
      expect(res.headers()['content-encoding'], file).toBe('gzip');
    }
  });

  test('service worker: el grupo del detalle no capta el catálogo ni los filtros', async ({
    request,
  }) => {
    const manifest = await (await request.get('/es/ngsw.json')).json();
    const group = manifest.dataGroups.find((g: { name: string }) => g.name === 'detail');
    expect(group.strategy).toBe('performance');
    // Ojo: el service worker compara el *pathname* (sin query) con cada patrón.
    const matches = (url: string) =>
      (group.patterns as string[]).some((pattern) =>
        new RegExp(pattern).test(new URL(url).pathname),
      );
    expect(matches('http://localhost:4000/api/pokemon/pikachu?lang=es')).toBe(true);
    expect(matches('http://localhost:4000/api/pokemon/pikachu/evolution?lang=es')).toBe(true);
    expect(matches('http://localhost:4000/api/pokemon?offset=0&limit=24&lang=es')).toBe(false);
    expect(matches('http://localhost:4000/api/filters?lang=es')).toBe(false);
    // y va antes que el grupo genérico del catálogo (gana el primero que calza)
    const names = manifest.dataGroups.map((g: { name: string }) => g.name);
    expect(names.indexOf('detail')).toBeLessThan(names.indexOf('api'));
  });
});

test.describe('idiomas', () => {
  test('la raíz redirige según Accept-Language', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/en\/?$/);
    await context.close();
  });

  test('interfaz y datos en inglés', async ({ page }) => {
    await page.goto('/en/pokemon/pikachu');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Mouse Pokémon')).toBeVisible();
    await expect(page.locator('app-type-chip').first()).toHaveText('Electric');
    await expect(page.getByRole('heading', { name: 'Base stats' })).toBeVisible();
    await expect(page.getByText('Thunder Stone')).toBeVisible();
  });

  test('el selector de idioma conserva la página', async ({ page }) => {
    await page.goto('/es/pokemon/pikachu');
    await page.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/pokemon\/pikachu$/);
    await expect(page.getByRole('heading', { name: 'Base stats' })).toBeVisible();
    await expect(page.locator('div.stage')).toHaveCount(3); // la evolución solo se pide una vez que la página quedó hidratada
    await page.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(/\/es\/pokemon\/pikachu$/);
  });

  test('el HTML llega renderizado desde el servidor (SSR)', async ({ request }) => {
    const html = await (await request.get('/es/pokemon/pikachu')).text();
    expect(html).toContain('<h1');
    expect(html).toContain('Electricidad Estática');
    expect(html).toContain('<title>Pikachu · Explorador de Pokémon</title>');
  });
});

test.describe('accesibilidad (axe, WCAG 2.1 AA)', () => {
  for (const [name, path, ready] of [
    ['catálogo', '/es/', 'app-pokemon-card'],
    ['catálogo en inglés', '/en/', 'app-pokemon-card'],
    ['detalle', '/es/pokemon/pikachu', 'app-stat-bar'],
    ['no encontrado', '/es/pokemon/no-existe', 'app-state-message'],
  ] as const) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await page.locator(ready).first().waitFor();
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }

  test('responsive: sin scroll horizontal a 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of ['/es/', '/es/pokemon/eevee']) {
      await page.goto(path);
      await page.locator('app-pokemon-card, app-stat-bar').first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('PWA y sin conexión', () => {
  test.use({ serviceWorkers: 'allow' });

  test('páginas ya visitadas siguen disponibles sin red y se avisa', async ({ page, context }) => {
    await page.goto('/es/');
    await expect(cards(page)).toHaveCount(24);
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Con el SW activo, la siguiente carga ya se renderiza en el cliente y de paso llena la caché de datos de /api.
    await page.reload();
    await expect(cards(page)).toHaveCount(24);
    await page.getByLabel('Buscar por nombre').fill('pika');
    await expect(cards(page).first()).toContainText('Pikachu');
    await cards(page).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu');

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pikachu');
    await expect(page.getByText('Sin conexión')).toBeVisible();
    await context.setOffline(false);
  });

  test('publica un manifest instalable', async ({ request }) => {
    const manifest = await (await request.get('/es/manifest.webmanifest')).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
  });
});

test.describe('API del BFF', () => {
  test('Swagger y health disponibles; /api reenviado por el servidor web', async ({ request }) => {
    expect((await request.get('/api/health')).ok()).toBe(true);
    const res = await request.get('/api/pokemon?q=pikachu&limit=1&lang=es');
    expect(res.headers()['x-cache']).toMatch(/HIT|MISS/);
    expect((await res.json()).total).toBe(17);
  });
});
