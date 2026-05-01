# H🌸PE PDF — Backend

Production-ready Node + Express backend for the H🌸PE PDF Vercel frontend.

## Endpoints

| Method | Path                   | Auth | Body                       | Notes                                       |
| ------ | ---------------------- | ---- | -------------------------- | ------------------------------------------- |
| GET    | `/healthz`             | no   | —                          | Liveness probe                              |
| POST   | `/auth/google`         | no   | `{ idToken }`              | Verifies Google ID token, upserts user      |
| GET    | `/auth/me`             | yes  | —                          | Returns the current user                    |
| POST   | `/pdf/merge`           | yes  | multipart `files[]`        | Premium → multi; Free → 1 file              |
| POST   | `/pdf/split`           | yes  | multipart `file`           |                                             |
| POST   | `/pdf/compress`        | yes  | multipart `file` + opts    | `quality` 0.3–0.9, `scale` 1.0–2.0          |
| POST   | `/pdf/to-word`         | yes  | multipart `files[]`        | Layout-preserving: page → image → DOCX      |
| POST   | `/pdf/to-jpg`          | yes  | multipart `file`           | Returns JSON of base64 JPEGs (multi-page)   |
| POST   | `/word/to-pdf`         | yes  | multipart `files[]`        | DOCX/DOC → PDF                              |
| POST   | `/image/to-pdf`        | yes  | multipart `files[]`        | JPG/PNG → PDF                               |
| POST   | `/payment/create-order`| yes  | `{ plan: monthly\|yearly }`| Returns Razorpay order                      |
| POST   | `/payment/verify`      | yes  | razorpay handler payload   | Verifies HMAC, upgrades user                |

Frontend sends `Authorization: Bearer <google_id_token>` on every authed request.

## Local

```bash
cp .env.example .env       # fill secrets
npm install
npm run dev
```

## Deploy (Render)

1. Push to GitHub.
2. New → Web Service → connect repo → root `server`.
3. Set env vars from `.env.example` in dashboard.
4. Render reads `render.yaml` if you keep it.

## Plans

- Free → 1 file/req, 20 MB cap, 30 jobs/h
- Premium → batch in parallel, 100 MB cap, 300 jobs/h

## Notes

- Files land in `uploads/`, are deleted in the response cycle.
- User store is `data/users.json`. Swap `services/user.service.js` for a DB adapter when needed.
- PDF→Word renders each page to PNG and embeds in DOCX → preserves tables, logos, QR codes.
