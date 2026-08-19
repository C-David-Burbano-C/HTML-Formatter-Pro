import { Injectable } from '@angular/core';
import type * as Monaco from 'monaco-editor';

declare global {
  interface Window {
    monaco?: typeof Monaco;
    require?: {
      config: (options: { paths: Record<string, string> }) => void;
      (deps: string[], callback: () => void): void;
    };
    MonacoEnvironment?: unknown;
  }
}

const MONACO_BASE_URL = '/monaco';

const WORKER_BY_LABEL: Record<string, string> = {
  json: 'vs/language/json/json.worker.js',
  css: 'vs/language/css/css.worker.js',
  scss: 'vs/language/css/css.worker.js',
  less: 'vs/language/css/css.worker.js',
  html: 'vs/language/html/html.worker.js',
  handlebars: 'vs/language/html/html.worker.js',
  razor: 'vs/language/html/html.worker.js',
  typescript: 'vs/language/typescript/ts.worker.js',
  javascript: 'vs/language/typescript/ts.worker.js',
};

/**
 * Carga Monaco Editor desde los archivos estáticos locales en `/monaco/vs`
 * (copiados de `monaco-editor/min/vs` al hacer build) usando su cargador AMD
 * clásico, evitando por completo los dolores de cabeza de empaquetar sus
 * web workers con el builder basado en esbuild de Angular. La carga se
 * memoiza: solo se inserta un `<script>` y se ejecuta el loader una vez,
 * sin importar cuántos editores se creen.
 */
@Injectable({ providedIn: 'root' })
export class MonacoLoaderService {
  private loadPromise: Promise<typeof Monaco> | null = null;

  load(): Promise<typeof Monaco> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadInternal();
    }
    return this.loadPromise;
  }

  private loadInternal(): Promise<typeof Monaco> {
    if (window.monaco) return Promise.resolve(window.monaco);

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${MONACO_BASE_URL}/vs/loader.js`;
      script.onload = () => {
        this.configureWorkerEnvironment();
        window.require!.config({ paths: { vs: `${MONACO_BASE_URL}/vs` } });
        window.require!(['vs/editor/editor.main'], () => {
          this.registerTheme(window.monaco!);
          resolve(window.monaco!);
        });
      };
      script.onerror = () => reject(new Error('No se pudo cargar Monaco Editor desde /monaco/vs/loader.js'));
      document.body.appendChild(script);
    });
  }

  private configureWorkerEnvironment(): void {
    const origin = window.location.origin;
    window.MonacoEnvironment = {
      getWorkerUrl: (_moduleId: string, label: string) => {
        const workerPath = WORKER_BY_LABEL[label] ?? 'vs/editor/editor.worker.js';
        const workerSource = `
          self.MonacoEnvironment = { baseUrl: '${origin}${MONACO_BASE_URL}/' };
          importScripts('${origin}${MONACO_BASE_URL}/${workerPath}');
        `;
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(workerSource)}`;
      },
    };
  }

  /** Tema oscuro a medida, alineado con los tokens de diseño de `styles.scss`. */
  private registerTheme(monaco: typeof Monaco): void {
    monaco.editor.defineTheme('app-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#12151c',
        'editor.foreground': '#e7e9f0',
        'editorLineNumber.foreground': '#6b7285',
        'editorLineNumber.activeForeground': '#9aa1b5',
        'editor.selectionBackground': '#7c5cff33',
        'editor.inactiveSelectionBackground': '#7c5cff1a',
        'editorCursor.foreground': '#7c5cff',
        'editorIndentGuide.background': '#1f2430',
        'editorIndentGuide.activeBackground': '#262b38',
        'editorGutter.background': '#12151c',
        'editorWidget.background': '#181c26',
        'editorWidget.border': '#262b38',
        'editorSuggestWidget.background': '#181c26',
        'editorSuggestWidget.border': '#262b38',
        'scrollbarSlider.background': '#1f243066',
        'scrollbarSlider.hoverBackground': '#262b3899',
      },
    });
  }
}
