# Migration plan — legacy UDIP feature parity

| Work item | Source evidence | Target design | Dependencies | Validation | Status |
|---|---|---|---|---|---|
| Shared domain models and initial data | `asystent_urzednika/src/types.ts`, `server.ts` seed data, `wnioski.csv` | Typed Angular domain models and NestJS `/api/initial-data` payload for the registry, archive, departments and samples | None | Backend build; verify initial-data response counts and required shapes | implemented; validation pending |
| Case calendar and registry | `asystent_urzednika/src/components/CalendarDashboard.tsx` | Angular calendar month grid, due/overdue counters, search/status filters, case list and navigation to a case | Shared models/data | Frontend build; exercise date navigation/filtering in the browser if available | implemented; validation pending |
| Archive and knowledge base | `asystent_urzednika/src/components/KnowledgeBaseView.tsx` | Search/filter archive, add an archive/legal entry, show departments and anonymization rules | Shared models/data; document extraction | Frontend build; verify add/search behavior | implemented; validation pending |
| Case workflow and response generation | `asystent_urzednika/src/components/WorkflowWorkspace.tsx`, source `/api/analyze-request` and `/api/generate-response` | Angular case editor, knowledge-base matches, routing, department materials, response mode and Bielik endpoints | Shared models/data; configured Bielik service | Backend/frontend builds; API validation; browser flow where available | implemented; validation pending |
| Preserve original app while validating parity | Existing React/Vite package remains in `asystent_urzednika/` | Keep source intact until target behavior is reviewed; no silent cutover | Feature families above | Build and test source and target; record unavailable credentials/browser as blockers | source preserved; validation pending |

## Contract changes

| Contract | Source value | Target value | Why required | Alternatives considered | Validation evidence | Approval status |
|---|---|---|---|---|---|---|
| Node.js floor | `>=20.19.0` | `>=20.19.0` | No increase needed | Raise runtime; rejected | Target build not run after these changes | preserved |
| Application framework | React 19/Vite | Angular 21 | Requested architecture | Keep React target | Target validation pending | approved change |
| AI provider | Gemini (`GEMINI_API_KEY`) | Bielik-compatible endpoint/config | Existing NestJS integration and user request | Keep Gemini as target provider | Requires valid Bielik endpoint/key for live generation | approved change |

