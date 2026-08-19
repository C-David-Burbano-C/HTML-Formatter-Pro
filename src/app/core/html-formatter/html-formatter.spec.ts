import { HtmlAstBuilder } from './html-ast-builder';
import { HtmlPrinter } from './html-printer';
import { HtmlFormatterOptions } from './model/formatter-options.model';

function format(source: string, overrides: Partial<HtmlFormatterOptions> = {}): string {
  const options = HtmlFormatterOptions.default().clone(overrides);
  const doc = new HtmlAstBuilder().build(source, options.documentMode);
  return new HtmlPrinter(options).print(doc);
}

describe('HtmlAstBuilder + HtmlPrinter', () => {
  it('indenta las secciones <head> y <body> de un documento completo', () => {
    const out = format(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>T</title></head><body><p>Hola</p></body></html>',
    );
    expect(out).toBe(
      [
        '<!DOCTYPE html>',
        '<html>',
        '  <head>',
        '    <meta charset="utf-8">',
        '    <title>T</title>',
        '  </head>',
        '  <body>',
        '    <p>Hola</p>',
        '  </body>',
        '</html>',
        '',
      ].join('\n'),
    );
  });

  it('preserva una única línea en blanco entre hermanos y respeta el máximo configurado', () => {
    const source = '<div>\n<p>A</p>\n\n\n\n\n<p>B</p>\n</div>';
    expect(format(source)).toContain('<p>A</p>\n\n  <p>B</p>');
    expect(format(source, { preserveBlankLines: false })).not.toContain('\n\n');
  });

  it('mantiene en una sola línea el contenido que el autor ya escribió en una sola línea', () => {
    const out = format('<div class="card">\n  <span>A</span><span>B</span> <span>C</span>\n</div>');
    expect(out).toContain('<span>A</span><span>B</span> <span>C</span>');
  });

  it('preserva el contenido de <pre> byte a byte', () => {
    const source = '<pre>\n    function foo() {\n        return    1;\n    }\n</pre>';
    expect(format(source)).toBe(source + '\n');
  });

  it('preserva el contenido de <textarea> exactamente (regresión: no debe vaciarse dentro de un flujo en línea)', () => {
    const out = format('<div><textarea>  conservar   esto\n  tal cual  </textarea></div>');
    expect(out).toContain('<textarea>  conservar   esto\n  tal cual  </textarea>');
  });

  it('respeta el estilo de autocierre para elementos vacíos', () => {
    expect(format('<input type="text"><br>')).toBe('<input type="text"><br>\n');
    expect(format('<input type="text"><br>', { voidElementStyle: 'xhtml' })).toBe('<input type="text" /><br />\n');
  });

  it('preserva el casing original de atributos tipo Angular ([(ngModel)], *ngIf, etc)', () => {
    const out = format('<input [(ngModel)]="value" (click)="onClick()" *ngIf="show" [class.active]="isActive">');
    expect(out).toContain('[(ngModel)]="value"');
    expect(out).toContain('(click)="onClick()"');
    expect(out).toContain('*ngIf="show"');
    expect(out).toContain('[class.active]="isActive"');
  });

  it('envuelve los atributos, uno por línea, cuando la etiqueta supera el ancho configurado', () => {
    const out = format(
      '<input type="text" class="form-control form-control-lg" placeholder="Enter your full name here please" data-testid="name-input" required>',
    );
    expect(out).toContain('<input\n  type="text"\n  class="form-control form-control-lg"');
    expect(out.trim().endsWith('>')).toBeTrue();
  });

  it('cierra correctamente los elementos foráneos vacíos de SVG (regresión: no debe duplicar el cierre)', () => {
    const out = format('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>');
    expect(out).not.toContain('/></circle>');
    expect(out).toContain('<circle cx="5" cy="5" r="4" />');
  });

  it('preserva el casing de atributos y etiquetas dentro de contenido SVG', () => {
    const out = format('<svg viewBox="0 0 10 10"><linearGradient id="g"></linearGradient></svg>');
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('<linearGradient');
  });

  it('escapa el símbolo & en <title>', () => {
    const out = format('<html><head><title>Fish & Chips</title></head><body></body></html>');
    expect(out).toContain('<title>Fish &amp; Chips</title>');
  });

  it('re-escapa entidades en el contenido de texto para no corromper el marcado', () => {
    const out = format('<p>A &amp; B &lt; C</p>');
    expect(out).toContain('<p>A &amp; B &lt; C</p>');
  });

  it('tolera HTML mal formado igual que un navegador (cierre implícito de <p>)', () => {
    const out = format('<div class=unquoted><p>Texto<div>Anidado</div></div>');
    expect(out).toContain('class="unquoted"');
    expect(out).toContain('<p>Texto</p>');
    expect(out).toContain('<div>Anidado</div>');
  });

  it('colapsa elementos vacíos a una sola línea', () => {
    expect(format('<div>\n</div>')).toBe('<div></div>\n');
  });

  it('en modo fragmento no envuelve el contenido en <html>/<head>/<body>', () => {
    const out = format('<div>Hola</div>', { documentMode: 'fragment' });
    expect(out).toBe('<div>Hola</div>\n');
  });

  it('formatea documentos muy grandes sin desbordar la pila de llamadas (regresión: push(...items) con miles de filas)', () => {
    const rows: string[] = [];
    for (let i = 0; i < 20000; i++) {
      rows.push(`<tr><td>${i}</td><td>Fila número ${i}</td></tr>`);
    }
    const source = `<table><tbody>${rows.join('')}</tbody></table>`;
    expect(() => format(source)).not.toThrow();
    const out = format(source);
    expect(out).toContain('<td>0</td>');
    expect(out).toContain('<td>19999</td>');
  });

  it('no parte una expresión de interpolación {{ }} al ajustar el texto (regresión)', () => {
    const out = format(
      '<p class="mb-2 text-sm text-gray-500"><span class="font-semibold">{{\'Haga clic para subir\' | translate}}</span> {{\'o arrastre y suelte\' | translate}}</p>',
    );
    expect(out).toContain("{{'o arrastre y suelte' | translate}}");
    expect(out).not.toMatch(/\{\{[^}]*\n/);
  });

  it('no envuelve un único atributo aunque sea muy largo (regresión: class de Tailwind y d de SVG)', () => {
    const outDiv = format(
      '<div class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow">Hola</div>',
    );
    expect(outDiv).toContain(
      '<div class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow">',
    );

    const outSvg = format(
      '<svg><path d="M12 6v12m6-6H6 datos de trazado bastante largos para superar el ancho configurado por defecto" /></svg>',
    );
    expect(outSvg).toContain(
      '<path d="M12 6v12m6-6H6 datos de trazado bastante largos para superar el ancho configurado por defecto" />',
    );
  });

  it('no inserta espacios entre texto y una expresión {{ }} que estaban pegados en el original', () => {
    const out = format(
      "<p>hola{{ 'x' | translate }}mundo, esto es un párrafo bastante largo para forzar el ajuste de línea y ver qué pasa con la expresión pegada al texto</p>",
    );
    expect(out).toContain("hola{{ 'x' | translate }}mundo");
  });
});
