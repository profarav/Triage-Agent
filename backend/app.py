from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are an expert support triage agent for Zello, the push-to-talk communication platform used by first responders, warehouse teams, delivery fleets, and enterprise field operations.

Analyze the incoming support ticket and return a JSON object with EXACTLY these fields:
{
  "category": "billing" | "technical" | "account" | "feature_request",
  "urgency": "P1" | "P2" | "P3",
  "urgency_reason": "<one concise sentence explaining the urgency level>",
  "summary": "<one-line ticket summary, max 80 characters>",
  "draft_response": "<professional, empathetic customer response — 2-4 paragraphs>"
}

Urgency guidelines:
- P1 (Critical): Service completely down, active safety risk, blocking operations, multiple users affected
- P2 (High): Significant functionality impacted, workaround is painful or unclear, deadline pressure
- P3 (Low): Minor inconvenience, general question, feature/enhancement request, single user

The draft_response should:
- Open by acknowledging the customer's specific issue
- Explain what Zello's support team will do or how to resolve it
- Include any immediate workarounds if applicable
- Close with a commitment to follow up

Respond ONLY with valid JSON. No markdown fences, no extra text."""


@app.route("/api/triage", methods=["POST"])
def triage_ticket():
    try:
        data = request.get_json()
        ticket_text = (data or {}).get("ticket", "").strip()

        if not ticket_text:
            return jsonify({"error": "No ticket text provided"}), 400

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"Support ticket:\n\n{ticket_text}"}
            ],
        )

        raw = response.content[0].text.strip()

        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        return jsonify(result)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse AI response: {str(e)}"}), 500
    except anthropic.APIError as e:
        return jsonify({"error": f"Anthropic API error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
