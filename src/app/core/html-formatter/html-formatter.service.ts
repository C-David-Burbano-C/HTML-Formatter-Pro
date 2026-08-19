import { Injectable } from '@angular/core';
import { CodeFormatterService } from '../code-formatter/code-formatter.service';
import { EmbeddedCodeFormatter } from './embedded-code-formatter';
import { HtmlAstBuilder } from './html-ast-builder';
import { HtmlPrinter } from './html-printer';
import { FormatResult, FormatStats, FormatWarning } from './model/format-result.model';
import { HtmlFormatterOptions } from './model/formatter-options.model';

/**
 * Punto de entrada público del formateador de HTML: entra un string de origen,
 * sale un {@link FormatResult} formateado. Orquesta las tres etapas del pipeline
 * — parsear a un AST rico, formatear el código embebido <script>/<style>,
 * imprimir — manteniendo cada etapa como una clase independiente y testeable por separado.
 */
@Injectable({ providedIn: 'root' })
export class HtmlFormatterService {
  constructor(private readonly codeFormatter: CodeFormatterService) {}

  async format(source: string, options: HtmlFormatterOptions = HtmlFormatterOptions.default()): Promise<FormatResult> {
    const start = this.now();

    const doc = new HtmlAstBuilder().build(source, options.documentMode);

    let warnings: FormatWarning[] = [];
    if (options.formatEmbeddedJs || options.formatEmbeddedCss) {
      warnings = await new EmbeddedCodeFormatter(this.codeFormatter, options).formatInPlace(doc.children);
    }

    const code = new HtmlPrinter(options).print(doc);
    const elapsedMs = this.now() - start;

    const stats = new FormatStats(source.length, code.length, this.countLines(source), this.countLines(code), elapsedMs);
    return new FormatResult(code, stats, warnings);
  }

  private countLines(text: string): number {
    return text.length === 0 ? 0 : text.split('\n').length;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}
