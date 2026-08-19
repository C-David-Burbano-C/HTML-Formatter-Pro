import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttributeWrapMode,
  DocumentMode,
  HtmlFormatterOptions,
  IndentStyle,
  QuoteStyle,
  VoidElementStyle,
} from '../../../core/html-formatter/model/formatter-options.model';

/**
 * Panel de opciones para el formateador de HTML. Trabaja de forma inmutable:
 * cada cambio produce una nueva {@link HtmlFormatterOptions} vía `.clone(...)`
 * y se emite completa a través del `model()`, para que el resto de la app
 * (efectos de recalculado, etc) reaccione de forma predecible.
 */
@Component({
  selector: 'app-html-options-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './html-options-panel.component.html',
  styleUrl: './html-options-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlOptionsPanelComponent {
  readonly options = model.required<HtmlFormatterOptions>();

  readonly documentModes: Array<{ value: DocumentMode; label: string }> = [
    { value: 'auto', label: 'Automático' },
    { value: 'fragment', label: 'Fragmento' },
    { value: 'document', label: 'Documento completo' },
  ];

  readonly indentStyles: Array<{ value: IndentStyle; label: string }> = [
    { value: 'spaces', label: 'Espacios' },
    { value: 'tabs', label: 'Tabulaciones' },
  ];

  readonly attributeWrapModes: Array<{ value: AttributeWrapMode; label: string }> = [
    { value: 'auto', label: 'Automático (según ancho)' },
    { value: 'always', label: 'Siempre, uno por línea' },
    { value: 'never', label: 'Nunca' },
  ];

  readonly quoteStyles: Array<{ value: QuoteStyle; label: string }> = [
    { value: 'double', label: 'Comillas dobles "' },
    { value: 'single', label: "Comillas simples '" },
  ];

  readonly voidElementStyles: Array<{ value: VoidElementStyle; label: string }> = [
    { value: 'html', label: 'HTML (<br>)' },
    { value: 'xhtml', label: 'XHTML (<br />)' },
  ];

  update(partial: Partial<HtmlFormatterOptions>): void {
    this.options.set(this.options().clone(partial));
  }

  restoreDefaults(): void {
    this.options.set(HtmlFormatterOptions.default());
  }
}
