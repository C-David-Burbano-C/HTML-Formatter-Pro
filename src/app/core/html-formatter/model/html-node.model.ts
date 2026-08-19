import { isInlineElement, isVoidElement, isWhitespaceSensitiveElement } from '../element-classification';

/** Discriminante de la jerarquía sellada de HtmlNode. */
export enum HtmlNodeType {
  Document = 'document',
  Doctype = 'doctype',
  Element = 'element',
  Text = 'text',
  Comment = 'comment',
}

/** Un atributo HTML, preservando si fue escrito como flag booleano sin valor. */
export class HtmlAttribute {
  constructor(
    public readonly name: string,
    public readonly value: string,
    /** True cuando el origen no tenía parte `=valor`, ej. `<input disabled>`. */
    public readonly isBooleanFlag: boolean,
  ) {}

  withName(name: string): HtmlAttribute {
    return new HtmlAttribute(name, this.value, this.isBooleanFlag);
  }
}

/** Clase base para todos los nodos del AST propio del formateador. */
export abstract class HtmlNode {
  abstract readonly type: HtmlNodeType;

  parent: HtmlElementNode | HtmlDocumentNode | null = null;

  /** Número de líneas completamente en blanco que aparecían justo antes de este nodo. */
  blankLinesBefore = 0;

  /** True si hubo un salto de línea entre el hermano anterior y este nodo en el origen. */
  hadLineBreakBefore = false;
}

/** Raíz sintética de un documento o fragmento parseado. */
export class HtmlDocumentNode extends HtmlNode {
  readonly type = HtmlNodeType.Document;
  children: HtmlNode[] = [];
  /** True cuando se parseó como documento completo (tenía <html>), false si es un fragmento. */
  isFullDocument = true;
  /** True si hubo un salto de línea justo antes del cierre del padre / fin de archivo. */
  hadLineBreakBeforeClose = true;
}

export class HtmlDoctypeNode extends HtmlNode {
  readonly type = HtmlNodeType.Doctype;
  constructor(
    public readonly name: string,
    public readonly publicId: string | null,
    public readonly systemId: string | null,
  ) {
    super();
  }
}

export class HtmlCommentNode extends HtmlNode {
  readonly type = HtmlNodeType.Comment;
  constructor(public readonly data: string) {
    super();
  }
}

export class HtmlTextNode extends HtmlNode {
  readonly type = HtmlNodeType.Text;
  constructor(public text: string) {
    super();
  }

  get isWhitespaceOnly(): boolean {
    return /^\s*$/.test(this.text);
  }
}

/** Namespace de un elemento, reflejando el ajuste de contenido foráneo de parse5. */
export enum HtmlNamespace {
  Html = 'html',
  Svg = 'svg',
  MathMl = 'mathml',
}

export class HtmlElementNode extends HtmlNode {
  readonly type = HtmlNodeType.Element;
  children: HtmlNode[] = [];
  /** True si hubo un salto de línea entre el último hijo y la etiqueta de cierre. */
  hadLineBreakBeforeClose = false;
  /** Para elementos sensibles al espacio en blanco (ej. <pre>), el marcado interno original exacto. */
  rawInnerHtml: string | undefined;

  constructor(
    public tagName: string,
    public attributes: HtmlAttribute[],
    public readonly namespace: HtmlNamespace = HtmlNamespace.Html,
  ) {
    super();
  }

  get isVoid(): boolean {
    return this.namespace === HtmlNamespace.Html && isVoidElement(this.tagName);
  }

  get isInline(): boolean {
    return this.namespace === HtmlNamespace.Html && isInlineElement(this.tagName);
  }

  get isWhitespaceSensitive(): boolean {
    return this.namespace === HtmlNamespace.Html && isWhitespaceSensitiveElement(this.tagName);
  }

  get isForeign(): boolean {
    return this.namespace !== HtmlNamespace.Html;
  }

  getAttribute(name: string): string | undefined {
    return this.attributes.find((a) => a.name === name)?.value;
  }
}
