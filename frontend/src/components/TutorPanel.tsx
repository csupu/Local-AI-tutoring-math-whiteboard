/** Collapsible, resizable AI Tutor chat panel with KaTeX rendering. */

import { useEffect, useRef, useState } from 'react';
import MathText from '../lib/MathText';
import type { WsStatus } from '../lib/ws';
import { clamp } from '../lib/state';

export type AskMode = 'chat' | 'analyze' | 'actions';

export interface ChatEntry {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  error?: boolean;
  verified?: string;
}

interface TutorPanelProps {
  width: number;
  onWidthChange: (w: number) => void;
  onCollapse: () => void;
  status: WsStatus;
  busy: boolean;
  model: string;
  messages: ChatEntry[];
  autoAnalyze: boolean;
  onAutoAnalyzeChange: (v: boolean) => void;
  onAsk: (prompt: string, mode: AskMode) => void;
}

const STATUS_LABEL: Record<WsStatus, string> = {
  waiting: 'Waiting',
  thinking: 'Analyzing…',
  ready: 'Ready',
  error: 'Error',
};

function StatusPill({ status }: { status: WsStatus }) {
  const cls = status === 'thinking' ? 'thinking' : status;
  return (
    <span className={`status-pill ${cls}`} title={`AI status: ${STATUS_LABEL[status]}`}>
      <span className="dot" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CollapsedRail({
  status,
  onExpand,
}: {
  status: WsStatus;
  onExpand: () => void;
}) {
  return (
    <div className="panel-rail">
      <StatusPill status={status} />
      <button className="btn" onClick={onExpand} title="Open the AI Tutor panel">
        AI Tutor
      </button>
    </div>
  );
}

export default function TutorPanel({
  width,
  onWidthChange,
  onCollapse,
  status,
  busy,
  model,
  messages,
  autoAnalyze,
  onAutoAnalyzeChange,
  onAsk,
}: TutorPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<AskMode>('analyze');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    let last = width;
    const move = (ev: MouseEvent) => {
      last = clamp(window.innerWidth - ev.clientX, 300, 760);
      onWidthChange(last);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const send = () => {
    const text = prompt.trim();
    if (busy) return;
    if (!text && mode !== 'analyze' && mode !== 'actions') return;
    onAsk(text, mode);
    setPrompt('');
  };

  return (
    <aside className="tutor-panel" style={{ width }}>
      <div className="panel-resizer" onMouseDown={startResize} title="Drag to resize" />
      <div className="panel-header">
        <span className="panel-title">🎓 AI Tutor</span>
        <StatusPill status={status} />
        <span className="spacer" />
        <label
          className="auto-analyze"
          title="Automatically analyze the board ~12s after you stop drawing (rate-limited, never while AI is busy)"
        >
          <input
            type="checkbox"
            checked={autoAnalyze}
            onChange={(e) => onAutoAnalyzeChange(e.target.checked)}
          />
          Auto
        </label>
        <button className="btn icon small" onClick={onCollapse} title="Collapse the tutor panel">
          ❯
        </button>
      </div>

      <div className="messages" ref={listRef}>
        {messages.length === 0 && !busy && (
          <div className="msg system">
            Draw a problem on the whiteboard, then pick a mode below and press Send.
            Use the Text tool (T) to write equations — the AI reads them directly.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg ${m.role}${m.error ? ' error' : ''}`}
            title={m.role === 'ai' ? `AI Tutor (${model})` : undefined}
          >
            {m.role === 'user' ? (
              m.text
            ) : (
              <>
                <MathText text={m.text} />
                {m.verified && <span className="verified">{m.verified}</span>}
              </>
            )}
          </div>
        ))}
        {busy && <div className="thinking-line">AI is thinking…</div>}
      </div>

      <div className="input-area">
        <div className="input-row">
          <textarea
            value={prompt}
            placeholder={
              mode === 'chat'
                ? 'Ask anything about the board… (Enter to send)'
                : 'Optional: what exactly do you want help with?'
            }
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button className="btn primary" disabled={busy} onClick={send} title="Send to the AI (Enter)">
            {busy ? '…' : 'Send'}
          </button>
        </div>
        <div className="mode-select">
          <label htmlFor="ask-mode">Mode</label>
          <select
            id="ask-mode"
            value={mode}
            disabled={busy}
            onChange={(e) => setMode(e.target.value as AskMode)}
          >
            <option value="chat">Chat — ask a question</option>
            <option value="analyze">Analyze board — step-by-step help</option>
            <option value="actions">Add to board — AI writes on it</option>
          </select>
          <span className="hint-line">
            {mode === 'actions'
              ? 'AI can only ADD content; “Undo AI changes” removes it.'
              : 'Enter = send · Shift+Enter = newline'}
          </span>
        </div>
      </div>
    </aside>
  );
}
