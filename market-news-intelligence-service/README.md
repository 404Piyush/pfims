# Market News Intelligence FinBERT Service

## Setup

```bash
cd market-news-intelligence-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Service runs at `http://127.0.0.1:5005`.

## Endpoints

- `GET /health`
- `POST /analyze`

### Request

```json
{
  "headlines": [
    "Tech stocks rally as inflation cools",
    "Banks face pressure from higher provisions"
  ]
}
```

### Response

```json
{
  "sentiment_score": 0.5,
  "label": "Bullish"
}
```
