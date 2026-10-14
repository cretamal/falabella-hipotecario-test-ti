import type { Lang } from '@pokedex/contracts';

/** Los idiomas en los que sabemos responder (por ahora, español e inglés). */
export const SUPPORTED_LANGS: readonly Lang[] = ['es', 'en'];
/** El idioma al que echamos mano cuando no hay cómo deducir otro. */
export const DEFAULT_LANG: Lang = 'es';

/**
 * Decide en qué idioma le respondemos al cliente. La idea es simple: manda `?lang=` si viene; si no, miramos
 * `Accept-Language` (respetando los pesos `q=`) y nos quedamos con el mejor idioma que soportamos; y si nada calza,
 * español y listo.
 */
export function resolveLang(queryLang?: string, acceptLanguage?: string): Lang {
  if (queryLang && (SUPPORTED_LANGS as readonly string[]).includes(queryLang))
    return queryLang as Lang;
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return {
        lang: tag.trim().slice(0, 2).toLowerCase(),
        q: q ? Number(q.trim().slice(2)) : 1,
      };
    })
    .filter(
      (entry) =>
        entry.q > 0 &&
        (SUPPORTED_LANGS as readonly string[]).includes(entry.lang),
    )
    .sort((a, b) => b.q - a.q);
  return (ranked[0]?.lang as Lang | undefined) ?? DEFAULT_LANG;
}
