import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, model, viewChild } from '@angular/core';
import type * as Monaco from 'monaco-editor';
import { MonacoLoaderService } from './monaco-loader.service';

/**
 * Envoltorio de Monaco Editor como componente standalone de Angular, con
 * binding bidireccional por señales (`[(value)]`) y actualización reactiva
 * de idioma / modo solo-lectura. Toda la carga de Monaco (script AMD, workers,
 * tema) vive en {@link MonacoLoaderService} y se comparte entre instancias.
 */
@Component({
  selector: 'app-monaco-editor',
  standalone: true,
  template: `<div #host class="h-full w-full" [attr.aria-label]="ariaLabel()"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonacoEditorComponent {
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly loader = inject(MonacoLoaderService);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = model<string>('');
  readonly language = input<string>('html');
  readonly readOnly = input<boolean>(false);
  readonly ariaLabel = input<string>('Editor de código');

  private editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  private monacoRef: typeof Monaco | undefined;
  private applyingRemoteChange = false;

  constructor() {
    afterNextRender(() => this.init());

    effect(() => {
      const source = this.value();
      if (!this.editor || this.applyingRemoteChange) return;
      if (this.editor.getValue() !== source) {
        const position = this.editor.getPosition();
        this.editor.setValue(source);
        if (position) this.editor.setPosition(position);
      }
    });

    effect(() => {
      const lang = this.language();
      const model = this.editor?.getModel();
      if (model) this.monacoRef?.editor.setModelLanguage(model, lang);
    });

    effect(() => {
      this.editor?.updateOptions({ readOnly: this.readOnly() });
    });
  }

  private async init(): Promise<void> {
    const monaco = await this.loader.load();
    this.monacoRef = monaco;

    this.editor = monaco.editor.create(this.host().nativeElement, {
      value: this.value(),
      language: this.language(),
      readOnly: this.readOnly(),
      theme: 'app-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontLigatures: true,
      fontSize: 13.5,
      lineHeight: 1.6,
      fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      renderLineHighlight: 'gutter',
      padding: { top: 14, bottom: 14 },
      tabSize: 2,
      wordWrap: 'on',
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
    });

    this.editor.onDidChangeModelContent(() => {
      this.applyingRemoteChange = true;
      this.value.set(this.editor!.getValue());
      this.applyingRemoteChange = false;
    });

    this.destroyRef.onDestroy(() => this.editor?.dispose());
  }

  /** Fuerza un re-layout (útil tras animaciones de tamaño, cambios de panel, etc). */
  layout(): void {
    this.editor?.layout();
  }
}
