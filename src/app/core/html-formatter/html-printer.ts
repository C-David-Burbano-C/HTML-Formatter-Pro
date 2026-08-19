import { HtmlFormatterOptions } from './model/formatter-options.model';
import {
  HtmlAttribute,
  HtmlCommentNode,
  HtmlDoctypeNode,
  HtmlDocumentNode,
  HtmlElementNode,
  HtmlNamespace,
  HtmlNode,
  HtmlNodeType,
  HtmlTextNode,
} from './model/html-node.model';
import { escapeAttributeValue, escapeText, dedent, indentLines, normalizeInlineText } from './text-utils';

interface InlineAtom {
  text: string;
  /** Si debe renderizarse un espacio (quebrable) entre el átomo anterior y este. */
  breakableBefore: boolean;
}

/**
 * Convierte un árbol {@link HtmlNode} rico en marcado formateado.
 *
 * Política de maquetado, en una frase: un elemento se renderiza en una línea
 * cuando el autor originalmente lo escribió en una línea y todavía entra en el
 * ancho de impresión; en caso contrario, cada hijo que no forme parte de una
 * secuencia en línea ininterrumpida obtiene su propia línea, y las líneas en
 * blanco que el autor dejó entre hermanos se preservan (limitadas por
 * {@link HtmlFormatterOptions.maxConsecutiveBlankLines}).
 */
export class HtmlPrinter {
  private blockDescendantCache = new WeakMap<HtmlElementNode, boolean>();

  constructor(private readonly options: HtmlFormatterOptions) {}

  print(doc: HtmlDocumentNode): string {
    const lines = this.renderChildren(doc.children, 0);
    let code = lines.join('\n');
    if (this.options.insertFinalNewline && code.length > 0 && !code.endsWith('\n')) {
      code += '\n';
    }
    return code;
  }

  // ---------------------------------------------------------------------
  // Maquetado de la lista de hijos: agrupación, líneas en blanco, y despacho
  // hacia bloque vs. relleno en línea.
  // ---------------------------------------------------------------------

  private renderChildren(nodes: HtmlNode[], depth: number): string[] {
    const groups = this.groupChildren(nodes, depth);
    const maxBlank = this.options.preserveBlankLines ? this.options.maxConsecutiveBlankLines : 0;
    const lines: string[] = [];

    for (const group of groups) {
      const blanks = Math.min(group[0].blankLinesBefore, maxBlank);
      for (let i = 0; i < blanks; i++) lines.push('');

      if (group.length === 1 && !this.isInlineSafe(group[0], depth)) {
        this.appendAll(lines, this.renderBlockNode(group[0], depth));
      } else {
        this.appendAll(lines, this.renderInlineFill(group, depth));
      }
    }
    return lines;
  }

  /**
   * Añade `items` a `target` sin usar `push(...items)`: con documentos grandes
   * (miles de líneas) el spread como argumentos de función choca con el límite
   * de argumentos del motor JS y lanza "Maximum call stack size exceeded".
   */
  private appendAll(target: string[], items: string[]): void {
    for (const item of items) target.push(item);
  }

