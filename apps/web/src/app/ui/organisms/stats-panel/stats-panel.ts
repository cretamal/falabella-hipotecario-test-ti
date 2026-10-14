import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { NamedLabel } from '@pokedex/contracts';
import { Meter } from '../../atoms/meter/meter';
import { Panel } from '../../molecules/panel/panel';
import { StatBar } from '../../molecules/stat-bar/stat-bar';
import { toneLabel, totalTone } from '../../molecules/stat-bar/stat-tier';
import { Text } from '../../atoms/text/text';
import { Skeleton } from '../../atoms/skeleton/skeleton';

/** La suma máxima habitual de las seis estadísticas base (escala de la barra del total). */
const TOTAL_MAX = 720;

/** Organismo: el panel «Estadísticas base» (una barra por estadística y el resumen del total). */
@Component({
  selector: 'app-stats-panel',
  imports: [Meter, Skeleton, Panel, StatBar, Text],
  templateUrl: './stats-panel.html',
  styleUrl: './stats-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPanel {
  readonly stats = input<readonly (NamedLabel & { value: number })[]>();
  protected readonly placeholders = Array.from({ length: 6 });
  protected readonly totalMax = TOTAL_MAX;
  protected readonly total = computed(() =>
    (this.stats() ?? []).reduce((sum, stat) => sum + stat.value, 0),
  );
  protected readonly tone = computed(() => totalTone(this.total()));
  protected readonly level = computed(() => toneLabel(this.tone()));
}
