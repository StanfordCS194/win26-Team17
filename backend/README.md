# PulseCheck Backend (Prototype)

Minimal API for the MVP demo. Serves product reports with pre-cached data for Notion, Figma, and Linear, plus generic placeholder reports for any other product name.

## Quick start

```bash
cd backend
npm install
npm run dev
```

API runs at **http://localhost:3001**. The frontend (Vite) proxies `/api` to this port in development.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/suggestions` | Suggested product names for typeahead |
| GET | `/api/reports/:productKey` | Cached report by slug (`notion`, `figma`, `linear`) – 404 for others |
| POST | `/api/reports` | Get or generate report. Body: `{ "productName": "Notion" }` |

## MVP scope

- **In scope:** Product search, pre-cached demo data (2–3 products), same response shape as frontend `ProductReport`.
- **Post-demo:** Reddit/G2 ingestion, real sentiment pipeline, deduplication, confidence indicators.

## Response shape

Matches frontend `ProductReport`: `productName`, `overallScore`, `totalMentions`, `sourcesAnalyzed`, `generatedAt`, `summary`, `strengths`, `issues`, `aspects` (each strength/issue has `quotes` with `source`, `author`, `date`, `url`).
