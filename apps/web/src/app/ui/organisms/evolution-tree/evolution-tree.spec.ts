import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { EvolutionNode } from '@pokedex/contracts';
import { EvolutionTree } from './evolution-tree';

/** Un nodo de evolución de mentira. */
const node = (
  id: number,
  name: string,
  evolvesTo: EvolutionNode[] = [],
  conditions: string[] = [],
): EvolutionNode => ({
  id,
  name,
  label: name,
  imageUrl: `${id}.png`,
  conditions,
  evolvesTo,
});

const EEVEE = node(133, 'eevee', [
  node(134, 'vaporeon', [], ['Piedra Agua']),
  node(135, 'jolteon', [], ['Piedra Trueno']),
  node(136, 'flareon', [node(999, 'mega-flareon', [], ['Nivel 50'])], ['Piedra Fuego']),
]);

/** Pinta el árbol de Eevee dejando como actual al Pokémon indicado. */
function render(currentName: string) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'pokemon/:name', children: [] }])],
  });
  const fixture = TestBed.createComponent(EvolutionTree);
  fixture.componentRef.setInput('node', EEVEE);
  fixture.componentRef.setInput('currentName', currentName);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('EvolutionTree (organismo)', () => {
  it('pinta todas las etapas, incluidas las ramas anidadas, con su condición', () => {
    const el = render('eevee');
    const stages = Array.from(el.querySelectorAll('div.stage')).map((a) => a.textContent?.trim());
    expect(stages).toEqual(['eevee', 'vaporeon', 'jolteon', 'flareon', 'mega-flareon']);
    expect(el.textContent).toContain('Piedra Trueno');
    expect(el.textContent).toContain('Nivel 50');
  });

  it('cada etapa navega al detalle por id de especie (clic y teclado)', async () => {
    const el = render('eevee');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    /** Busca la etapa del árbol por su nombre. */
    const stage = (label: string) =>
      Array.from(el.querySelectorAll<HTMLElement>('div.stage')).find(
        (s) => s.textContent?.trim() === label,
      )!;
    expect(stage('jolteon').getAttribute('role')).toBe('link');

    stage('jolteon').click();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(router.url).toBe('/pokemon/135');

    stage('mega-flareon').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await TestBed.inject(ApplicationRef).whenStable();
    expect(router.url).toBe('/pokemon/999');
  });

  it('resalta la etapa actual, también cuando se ve una de sus formas', () => {
    /** Los nombres de las etapas marcadas como actuales para un Pokémon dado. */
    const current = (name: string) =>
      Array.from(render(name).querySelectorAll('div.stage[aria-current="page"]')).map((a) =>
        a.textContent?.trim(),
      );
    expect(current('jolteon')).toEqual(['jolteon']);
    expect(current('flareon-gmax')).toEqual(['flareon']);
  });

  it('el modo compacto llega a todas las ramas y etapas', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'pokemon/:name', children: [] }])],
    });
    const fixture = TestBed.createComponent(EvolutionTree);
    fixture.componentRef.setInput('node', EEVEE);
    fixture.componentRef.setInput('currentName', 'eevee');
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList).toContain('compact');
    expect(el.querySelectorAll('app-evolution-tree.compact')).toHaveLength(4); // 3 hijas + mega-flareon… menos la raíz
    expect(el.querySelectorAll('app-evolution-stage.compact')).toHaveLength(5);
    expect(el.querySelector('img')?.getAttribute('width')).toBe('48');
  });

  describe('muchas ramas (más de 3)', () => {
    /** Pinta un árbol con tantas ramas como se pida, cada una con tres condiciones. */
    const wide = (count: number) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: 'pokemon/:name', children: [] }])],
      });
      const fixture = TestBed.createComponent(EvolutionTree);
      const kids = Array.from({ length: count }, (_, i) =>
        node(200 + i, `k${i}`, [], ['Lugar A', 'Lugar B', 'Lugar C']),
      );
      fixture.componentRef.setInput('node', node(133, 'eevee', kids));
      fixture.componentRef.setInput('currentName', 'eevee');
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('con 4 o más ramas usa la rejilla, con un solo conector y condiciones plegables', () => {
      const el = wide(8);
      expect(el.classList).toContain('wide');
      expect(el.querySelectorAll('div.stage')).toHaveLength(9);
      expect(el.querySelectorAll('.down')).toHaveLength(1);
      expect(el.querySelectorAll('app-evolution-conditions')).toHaveLength(8);
      expect(el.querySelectorAll('.condition')).toHaveLength(8); // solo se ve la primera condición de cada rama
    });

    it('con 3 ramas mantiene el árbol lineal', () => {
      const el = render('eevee');
      expect(el.classList).not.toContain('wide');
      expect(el.querySelector('app-evolution-conditions')).toBeNull();
    });
  });
});
