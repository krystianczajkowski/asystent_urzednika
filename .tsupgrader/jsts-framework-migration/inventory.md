# Inventory — React/Vite to Angular/NestJS feature parity

## Scope and topology

- Repository root: `asystent_urzednika` monorepo.
- Source package: `asystent_urzednika/` (React 19, Vite, Express, Gemini).
- Target packages: `frontend/` (Angular 21) and `backend/` (NestJS).
- This work migrates the previously omitted UDIP calendar, knowledge base/archive, and response-generation workflow. The legacy package remains in place; this is not the final framework cutover.
- Source UI units: 11 tracked files under `asystent_urzednika/src/`, including 4 application views (`App`, `CalendarDashboard`, `KnowledgeBaseView`, `WorkflowWorkspace`) and shared navigation/types/utilities.
- Source data: `wnioski.csv` contains a title row, header row, and 10 data rows; `server.ts` seeds 8 departments, 6 archive/legal records, and 3 sample requests.

## Source framework and behavior

- React entry: `asystent_urzednika/src/main.tsx`; Vite config: `asystent_urzednika/vite.config.ts`.
- App navigation and in-memory state: `asystent_urzednika/src/App.tsx`.
- Calendar: month navigation, due-date markers, date/status/year filters, search, sorting, summary counters, case selection and status updates in `CalendarDashboard.tsx`.
- Archive/knowledge base: full-text search, category filters, archive upload, manual record entry, departments and anonymization catalogue in `KnowledgeBaseView.tsx`.
- Workflow: request intake, sample cases, archive similarity results, routing recommendations, department-reply input, four response modes, generated draft, and save-to-archive in `WorkflowWorkspace.tsx`.
- API routes in `asystent_urzednika/server.ts`: `GET /api/initial-data`, `POST /api/parse-document`, `/api/analyze-request`, `/api/detect-pii`, `/api/generate-response`, and `/api/export-doc`.
- Source app used Gemini and the source API reports a clear error if `GEMINI_API_KEY` is absent.
- Previously captured source checks (from the migration work): TypeScript check, production build, `/api/initial-data`, and 2 workflow tests passed. The source server required `tsx` for Node 20.

## Target state before the feature-parity changes

- Angular app had only a single-file upload/analyze screen and a Bielik documents API client.
- NestJS exposed health and `POST /api/documents/analyze`; no seeded registry, calendar, archive or response-generation endpoints.
- The target build and runtime behavior have not been revalidated after the feature-parity changes.

## Contract changes

| Contract | Source value | Target value | Why required | Alternatives considered | Validation evidence | Approval status |
|---|---|---|---|---|---|---|
| Node.js floor | `>=20.19.0` | `>=20.19.0` | No increase needed for the requested feature parity | Raise to latest Node; rejected | Existing monorepo package declarations and prior build on Node 22.23.2 | preserved |
| Application framework | React 19/Vite in source package | Angular 21 in target package | User requested Angular frontend and NestJS backend | Keep React as primary UI; rejected by original request | To be validated with target builds and app API checks | approved change |
| AI integration | Gemini API via `GEMINI_API_KEY` | Bielik-compatible API via `BIELIK_API_URL`, `BIELIK_API_KEY`, `BIELIK_MODEL` | Target backend already uses Bielik; retain explicit model configuration | Keep Gemini dependency in target; rejected | To be validated with configured service; credentials may be unavailable | approved change |

