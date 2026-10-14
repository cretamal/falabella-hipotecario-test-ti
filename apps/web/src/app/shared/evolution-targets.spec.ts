import type { EvolutionNode } from '@pokedex/contracts';
import { evolutionTargets } from './evolution-targets';

/** Un nodo de evolución de mentira, con nombre propio. */
const node = (id: number, name: string, evolvesTo: EvolutionNode[] = []): EvolutionNode => ({
  id,
  name,
  label: name,
  imageUrl: '',
  conditions: [],
  evolvesTo,
});

describe('evolutionTargets', () => {
  const chain = node(1, 'a', [node(2, 'b', [node(3, 'c')])]);

  it('ordena de la más cercana a la más lejana y excluye la actual', () => {
    expect(evolutionTargets(chain, 'b')).toEqual(['1', '3']);
    expect(evolutionTargets(chain, 'a')).toEqual(['2', '3']);
    expect(evolutionTargets(chain, 'c')).toEqual(['2', '1']);
  });

  it('reconoce las formas de la etapa actual', () => {
    expect(evolutionTargets(chain, 'b-alola')).toEqual(['1', '3']);
  });

  it('acepta el número en lugar del nombre (enlaces de las etapas)', () => {
    expect(evolutionTargets(chain, '2')).toEqual(['1', '3']);
  });

  it('limita la cantidad (cadenas anchas como Eevee)', () => {
    const wide = node(
      133,
      'eevee',
      Array.from({ length: 8 }, (_, i) => node(134 + i, `e${i}`)),
    );
    expect(evolutionTargets(wide, 'eevee')).toEqual(['134', '135', '136', '137']);
    expect(evolutionTargets(wide, 'e7')).toEqual(['133', '134', '135', '136']);
    expect(evolutionTargets(wide, 'eevee', 2)).toHaveLength(2);
  });

  it('sin la actual en la cadena o sin evolución no hay nada que precargar', () => {
    expect(evolutionTargets(chain, 'zzz')).toEqual([]);
    expect(evolutionTargets(node(151, 'mew'), 'mew')).toEqual([]);
  });
});
