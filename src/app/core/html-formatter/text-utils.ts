/** Utilidades de texto pequeñas y sin dependencias, compartidas por el impresor de HTML. */

/** Colapsa cualquier secuencia de espacios en blanco (incluyendo saltos de línea) en un solo espacio. */
export function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/** Escapa el contenido de un nodo de texto para que sea idéntico al re-parsearlo. */
export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escapa el valor de un atributo según el carácter de comilla usado para envolverlo. */
export function escapeAttributeValue(value: string, quoteChar: '"' | "'"): string {
  const escaped = value.replace(/&/g, '&amp;');
  return quoteChar === '"' ? escaped.replace(/"/g, '&quot;') : escaped.replace(/'/g, '&#39;');
}

/** Quita la mayor indentación común compartida por todas las líneas no vacías. */
export function dedent(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let common: string | null = null;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const leading = /^[ \t]*/.exec(line)![0];
    if (common === null || leading.length < common.length) {
      common = leading;
    }
  }
  if (!common) return text.replace(/\r\n/g, '\n');
  return lines.map((l) => (l.startsWith(common!) ? l.slice(common!.length) : l.trimStart())).join('\n');
}

/** Reindenta un bloque multilínea (normalmente ya dedentado) al nivel de profundidad dado. */
export function indentLines(text: string, indentUnit: string, depth: number): string[] {
  const prefix = indentUnit.repeat(depth);
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : prefix + line));
}
