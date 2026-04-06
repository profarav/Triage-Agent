import React, { useState, useCallback, useMemo } from 'react';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'pricing_inquiry' | 'delivery_exception' | 'client_onboarding' | 'route_network' | 'billing_dispute';
type Urgency = 'P1' | 'P2' | 'P3';

interface TriageResult {
  category: Category;
  urgency: Urgency;
  urgency_reason: string;
  summary: string;
  draft_response: string;
}

interface QueueItem extends TriageResult {
  id: string;
  ticket: string;
  timestamp: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label: 'Volume Discount',
    ticket:
      "We're shipping around 4,000 parcels/month and our current rate card isn't competitive anymore. Can we get a revised quote for a 12-month volume commitment? We need this before our contract renewal meeting on Friday.",
  },
  {
    label: 'Shipment Stuck',
    ticket:
      "One of our highest-value clients has a pallet of 200 units sitting at the Chicago hub for 4 days — it was supposed to deliver last Monday. They're threatening to pull their account. Need escalation immediately.",
  },
  {
    label: 'New Client Go-Live',
    ticket:
      'We have a new retail client, Meridian Home Goods, that needs to go live on our shipping platform by next Wednesday. Their IT team is ready for the API integration but we still need account credentials and rate setup from your side.',
  },
  {
    label: 'Invoice Dispute',
    ticket:
      "There are 17 fuel surcharge line items on last month's invoice that we weren't notified about in advance. The total discrepancy is $2,340. We need these reviewed and credited before we process payment.",
  },
  {
    label: 'Hub Capacity Issue',
    ticket:
      'Our shipments out of the Dallas-Fort Worth lane have been running 2-3 days behind SLA for the past two weeks. Is there a capacity constraint at the DFW hub? We need to know if we should reroute through another carrier for now.',
  },
  {
    label: 'Rate Card Request',
    ticket:
      "Can you send over a current rate card for ground parcel delivery across the Midwest region? We're putting together a bid for a new client and need ballpark figures for zones 2-5.",
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  pricing_inquiry: 'Pricing Inquiry',
  delivery_exception: 'Delivery Exception',
  client_onboarding: 'Client Onboarding',
  route_network: 'Route / Network',
  billing_dispute: 'Billing Dispute',
};

const CATEGORY_COLORS: Record<Category, string> = {
  pricing_inquiry: '#a855f7',
  delivery_exception: '#ef4444',
  client_onboarding: '#3b82f6',
  route_network: '#14b8a6',
  billing_dispute: '#f59e0b',
};

