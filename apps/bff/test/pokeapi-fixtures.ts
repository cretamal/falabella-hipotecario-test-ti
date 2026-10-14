/**
 * Respuestas de PokéAPI (mínimas, pero con su forma real) que comparten los tests del adaptador, así no las repetimos.
 */
export const BASE = 'https://pokeapi.co/api/v2';
/** Una referencia a un recurso tal como la entrega PokéAPI: nombre y URL. */
export const ref = (kind: string, name: string, id?: number) => ({
  name,
  url: `${BASE}/${kind}/${id ?? name}/`,
});
/** Una lista de nombres traducidos (español e inglés). */
export const names = (es: string, en: string) => [
  { name: es, language: { name: 'es' } },
  { name: en, language: { name: 'en' } },
];
/** Una entrada de texto (descripción o categoría) en un idioma. */
export const entry = (flavor_text: string, lang: string) => ({
  flavor_text,
  language: { name: lang },
});

/** El detalle de una evolución por subida de nivel. */
export const level = (n: number) => ({
  trigger: ref('evolution-trigger', 'level-up'),
  min_level: n,
});
/**
 * Un detalle de evolución con todas las condiciones en blanco, para ir llenando solo la que importa.
 */
export const none = {
  item: null,
  held_item: null,
  min_level: null,
  min_happiness: null,
  min_affection: null,
  min_beauty: null,
  time_of_day: '',
  known_move: null,
  known_move_type: null,
  location: null,
  gender: null,
  needs_overworld_rain: false,
  turn_upside_down: false,
  trade_species: null,
  party_species: null,
};
/** Un detalle de evolución a partir de `none`, más las condiciones que le pasemos. */
export const detail = (d: object) => ({ ...none, ...d });

/** Respuestas de PokéAPI por ruta; el `fetch` falso de los tests las busca acá. */
export const FIXTURES: Record<string, unknown> = {
  /** Alias: la especie se pide por nombre y por número, y las dos rutas devuelven lo mismo. */
  get '/pokemon-species/pikachu'() {
    return FIXTURES['/pokemon-species/25'];
  },
  '/pokemon?limit=100000': {
    results: [
      ref('pokemon', 'bulbasaur', 1),
      ref('pokemon', 'mr-mime-galar', 10168),
      ref('pokemon', 'pikachu', 25),
      ref('pokemon', 'mr-mime', 122),
    ],
  },
  '/type?limit=100': {
    results: [
      ref('type', 'grass'),
      ref('type', 'poison'),
      ref('type', 'shadow'),
      ref('type', 'psychic'),
    ],
  },
  '/type/grass': {
    names: names('Planta', 'Grass'),
    pokemon: [{ slot: 1, pokemon: ref('pokemon', 'bulbasaur', 1) }],
  },
  '/type/poison': {
    names: names('Veneno', 'Poison'),
    pokemon: [{ slot: 2, pokemon: ref('pokemon', 'bulbasaur', 1) }],
  },
  '/type/shadow': { names: names('Sombra', 'Shadow'), pokemon: [] },
  '/type/psychic': {
    names: [{ name: 'Psychic', language: { name: 'en' } }],
    pokemon: [
      { slot: 1, pokemon: ref('pokemon', 'mr-mime', 122) },
      { slot: 1, pokemon: ref('pokemon', 'mr-mime-galar', 10168) },
    ],
  },
  '/generation?limit=100': {
    results: [
      ref('generation', 'generation-ii', 2),
      ref('generation', 'generation-i', 1),
    ],
  },
  '/generation/generation-i': {
    id: 1,
    names: names('Generación I', 'Generation I'),
    pokemon_species: [
      ref('pokemon-species', 'bulbasaur'),
      ref('pokemon-species', 'pikachu'),
      ref('pokemon-species', 'mr-mime'),
    ],
  },
  '/generation/generation-ii': {
    id: 2,
    names: names('Generación II', 'Generation II'),
    pokemon_species: [],
  },

  '/pokemon/pikachu': {
    id: 25,
    name: 'pikachu',
    height: 4,
    weight: 60,
    types: [{ type: ref('type', 'electric') }],
    abilities: [
      { ability: ref('ability', 'static'), is_hidden: false },
      { ability: ref('ability', 'lightning-rod'), is_hidden: true },
    ],
    stats: [
      { base_stat: 35, stat: ref('stat', 'hp') },
      { base_stat: 90, stat: ref('stat', 'speed') },
    ],
    species: ref('pokemon-species', 'pikachu', 25),
    sprites: {
      front_default: 'front.png',
      other: { 'official-artwork': { front_default: null } },
    },
  },
  '/pokemon-species/25': {
    id: 25,
    names: names('Pikachú', 'Pikachu'),
    genera: [
      { genus: 'Pokémon Ratón', language: { name: 'es' } },
      { genus: 'Mouse Pokémon', language: { name: 'en' } },
    ],
    flavor_text_entries: [
      entry('Antiguo\ntexto', 'es'),
      entry('Texto\fmás   reciente\nen español', 'es'),
      entry('English text', 'en'),
    ],
    generation: ref('generation', 'generation-i', 1),
    evolution_chain: { url: `${BASE}/evolution-chain/10/` },
    is_legendary: false,
    is_mythical: false,
  },
  '/evolution-chain/10': {
    chain: {
      species: ref('pokemon-species', 'pichu', 172),
      evolution_details: [],
      evolves_to: [
        {
          species: ref('pokemon-species', 'pikachu', 25),
          evolution_details: [
            detail({
              trigger: ref('evolution-trigger', 'level-up'),
              min_happiness: 220,
            }),
          ],
          evolves_to: [
            {
              species: ref('pokemon-species', 'raichu', 26),
              evolution_details: [
                detail({
                  trigger: ref('evolution-trigger', 'use-item'),
                  item: ref('item', 'thunder-stone'),
                }),
              ],
              evolves_to: [],
            },
            {
              species: ref('pokemon-species', 'raichu-alola', 10100),
              evolution_details: [detail(level(30)), detail(level(30))],
              evolves_to: [],
            },
          ],
        },
      ],
    },
  },
  '/type/electric': { names: names('Eléctrico', 'Electric'), pokemon: [] },
  '/ability/static': { names: names('Electricidad Estática', 'Static') },
  '/ability/lightning-rod': {
    names: [{ name: 'Lightning Rod', language: { name: 'en' } }],
  },
  '/stat/hp': { names: names('PS', 'HP') },
  '/stat/speed': { names: names('Velocidad', 'Speed') },
  '/item/thunder-stone': { names: names('Piedra Trueno', 'Thunder Stone') },
  '/evolution-trigger/level-up': { names: names('Subir de nivel', 'Level up') },
};

/** Una respuesta HTTP JSON de mentira, con el estado que se le pida. */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
