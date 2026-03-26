from http.server import BaseHTTPRequestHandler
import json
import os
import anthropic

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
