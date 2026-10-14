import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HardLink } from '../../atoms/link/link';
import { Text } from '../../atoms/text/text';

/** Organismo: el pie de página, con la atribución de los datos. */
@Component({
  selector: 'app-footer',
  imports: [Text, HardLink],
  templateUrl: './app-footer.html',
  styleUrl: './app-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooter {}
