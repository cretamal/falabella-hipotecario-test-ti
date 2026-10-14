import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HardLink, ROUTER_LINK } from './link';

/**
 * El componente anfitrión con los casos de enlace: `div` y `a` con `routerLink`, y el enlace duro.
 */
@Component({
  imports: [ROUTER_LINK, HardLink],
  template: `
    <div id="div" routerLink="/destino">Interno</div>
    <a id="anchor" routerLink="/destino">Ancla</a>
    <div id="hard" appHardLink="https://example.test/x" target="blank">Externo</div>
  `,
})
class Host {}

/** Monta el anfitrión con un router de prueba y entrega ayudas para buscar elementos. */
function setup() {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'destino', children: [] }])],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  /** Busca un elemento del anfitrión por su id. */
  const q = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${id}`)!;
  return { fixture, q, router: TestBed.inject(Router) };
}

describe('enlaces (átomos)', () => {
  it('div[routerLink]: rol link, enfocable, y navega con clic y con Enter', async () => {
    const { fixture, q, router } = setup();
    const el = q('div');
    expect(el.getAttribute('role')).toBe('link');
    expect(el.getAttribute('tabindex')).toBe('0');
    el.click();
    await fixture.whenStable();
    expect(router.url).toBe('/destino');

    await router.navigateByUrl('/');
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(router.url).toBe('/destino');
  });

  it('un <a routerLink> conserva su semántica nativa (sin rol añadido)', () => {
    const { q } = setup();
    expect(q('anchor').getAttribute('role')).toBeNull();
    expect(q('anchor').getAttribute('href')).toBe('/destino');
  });

  it('appHardLink: rol link, enfocable; abre pestaña nueva con target="blank" (clic y Enter)', () => {
    const { q } = setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const el = q('hard');
    expect(el.getAttribute('role')).toBe('link');
    expect(el.getAttribute('tabindex')).toBe('0');
    el.click();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith('https://example.test/x', '_blank', 'noopener,noreferrer');
    open.mockRestore();
  });
});
