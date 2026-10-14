import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Las etiquetas HTML que puede usar `<app-text>`. */
export type TextTag =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'span'
  | 'strong'
  | 'em'
  | 'small'
  | 'label'
  | 'div';
/** Las variantes tipográficas: tamaño, peso e interlineado salen de los tokens. */
export type TextVariant = 'body' | 'caption' | 'heading' | 'title';
/** Los pesos disponibles (los valores están en `_tokens.scss`). */
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
/** Los tonos de color: normal, atenuado o de error. */
export type TextTone = 'default' | 'muted' | 'danger';

/**
 * Átomo: texto tipográfico. La etiqueta (`as`) se elige en tiempo de ejecución; el peso, la variante y el tono son
 * tokens (`styles/_typography.scss`), sin estilos en línea. El contenido llega por `text` o proyectado (hace falta para
 * plurales ICU y textos con enlaces). Ojo: no sirve para `li`, `dt`, `dd` ni `option`, porque el contenedor
 * `<app-text>` rompería esa estructura HTML.
 */
@Component({
  selector: 'app-text',
  imports: [NgTemplateOutlet],
  template: `
    <ng-template #body>{{ text() }}<ng-content /></ng-template>
    @switch (tag()) {
      @case ('h1') {
        <h1 [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </h1>
      }
      @case ('h2') {
        <h2 [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </h2>
      }
      @case ('h3') {
        <h3 [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </h3>
      }
      @case ('h4') {
        <h4 [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </h4>
      }
      @case ('h5') {
        <h5 [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </h5>
      }
      @case ('h6') {
        <h6 [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </h6>
      }
      @case ('p') {
        <p [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </p>
      }
      @case ('span') {
        <span [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()"
          ><ng-container [ngTemplateOutlet]="body"
        /></span>
      }
      @case ('strong') {
        <strong [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()"
          ><ng-container [ngTemplateOutlet]="body"
        /></strong>
      }
      @case ('em') {
        <em [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()"
          ><ng-container [ngTemplateOutlet]="body"
        /></em>
      }
      @case ('small') {
        <small [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()"
          ><ng-container [ngTemplateOutlet]="body"
        /></small>
      }
      @case ('label') {
        <label [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()" [attr.for]="forId()"
          ><ng-container [ngTemplateOutlet]="body"
        /></label>
      }
      @case ('div') {
        <div [attr.id]="id()" [attr.role]="role()" [attr.aria-live]="live()">
          <ng-container [ngTemplateOutlet]="body" />
        </div>
      }
    }
  `,
  host: {
    // un `role` estático en el host se duplicaría con el del elemento interno
    '[attr.role]': 'null',
    '[attr.data-tag]': 'tag()',
    '[attr.data-variant]': 'variant()',
    '[attr.data-weight]': 'weight()',
    '[attr.data-tone]': 'tone()',
    '[attr.data-align]': 'align()',
    '[attr.data-numeric]': 'numeric() ? "" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Text {
  /** `as` es palabra reservada en las plantillas de Angular, por eso se declara con alias. */
  // eslint-disable-next-line @angular-eslint/no-input-rename -- `as` es reservada en plantillas
  readonly tag = input<TextTag>('span', { alias: 'as' });
  readonly variant = input<TextVariant>('body');
  /** Si se omite, lo decide la variante (los encabezados van en negrita). */
  readonly weight = input<TextWeight>();
  readonly tone = input<TextTone>('default');
  readonly align = input<'start' | 'center' | 'end'>();
  readonly numeric = input(false, { transform: booleanAttribute });
  readonly text = input<string>();
  /**
   * Id del elemento interno. Con un valor fijo hay que usar `[id]="'x'"`: un `id="x"` estático también queda en el host y
   * duplicaría el id.
   */
  readonly id = input<string>();
  readonly role = input<string>();
  readonly live = input<'polite' | 'assertive'>();
  // eslint-disable-next-line @angular-eslint/no-input-rename -- `for` es palabra reservada de JS
  readonly forId = input<string>(undefined, { alias: 'for' });
}