  /** Divide una lista de hermanos en tramos que se maquetan juntos (en línea) o solos (bloque). */
  private groupChildren(nodes: HtmlNode[], depth: number): HtmlNode[][] {
    const groups: HtmlNode[][] = [];
    let current: HtmlNode[] = [];

    for (const node of nodes) {
      const blockForcing = !this.isInlineSafe(node, depth);
      const startNew = current.length === 0 || blockForcing || node.hadLineBreakBefore || node.blankLinesBefore > 0;
      if (startNew && current.length > 0) {
        groups.push(current);
        current = [];
      }
      current.push(node);
      if (blockForcing) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }

  private isInlineSafe(node: HtmlNode, depth: number): boolean {
    if (node.type === HtmlNodeType.Text) return true;
    if (node.type === HtmlNodeType.Element) {
      const el = node as HtmlElementNode;
      if (el.rawInnerHtml !== undefined) return false;
      if (this.isRawTextFamily(el)) return false;
      // Una etiqueta de apertura que debe envolver sus atributos no puede insertarse en un flujo de texto.
      if (this.attributesNeedWrap(el, depth)) return false;
      return el.isInline && !this.hasBlockDescendant(el);
    }
    return false; // los comentarios y el doctype siempre van en su propia línea
  }

  /** True cuando el elemento nunca tiene una etiqueta de cierre separada (vacío, o una hoja foránea autocerrada). */
  private isSelfContained(el: HtmlElementNode): boolean {
    return el.isVoid || (el.isForeign && el.children.length === 0);
  }

  private hasBlockDescendant(el: HtmlElementNode): boolean {
    const cached = this.blockDescendantCache.get(el);
    if (cached !== undefined) return cached;
    let result = false;
    for (const child of el.children) {
      if (child.type === HtmlNodeType.Element) {
        const ce = child as HtmlElementNode;
        if (ce.rawInnerHtml !== undefined || this.isRawTextFamily(ce) || !ce.isInline || this.hasBlockDescendant(ce)) {
          result = true;
          break;
        }
      } else if (child.type === HtmlNodeType.Comment) {
        // Los comentarios siempre rompen el flujo, así que un elemento que contenga uno no puede ser un átomo en línea simple.
        result = true;
        break;
      }
    }
    this.blockDescendantCache.set(el, result);
    return result;
  }

  // ---------------------------------------------------------------------
  // Nodos de nivel bloque (su(s) propia(s) línea(s)).
  // ---------------------------------------------------------------------

  private renderBlockNode(node: HtmlNode, depth: number): string[] {
    switch (node.type) {
      case HtmlNodeType.Element:
        return this.renderElementBlock(node as HtmlElementNode, depth);
      case HtmlNodeType.Comment:
        return this.renderComment(node as HtmlCommentNode, depth);
      case HtmlNodeType.Doctype:
        return [this.renderDoctype(node as HtmlDoctypeNode, depth)];
      default:
        return this.renderInlineFill([node], depth);
    }
  }

  private renderComment(node: HtmlCommentNode, depth: number): string[] {
    const indent = this.options.indentUnit.repeat(depth);
    return [`${indent}<!--${node.data}-->`];
  }

  private renderDoctype(node: HtmlDoctypeNode, depth: number): string {
    const indent = this.options.indentUnit.repeat(depth);
    const name = node.name || 'html';
    if (node.publicId) {
      const system = node.systemId ? ` "${node.systemId}"` : '';
      return `${indent}<!DOCTYPE ${name} PUBLIC "${node.publicId}"${system}>`;
    }
    if (node.systemId) {
      return `${indent}<!DOCTYPE ${name} SYSTEM "${node.systemId}">`;
    }
    return `${indent}<!DOCTYPE ${name}>`;
  }

  private renderElementBlock(el: HtmlElementNode, depth: number): string[] {
    const indent = this.options.indentUnit.repeat(depth);
    const tag = this.tagNameFor(el);

    if (el.isVoid) {
      return this.renderOpenTagLines(el, depth);
    }

    if (el.rawInnerHtml !== undefined) {
      const openLine = indent + this.openTagFlat(el);
      return [`${openLine}${el.rawInnerHtml}</${tag}>`];
    }

    if (this.isRawTextFamily(el)) {
      return this.renderRawTextElement(el, depth);
    }

    if (!el.hadLineBreakBeforeClose) {
      const flat = this.tryFlattenElement(el);
      if (flat !== null) {
        const budget = this.options.printWidth - depth * this.options.indentUnit.length;
        if (flat.length <= Math.max(budget, this.options.indentUnit.length)) {
          return [indent + flat];
        }
      }
    }

    const openLines = this.renderOpenTagLines(el, depth);
    if (el.children.length === 0) {
      if (!this.isSelfContained(el)) {
        openLines[openLines.length - 1] += `</${tag}>`;
      }
      return openLines;
    }
    const childLines = this.renderChildren(el.children, depth + 1);
    if (childLines.length === 0) {
      if (!this.isSelfContained(el)) {
        openLines[openLines.length - 1] += `</${tag}>`;
      }
      return openLines;
    }
    return [...openLines, ...childLines, `${indent}</${tag}>`];
  }

  private renderRawTextElement(el: HtmlElementNode, depth: number): string[] {
    const indent = this.options.indentUnit.repeat(depth);
    const tag = this.tagNameFor(el);
    const openLines = this.renderOpenTagLines(el, depth);
    const textChild = el.children[0] as HtmlTextNode | undefined;
    const raw = textChild?.text ?? '';

    if (raw.trim() === '') {
      openLines[openLines.length - 1] += `</${tag}>`;
      return openLines;
    }

    if (tag.toLowerCase() === 'title') {
      openLines[openLines.length - 1] += `${raw.trim().replace(/&/g, '&amp;')}</${tag}>`;
      return openLines;
    }

    const trimmed = raw.replace(/^\n/, '').replace(/[ \t\n]+$/, '');
    const body = indentLines(dedent(trimmed), this.options.indentUnit, depth + 1);
    return [...openLines, ...body, `${indent}</${tag}>`];
  }

  private isRawTextFamily(el: HtmlElementNode): boolean {
    if (el.namespace !== HtmlNamespace.Html) return false;
    const t = el.tagName.toLowerCase();
    return t === 'script' || t === 'style' || t === 'title';
  }

  // ---------------------------------------------------------------------
  // Renderizado plano de una sola línea (usado tanto para "¿entra este
  // elemento en una línea?" como para renderizar un elemento en línea como
  // átomo de relleno).
  // ---------------------------------------------------------------------

  private tryFlattenElement(el: HtmlElementNode): string | null {
    if (el.hadLineBreakBeforeClose) return null;
    if (this.forcesAttributeWrap(el)) return null;

    if (this.isSelfContained(el)) return this.openTagFlat(el);
    if (el.rawInnerHtml !== undefined || this.isRawTextFamily(el)) return null;
    if (el.children.length === 0) return `${this.openTagFlat(el)}</${this.tagNameFor(el)}>`;

    const parts: string[] = [];
    for (const child of el.children) {
      if (child.hadLineBreakBefore || child.blankLinesBefore > 0) return null;
      const rendered = this.flattenChildForAtom(child, /* strict */ true);
      if (rendered === null) return null;
      parts.push(rendered);
    }
    return `${this.openTagFlat(el)}${parts.join('')}</${this.tagNameFor(el)}>`;
  }

  /** Igual que {@link tryFlattenElement} pero nunca falla: se usa como átomo de relleno de último recurso. */
  private forceFlattenElement(el: HtmlElementNode): string {
    if (this.isSelfContained(el)) return this.openTagFlat(el);
    if (el.rawInnerHtml !== undefined) {
      return `${this.openTagFlat(el)}${el.rawInnerHtml}</${this.tagNameFor(el)}>`;
    }
    if (el.children.length === 0) return `${this.openTagFlat(el)}</${this.tagNameFor(el)}>`;
    const parts = el.children.map((child) => this.flattenChildForAtom(child, /* strict */ false)!);
    return `${this.openTagFlat(el)}${parts.join('')}</${this.tagNameFor(el)}>`;
  }

  private flattenChildForAtom(child: HtmlNode, strict: boolean): string | null {
    if (child.type === HtmlNodeType.Text) {
      return escapeText(normalizeInlineText((child as HtmlTextNode).text));
    }
    if (child.type === HtmlNodeType.Comment) {
      return `<!--${(child as HtmlCommentNode).data}-->`;
    }
    if (child.type === HtmlNodeType.Element) {
      const ce = child as HtmlElementNode;
      if (strict) {
        if (!ce.isInline || ce.rawInnerHtml !== undefined || this.hasBlockDescendant(ce)) return null;
        return this.tryFlattenElement(ce);
      }
      return this.forceFlattenElement(ce);
    }
    return strict ? null : '';
  }

  // ---------------------------------------------------------------------
  // Renderizado de relleno en línea (ajuste de palabras) para un tramo de
  // texto / elementos en línea.
  // ---------------------------------------------------------------------

  private renderInlineFill(group: HtmlNode[], depth: number): string[] {
    const atoms = this.buildAtoms(group);
    if (atoms.length === 0) return [];

    const indent = this.options.indentUnit.repeat(depth);
    const width = this.options.printWidth;
    const lines: string[] = [];
    let current = '';

    for (const atom of atoms) {
      if (current === '') {
        current = atom.text;
        continue;
      }
      const addition = (atom.breakableBefore ? ' ' : '') + atom.text;
      if (indent.length + current.length + addition.length <= width) {
        current += addition;
      } else if (atom.breakableBefore) {
        lines.push(indent + current);
        current = atom.text;
      } else {
        current += addition; // pegado a su vecino en el origen: no se debe insertar un salto aquí
      }
    }
    if (current !== '') lines.push(indent + current);
    return lines;
  }

  private buildAtoms(group: HtmlNode[]): InlineAtom[] {
    const atoms: InlineAtom[] = [];
    let pendingSpace = false;

    for (const node of group) {
      if (node.type === HtmlNodeType.Text) {
        const raw = (node as HtmlTextNode).text;
        if (/^[\t\n\r ]*$/.test(raw)) {
          if (raw.length > 0) pendingSpace = true;
          continue;
        }
        const hasLeading = /^\s/.test(raw);
        const hasTrailing = /\s$/.test(raw);
        if (hasLeading) pendingSpace = true;
        const tokens = this.tokenizePreservingTemplateExpressions(normalizeInlineText(raw).trim());
        tokens.forEach((t, i) => {
          atoms.push({ text: escapeText(t.text), breakableBefore: i === 0 ? pendingSpace : t.breakableBefore });
        });
        pendingSpace = hasTrailing;
        continue;
      }
      if (node.type === HtmlNodeType.Comment) {
        atoms.push({ text: `<!--${(node as HtmlCommentNode).data}-->`, breakableBefore: pendingSpace });
        pendingSpace = false;
        continue;
      }
      const el = node as HtmlElementNode;
      const rendered = this.tryFlattenElement(el) ?? this.forceFlattenElement(el);
      atoms.push({ text: rendered, breakableBefore: pendingSpace });
      pendingSpace = false;
    }
    return atoms;
  }

  /**
   * Divide texto por espacios para el ajuste de línea, pero sin partir jamás
   * una expresión de interpolación `{{ ... }}` (Angular/Vue/etc): esas deben
   * viajar como un único átomo indivisible aunque contengan espacios
   * internos (ej. `{{'o arrastre y suelte' | translate}}`), o el salto de
   * línea rompería visualmente la expresión.
   *
   * Cada token devuelto trae su propio `breakableBefore`, calculado siguiendo
   * si realmente hubo un espacio en el texto original justo antes de él, para
   * no insertar espacios donde el autor pegó el texto a la expresión (ej.
   * `hola{{ 'x' }}mundo`) ni perder el espacio cuando sí existía.
   */
  private tokenizePreservingTemplateExpressions(
    text: string,
  ): Array<{ text: string; breakableBefore: boolean }> {
    const parts = text.split(/(\{\{[\s\S]*?\}\})/g);
    const tokens: Array<{ text: string; breakableBefore: boolean }> = [];
    let spaceBefore = false;

    parts.forEach((part, i) => {
      if (part === '') return;
      const isExpression = i % 2 === 1;
      if (isExpression) {
        tokens.push({ text: part, breakableBefore: spaceBefore });
        spaceBefore = false;
        return;
      }
      const hasLeading = /^ /.test(part);
      const hasTrailing = / $/.test(part);
      if (hasLeading) spaceBefore = true;
      const words = part.split(' ').filter((w) => w !== '');
      words.forEach((w, wi) => {
        tokens.push({ text: w, breakableBefore: wi === 0 ? spaceBefore : true });
      });
      spaceBefore = hasTrailing;
    });

    return tokens;
  }

  // ---------------------------------------------------------------------
  // Etiquetas y atributos.
  // ---------------------------------------------------------------------

  private tagNameFor(el: HtmlElementNode): string {
    const simple = /^[a-zA-Z][a-zA-Z0-9-]*$/.test(el.tagName);
    return this.options.lowercaseTags && el.namespace === HtmlNamespace.Html && simple
      ? el.tagName.toLowerCase()
      : el.tagName;
  }

  private openTagFlat(el: HtmlElementNode): string {
    const tag = this.tagNameFor(el);
    const attrs = el.attributes.map((a) => this.renderSingleAttr(el, a));
    const attrPart = attrs.length ? ' ' + attrs.join(' ') : '';
    return `<${tag}${attrPart}${this.selfClosingSuffix(el)}`;
  }

  private renderOpenTagLines(el: HtmlElementNode, depth: number): string[] {
    const indent = this.options.indentUnit.repeat(depth);
    const tag = this.tagNameFor(el);
    const suffix = this.selfClosingSuffix(el);

    if (!this.attributesNeedWrap(el, depth)) {
      const attrs = el.attributes.map((a) => this.renderSingleAttr(el, a));
      const attrPart = attrs.length ? ' ' + attrs.join(' ') : '';
      return [`${indent}<${tag}${attrPart}${suffix}`];
    }

    const attrIndent = this.options.indentUnit.repeat(depth + 1);
    const lines = [`${indent}<${tag}`];
    for (const a of el.attributes) {
      lines.push(`${attrIndent}${this.renderSingleAttr(el, a)}`);
    }
    lines.push(`${indent}${suffix.trim()}`);
    return lines;
  }

  private forcesAttributeWrap(el: HtmlElementNode): boolean {
    return this.options.attributeWrap === 'always' && el.attributes.length > 1;
  }

  private attributesNeedWrap(el: HtmlElementNode, depth: number): boolean {
    if (el.attributes.length === 0) return false;
    if (this.options.attributeWrap === 'never') return false;
    if (this.forcesAttributeWrap(el)) return true;
    if (this.options.attributeWrap === 'always') return false;
    const flatOpen = this.openTagFlat(el);
    return depth * this.options.indentUnit.length + flatOpen.length > this.options.printWidth;
  }

  private selfClosingSuffix(el: HtmlElementNode): string {
    if (el.isVoid) return this.options.voidElementStyle === 'xhtml' ? ' />' : '>';
    if (el.isForeign && el.children.length === 0) return ' />';
    return '>';
  }

  private renderSingleAttr(el: HtmlElementNode, a: HtmlAttribute): string {
    const simpleIdentifier = /^[a-zA-Z:_-][a-zA-Z0-9:_.-]*$/.test(a.name);
    const name =
      this.options.lowercaseAttributes && el.namespace === HtmlNamespace.Html && simpleIdentifier
        ? a.name.toLowerCase()
        : a.name;
    if (a.isBooleanFlag && a.value === '') {
      return name;
    }
    const quoteChar = this.options.quoteStyle === 'single' ? "'" : '"';
    return `${name}=${quoteChar}${escapeAttributeValue(a.value, quoteChar)}${quoteChar}`;
  }
}
