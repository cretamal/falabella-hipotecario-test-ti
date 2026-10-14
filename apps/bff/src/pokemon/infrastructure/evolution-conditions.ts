import type { Lang } from '@pokedex/contracts';
import { formatName } from '../../common/text.js';
import type { RawEvolutionDetail } from './pokeapi.types.js';

/** Resuelve etiquetas traducidas de recursos de PokéAPI (item, evolution-trigger…). */
export type LabelOf = (
  resource: 'item' | 'evolution-trigger',
  name: string,
) => Promise<string>;

/**
 * Los textos de las condiciones de evolución por idioma. Para sumar un idioma basta con agregar su bloque, así de simple.
 */
const TEXT = {
  es: {
    level: (n: number) => `Nivel ${n}`,
    happiness: (n: number) => `Amistad ${n}`,
    affection: (n: number) => `Afecto ${n}`,
    beauty: (n: number) => `Belleza ${n}`,
    move: (m: string) => `Conociendo ${m}`,
    moveType: (t: string) => `Conociendo un movimiento de tipo ${t}`,
    location: (l: string) => `En ${l}`,
    holding: (i: string) => `Sosteniendo ${i}`,
    tradeFor: (s: string) => `Intercambio por ${s}`,
    party: (s: string) => `Con ${s} en el equipo`,
    time: { day: 'De día', night: 'De noche', dusk: 'Al atardecer' } as Record<
      string,
      string
    >,
    gender: { 1: 'Hembra', 2: 'Macho' } as Record<number, string>,
    rain: 'Con lluvia',
    upsideDown: 'Con la consola boca abajo',
  },
  en: {
    level: (n: number) => `Level ${n}`,
    happiness: (n: number) => `Friendship ${n}`,
    affection: (n: number) => `Affection ${n}`,
    beauty: (n: number) => `Beauty ${n}`,
    move: (m: string) => `Knowing ${m}`,
    moveType: (t: string) => `Knowing a ${t}-type move`,
    location: (l: string) => `At ${l}`,
    holding: (i: string) => `Holding ${i}`,
    tradeFor: (s: string) => `Traded for ${s}`,
    party: (s: string) => `With ${s} in the party`,
    time: {
      day: 'During the day',
      night: 'At night',
      dusk: 'At dusk',
    } as Record<string, string>,
    gender: { 1: 'Female', 2: 'Male' } as Record<number, string>,
    rain: 'While raining',
    upsideDown: 'Holding the console upside down',
  },
} satisfies Record<Lang, unknown>;

/**
 * Una cadena por cada forma alternativa de evolucionar ("Nivel 16", "Piedra Trueno", "Intercambio"…). Lo que PokéAPI no
 * traduce (movimientos, lugares, especies) lo mostramos con su clave formateada, no hay otra.
 */
export async function describeEvolution(
  details: RawEvolutionDetail[],
  lang: Lang,
  labelOf: LabelOf,
): Promise<string[]> {
  const t = TEXT[lang];
  const described = await Promise.all(
    details.map(async (d) => {
      const parts: string[] = [];
      if (d.item) parts.push(await labelOf('item', d.item.name));
      if (d.trigger.name === 'trade')
        parts.push(await labelOf('evolution-trigger', 'trade'));
      if (d.min_level) parts.push(t.level(d.min_level));
      if (d.min_happiness) parts.push(t.happiness(d.min_happiness));
      if (d.min_affection) parts.push(t.affection(d.min_affection));
      if (d.min_beauty) parts.push(t.beauty(d.min_beauty));
      if (d.known_move) parts.push(t.move(formatName(d.known_move.name)));
      if (d.known_move_type)
        parts.push(t.moveType(formatName(d.known_move_type.name)));
      if (d.location) parts.push(t.location(formatName(d.location.name)));
      if (d.held_item)
        parts.push(t.holding(await labelOf('item', d.held_item.name)));
      if (d.trade_species)
        parts.push(t.tradeFor(formatName(d.trade_species.name)));
      if (d.party_species)
        parts.push(t.party(formatName(d.party_species.name)));
      if (d.time_of_day)
        parts.push(t.time[d.time_of_day] ?? formatName(d.time_of_day));
      if (d.gender) parts.push(t.gender[d.gender] ?? '');
      if (d.needs_overworld_rain) parts.push(t.rain);
      if (d.turn_upside_down) parts.push(t.upsideDown);
      if (parts.length === 0)
        parts.push(await labelOf('evolution-trigger', d.trigger.name));
      return parts.filter(Boolean).join(' · ');
    }),
  );
  return [...new Set(described)];
}
