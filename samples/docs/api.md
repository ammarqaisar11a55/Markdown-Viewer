# API Reference

Reference for the Notes API used in the [getting started guide](getting-started.md).
All endpoints are relative to `https://api.example.com/v1`.

## Authentication

Every request needs a bearer token in the `Authorization` header:

```http
GET /notes HTTP/1.1
Host: api.example.com
Authorization: Bearer <token>
```

> [!CAUTION]
> Never commit tokens to a repository. Load them from the environment instead.

Tokens expire after 90 days. Requests with a missing or expired token return
`401 Unauthorized`.

## Endpoints

| Method   | Path          | Description           |
| :------- | :------------ | :-------------------- |
| `GET`    | `/notes`      | List notes            |
| `GET`    | `/notes/{id}` | Get a single note     |
| `POST`   | `/notes`      | Create a note         |
| `DELETE` | `/notes/{id}` | Delete a note         |

### List notes

`GET /notes?limit=20&cursor=<cursor>`

```json
{
  "items": [
    { "id": "n_01", "title": "Meeting notes", "updatedAt": "2026-09-01T10:00:00Z" }
  ],
  "nextCursor": null
}
```

### Create a note

```bash
curl -X POST https://api.example.com/v1/notes \
  -H "Authorization: Bearer $NOTES_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Ideas", "body": "# Ideas\n\n- First"}'
```

## Errors

| Status | Meaning                          |
| -----: | -------------------------------- |
|    400 | The request body is invalid      |
|    401 | Missing or expired token         |
|    404 | The note does not exist          |
|    429 | Too many requests; retry later   |

Errors use a consistent shape:

```json
{ "error": { "code": "not_found", "message": "Note n_99 does not exist." } }
```

## See also

- [Getting started](getting-started.md#installation)
- [Back to the top](#api-reference)