const URGENCY_COLORS: Record<Urgency, string> = {
  P1: '#ef4444',
  P2: '#f59e0b',
  P3: '#22c55e',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return `TKT-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [ticket, setTicket] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [filterUrg, setFilterUrg] = useState('all');

  const handleTriage = useCallback(async () => {
    if (!ticket.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticket.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [ticket, loading]);

  const handleAddToQueue = useCallback(() => {
    if (!result || !ticket.trim()) return;
    setQueue(prev => [
      { ...result, id: genId(), ticket: ticket.trim(), timestamp: new Date() },
      ...prev,
    ]);
  }, [result, ticket]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.draft_response).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result]);

  const filteredQueue = useMemo(
    () =>
      queue.filter(
        item =>
          (filterCat === 'all' || item.category === filterCat) &&
          (filterUrg === 'all' || item.urgency === filterUrg),
      ),
    [queue, filterCat, filterUrg],
  );

  const p1Count = queue.filter(i => i.urgency === 'P1').length;
  const p2Count = queue.filter(i => i.urgency === 'P2').length;

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-hex">
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M14 2L25 8V20L14 26L3 20V8L14 2Z"
                stroke="#ff5500"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M9.5 10.5L14 8.5L18.5 10.5V17.5L14 19.5L9.5 17.5V10.5Z"
                fill="#ff5500"
                opacity="0.9"
              />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">SPEEDX</span>
            <span className="brand-sub">COMMERCIAL OPS TRIAGE</span>
          </div>
        </div>

        <div className="header-stats">
          <div className="h-stat">
            <span className="h-val">{queue.length}</span>
            <span className="h-lbl">QUEUED</span>
          </div>
          <div className="h-divider" />
          <div className="h-stat">
            <span className="h-val" style={{ color: URGENCY_COLORS.P1 }}>
              {p1Count}
            </span>
            <span className="h-lbl" style={{ color: URGENCY_COLORS.P1 }}>
              P1
            </span>
          </div>
          <div className="h-stat">
            <span className="h-val" style={{ color: URGENCY_COLORS.P2 }}>
              {p2Count}
            </span>
            <span className="h-lbl" style={{ color: URGENCY_COLORS.P2 }}>
              P2
            </span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="app-main">
        {/* LEFT: Input panel */}
        <div className="panel">
          <div className="panel-header">
            <span className="p-label">TICKET INPUT</span>
            <span className="p-badge">{ticket.length} CHARS</span>
          </div>

          <div className="examples-row">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                className="ex-btn"
                onClick={() => {
                  setTicket(ex.ticket);
                  setResult(null);
                  setError(null);
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>

          <textarea
            className="ticket-area"
            value={ticket}
            onChange={e => setTicket(e.target.value)}
            placeholder="Paste a ticket here, or select an example above…&#10;&#10;⌘+Enter to triage"
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleTriage();
            }}
          />

          <button
            className={`triage-btn${loading ? ' is-loading' : ''}`}
            onClick={handleTriage}
            disabled={!ticket.trim() || loading}
          >
            {loading ? (
              <>
                <span className="loading-dots">
                  <i />
                  <i />
                  <i />
                </span>
                ANALYZING TICKET…
              </>
            ) : (
              <>▶&nbsp;&nbsp;TRIAGE TICKET</>
            )}
          </button>
        </div>

        {/* RIGHT: Results panel */}
        <div className="panel results-panel">
          <div className="panel-header">
            <span className="p-label">ANALYSIS RESULTS</span>
            {loading && <span className="p-badge is-scanning">SCANNING</span>}
            {result && !loading && <span className="p-badge is-done">COMPLETE</span>}
          </div>

          <div className="results-body">
            {!result && !loading && !error && (
              <div className="results-empty">
                <div className="empty-glyph">◈</div>
                <p>Submit a ticket to begin triage analysis</p>
              </div>
            )}

            {loading && (
              <div className="results-loading">
                <div className="scan-beam" />
                <div className="skel" style={{ width: '65%', height: 22 }} />
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <div className="skel" style={{ width: 120, height: 36 }} />
                  <div className="skel" style={{ width: 80, height: 36 }} />
                </div>
                <div className="skel" style={{ width: '100%', height: 52, marginTop: 6 }} />
                <div className="skel" style={{ width: '100%', height: 180, marginTop: 14 }} />
              </div>
            )}

            {error && !loading && (
              <div className="results-error">
                <span className="error-icon">⚠</span>
                {error}
              </div>
            )}

            {result && !loading && (
              <div className="results-content">
                <div className="result-summary">{result.summary}</div>

                <div className="badges-row">
                  <span
                    className="cat-badge"
                    style={{
                      color: CATEGORY_COLORS[result.category],
                      borderColor: CATEGORY_COLORS[result.category] + '55',
                      background: CATEGORY_COLORS[result.category] + '18',
                    }}
                  >
                    {CATEGORY_LABELS[result.category].toUpperCase()}
                  </span>

                  <span
                    className={`urg-badge urg-${result.urgency.toLowerCase()}`}
                    style={{
                      color: URGENCY_COLORS[result.urgency],
                      borderColor: URGENCY_COLORS[result.urgency] + '80',
                      background: URGENCY_COLORS[result.urgency] + '18',
                    }}
                  >
                    {result.urgency}
                  </span>
                </div>

                <div className="urg-reason">
                  <span className="dim-lbl">REASON: </span>
                  {result.urgency_reason}
                </div>

                <div className="draft-box">
                  <div className="draft-top">
                    <span className="dim-lbl">DRAFT RESPONSE</span>
                    <div className="draft-actions">
                      <button className="act-btn" onClick={handleCopy}>
                        {copied ? '✓ COPIED' : '⎘ COPY'}
                      </button>
                      <button className="act-btn primary" onClick={handleAddToQueue}>
                        + ADD TO QUEUE
                      </button>
                    </div>
                  </div>
                  <div className="draft-text">{result.draft_response}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Queue ── */}
      <div className="queue-section">
        <div className="queue-top">
          <span className="p-label">TICKET QUEUE</span>
          <div className="filters">
            <span className="dim-lbl">FILTER:</span>

            {['all', ...Object.keys(CATEGORY_LABELS)].map(f => (
              <button
                key={f}
                className={`f-chip${filterCat === f ? ' active' : ''}`}
                style={
                  filterCat === f && f !== 'all'
                    ? {
                        color: CATEGORY_COLORS[f as Category],
                        borderColor: CATEGORY_COLORS[f as Category],
                        background: CATEGORY_COLORS[f as Category] + '18',
                      }
                    : {}
                }
                onClick={() => setFilterCat(f)}
              >
                {f === 'all' ? 'ALL' : CATEGORY_LABELS[f as Category].toUpperCase()}
              </button>
            ))}

            <span className="f-div">│</span>

            {['all', 'P1', 'P2', 'P3'].map(u => (
              <button
                key={u}
                className={`f-chip${filterUrg === u ? ' active' : ''}`}
                style={
                  filterUrg === u && u !== 'all'
                    ? {
                        color: URGENCY_COLORS[u as Urgency],
                        borderColor: URGENCY_COLORS[u as Urgency],
                        background: URGENCY_COLORS[u as Urgency] + '18',
                      }
                    : {}
                }
                onClick={() => setFilterUrg(u)}
              >
                {u === 'all' ? 'ALL URG' : u}
              </button>
            ))}
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <div className="queue-empty">
            {queue.length === 0
              ? 'No tickets queued — triage a ticket and click "Add to Queue"'
              : 'No tickets match current filters'}
          </div>
        ) : (
          <div className="queue-scroll">
            <table className="q-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>TIME</th>
                  <th>URG</th>
                  <th>CATEGORY</th>
                  <th>SUMMARY</th>
                  <th>REASON</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map(item => (
                  <tr key={item.id} className={`q-row p-${item.urgency.toLowerCase()}`}>
                    <td className="mono orange">{item.id}</td>
                    <td className="mono muted">{fmtTime(item.timestamp)}</td>
                    <td>
                      <span
                        className={`urg-badge small urg-${item.urgency.toLowerCase()}`}
                        style={{
                          color: URGENCY_COLORS[item.urgency],
                          borderColor: URGENCY_COLORS[item.urgency] + '80',
                          background: URGENCY_COLORS[item.urgency] + '18',
                        }}
                      >
                        {item.urgency}
                      </span>
                    </td>
                    <td style={{ color: CATEGORY_COLORS[item.category], fontSize: 12 }}>
                      ● {CATEGORY_LABELS[item.category]}
                    </td>
                    <td className="sum-cell">{item.summary}</td>
                    <td className="rea-cell">{item.urgency_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
