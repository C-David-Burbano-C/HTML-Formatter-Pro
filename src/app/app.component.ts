import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormatterPageComponent } from './features/formatter/formatter-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormatterPageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
