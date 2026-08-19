import { Injectable } from '@angular/core';
import { CodeFormatterOptions, CodeLanguage } from './code-formatter-options.model';

type PrettierPlugin = unknown;

/** Paquete de un plugin parser de Prettier + su impresor (estree/postcss), cargado de forma perezosa y memoizado. */
class PluginBundle {
  private static cache = new Map<string, Promise<PrettierPlugin[]>>();

  static async forLanguage(language: CodeLanguage): Promise<PrettierPlugin[]> {
    const cached = PluginBundle.cache.get(language);
    if (cached) return cached;

    const promise = PluginBundle.load(language);
    PluginBundle.cache.set(language, promise);
    return promise;
  }

  private static async load(language: CodeLanguage): Promise<PrettierPlugin[]> {
    switch (language) {
      case 'typescript': {
        const [ts, estree] = await Promise.all([
          import('prettier/plugins/typescript'),
          import('prettier/plugins/estree'),
        ]);
        return [ts.default, estree.default];
      }
      case 'javascript':
      case 'json': {
        const [babel, estree] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
        return [babel.default, estree.default];
      }
      case 'css':
      case 'scss':
      case 'less': {
        const postcss = await import('prettier/plugins/postcss');
        return [postcss.default];
      }
    }
  }
}

function parserFor(language: CodeLanguage): string {
  switch (language) {
    case 'typescript':
      return 'typescript';
    case 'javascript':
      return 'babel';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'less':
      return 'less';
  }
}

/**
 * Envoltorio delgado y neutral respecto al framework sobre el build standalone
 * de Prettier para navegador. Los plugins se dividen en chunks y se cargan la
 * primera vez que se usa cada idioma, así el bundle inicial de la app nunca
 * paga por parsers que el usuario todavía no ha usado.
 */
@Injectable({ providedIn: 'root' })
export class CodeFormatterService {
  async format(code: string, language: CodeLanguage, options: CodeFormatterOptions = CodeFormatterOptions.default()): Promise<string> {
    const { format } = await import('prettier/standalone');
    const plugins = await PluginBundle.forLanguage(language);
    const result = await format(code, {
      parser: parserFor(language),
      plugins: plugins as never,
      printWidth: options.printWidth,
      tabWidth: options.tabWidth,
      useTabs: options.useTabs,
      singleQuote: options.singleQuote,
      semi: options.semi,
      trailingComma: options.trailingComma,
      bracketSpacing: options.bracketSpacing,
    });
    return result;
  }
}
