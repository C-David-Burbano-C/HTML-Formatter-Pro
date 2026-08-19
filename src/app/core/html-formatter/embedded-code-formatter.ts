import { CodeFormatterService } from '../code-formatter/code-formatter.service';
import { CodeFormatterOptions, CodeLanguage } from '../code-formatter/code-formatter-options.model';
import { FormatWarning } from './model/format-result.model';
import { HtmlFormatterOptions } from './model/formatter-options.model';
import { HtmlElementNode, HtmlNamespace, HtmlNode, HtmlNodeType, HtmlTextNode } from './model/html-node.model';

const JS_SCRIPT_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module', 'text/babel', 'application/ecmascript']);

/**
 * Ejecuta Prettier sobre el contenido de los elementos <script> y <style> in situ,
 * de modo que el impresor de HTML solo tenga que maquetar código embebido que ya
 * viene formateado. Los elementos que no puede tocar con seguridad (scripts
 * externos, tipos que no son JS/CSS, JSON, etc.) se dejan exactamente como fueron escritos.
 */
export class EmbeddedCodeFormatter {
  constructor(
    private readonly codeFormatter: CodeFormatterService,
    private readonly options: HtmlFormatterOptions,
  ) {}

  async formatInPlace(roots: HtmlNode[]): Promise<FormatWarning[]> {
    const warnings: FormatWarning[] = [];
    await this.walk(roots, warnings);
    return warnings;
  }

  private async walk(nodes: HtmlNode[], warnings: FormatWarning[]): Promise<void> {
    for (const node of nodes) {
      if (node.type !== HtmlNodeType.Element) continue;
      const el = node as HtmlElementNode;

      const scriptLanguage = this.options.formatEmbeddedJs ? this.resolveScriptLanguage(el) : null;
      if (scriptLanguage) {
        await this.formatTextChild(el, scriptLanguage, warnings, `<script>`);
        continue;
      }

      const styleLanguage = this.options.formatEmbeddedCss ? this.resolveStyleLanguage(el) : null;
      if (styleLanguage) {
        await this.formatTextChild(el, styleLanguage, warnings, `<style>`);
        continue;
      }

      if (el.rawInnerHtml === undefined) {
        await this.walk(el.children, warnings);
      }
    }
  }

  private resolveScriptLanguage(el: HtmlElementNode): CodeLanguage | null {
    if (el.namespace !== HtmlNamespace.Html || el.tagName.toLowerCase() !== 'script') return null;
    if (el.getAttribute('src') !== undefined) return null;
    const type = (el.getAttribute('type') ?? '').trim().toLowerCase();
    const lang = (el.getAttribute('lang') ?? '').trim().toLowerCase();
    if (lang === 'ts' || lang === 'typescript' || type.includes('typescript')) return 'typescript';
    if (!JS_SCRIPT_TYPES.has(type)) return null;
    return 'javascript';
  }

  private resolveStyleLanguage(el: HtmlElementNode): CodeLanguage | null {
    if (el.namespace !== HtmlNamespace.Html || el.tagName.toLowerCase() !== 'style') return null;
    const lang = (el.getAttribute('lang') ?? 'css').trim().toLowerCase();
    if (lang === 'css' || lang === 'scss' || lang === 'less') return lang;
    return null;
  }

  private async formatTextChild(el: HtmlElementNode, language: CodeLanguage, warnings: FormatWarning[], label: string): Promise<void> {
    const textChild = el.children[0] as HtmlTextNode | undefined;
    if (!textChild || textChild.text.trim() === '') return;

    const codeOptions = new CodeFormatterOptions(
      this.options.printWidth,
      this.options.indentSize,
      this.options.indentStyle === 'tabs',
    );

    try {
      textChild.text = await this.codeFormatter.format(textChild.text, language, codeOptions);
    } catch (err) {
      warnings.push(new FormatWarning(`No se pudo formatear el contenido de ${label}, se dejó tal cual.`, (err as Error).message));
    }
  }
}
