import { TestBed } from '@angular/core/testing';
import { LanguageSwitch } from './language-switch';

describe('LanguageSwitch (molécula)', () => {
  it('lista los idiomas como enlaces accesibles y marca el activo', () => {
    const fixture = TestBed.createComponent(LanguageSwitch);
    fixture.componentRef.setInput('options', [
      { id: 'es', label: 'Español' },
      { id: 'en', label: 'English' },
    ]);
    fixture.componentRef.setInput('active', 'es');
    fixture.componentRef.setInput('hrefFor', (id: string) => `/${id}/x`);
    fixture.detectChanges();
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="link"]'),
    );
    expect(
      links.map((l) => [
        l.textContent?.trim(),
        l.getAttribute('lang'),
        l.getAttribute('aria-current'),
      ]),
    ).toEqual([
      ['Español', 'es', 'true'],
      ['English', 'en', null],
    ]);
    expect(links.every((l) => l.getAttribute('tabindex') === '0')).toBe(true);
  });
});
