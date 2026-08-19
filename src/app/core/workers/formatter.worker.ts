/// <reference lib="webworker" />

import { CodeFormatterOptions } from '../code-formatter/code-formatter-options.model';
import { CodeFormatterService } from '../code-formatter/code-formatter.service';
import { HtmlFormatterOptions } from '../html-formatter/model/formatter-options.model';
import { HtmlFormatterService } from '../html-formatter/html-formatter.service';
import { FormatWorkerRequest, FormatWorkerResponse } from './formatter-worker.protocol';

/**
 * Corre el pipeline de formateo completo (parseo de HTML, formateo de código
 * embebido, impresión / Prettier) fuera del hilo principal, para que documentos
 * grandes no congelen la UI ni el editor mientras se procesan.
 *
 * Se instancian las mismas clases "ricas" que usa el hilo principal — no hay
 * lógica duplicada, `HtmlFormatterService`/`CodeFormatterService` no dependen
 * del framework más allá del decorador `@Injectable`, así que se pueden crear
 * aquí con `new` directamente, sin el inyector de Angular.
 */
const codeFormatter = new CodeFormatterService();
const htmlFormatter = new HtmlFormatterService(codeFormatter);

addEventListener('message', async ({ data }: MessageEvent<FormatWorkerRequest>) => {
  if (data.kind === 'html') {
    await handleHtmlRequest(data);
  } else {
    await handleCodeRequest(data);
  }
});

async function handleHtmlRequest(request: Extract<FormatWorkerRequest, { kind: 'html' }>): Promise<void> {
  try {
    const options = HtmlFormatterOptions.default().clone(request.options);
    const result = await htmlFormatter.format(request.source, options);
    const response: FormatWorkerResponse = {
      kind: 'html',
      requestId: request.requestId,
      ok: true,
      code: result.code,
      stats: { ...result.stats },
      warnings: result.warnings.map((w) => ({ message: w.message, context: w.context })),
    };
    postMessage(response);
  } catch (err) {
    postMessage({ kind: 'html', requestId: request.requestId, ok: false, error: describeError(err) } satisfies FormatWorkerResponse);
  }
}

async function handleCodeRequest(request: Extract<FormatWorkerRequest, { kind: 'code' }>): Promise<void> {
  try {
    const options = CodeFormatterOptions.default().clone(request.options);
    const t0 = performance.now();
    const code = await codeFormatter.format(request.source, request.language, options);
    const response: FormatWorkerResponse = {
      kind: 'code',
      requestId: request.requestId,
      ok: true,
      code,
      elapsedMs: performance.now() - t0,
    };
    postMessage(response);
  } catch (err) {
    postMessage({ kind: 'code', requestId: request.requestId, ok: false, error: describeError(err) } satisfies FormatWorkerResponse);
  }
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split('\n')[0];
}
