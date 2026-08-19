import { Injectable, OnDestroy } from '@angular/core';
import { CodeFormatterOptions, CodeLanguage } from '../code-formatter/code-formatter-options.model';
import { FormatResult, FormatStats, FormatWarning } from '../html-formatter/model/format-result.model';
import { HtmlFormatterOptions } from '../html-formatter/model/formatter-options.model';
import { CodeFormatRequest, CodeFormatResponseOk, HtmlFormatRequest, HtmlFormatResponseOk } from './formatter-worker.protocol';

/** Marca un resultado descartado porque una petición más nueva lo reemplazó: no es un error real. */
export class SupersededError extends Error {
  constructor() {
    super('superseded');
    this.name = 'SupersededError';
  }
}

interface PendingJob<TRes> {
  requestId: number;
  resolve: (value: TRes) => void;
  reject: (reason: unknown) => void;
}

/**
 * Ejecuta un tipo de trabajo (HTML o código) en su propio Web Worker dedicado.
 * Si llega una petición nueva mientras la anterior sigue procesándose —el caso
 * real con documentos enormes, donde el formateo puede tardar varios segundos—
 * se termina el worker en curso y se arranca uno nuevo, para que el trabajo
 * obsoleto deje de consumir CPU en vez de simplemente ignorarse al terminar.
 */
class WorkerJobRunner<TReq extends { requestId: number }, TRes extends { requestId: number; ok: boolean }> {
  private worker: Worker | undefined;
  private pending: PendingJob<TRes> | undefined;
  private nextRequestId = 1;

  constructor(private readonly createWorker: () => Worker) {}

  run(buildRequest: (requestId: number) => TReq): Promise<TRes> {
    this.cancelCurrent();
    const worker = this.ensureWorker();
    const requestId = this.nextRequestId++;
    return new Promise<TRes>((resolve, reject) => {
      this.pending = { requestId, resolve, reject };
      worker.postMessage(buildRequest(requestId));
    });
  }

  dispose(): void {
    this.cancelCurrent();
    this.worker?.terminate();
    this.worker = undefined;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      const worker = this.createWorker();
      worker.onmessage = (event: MessageEvent<TRes>) => this.handleMessage(event.data);
      worker.onerror = (event: ErrorEvent) => this.failCurrent(new Error(event.message || 'Error en el worker de formateo'));
      this.worker = worker;
    }
    return this.worker;
  }

  private handleMessage(data: TRes): void {
    if (!this.pending || data.requestId !== this.pending.requestId) return; // respuesta de una petición ya reemplazada
    const { resolve, reject } = this.pending;
    this.pending = undefined;
    if (data.ok) {
      resolve(data);
    } else {
      reject(new Error((data as unknown as { error: string }).error));
    }
  }

  private failCurrent(error: Error): void {
    this.pending?.reject(error);
    this.pending = undefined;
  }

  private cancelCurrent(): void {
    if (!this.pending) return;
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.reject(new SupersededError());
    this.pending = undefined;
  }
}

@Injectable({ providedIn: 'root' })
export class FormatterWorkerClient implements OnDestroy {
  private readonly htmlRunner = new WorkerJobRunner<HtmlFormatRequest, HtmlFormatResponseOk>(() => this.spawnWorker());
  private readonly codeRunner = new WorkerJobRunner<CodeFormatRequest, CodeFormatResponseOk>(() => this.spawnWorker());

  async formatHtml(source: string, options: HtmlFormatterOptions): Promise<FormatResult> {
    const raw = await this.htmlRunner.run((requestId) => ({
      kind: 'html',
      requestId,
      source,
      options: { ...options },
    }));
    const stats = new FormatStats(raw.stats.inputLength, raw.stats.outputLength, raw.stats.inputLines, raw.stats.outputLines, raw.stats.elapsedMs);
    const warnings = raw.warnings.map((w) => new FormatWarning(w.message, w.context));
    return new FormatResult(raw.code, stats, warnings);
  }

  async formatCode(
    source: string,
    language: CodeLanguage,
    options: CodeFormatterOptions,
  ): Promise<{ code: string; elapsedMs: number }> {
    const raw = await this.codeRunner.run((requestId) => ({
      kind: 'code',
      requestId,
      source,
      language,
      options: { ...options },
    }));
    return { code: raw.code, elapsedMs: raw.elapsedMs };
  }

  ngOnDestroy(): void {
    this.htmlRunner.dispose();
    this.codeRunner.dispose();
  }

  private spawnWorker(): Worker {
    return new Worker(new URL('./formatter.worker', import.meta.url), { type: 'module' });
  }
}
