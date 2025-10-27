# PFIMS Assistant — Architecture & API Specs

## Overview
- Purpose: AI-powered budget management assistant integrated into PFIMS.
- Model: `meta-llama-3-8b-instruct-q4km` via local Ollama (`http://localhost:11434`).
- Frontend: Chat UI at route `/assistant` using `frontend/src/pages/Assistant/Assistant.js`.
- Backend: Authenticated API at `POST /api/chatbot/message`.

## Frontend
- Page: `frontend/src/pages/Assistant/Assistant.js`.
- Behavior:
  - Maintains `messages` state with roles `user` and `assistant`.
  - Sends `message` and `history` to backend; displays assistant reply.
  - Handles loading UI and basic error messaging.
- Routing:
  - Protected route: `/assistant` (inside main layout).
  - Sidebar link added under "Assistant".

## Backend API
- Route: `POST /api/chatbot/message`.
- Middlewares:
  - `sanitizeRequest` — normalize/clean inputs.
  - `apiRateLimit` — request throttling.
  - `expensiveOperationSlowDown` — slow down bursty, costly calls.
  - `handleValidationErrors` — returns 422 for invalid inputs.
  - `auth` — requires `Authorization: Bearer <token>`.
- Validation:
  - `message` required (1–4000 chars).
  - `history` optional array of `{ role, content }` with roles `user|assistant|system`.
  - `includeContext` optional boolean.
- System Prompt:
  - Strong PFIMS context: budgeting, categories, transactions, tips, and guardrails.
- Ollama Call:
  - URL: `process.env.OLLAMA_URL || 'http://localhost:11434/api/chat'`.
  - Model: `process.env.OLLAMA_MODEL || 'meta-llama-3-8b-instruct-q4km'`.
  - Options: `{ temperature: 0.7, num_ctx: 8192, stream: false }`.
- Response:
  - Success: `{ success: true, data: { reply: string } }`.
  - AI error: 502 with `details` string from Ollama.
  - Validation error: 422 with error list.
  - Server error: 500 with message.

## Security
- Auth required for all chatbot calls.
- CORS allows `http://localhost:3000` and `http://localhost:3001` in dev.
- Input sanitized; headers validated; rate limit & slowdown applied.

## Configuration
- Env vars:
  - `PORT` (backend) default `3001`.
  - `CLIENT_URL` optional allowed origin.
  - `OLLAMA_URL` optional, default `http://localhost:11434/api/chat`.
  - `OLLAMA_MODEL` optional, default `meta-llama-3-8b-instruct-q4km`.

## Example Requests
### cURL (replace `<TOKEN>`)
```bash
curl -X POST http://localhost:3001/api/chatbot/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "message": "Help me plan a food budget for $500/month.",
    "history": [
      { "role": "assistant", "content": "Hi! How can I help today?" }
    ],
    "includeContext": true
  }'
```

### Frontend Usage
- `api.post('/chatbot/message', { message, history, includeContext: true })`.

## Future Enhancements
- Enrich context with user budgets, categories, and recent spending summaries.
- Persist conversations per user with summaries and follow-up recommendations.
- Add quick action buttons ("Generate budget", "Analyze last month").