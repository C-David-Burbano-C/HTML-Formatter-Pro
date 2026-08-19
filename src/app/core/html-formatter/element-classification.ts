/**
 * Tablas estáticas de clasificación de elementos HTML, usadas por el impresor
 * para decidir el comportamiento de maquetado (vacío vs. contenedor, en línea
 * vs. bloque, contenido de texto crudo, etc).
 */

/** Elementos que nunca tienen etiqueta de cierre ni hijos. */
export const VOID_ELEMENTS: ReadonlySet<string> = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Elementos cuyo modelo de contenido es "en línea"/"phrasing": pueden ir en la
 * misma línea que texto y otros elementos en línea sin forzar un salto de bloque.
 */
export const INLINE_ELEMENTS: ReadonlySet<string> = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'del',
  'dfn', 'em', 'i', 'ins', 'kbd', 'label', 'mark', 'meter', 'noscript',
  'output', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small',
  'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
  'button', 'img', 'input', 'select', 'textarea', 'audio',
]);

/**
 * Elementos cuyo contenido de texto es opaco para el parser HTML (RAWTEXT / RCDATA):
 * sus hijos son siempre un único nodo de texto y nunca deben re-escaparse.
 */
export const RAW_TEXT_ELEMENTS: ReadonlySet<string> = new Set([
  'script', 'style',
]);

/** Elementos RCDATA: solo contenido de texto, pero sujeto a decodificación de entidades. */
export const ESCAPABLE_RAW_TEXT_ELEMENTS: ReadonlySet<string> = new Set([
  'textarea', 'title',
]);

/** Elementos cuyo espacio en blanco es significativo y debe preservarse byte a byte. */
export const WHITESPACE_SENSITIVE_ELEMENTS: ReadonlySet<string> = new Set([
  'pre', 'textarea',
]);

export function isVoidElement(tagName: string): boolean {
  return VOID_ELEMENTS.has(tagName.toLowerCase());
}

export function isInlineElement(tagName: string): boolean {
  return INLINE_ELEMENTS.has(tagName.toLowerCase());
}

export function isRawTextElement(tagName: string): boolean {
  return RAW_TEXT_ELEMENTS.has(tagName.toLowerCase());
}

export function isEscapableRawTextElement(tagName: string): boolean {
  return ESCAPABLE_RAW_TEXT_ELEMENTS.has(tagName.toLowerCase());
}

export function isWhitespaceSensitiveElement(tagName: string): boolean {
  return WHITESPACE_SENSITIVE_ELEMENTS.has(tagName.toLowerCase());
}

export const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
