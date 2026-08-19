import { CodeLanguage } from '../code-formatter/code-formatter-options.model';

/**
 * Contrato de mensajes entre el hilo principal y {@link formatter.worker}.
 * Todo lo que cruza esa frontera pasa por `structuredClone`, así que aquí solo
 * hay datos planos (nada de clases ricas ni funciones) — la reconstrucción en
 * instancias reales de {@link HtmlFormatterOptions}/{@link FormatResult} ocurre
 * en {@link FormatterWorkerClient}, a ambos lados de la frontera.
 */

export interface HtmlFormatRequest {
  kind: 'html';
  requestId: number;
  source: string;
  options: Record<string, unknown>;
}

export interface CodeFormatRequest {
  kind: 'code';
  requestId: number;
  source: string;
  language: CodeLanguage;
  options: Record<string, unknown>;
}

export type FormatWorkerRequest = HtmlFormatRequest | CodeFormatRequest;

export interface PlainFormatStats {
  inputLength: number;
  outputLength: number;
  inputLines: number;
  outputLines: number;
  elapsedMs: number;
}

export interface PlainFormatWarning {
  message: string;
  context?: string;
}

export interface HtmlFormatResponseOk {
  kind: 'html';
  requestId: number;
  ok: true;
  code: string;
  stats: PlainFormatStats;
  warnings: PlainFormatWarning[];
}

export interface CodeFormatResponseOk {
  kind: 'code';
  requestId: number;
  ok: true;
  code: string;
  elapsedMs: number;
}

export interface FormatResponseErr {
  kind: 'html' | 'code';
  requestId: number;
  ok: false;
  error: string;
}

export type FormatWorkerResponse = HtmlFormatResponseOk | CodeFormatResponseOk | FormatResponseErr;
