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

| Name            | Default                                                           |
| --------------- | ----------------------------------------------------------------- |
| `_REGION`       | `europe-west1`                                                    |
| `_SERVICE`      | `dmc-dataloader-console`                                          |
| `_REPOSITORY`   | `dmc`                                                             |
| `_API_BASE_URL` | empty (same origin; put the API behind the same host or set this) |

IAP and the Artifact Registry repository are configured outside this file. Do not deploy from a laptop with this config unless that project setup already exists.

## Contract assumptions

The create and edit flow follows `dmc-dataloader-api` `api/openapi.yaml` (`LoadConfigWrite`, `DerivedConfig`, and the organization routes).

- `GET /api/v1/organizations?type=publisher|advertiser` returns a JSON array `[{id, name, slug}]`. A bad `type` is 400.
- `GET /api/v1/organizations/{id}/accounts` returns `[{id, name, slug}]`. An unknown organization returns an empty array.
- `GET /api/v1/organizations/{slug}/bases?type=publisher` returns `[{name, slug}]`. `id` is omitted. Names are the slugs already used in load-config paths. A bad `type` is 400.
- `POST /api/v1/load-configs/derive` takes `{kind, organizationName, nestedName, fileType}` and returns `{id, publisherName, patterns, notification, destination, organization, warnings}`. Warnings include pattern overlap and `a load config with this id already exists`. A 422 names the organization (`organization "Name" (kind) was not found`) or the account (`account "Name" was not found for organization "Name"`). An unknown publisher base is accepted. An empty slug is `organization name is empty after slug normalization` or `nested name is empty after slug normalization`.
- Create and update send `LoadConfigWrite`: `{kind, organizationName, nestedName, fileType, mode, bqParams, mappings}`. Derived plumbing is not sent. Create is 201 and sets `Location`. 409 means the id already exists. Update omits the four identity fields for a legacy document, and the server keeps stored plumbing. Sending identity that slugs to the same document also keeps stored plumbing. Changing it moves the document; the response sets `Location`, and the console opens that id.
- `POST /load-configs/validate` takes a full `LoadConfig` (the derived document, or the stored legacy document with the edited mode, `bqParams`, and mappings). It does not take the slim write body.
- Mock derive trims, lowercases, strips accents, turns spaces and `-` into `_`, and keeps `[a-z0-9_]`. The id and `publisherName` are `{org}:{nested}:{fileType}`. Patterns are anchored. Advertiser preprocess is `^dkp-dmc-advertisers-raw-euw1-dev/{org}/{nested}/{fileType}/.+[.](csv|zip|gz|gzip|tgz|tar\.gz|7z)$`. Advertiser ingest is `^dkp-dmc-advertisers-staging-euw1-dev/data/[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]Z/{org}/{nested}/{fileType}/.+$`. Publishers use the `dkp-dmc-publishers-*` buckets. Notification is `dmc-curated-inventory-dev-e6da` / `dkp-dmc-data-loader-notifications-dev`. Advertiser destination is `dmc-raw-advertisers-dev-27c7` / `dkp_dmc_advertisers_raw_eu_dev` / the file type, and `organization.account` is the account document id. Publisher destination is `dmc-raw-publishers-dev-c69c` / `dkp_dmc_publishers_raw_eu_dev`, with `optin` stored in `profiles` and `optout` in `optout`, and `organization.account` is `""`.
- GET list and GET one return the stored document. When the id or patterns follow the convention, the payload also includes read-only `kind`, `organizationName`, `nestedName`, and `fileType` (slugs). Legacy documents omit those four. The edit screen uses their presence to decide which form to show.
- Mapping `type` is the domain iota: `0 RENAME`, `1 SQL`, `2 PREFIX_PATTERN`, `3 CUSTOM`, `4 EXTRA_FIELDS`, `5 MISSING_MAPPINGS`, `6 ARRAY`. Labels come from `/meta`. BigQuery column types (`STRING`, `DATE`, …) stay on the template column and are shown next to the name. A copied CSV column uses `0`. A SQL expression such as `SUBSTR(...)` uses `1`.
- `bqParams.sourceFormat` is an integer: `0` CSV, `1` JSON. The form is a select of those labels.
- `organization.account` and `bqParams.nullMarker` are nullable. An empty null marker is sent as `null`.
- `partnerType` and `importType` are derived on read. The client keeps values the API returns. Otherwise it follows the API's `Classify`: organization type, then dataset id, then import kind; import kind prefers the last id segment, then the table id. `profiles` is opt-in.
- `createTime`, `updateTime`, `partnerType`, and `importType` are omitted from writes. `deactivated`, `incremental`, and `mappings.<column>.isPartitionKey` are not sent. The API preserves those stored fields on PUT when they are absent from the body.
- List takes `partnerType`, `importType`, and `q` only. There is no deactivated filter.
- Config ids are path-encoded. `DELETE` is 204 with an empty body, read as text.
- Validate returns 200 with `{errors, warnings}`. Errors block save. Warnings need Save anyway. The mock still checks source format, mapping type, and `INCREMENTAL` without a primary key. Generated patterns are anchored, so the unanchored-regex warning does not apply to them. A stored `referential` organization type can be read and is rejected when a write keeps it.
- `POST /load-configs/test-pattern` sets `matches` from the submitted pattern. `matchingConfigId` is the first config, in document id order, whose ingest or preprocess pattern matches the path. Either pattern counts.
- Mapping order is JSON key order. A Go map or Firestore map may not keep it.
- Mock template starters still carry a destination in `defaults` for the templates endpoint. The form copies mode, `bqParams`, and mappings only.
- Field delimiter Tab is the single character U+0009. The form rejects the two-character text `\t`. The API only warns about that text.

## Open questions

- Whether mapping order needs an explicit field because Firestore maps are unordered.
- Whether IAP identity should come from `/whoami` on this container or from a future `/api/v1/me`.
- Whether the console should gain a way to edit `deactivated`, `incremental`, and `isPartitionKey` once the API models them. Today those fields are preserved server-side and are not readable.
