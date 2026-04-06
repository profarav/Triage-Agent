from http.server import BaseHTTPRequestHandler
import json
import os
import anthropic

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


class handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default access logs

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length))
            ticket_text = data.get("ticket", "").strip()

            if not ticket_text:
                return self._send(400, {"error": "No ticket text provided"})

            client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
            response = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": f"Support ticket:\n\n{ticket_text}"}
                ],
            )

            raw = response.content[0].text.strip()
            # Strip accidental markdown fences
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            self._send(200, json.loads(raw))

        except json.JSONDecodeError as e:
            self._send(500, {"error": f"Failed to parse AI response: {e}"})
        except KeyError:
            self._send(500, {"error": "ANTHROPIC_API_KEY not set in environment"})
        except Exception as e:
            self._send(500, {"error": str(e)})

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
