/**
 * Herramienta de desarrollo (no es un test): perfila el detalle contra la PokéAPI real, llamada por llamada.
 *   npx tsx test/profile-detail.mts [nombre ...]      (por defecto: eevee charizard bulbasaur dragonite mewtwo)
 * Escenarios por Pokémon (cada uno parte con la caché vacía):
 *   A · arranque en frío, sin pista de especie: lo que le tocaba pagar al primer visitante
 *   B · después del calentamiento (índice + etiquetas de estadísticas) y con pista: el caso normal
 */
import { createCache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { memoryStore } from '../src/config/cache-store.ts';
import { configuration } from '../src/config/configuration.ts';
import { Memoizer } from '../src/common/memoizer.ts';
import { PokeApiClient } from '../src/pokemon/infrastructure/pokeapi.client.ts';
import { PokeApiSource } from '../src/pokemon/infrastructure/pokeapi.source.ts';

/** El registro de cada llamada a PokéAPI y lo que se demoró. */
const log: { url: string; ms: number }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init: unknown) => {
  const start = performance.now();
  const response = await realFetch(url as string, init as RequestInit);
  log.push({
    url: String(url).replace(/^.*\/api\/v2/, ''),
    ms: Math.round(performance.now() - start),
  });
  return response;
}) as typeof fetch;

/** Crea un adaptador nuevo con la caché vacía, para medir cada escenario desde cero. */
const make = () => {
  const cfg = new ConfigService({ ...configuration() });
  const memo = new Memoizer(createCache({ stores: [memoryStore() as never] }));
  return new PokeApiSource(
    new PokeApiClient(cfg as never, memo),
    memo,
    cfg as never,
  );
};

/** Ejecuta algo y devuelve su resultado, cuánto se demoró y cuántas llamadas hizo. */
async function time<T>(run: () => Promise<T>) {
  log.length = 0;
  const start = performance.now();
  const value = await run();
  return {
    value,
    ms: Math.round(performance.now() - start),
    calls: log.length,
  };
}

const names = process.argv.slice(2);
const targets = names.length
  ? names
  : ['eevee', 'charizard', 'bulbasaur', 'dragonite', 'mewtwo'];
const rows: string[] = [];

const index = await make().fetchIndex();
/** La especie de un Pokémon según el índice (simula la pista que entrega el servicio). */
const speciesOf = (name: string) =>
  index.entries.find((e) => e.name === name)?.species ?? undefined;

for (const name of targets) {
  const cold = await time(() => make().fetchDetail(name, 'es'));
  const coldEvo = await time(() => make().fetchEvolution(name, 'es'));

  const source = make();
  await source.fetchIndex();
  await source.warm();
  const hint = speciesOf(name);
  log.length = 0;
  const start = performance.now();
  const core = source
    .fetchDetail(name, 'es', hint)
    .then(() => Math.round(performance.now() - start));
  const evolution = source
    .fetchEvolution(name, 'es', hint)
    .then(() => Math.round(performance.now() - start));
  const [coreMs, evolutionMs] = await Promise.all([core, evolution]);
  rows.push(
    `${name.padEnd(11)}| A detalle ${String(cold.ms).padStart(5)} ms (${cold.calls} llamadas) · evolución ${String(coldEvo.ms).padStart(5)} ms (${coldEvo.calls}) ` +
      `| B núcleo ${String(coreMs).padStart(5)} ms · evolución ${String(evolutionMs).padStart(5)} ms (${log.length} llamadas en total)`,
  );
}
console.log(rows.join('\n'));
