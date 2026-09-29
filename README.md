# DMC data loader console

Angular console for Greg's team to add, edit and delete `dmc-data-loader` import configs. Access in production is Google IAP in front of Cloud Run, so the app has no login screen of its own.

The visual language follows [dmc-console-core](https://github.com/gferreux/dmc-console-core): Sora and Inter, brand violet `#706ef5`, the gray scale, and a dark sidenav with a white top bar. This repo is a standalone Angular app rather than an Nx library inside that monorepo.

The API is [dmc-dataloader-api](https://github.com/gferreux/dmc-dataloader-api). That repo does not publish an OpenAPI document yet, so this UI follows the REST contract described in the project brief. Assumptions are listed at the bottom.

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

- `GET /api/v1/meta` mapping type integers are `1 STRING`, `2 INTEGER`, `3 FLOAT`, `4 BOOLEAN`, `5 DATE`, `6 TIMESTAMP`, `7 NUMERIC`, `8 BYTES` until the API publishes the real list. The UI labels types from that payload.
- `partnerType` and `importType` are derived, not stored. The client prefers values the API returns. If they are missing it infers partner from `publishers` / `advertisers` in the dataset id, and import type from the table id. Table `profiles` is treated as `optin`.
- Create and update bodies omit `createTime`, `updateTime`, `partnerType` and `importType`.
- List responses are full config documents, so the active toggle can `PUT` the row it is showing.
- `includeDeactivated=false` returns active configs. Deactivated-only is done by requesting deactivated rows and filtering client-side, because the contract has no status enum.
- Config ids are path-encoded (`demo_retail%3Ademo%3Aoptin`).
- `DELETE` returns 204 with an empty body. The client uses a text response so it does not try to parse JSON.
- `POST /load-configs/validate` returns 200 with `{errors, warnings}`. Errors block save. Warnings need an explicit Save anyway. The mock also warns when a regex is not anchored with both `^` and `$`, and when another active config shares the ingest pattern or destination table.
- `POST /load-configs/test-pattern` sets `matches` from the submitted pattern. `matchingConfigId` is the first non-deactivated config whose ingest or preprocess pattern matches the path, in list order. Which of the two patterns the loader actually uses is an open question.
- Mapping order is the order of keys in the JSON object. A Go `map` or Firestore map may not preserve it.
- Template columns without an explicit type are STRING. `country` with hint "Default FR" is prefilled with the SQL literal `'FR'`. A required marker applies only to the column it is written next to (`mobile_phone`, `optin_sms`, `collect_date`, `collect_url`, and the sales/stores columns called out as required).
- Organization, notification and both patterns are required by the form and the mock validator. The real API may treat some of them as optional.
- Field delimiter Tab is the single character U+0009. The two-character text `\t` is rejected.
- Unspecified BQ types on template columns stay STRING. Illustrative primary-key and partition flags on the fixtures are not a statement of loader rules.

## Open questions

- Final OpenAPI from `dmc-dataloader-api`, especially mapping type codes and which fields are required.
- Whether `profiles` is always publisher opt-in, and how opt-out tables are named.
- Whether the loader matches `patterns.ingest`, `patterns.preprocess`, or both against `bucket/objectName`.
- Whether mapping order needs an explicit field because Firestore maps are unordered.
- Whether IAP identity should come from `/whoami` on this container or from a future `/api/v1/me`.
