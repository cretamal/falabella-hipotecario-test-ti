import type { EvolutionNode } from '@pokedex/contracts';

/**
 * Con más ramas que estas (Eevee) ya no caben en una fila: se reparten en una rejilla bajo la etapa de origen.
 */
export const WIDE_BRANCHES = 3;

/** ¿Este nodo tiene tantas ramas que conviene mostrarlas en rejilla? */
export const isWide = (node: EvolutionNode): boolean => node.evolvesTo.length > WIDE_BRANCHES;
