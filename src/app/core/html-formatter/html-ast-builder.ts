import * as parse5 from 'parse5';
import {
  HtmlAttribute,
  HtmlCommentNode,
  HtmlDoctypeNode,
  HtmlDocumentNode,
  HtmlElementNode,
  HtmlNamespace,
  HtmlNode,
  HtmlTextNode,
} from './model/html-node.model';
import { DocumentMode } from './model/formatter-options.model';
import { isRawTextElement, isEscapableRawTextElement, isWhitespaceSensitiveElement } from './element-classification';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

/** Coincide con un atributo `nombre` o `nombre=valor` (con o sin comillas), tal como fue escrito. */
const ATTR_PATTERN = /^([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]*)))?$/s;

/**
 * Convierte el marcado crudo en el árbol {@link HtmlNode} rico que usa el impresor,
 * resolviendo todo lo que un recorrido ingenuo del árbol de parse5 perdería: el
 * casing original de los atributos (parse5 pasa a minúsculas los nombres de
 * atributo en el namespace HTML, lo que rompería bindings de frameworks como
 * `[(ngModel)]`), los atributos booleanos sin valor, las barras de autocierre,
 * y la estructura de líneas en blanco / saltos de línea del origen.
 */
export class HtmlAstBuilder {
  build(source: string, documentMode: DocumentMode): HtmlDocumentNode {
    const useDocumentParse = documentMode === 'document' || (documentMode === 'auto' && this.looksLikeFullDocument(source));

    const root = new HtmlDocumentNode();
    root.isFullDocument = useDocumentParse;

    if (useDocumentParse) {
      const p5doc = parse5.parse(source, { sourceCodeLocationInfo: true });
      this.buildChildren(p5doc.childNodes as any[], source, root, root.children);
    } else {
      const p5frag = parse5.parseFragment(source, { sourceCodeLocationInfo: true });
      this.buildChildren(p5frag.childNodes as any[], source, root, root.children);
    }

    return root;
  }

  private looksLikeFullDocument(source: string): boolean {
    const probe = source.replace(/^﻿/, '').trimStart();
    return /^<!doctype\b/i.test(probe) || /^<html[\s>/]/i.test(probe);
  }

  private countBlankLines(whitespace: string): number {
    const newlines = whitespace.match(/\n/g)?.length ?? 0;
    return Math.max(0, newlines - 1);
  }

  /** Construye los hijos de un nodo de parse5 en `outChildren`, plegando el espacio en blanco puramente de formato. */
  private buildChildren(rawChildren: any[], source: string, parentOwner: HtmlNode, outChildren: HtmlNode[]): void {
    let pendingBlankLines = 0;
    let pendingBreak = false;

    for (const raw of rawChildren) {
      if (raw.nodeName === '#text') {
        const text: string = raw.value;
        const isWhitespaceOnly = /^[\t\n\r ]*$/.test(text);
        if (isWhitespaceOnly && text.includes('\n')) {
          // Espacio en blanco puramente de formato: no crear un nodo, solo recordar el salto/línea en blanco.
          pendingBlankLines += this.countBlankLines(text);
          pendingBreak = true;
          continue;
        }
        const node = new HtmlTextNode(text);
        this.attach(node, parentOwner, pendingBlankLines, pendingBreak);
        outChildren.push(node);
        pendingBlankLines = 0;
        pendingBreak = false;
        continue;
      }

      if (raw.nodeName === '#comment') {
        const node = new HtmlCommentNode(raw.data);
        this.attach(node, parentOwner, pendingBlankLines, pendingBreak);
        outChildren.push(node);
        pendingBlankLines = 0;
        pendingBreak = false;
        continue;
      }

      if (raw.nodeName === '#documentType') {
        const node = new HtmlDoctypeNode(raw.name ?? 'html', raw.publicId || null, raw.systemId || null);
        this.attach(node, parentOwner, pendingBlankLines, pendingBreak);
        outChildren.push(node);
        pendingBlankLines = 0;
        pendingBreak = false;
        continue;
      }

      // Nodo elemento.
      const node = this.buildElement(raw, source);
      this.attach(node, parentOwner, pendingBlankLines, pendingBreak);
      outChildren.push(node);
      pendingBlankLines = 0;
      pendingBreak = false;
    }

    if (parentOwner instanceof HtmlElementNode || parentOwner instanceof HtmlDocumentNode) {
      parentOwner.hadLineBreakBeforeClose = pendingBreak;
    }
  }

  private attach(node: HtmlNode, parent: HtmlNode, blankLinesBefore: number, hadLineBreakBefore: boolean): void {
    node.parent = parent as any;
    node.blankLinesBefore = blankLinesBefore;
    node.hadLineBreakBefore = hadLineBreakBefore;
  }

  private buildElement(raw: any, source: string): HtmlElementNode {
    const namespace = this.resolveNamespace(raw.namespaceURI);
    const attributes = this.buildAttributes(raw, source);
    const el = new HtmlElementNode(raw.tagName, attributes, namespace);
    const loc = raw.sourceCodeLocation;
    const tagLower = el.tagName.toLowerCase();

    if (namespace === HtmlNamespace.Html && isWhitespaceSensitiveElement(tagLower) && !el.isVoid) {
      // El espacio en blanco es significativo: preservar el subárbol interno byte a byte.
      if (loc?.startTag && loc?.endTag) {
        el.rawInnerHtml = source.slice(loc.startTag.endOffset, loc.endTag.startOffset);
      } else {
        el.rawInnerHtml = '';
      }
      return el;
    }

    if (namespace === HtmlNamespace.Html && (isRawTextElement(tagLower) || isEscapableRawTextElement(tagLower))) {
      const textChild = raw.childNodes?.[0];
      if (textChild && typeof textChild.value === 'string' && textChild.value.length > 0) {
        const textNode = new HtmlTextNode(textChild.value);
        textNode.parent = el;
        el.children = [textNode];
      }
      return el;
    }

    if (!el.isVoid) {
      this.buildChildren(raw.childNodes ?? [], source, el, el.children);
    }

    return el;
  }

  private resolveNamespace(namespaceURI: string | undefined): HtmlNamespace {
    if (namespaceURI === SVG_NS) return HtmlNamespace.Svg;
    if (namespaceURI === MATHML_NS) return HtmlNamespace.MathMl;
    return HtmlNamespace.Html;
  }

  private buildAttributes(raw: any, source: string): HtmlAttribute[] {
    const loc = raw.sourceCodeLocation;
    const attrLocs: Record<string, any> | undefined = loc?.startTag?.attrs ?? loc?.attrs;

    return (raw.attrs ?? []).map((a: { name: string; value: string }) => {
      const attrLoc = attrLocs?.[a.name.toLowerCase()];
      if (attrLoc) {
        const rawText = source.slice(attrLoc.startOffset, attrLoc.endOffset).trim();
        const match = ATTR_PATTERN.exec(rawText);
        if (match) {
          const hasValue = match[2] !== undefined || match[3] !== undefined || match[4] !== undefined;
          return new HtmlAttribute(match[1], a.value, !hasValue);
        }
      }
      return new HtmlAttribute(a.name, a.value, a.value === '');
    });
  }
}
