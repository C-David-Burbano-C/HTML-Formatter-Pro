import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeFormatterOptions } from '../../../core/code-formatter/code-formatter-options.model';

type TrailingComma = CodeFormatterOptions['trailingComma'];

/** Panel de opciones para el formateo de TypeScript/JavaScript vía Prettier. */
@Component({
  selector: 'app-code-options-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './code-options-panel.component.html',
  styleUrl: './code-options-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeOptionsPanelComponent {
  readonly options = model.required<CodeFormatterOptions>();

  readonly trailingCommaModes: Array<{ value: TrailingComma; label: string }> = [
    { value: 'all', label: 'Siempre (all)' },
    { value: 'es5', label: 'Compatible ES5' },
    { value: 'none', label: 'Nunca' },
  ];

  update(partial: Partial<CodeFormatterOptions>): void {
    this.options.set(this.options().clone(partial));
  }

  restoreDefaults(): void {
    this.options.set(CodeFormatterOptions.default());
  }
}
