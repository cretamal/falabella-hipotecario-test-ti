import type { EvolutionNode } from '@pokedex/contracts';
import { isWide } from './evolution-layout';

/** Un nodo de evolución de mentira. */
const node = (n: number, evolvesTo: EvolutionNode[] = []): EvolutionNode => ({
  id: n,
  name: `p${n}`,
  label: `p${n}`,
  imageUrl: '',
  conditions: [],
  evolvesTo,
});
/** Genera la cantidad pedida de nodos hijos. */
const kids = (count: number) => Array.from({ length: count }, (_, i) => node(i + 10));

describe('evolution-layout', () => {
  it('es ancho solo con más de 3 ramas', () => {
    expect(isWide(node(1, kids(3)))).toBe(false);
    expect(isWide(node(1, kids(4)))).toBe(true);
  });
});
