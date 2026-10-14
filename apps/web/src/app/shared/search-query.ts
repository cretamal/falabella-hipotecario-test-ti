/**
 * Las reglas de la consulta de búsqueda (funciones puras, sin depender de Angular). Se repiten en el BFF
 * (`common/text.ts`); `packages/contracts/search-fixtures.json` cuida que ambos lados sigan iguales.
 */
export const SEARCH_MAX_LENGTH = 50;
/** El largo mínimo para buscar por texto. */
export const SEARCH_MIN_LENGTH = 2;

/**
 * El texto tal como se guarda en la URL: sin caracteres de control, con los espacios colapsados y recortado.
 */
export const normalizeQuery = (text: string): string =>
  text
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_MAX_LENGTH)
    .trim();

/** La clave canónica (la misma que `normalizeSearch` del BFF): "Mr. Mime" ≡ "mr-mime". */
export const searchKey = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Se puede buscar con 2 o más caracteres, o con un solo dígito (número de Pokémon). */
export const isSearchable = (text: string): boolean => {
  const key = searchKey(text);
  return key.length >= SEARCH_MIN_LENGTH || /^\d$/.test(key);
};

/** Hay texto, pero muy corto: se avisa en vez de buscar. */
export const isTooShort = (text: string): boolean =>
  searchKey(text).length > 0 && !isSearchable(text);
