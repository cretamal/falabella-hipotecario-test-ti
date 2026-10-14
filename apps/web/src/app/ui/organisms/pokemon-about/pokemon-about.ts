import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PokemonDetail } from '@pokedex/contracts';
import { Panel } from '../../molecules/panel/panel';
import { Text } from '../../atoms/text/text';
import { Skeleton } from '../../atoms/skeleton/skeleton';

/** Organismo: el panel «Acerca de» (descripción, altura, peso y habilidades). */
@Component({
  selector: 'app-pokemon-about',
  imports: [Skeleton, Text, DecimalPipe, Panel],
  templateUrl: './pokemon-about.html',
  styleUrl: './pokemon-about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokemonAbout {
  readonly pokemon = input<PokemonDetail>();
}
