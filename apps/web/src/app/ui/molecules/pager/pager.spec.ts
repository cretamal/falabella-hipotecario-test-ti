import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Pager } from './pager';

/** Pinta el paginador en la página dada, con un router de prueba parado en una búsqueda. */
async function render(page: number, totalPages: number) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/?q=pika');
  const fixture = TestBed.createComponent(Pager);
  fixture.componentRef.setInput('page', page);
  fixture.componentRef.setInput('totalPages', totalPages);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  /** Busca un enlace de la paginación por su texto. */
  const link = (text: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="link"]')).find(
      (l) => l.textContent?.trim() === text,
    );
  return { el, router, link, fixture };
}

describe('Pager', () => {
  it('primera página: sin «Anterior» navegable; «Siguiente» avanza y conserva la búsqueda', async () => {
    const { el, router, link, fixture } = await render(1, 5);
    expect(link('Anterior')).toBeUndefined();
    expect(el.textContent).toContain('1 de 5');
    link('Siguiente')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/?q=pika&page=2');
  });

  it('última página: sin «Siguiente» navegable; «Anterior» retrocede', async () => {
    const { el, router, link, fixture } = await render(5, 5);
    expect(link('Siguiente')).toBeUndefined();
    expect(el.querySelectorAll('[aria-disabled="true"]')).toHaveLength(1);
    link('Anterior')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/?q=pika&page=4');
  });

  it('se puede usar con el teclado (Enter)', async () => {
    const { router, link, fixture } = await render(2, 5);
    link('Siguiente')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(router.url).toBe('/?q=pika&page=3');
  });

  it('página única: ambos deshabilitados', async () => {
    const { el } = await render(1, 1);
    expect(el.querySelectorAll('[aria-disabled="true"]')).toHaveLength(2);
    expect(el.querySelectorAll('[role="link"]')).toHaveLength(0);
  });
});
