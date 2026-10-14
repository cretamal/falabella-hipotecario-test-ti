import type { MeterTone } from '../../atoms/meter/meter';

/** El tramo de una estadística base (0–255) y de la suma de las seis (≈ 180–720). */
export const statTone = (value: number): MeterTone =>
  value < 50 ? 'low' : value < 90 ? 'mid' : value < 120 ? 'high' : 'top';

/** El tramo de la suma de las seis estadísticas base. */
export const totalTone = (total: number): MeterTone =>
  total < 300 ? 'low' : total < 450 ? 'mid' : total < 550 ? 'high' : 'top';

/** El texto del tramo en el idioma activo (también lo leen los lectores de pantalla). */
export function toneLabel(tone: MeterTone): string {
  switch (tone) {
    case 'low':
      return $localize`:@@stats.tier.low:bajo`;
    case 'mid':
      return $localize`:@@stats.tier.mid:medio`;
    case 'high':
      return $localize`:@@stats.tier.high:alto`;
    case 'top':
      return $localize`:@@stats.tier.top:excepcional`;
  }
}
