export type IndentStyle = 'spaces' | 'tabs';
export type VoidElementStyle = 'html' | 'xhtml';
export type AttributeWrapMode = 'auto' | 'always' | 'never';
export type QuoteStyle = 'double' | 'single';
export type DocumentMode = 'auto' | 'document' | 'fragment';

/**
 * Objeto de configuración rico (inmutable por convención) para {@link HtmlFormatterService}.
 * Cada campo tiene un valor por defecto sensato vía {@link HtmlFormatterOptions.default}.
 */
export class HtmlFormatterOptions {
  constructor(
    /** Cómo debe interpretarse la raíz del documento. */
    public documentMode: DocumentMode = 'auto',
    /** Cantidad de espacios (o tabulaciones) por nivel de indentación. */
    public indentSize: number = 2,
    public indentStyle: IndentStyle = 'spaces',
    /** Preservar las líneas en blanco que el autor dejó entre elementos. */
    public preserveBlankLines: boolean = true,
    /** Máximo de líneas en blanco consecutivas a conservar. */
    public maxConsecutiveBlankLines: number = 1,
    /** Longitud de línea objetivo usada para decidir el ajuste de atributos / saltos forzados. */
    public printWidth: number = 100,
    public attributeWrap: AttributeWrapMode = 'auto',
    public quoteStyle: QuoteStyle = 'double',
    public voidElementStyle: VoidElementStyle = 'html',
    public lowercaseTags: boolean = false,
    public lowercaseAttributes: boolean = false,
    /** Formatear con Prettier el contenido de las etiquetas <script> embebidas (sin src/type incompatible). */
    public formatEmbeddedJs: boolean = true,
    /** Formatear con Prettier el contenido de las etiquetas <style>. */
    public formatEmbeddedCss: boolean = true,
    public insertFinalNewline: boolean = true,
  ) {}

  static default(): HtmlFormatterOptions {
    return new HtmlFormatterOptions();
  }

  clone(overrides: Partial<HtmlFormatterOptions> = {}): HtmlFormatterOptions {
    return Object.assign(
      new HtmlFormatterOptions(
        this.documentMode,
        this.indentSize,
        this.indentStyle,
        this.preserveBlankLines,
        this.maxConsecutiveBlankLines,
        this.printWidth,
        this.attributeWrap,
        this.quoteStyle,
        this.voidElementStyle,
        this.lowercaseTags,
        this.lowercaseAttributes,
        this.formatEmbeddedJs,
        this.formatEmbeddedCss,
        this.insertFinalNewline,
      ),
      overrides,
    );
  }

  get indentUnit(): string {
    return this.indentStyle === 'tabs' ? '\t' : ' '.repeat(this.indentSize);
  }
}
