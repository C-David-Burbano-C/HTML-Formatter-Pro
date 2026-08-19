import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, switchMap } from 'rxjs';

import { CodeFormatterOptions } from '../../core/code-formatter/code-formatter-options.model';
import { FormatResult, FormatStats } from '../../core/html-formatter/model/format-result.model';
import { HtmlFormatterOptions } from '../../core/html-formatter/model/formatter-options.model';
import { MonacoEditorComponent } from '../../core/monaco/monaco-editor.component';
import { FormatterWorkerClient, SupersededError } from '../../core/workers/formatter-worker-client.service';
import { HtmlOptionsPanelComponent } from './options-panel/html-options-panel.component';
import { CodeOptionsPanelComponent } from './options-panel/code-options-panel.component';
import { SAMPLE_HTML, SAMPLE_TS } from './sample-code';

type FormatterTab = 'html' | 'ts';

/**
 * Página única de la aplicación: dos formateadores (HTML y TypeScript) detrás
 * de un selector de pestañas, cada uno con su editor de entrada/salida, su
 * panel de opciones y su propio flujo reactivo de formateo con debounce.
 */
@Component({
  selector: 'app-formatter-page',
  standalone: true,
  imports: [MonacoEditorComponent, HtmlOptionsPanelComponent, CodeOptionsPanelComponent],
  templateUrl: './formatter-page.component.html',
  styleUrl: './formatter-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormatterPageComponent {
  private readonly workerClient = inject(FormatterWorkerClient);

  readonly activeTab = signal<FormatterTab>('html');
  readonly optionsPanelOpen = signal(true);

  // --- HTML ---
  readonly htmlSource = signal(SAMPLE_HTML);
  readonly htmlOptions = signal(HtmlFormatterOptions.default());
  readonly htmlOutput = signal('');
  readonly htmlStats = signal<FormatStats | null>(null);
  readonly htmlWarnings = signal<string[]>([]);
  readonly htmlError = signal<string | null>(null);
  readonly htmlBusy = signal(false);

  // --- TypeScript ---
  readonly tsSource = signal(SAMPLE_TS);
  readonly tsOptions = signal(CodeFormatterOptions.default());
  readonly tsOutput = signal('');
  readonly tsError = signal<string | null>(null);
  readonly tsBusy = signal(false);
  readonly tsElapsedMs = signal(0);

  readonly copyState = signal<'idle' | 'copied'>('idle');

  readonly currentOutputLength = computed(() =>
    this.activeTab() === 'html' ? this.htmlOutput().length : this.tsOutput().length,
  );

  constructor() {
    this.wireHtmlPipeline();
    this.wireTsPipeline();
  }

  private wireHtmlPipeline(): void {
    combineLatest([toObservable(this.htmlSource), toObservable(this.htmlOptions)])
      .pipe(
        debounceTime(200),
        switchMap(([source, options]) => {
          this.htmlBusy.set(true);
          this.htmlError.set(null);
          return this.runHtmlFormat(source, options);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.htmlBusy.set(false);
        if (result === null) return;
        this.htmlOutput.set(result.code);
        this.htmlStats.set(result.stats);
        this.htmlWarnings.set(result.warnings.map((w) => w.message));
      });
  }

  private wireTsPipeline(): void {
    combineLatest([toObservable(this.tsSource), toObservable(this.tsOptions)])
      .pipe(
        debounceTime(200),
        switchMap(([source, options]) => {
          this.tsBusy.set(true);
          this.tsError.set(null);
          return this.codeFormatterSafe(source, options);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.tsBusy.set(false);
        if (result === null) return;
        this.tsOutput.set(result.code);
        this.tsElapsedMs.set(result.elapsedMs);
      });
  }

  private async runHtmlFormat(source: string, options: HtmlFormatterOptions): Promise<FormatResult | null> {
    if (source.trim() === '') {
      this.htmlOutput.set('');
      this.htmlStats.set(null);
      this.htmlWarnings.set([]);
      return null;
    }
    try {
      return await this.workerClient.formatHtml(source, options);
    } catch (err) {
      if (!(err instanceof SupersededError)) {
        this.htmlError.set(this.describeError(err));
      }
      return null;
    }
  }

  private async codeFormatterSafe(
    source: string,
    options: CodeFormatterOptions,
  ): Promise<{ code: string; elapsedMs: number } | null> {
    if (source.trim() === '') {
      this.tsOutput.set('');
      return null;
    }
    try {
      return await this.workerClient.formatCode(source, 'typescript', options);
    } catch (err) {
      if (!(err instanceof SupersededError)) {
        this.tsError.set(this.describeError(err));
      }
      return null;
    }
  }

  private describeError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    return message.split('\n')[0];
  }

  selectTab(tab: FormatterTab): void {
    this.activeTab.set(tab);
  }

  // Clases Tailwind del botón de pestaña según si está activo o no.
  tabButtonClass(tab: FormatterTab): string {
    return this.activeTab() === tab ? 'bg-accent text-white' : 'text-fg-muted';
  }

  toggleOptionsPanel(): void {
    this.optionsPanelOpen.update((open) => !open);
  }

  loadSample(): void {
    if (this.activeTab() === 'html') {
      this.htmlSource.set(SAMPLE_HTML);
    } else {
      this.tsSource.set(SAMPLE_TS);
    }
  }

  clear(): void {
    if (this.activeTab() === 'html') {
      this.htmlSource.set('');
    } else {
      this.tsSource.set('');
    }
  }

  async copyOutput(): Promise<void> {
    const text = this.activeTab() === 'html' ? this.htmlOutput() : this.tsOutput();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    this.copyState.set('copied');
    setTimeout(() => this.copyState.set('idle'), 1600);
  }

  downloadOutput(): void {
    const isHtml = this.activeTab() === 'html';
    const text = isHtml ? this.htmlOutput() : this.tsOutput();
    if (!text) return;
    const blob = new Blob([text], { type: isHtml ? 'text/html' : 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = isHtml ? 'formateado.html' : 'formateado.ts';
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
