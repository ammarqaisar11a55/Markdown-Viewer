# Getting Started

This guide belongs to a small documentation set used to try out folder mode.
Open the `samples/` folder with <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>O</kbd>
and the files appear in the sidebar under **Files**.

## Installation

Install the client library with your package manager:

```bash
npm install @example/notes-client
```

Then create a client with your API token:

```ts
import { NotesClient } from '@example/notes-client';

const client = new NotesClient({ token: process.env.NOTES_TOKEN ?? '' });
```

> [!NOTE]
> Tokens are covered in [API reference → Authentication](api.md#authentication).

## Configuration

| Option      | Type     | Default                      | Description               |
| ----------- | -------- | ---------------------------- | ------------------------- |
| `token`     | `string` | —                            | API token (required)      |
| `baseUrl`   | `string` | `https://api.example.com/v1` | Server address            |
| `timeoutMs` | `number` | `10000`                      | Request timeout           |

## Your first request

```ts
const notes = await client.notes.list({ limit: 10 });
for (const note of notes) {
  console.log(note.title);
}
```

The response format is described in [Endpoints](api.md#endpoints).

## Next steps

- Read the [API reference](api.md).
- Go back to the [feature showcase](../showcase.md).
- Jump to [Configuration](#configuration) on this page.
