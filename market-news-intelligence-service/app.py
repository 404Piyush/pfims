from flask import Flask, request, jsonify
from transformers import pipeline

app = Flask(__name__)

finbert = pipeline("sentiment-analysis", model="ProsusAI/finbert")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    headlines = data.get("headlines", [])

    if not isinstance(headlines, list):
        return jsonify({"message": "headlines must be an array"}), 400

    scores = []
    for text in headlines:
        if not isinstance(text, str) or not text.strip():
            continue
        result = finbert(text.strip())[0]["label"].lower()
        if result == "positive":
            scores.append(1)
        elif result == "negative":
            scores.append(-1)
        else:
            scores.append(0)

    final_score = (sum(scores) / len(scores)) if scores else 0

    if final_score > 0.2:
        label = "Bullish"
    elif final_score < -0.2:
        label = "Bearish"
    else:
        label = "Neutral"

    return jsonify({
        "sentiment_score": round(final_score, 4),
        "label": label
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005)
