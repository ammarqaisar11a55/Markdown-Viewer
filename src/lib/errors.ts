// Maps technical failures to friendly, user-facing messages.
import type { AppError, AppErrorKind, FsErrorKind, FsErrorPayload } from '@/types';

export type ErrorContext = 'file' | 'folder';

const FS_KINDS: readonly FsErrorKind[] = [
  'notFound',
  'permissionDenied',
  'notAFile',
  'notADirectory',
  'unsupportedType',
  'tooLarge',
  'io',
];

type Copy = Record<AppErrorKind, { title: string; description: string }>;

const FILE_COPY: Copy = {
  notFound: {
    title: 'Unable to open this file.',
    description: 'The file may have been moved or deleted.',
  },
  permissionDenied: {
    title: 'Unable to open this file.',
    description: 'You don’t have permission to read it.',
  },
  notAFile: {
    title: 'Unable to open this file.',
    description: 'The selected item is not a regular file.',
  },
  notADirectory: {
    title: 'Unable to open this file.',
    description: 'Part of the path is not a folder.',
  },
  unsupportedType: {
    title: 'This file type isn’t supported.',
    description: 'Markdown Viewer opens .md, .markdown, .mdown and .mkd files.',
  },
  tooLarge: {
    title: 'This file is too large to open.',
    description: 'Try splitting the document into smaller files.',
  },
  io: {
    title: 'Unable to read this file.',
    description: 'Something went wrong while reading it. Please try again.',
  },
  unknown: {
    title: 'Something went wrong.',
    description: 'The file could not be opened. Please try again.',
  },
};

const FOLDER_COPY: Copy = {
  notFound: {
    title: 'Unable to open this folder.',
    description: 'The folder may have been moved or deleted.',
  },
  permissionDenied: {
    title: 'Unable to open this folder.',
    description: 'You don’t have permission to read it.',
  },
  notAFile: {
    title: 'Unable to open this folder.',
    description: 'The selected item is not a folder.',
  },
  notADirectory: {
    title: 'Unable to open this folder.',
    description: 'The selected item is not a folder.',
  },
  unsupportedType: {
    title: 'Unable to open this folder.',
    description: 'The selected item is not a folder.',
  },
  tooLarge: {
    title: 'This folder is too large.',
    description: 'Try opening a smaller folder.',
  },
  io: {
    title: 'Unable to read this folder.',
    description: 'Something went wrong while reading it. Please try again.',
  },
  unknown: {
    title: 'Something went wrong.',
    description: 'The folder could not be opened. Please try again.',
  },
};

export function isFsErrorPayload(value: unknown): value is FsErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, message } = value as Record<string, unknown>;
  return (
    typeof message === 'string' &&
    typeof kind === 'string' &&
    (FS_KINDS as readonly string[]).includes(kind)
  );
}

function technicalDetail(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === 'string') return err;
  try {
    const json = JSON.stringify(err) as unknown;
    return typeof json === 'string' ? json : typeof err;
  } catch {
    return typeof err;
  }
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.kind === 'string' &&
    typeof record.title === 'string' &&
    typeof record.description === 'string' &&
    typeof record.technical === 'string'
  );
}

export function toAppError(err: unknown, context: ErrorContext = 'file'): AppError {
  if (isAppError(err)) return err;
  const copy = context === 'folder' ? FOLDER_COPY : FILE_COPY;
  if (isFsErrorPayload(err)) {
    return { kind: err.kind, ...copy[err.kind], technical: err.message };
  }
  return { kind: 'unknown', ...copy.unknown, technical: technicalDetail(err) };
}
