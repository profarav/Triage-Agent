import React, { useState, useCallback, useMemo } from 'react';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'billing' | 'technical' | 'account' | 'feature_request';
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
    label: 'Audio Failure',
    ticket:
      "My team can't hear each other on the channel during our warehouse shift. We have 12 workers who rely on Zello for coordination and this started 2 hours ago. We're missing packages because we can't communicate. Need immediate help.",
  },
  {
    label: 'Add 20 Users',
    ticket:
      'We need to add 20 new users to our enterprise account. Our company is expanding and we need the new field team onboarded by Monday morning. Can you help us with the upgrade process and confirm pricing for additional licenses?',
  },
  {
    label: 'WiFi/LTE Drops',
    ticket:
      'The app keeps disconnecting when switching between WiFi and LTE. This happens to all 5 of our delivery drivers throughout the day, every time they leave a depot. Very disruptive to our delivery operations.',
  },
  {
    label: 'Double Charge',
    ticket:
      'I was charged twice for my monthly subscription this billing cycle — two identical $49.99 charges on March 1st. Please review my account and issue a refund for the duplicate. Account: ops@company.com.',
  },
  {
    label: 'Record Channels',
    ticket:
      'Would Zello support recording channel conversations and auto-exporting them? Our legal team requires retention of all communications for 7 years per compliance regulations. Is this on your roadmap?',
  },
  {
    label: 'Login Outage',
    ticket:
      "None of our 8 dispatchers can log in this morning. We're a security company and our night shift can't hand off to day shift. This is actively affecting operations and potentially compromising site security.",
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  billing: 'Billing',
  technical: 'Technical',
  account: 'Account',
  feature_request: 'Feature Request',
};

const CATEGORY_COLORS: Record<Category, string> = {
  billing: '#a855f7',
  technical: '#3b82f6',
  account: '#14b8a6',
  feature_request: '#f59e0b',
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
      const res = await fetch('http://localhost:5001/api/triage', {
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
            <span className="brand-name">ZELLO</span>
            <span className="brand-sub">SUPPORT TRIAGE COMMAND</span>
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
            placeholder="Paste a support ticket here, or select an example above…&#10;&#10;⌘+Enter to triage"
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
