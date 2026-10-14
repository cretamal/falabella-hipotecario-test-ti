import { TestBed } from '@angular/core/testing';
import { PokemonImage } from './pokemon-image';

/** Crea la imagen con los inputs indicados. */
function create(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(PokemonImage);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('PokemonImage (átomo)', () => {
  it('reserva el tamaño y es decorativa por defecto (alt vacío, carga perezosa)', () => {
    const img = create({ src: 'a.png', size: 96 }).el.querySelector('img')!;
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('96');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('acepta alt, carga inmediata y modo pixelado', () => {
    const img = create({
      src: 'a.png',
      size: 280,
      alt: 'Pikachu',
      eager: true,
      pixelated: true,
    }).el.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Pikachu');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.classList).toContain('pixelated');
  });

  it('muestra un marcador si la imagen falla y se recupera al cambiar de imagen', () => {
    const { fixture, el } = create({ src: 'rota.png', size: 96 });
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.placeholder')?.getAttribute('aria-hidden')).toBe('true');

    fixture.componentRef.setInput('src', 'buena.png');
    fixture.detectChanges();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('buena.png');
  });

  it('con eager pide la imagen con prioridad alta', () => {
    const img = create({ src: 'a.png', size: 96, eager: true }).el.querySelector('img')!;
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(
      create({ src: 'a.png', size: 96 }).el.querySelector('img')!.hasAttribute('fetchpriority'),
    ).toBe(false);
  });

  it('muestra la miniatura detrás hasta que carga la imagen principal', () => {
    const { fixture, el } = create({ src: 'big.png', size: 280, placeholder: 'thumb.png' });
    const thumb = el.querySelector<HTMLImageElement>('img.thumb')!;
    expect(thumb.getAttribute('src')).toBe('thumb.png');
    expect(thumb.getAttribute('aria-hidden')).toBe('true');
    expect(thumb.getAttribute('alt')).toBe('');

    el.querySelector<HTMLImageElement>('img.over')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(el.querySelector('img.thumb')).toBeNull();
  });

  it('sin miniatura no dibuja marcador', () => {
    expect(create({ src: 'a.png', size: 96 }).el.querySelector('img.thumb')).toBeNull();
  });
});
