# DMC data loader console

Angular console for Greg's team to add, edit and delete `dmc-data-loader` import configs. Access in production is Google IAP in front of Cloud Run, so the app has no login screen of its own.

The visual language follows [dmc-console-core](https://github.com/gferreux/dmc-console-core): Sora and Inter, brand violet `#706ef5`, the gray scale, and a dark sidenav with a white top bar. This repo is a standalone Angular app rather than an Nx library inside that monorepo.

The API is [dmc-dataloader-api](https://github.com/gferreux/dmc-dataloader-api). The client follows `api/openapi.yaml` in that repo. Assumptions that the spec leaves open are listed at the bottom.

## Prerequisites

- Node.js 22.22.3 or newer (`nvm use` reads `.nvmrc`)
- npm 10

## Mock mode

Mock mode is the default. `public/assets/runtime-config.json` ships with `useMock: true`, and the app talks to an in-memory API with small fictional fixtures (Demo Retail, Sample Brand). No backend is required.

```bash
npm install
npm start
```

Open http://localhost:4200. The header shows a Mock API chip and the signed-in demo user.

## Local API

Point the console at a running API by editing `public/assets/runtime-config.json` (this file is not bundled into the compile; it is fetched when the app starts):

```json
{
  "apiBaseUrl": "",
  "useMock": false
}
```

Leave `apiBaseUrl` empty to use the dev-server proxy in `proxy.conf.json`, which forwards `/api` to `http://localhost:8080`. To call another origin directly:

```json
{
  "apiBaseUrl": "http://localhost:8080",
  "useMock": false
}
```

The API must allow the console origin if you set an absolute base URL. Restart `npm start` after changing the file.

## Tests and lint

```bash
npm test
npm run lint
npm run build
```

## Docker

The image builds the app and serves it with nginx. nginx falls back to `index.html` for client routes. At container start, `API_BASE_URL` and `USE_MOCK` are written into `/assets/runtime-config.json`, so the API URL is not baked in at build time.

`USE_MOCK` must be the JSON boolean `true` or `false`.

```bash
docker build -t dmc-dataloader-console .
docker run --rm -p 8080:8080 -e USE_MOCK=true -e API_BASE_URL= dmc-dataloader-console
```

Against a local API from inside the container, `localhost` is the container itself. Pass a reachable host instead:

```bash
docker run --rm -p 8080:8080 \
  -e USE_MOCK=false \
  -e API_BASE_URL=http://host.docker.internal:8080 \
  dmc-dataloader-console
```

Cloud Run injects `PORT` (the image defaults to 8080). IAP headers `X-Goog-Authenticated-User-Email` and `X-Goog-Authenticated-User-Id` are exposed to the browser as `GET /whoami`. The header chip hides itself when that call has no email. This is not an API endpoint and is not part of the loader contract.

## Cloud Build

`cloudbuild.yaml` builds the image, pushes it to Artifact Registry, and deploys Cloud Run in `europe-west1`. It is not run by this repository's CI. Substitutions:

| Name | Default |
| --- | --- |
| `_REGION` | `europe-west1` |
| `_SERVICE` | `dmc-dataloader-console` |
| `_REPOSITORY` | `dmc` |
| `_API_BASE_URL` | empty (same origin; put the API behind the same host or set this) |

IAP and the Artifact Registry repository are configured outside this file. Do not deploy from a laptop with this config unless that project setup already exists.

## Contract assumptions

Aligned with `dmc-dataloader-api` `api/openapi.yaml`:

- Mapping `type` is the domain iota: `0 RENAME`, `1 SQL`, `2 PREFIX_PATTERN`, `3 CUSTOM`, `4 EXTRA_FIELDS`, `5 MISSING_MAPPINGS`, `6 ARRAY`. Labels come from `/meta`. BigQuery column types (`STRING`, `DATE`, …) stay on the template column and are shown next to the name. A copied CSV column uses `0`. A SQL expression such as `SUBSTR(...)` uses `1`.
- `bqParams.sourceFormat` is an integer: `0` CSV, `1` JSON. The form is a select of those labels.
- `organization.account` and `bqParams.nullMarker` are nullable. An empty field is sent as `null`.
- `organization.type` writes must be `advertiser` or `publisher`. A stored `referential` value is shown in the select and blocks save until it is changed. Partner type still derives from the dataset when the organization type is neither publisher nor advertiser.
- `partnerType` and `importType` are derived. The client keeps values the API returns. Otherwise it follows the API's `Classify`: organization type, then dataset id, then import kind; import kind prefers the last id segment, then the table id. `profiles` is opt-in. The opt-out starter table id is `optout`.
- Request bodies contain only modeled fields. `createTime`, `updateTime`, `partnerType`, and `importType` are omitted. `deactivated`, `incremental`, and `mappings.<column>.isPartitionKey` are not in the schema; sending them is HTTP 400 (`DisallowUnknownFields`). The API preserves those stored fields on PUT when they are absent from the body, so this console does not edit them.
- List takes `partnerType`, `importType`, and `q` only. There is no deactivated filter.
- Config ids are path-encoded. `DELETE` is 204 with an empty body, read as text.
- `POST /load-configs/validate` returns 200 with `{errors, warnings}`. Errors block save. Warnings need Save anyway. The mock follows the API's checks: organization type, source format, mapping type, at least one pattern, notification all-or-nothing, unanchored regex, shared patterns, and `INCREMENTAL` without a primary key.
- `POST /load-configs/test-pattern` sets `matches` from the submitted pattern. `matchingConfigId` is the first config, in document id order, whose ingest or preprocess pattern matches the path. Either pattern counts.
- Mapping order is JSON key order. A Go map or Firestore map may not keep it.
- Mock template starters use project `demo-dmc-eu`. The API's `/templates` defaults use `dmc-datastores-dev-becb`. Column lists, mapping type `0`, and nullable account and null marker match the API catalog.
- Field delimiter Tab is the single character U+0009. The form rejects the two-character text `\t`. The API only warns about that text.

## Open questions

- Whether mapping order needs an explicit field because Firestore maps are unordered.
- Whether IAP identity should come from `/whoami` on this container or from a future `/api/v1/me`.
- Whether the console should gain a way to edit `deactivated`, `incremental`, and `isPartitionKey` once the API models them. Today those fields are preserved server-side and are not readable.
