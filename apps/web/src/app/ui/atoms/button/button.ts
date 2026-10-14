import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Átomo: botón. Se aplica como atributo sobre el elemento semántico que corresponda:
 * `<button appButton>`, `<div appButton routerLink=…>` o `<span appButton aria-disabled="true">` (también sirve en `<a>`).
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- átomo de atributo: se aplica a <button>, <div> (enlace con routerLink) o <span>
  selector: 'a[appButton], button[appButton], div[appButton], span[appButton]',
  template: '<ng-content />',
  styleUrl: './button.scss',
  host: { '[class.primary]': "appButton() === 'primary'" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly appButton = input<'default' | 'primary' | ''>('default');
}
