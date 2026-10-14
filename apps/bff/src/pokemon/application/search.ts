import type { IndexEntry } from './pokemon-source.port.js';
import { normalizeSearch } from '../../common/text.js';

/** Una entrada del índice con sus claves de búsqueda ya calculadas (se arma una vez por índice). */
export interface SearchEntry {
  id: number;
  name: string;
  /** El nombre normalizado, tal como se compara: "mr mime". */
  key: string;
  words: string[];
  types: string[];
  generation: number | null;
  species: string | null;
}

/**
 * Precalcula las claves de búsqueda de todo el índice. Se hace una vez por índice y no en cada petición: normalizar
 * 1.350 nombres por búsqueda era plata botada.
 */
export const buildSearchEntries = (entries: IndexEntry[]): SearchEntry[] =>
  entries.map((entry) => {
    const key = normalizeSearch(entry.name);
    return { ...entry, key, words: key.split(' ') };
  });

/**
 * La consulta ya interpretada: sin filtro de texto (`all`), imposible de calzar (`none`) o texto a buscar.
 */
export type ParsedQuery =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'text'; needle: string; tokens: string[]; id: number | null };

/**
 * Consulta vacía → sin filtro. Texto que se reduce a nada ("!!!") → sin resultados, jamás el catálogo entero (ojo
 * acá, que es un error fácil). Una consulta numérica ("25", "#025") también busca por id.
 */
export function parseQuery(raw: string | undefined): ParsedQuery {
  if (!raw || !raw.trim()) return { kind: 'all' };
  const needle = normalizeSearch(raw);
  if (!needle) return { kind: 'none' };
  return {
    kind: 'text',
    needle,
    tokens: needle.split(' '),
    id: /^\d{1,4}$/.test(needle) ? Number(needle) : null,
  };
}

/**
 * Niveles de relevancia, de mejor a peor: mientras menor el número, más arriba queda en la lista.
 */
const EXACT = 0;
const PREFIX = 1;
const WORD = 2;
const SUBSTRING = 3;
const FUZZY = 4;

/** Puntúa una entrada (menor = más relevante) o devuelve -1 si no calza. */
export function score(
  entry: SearchEntry,
  q: Extract<ParsedQuery, { kind: 'text' }>,
): number {
  if (entry.id === q.id || entry.key === q.needle) return EXACT;
  if (entry.key.startsWith(q.needle)) return PREFIX;
  if (q.tokens.every((t) => entry.words.some((w) => w.startsWith(t))))
    return WORD;
  if (entry.key.includes(q.needle)) return SUBSTRING;
  return -1;
}

/**
 * Compara el resto de dos textos desde las posiciones dadas, sin crear subcadenas nuevas (barato y sin basura).
 */
const tailEquals = (a: string, ai: number, b: string, bi: number): boolean => {
  if (a.length - ai !== b.length - bi) return false;
  for (; ai < a.length; ai++, bi++) if (a[ai] !== b[bi]) return false;
  return true;
};

/**
 * Distancia de edición ≤ 1 (sustitución, inserción, borrado o dos letras seguidas cambiadas de lugar), sin armar
 * matrices: así sale barata y no pesa nada.
 */
export function withinOneEdit(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (i === la && i === lb) return true;
  if (la === lb) {
    if (tailEquals(a, i + 1, b, i + 1)) return true;
    return (
      a[i] === b[i + 1] && a[i + 1] === b[i] && tailEquals(a, i + 2, b, i + 2)
    );
  }
  return la > lb ? tailEquals(a, i + 1, b, i) : tailEquals(b, i + 1, a, i);
}

/** Detecta una errata en el nombre completo, en una palabra o en el prefijo de una palabra. */
export function fuzzyMatches(entry: SearchEntry, needle: string): boolean {
  if (withinOneEdit(entry.key, needle)) return true;
  return entry.words.some(
    (w) =>
      withinOneEdit(w, needle) ||
      (w.length > needle.length &&
        withinOneEdit(w.slice(0, needle.length), needle)),
  );
}

/**
 * Con menos caracteres que esto, los falsos positivos se toman la lista y la búsqueda deja de servir.
 */
export const FUZZY_MIN_LENGTH = 4;

/** El resultado de buscar: las coincidencias ya ordenadas y si vienen de la búsqueda aproximada. */
export interface SearchResult {
  matches: SearchEntry[];
  fuzzy: boolean;
}

/**
 * Filtra por tipo y generación y ordena por relevancia (y por id cuando empatan). Recorre todo una sola vez; la
 * búsqueda aproximada solo corre si no hubo ni una coincidencia.
 */
export function search(
  entries: SearchEntry[],
  parsed: ParsedQuery,
  filter: { type?: string; generation?: number },
): SearchResult {
  /** Aplica los filtros de tipo y generación a una entrada. */
  const eligible = (e: SearchEntry) =>
    (!filter.type || e.types.includes(filter.type)) &&
    (!filter.generation || e.generation === filter.generation);

  if (parsed.kind === 'none') return { matches: [], fuzzy: false };
  if (parsed.kind === 'all')
    return { matches: entries.filter(eligible), fuzzy: false };

  const scored: { s: number; e: SearchEntry }[] = [];
  for (const e of entries) {
    if (!eligible(e)) continue;
    const s = score(e, parsed);
    if (s >= 0) scored.push({ s, e });
  }
  if (scored.length === 0) {
    if (parsed.needle.length < FUZZY_MIN_LENGTH)
      return { matches: [], fuzzy: false };
    const matches = entries.filter(
      (e) => eligible(e) && fuzzyMatches(e, parsed.needle),
    );
    return { matches, fuzzy: matches.length > 0 };
  }
  // `entries` ya viene ordenado por id y el sort es estable: nos basta con ordenar por puntuación.
  scored.sort((a, b) => a.s - b.s);
  return { matches: scored.map((x) => x.e), fuzzy: false };
}

/** Los niveles de relevancia, expuestos para los tests y el benchmark. */
export const SCORES = { EXACT, PREFIX, WORD, SUBSTRING, FUZZY };
