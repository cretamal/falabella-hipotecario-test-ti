/** Le saca las tildes y otras marcas combinadas al texto, así "Pokémon" queda como "Pokemon". */
export const stripAccents = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '');

/**
 * Deja el texto tal como lo comparamos al buscar: en minúsculas, sin tildes y con cualquier separador reducido a un solo
 * espacio (por eso "Mr. Mime" calza con "mr-mime").
 */
export const normalizeSearch = (text: string): string =>
  stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Convierte un slug de PokéAPI en un nombre que se pueda leer: "mr-mime" queda como "Mr Mime". */
export const formatName = (slug: string): string =>
  slug
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');

/**
 * Limpia los textos de PokéAPI, que traen saltos de línea y espacios de más (acá los dejamos prolijos).
 */
export const cleanText = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

/**
 * Largo máximo de la búsqueda. El web usa el mismo valor y `packages/contracts/search-fixtures.json` se encarga de
 * que nunca se desalineen: si cambia uno, el test avisa al tiro.
 */
export const SEARCH_MAX_LENGTH = 50;

/** Saca los caracteres de control y recorta los bordes; lo demás lo interpreta `parseQuery`. */
export const cleanQuery = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
