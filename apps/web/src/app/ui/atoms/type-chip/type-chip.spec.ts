import { TestBed } from '@angular/core/testing';
import { TypeChip } from './type-chip';

describe('TypeChip (átomo)', () => {
  it('muestra la etiqueta y expone la clave del tipo para el color', () => {
    const fixture = TestBed.createComponent(TypeChip);
    fixture.componentRef.setInput('type', { name: 'fire', label: 'Fuego' });
    fixture.detectChanges();
    const chip = (fixture.nativeElement as HTMLElement).querySelector('.chip')!;
    expect(chip.textContent).toBe('Fuego');
    expect(chip.getAttribute('data-type')).toBe('fire');
  });
});
