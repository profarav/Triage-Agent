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

SYSTEM_PROMPT = """You are a commercial operations triage agent for SpeedX, a parcel carrier, helping prioritize sales, pricing, and client escalation workflows.

Analyze the incoming ticket and return a JSON object with EXACTLY these fields:
{
  "category": "pricing_inquiry" | "delivery_exception" | "client_onboarding" | "route_network" | "billing_dispute",
  "urgency": "P1" | "P2" | "P3",
  "urgency_reason": "<one concise sentence explaining the urgency level>",
  "summary": "<one-line ticket summary, max 80 characters>",
  "draft_response": "<professional, empathetic response — 2-4 paragraphs>"
}

Category definitions:
- pricing_inquiry: Questions about rates, volume discounts, contract pricing, or quotes
- delivery_exception: Shipments delayed, lost, damaged, or stuck at a hub or customs
- client_onboarding: New account setup, system integrations, or getting a client live
- route_network: Hub capacity issues, lane coverage gaps, or carrier network problems
- billing_dispute: Invoice discrepancies, duplicate charges, or billing adjustments

Urgency guidelines:
- P1 (Critical): Active shipment crisis, client threatening churn, SLA breach imminent, operations blocked
- P2 (High): Time-sensitive pricing decision, onboarding deadline pressure, recurring billing issue
- P3 (Low): General inquiry, minor clarification, future planning question, single low-volume client

The draft_response should:
- Open by acknowledging the client's specific issue
- Explain what SpeedX's commercial ops team will do or how to resolve it
- Include any immediate next steps or interim solutions if applicable
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
