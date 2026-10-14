import type { EvolutionNode } from '@pokedex/contracts';

/** El máximo de etapas que se precargan solas; el resto se pide al pasar el cursor por la etapa. */
export const MAX_EVOLUTION_PREFETCH = 4;

/**
 * La misma regla que usa el árbol (`deoxys-attack` es la etapa `deoxys`); la URL también puede venir con el número.
 */
const isCurrent = (node: EvolutionNode, current: string) =>
  current === node.name || current === String(node.id) || current.startsWith(`${node.name}-`);

/**
 * Entrega los ids (tal como los usa el enlace de cada etapa) de las etapas a precargar, de la más cercana a la más
 * lejana (primero padre e hijos), sin contar la actual. Queda vacío si la actual no está en la cadena.
 */
export function evolutionTargets(
  root: EvolutionNode,
  current: string,
  max = MAX_EVOLUTION_PREFETCH,
): string[] {
  const order: EvolutionNode[] = [];
  const parent = new Map<EvolutionNode, EvolutionNode>();
  let here: EvolutionNode | undefined;
  /** Recorre el árbol anotando el orden, el padre de cada nodo y cuál es la etapa actual. */
  const walk = (node: EvolutionNode) => {
    order.push(node);
    if (isCurrent(node, current)) here = node;
    for (const child of node.evolvesTo) {
      parent.set(child, node);
      walk(child);
    }
  };
  walk(root);
  if (!here) return [];

  // Distancia en el árbol (sin dirección) desde la etapa actual.
  const distance = new Map<EvolutionNode, number>([[here, 0]]);
  const queue: EvolutionNode[] = [here];
  for (const node of queue) {
    const near = [...node.evolvesTo, ...(parent.has(node) ? [parent.get(node)!] : [])];
    for (const next of near) {
      if (distance.has(next)) continue;
      distance.set(next, distance.get(node)! + 1);
      queue.push(next);
    }
  }
  return order
    .filter((node) => node !== here)
    .sort((a, b) => distance.get(a)! - distance.get(b)!) // estable: a igual distancia se mantiene el orden del árbol
    .slice(0, max)
    .map((node) => String(node.id));
}
