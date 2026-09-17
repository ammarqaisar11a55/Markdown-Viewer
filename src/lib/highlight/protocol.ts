// Messages exchanged between the main thread and the highlight worker.

import type { SupportedLanguage } from './languages';

export interface HighlightRequest {
  type: 'highlight';
  id: number;
  code: string;
  lang: SupportedLanguage;
}

export interface CancelRequest {
  type: 'cancel';
  id: number;
}

export type WorkerRequest = HighlightRequest | CancelRequest;

/** A token: its text and an index into `styles` (`-1` = default color). */
export type WireToken = [content: string, style: number];

export interface HighlightResult {
  /** Custom properties for the block's default color, e.g. `--shiki-light`. */
  base: Record<string, string>;
  /** Distinct token style maps (custom properties such as `--shiki-dark`). */
  styles: Record<string, string>[];
  lines: WireToken[][];
}

export type WorkerResponse =
  | ({ type: 'result'; id: number } & HighlightResult)
  | { type: 'error'; id: number; message: string };
