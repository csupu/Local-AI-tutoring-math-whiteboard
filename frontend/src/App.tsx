/** MathTutor: top bar + whiteboard + AI tutor panel, all local (Ollama). */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tldraw/tldraw';
import TopBar from './components/TopBar';
import Whiteboard from './components/Whiteboard';
import TutorPanel, { CollapsedRail, type AskMode, type ChatEntry } from './components/TutorPanel';
import { chat, subscribeStatus, type WsStatus } from './lib/ws';
import { applyAiActions, undoAiActions } from './lib/aiActions';
import { useOllamaModels } from './hooks/useOllamaModels';
import { clamp, K, load, save, uid } from './lib/state';

const MODE_ENTRY: Record<AskMode, string> = {
  chat: 'Chat',
  analyze: 'Analyze the board',
  actions: 'Add an explanation to the board',
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => load(K.theme, 'dark'));
  const [grid, setGrid] = useState<boolean>(() => load(K.grid, true));
  const [bg, setBg] = useState<string>(() => load(K.bg, '#17171c'));
  const [panelOpen, setPanelOpen] = useState<boolean>(() => load(K.panelOpen, true));
  const [panelWidth, setPanelWidth] = useState<number>(() => load(K.panelWidth, 400));
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(() => load(K.autoAnalyze, false));

  const [status, setStatus] = useState<WsStatus>('waiting');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [model, setModel] = useState<string>(() => load(K.model, ''));
  const [aiShapeIds, setAiShapeIds] = useState<string[]>([]);
  const [editorTick, setEditorTick] = useState(0);

  const editorRef = useRef<Editor | null>(null);
  const busyRef = useRef(false);
  const suppressAutoRef = useRef(false);
  const readyTimerRef = useRef<number | null>(null);
  const panelWidthRef = useRef(panelWidth);
  const boardRevisionRef = useRef(0);
  const activeModelRef = useRef('');

  const { models, connected, loading: modelsLoading, error: modelsError, refresh } = useOllamaModels();

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  const activeModel = (() => {
    if (!models.length) return model;
    if (models.some((m) => m.name === model)) return model;
    return (models.find((m) => m.vision) ?? models[0]).name;
  })();
  activeModelRef.current = activeModel;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    return editor.store.listen(() => { boardRevisionRef.current += 1; }, { scope: 'document' });
  }, [editorTick]);

  useEffect(() => {
    if (activeModel !== model) setModel(activeModel);
  }, [activeModel, model]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save(K.theme, theme);
  }, [theme]);

  const changeTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    const defaultBg = t === 'dark' ? '#17171c' : '#ffffff';
    setBg(defaultBg);
    save(K.bg, defaultBg);
  };

  useEffect(() => subscribeStatus(setStatus), []);

  const flashReady = useCallback(() => {
    if (readyTimerRef.current) window.clearTimeout(readyTimerRef.current);
    setStatus('ready');
    readyTimerRef.current = window.setTimeout(() => setStatus('waiting'), 4000);
  }, []);

  const ask = useCallback(
    async (prompt: string, mode: AskMode) => {
      const editor = editorRef.current;
      if (!editor || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setStatus('thinking');
      const revision = boardRevisionRef.current;
      if (readyTimerRef.current) window.clearTimeout(readyTimerRef.current);

      setMessages((m) => [...m, { id: uid(), role: 'user', text: prompt || MODE_ENTRY[mode] }]);

      try {
        const shapes = editor
          .getCurrentPageShapes()
          .map((s) => ({ type: s.type, props: s.props as Record<string, unknown> }));
        const env = await chat({ model: activeModel, mode, prompt, shapes });
        if (revision !== boardRevisionRef.current || activeModel !== activeModelRef.current) {
          setMessages((m) => [...m, { id: uid(), role: 'system',
            text: 'Discarded an outdated AI reply because the board or model changed. Analyze again for the current board.' }]);
          setStatus('waiting');
          return;
        }

        if (env.status === 'error' || !env.response) {
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              role: 'ai',
              error: true,
              text: env.error || 'No response received from the AI.',
            },
          ]);
          setStatus('error');
          return;
        }

        if (mode === 'actions' && env.actions && env.actions.length) {
          const created = applyAiActions(editor, env.actions);
          if (created.length) {
            setAiShapeIds((ids) => [...ids, ...created]);
            suppressAutoRef.current = true;
            window.setTimeout(() => {
              suppressAutoRef.current = false;
            }, 6000);
            setMessages((m) => [
              ...m,
              { id: uid(), role: 'ai', text: env.response ?? '' },
              {
                id: uid(),
                role: 'system',
                text: `Added ${created.length} item${created.length > 1 ? 's' : ''} to the board — use “Undo AI changes” (bottom-right) to remove them.`,
              },
            ]);
          } else {
            setMessages((m) => [...m, { id: uid(), role: 'ai', text: env.response ?? '' }]);
          }
        } else {
          setMessages((m) => [
            ...m,
            { id: uid(), role: 'ai', text: env.response ?? '', verified: env.verified },
          ]);
        }
        flashReady();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Connection failed.';
        setMessages((m) => [...m, { id: uid(), role: 'ai', error: true, text: msg }]);
        setStatus('error');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [activeModel, flashReady]
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !autoAnalyze) return;
    let timer: number | null = null;
    const run = () => {
      if (busyRef.current) { timer = window.setTimeout(run, 1000); return; }
      void ask('', 'analyze');
    };
    const off = editor.store.listen(() => {
      if (suppressAutoRef.current) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(run, 12000);
    }, { scope: 'document', source: 'user' });
    return () => {
      off();
      if (timer) window.clearTimeout(timer);
    };
  }, [autoAnalyze, editorTick, ask]);

  const clearBoard = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    if (!shapes.length) return;
    const ok = window.confirm(
      'Clear the current board?\nThis deletes all shapes on this page.\nYou can still undo with Ctrl+Z.'
    );
    if (!ok) return;
    editor.deleteShapes(shapes.map((s) => s.id));
    setAiShapeIds([]);
  };

  const undoAi = () => {
    const editor = editorRef.current;
    if (!editor) return;
    undoAiActions(editor, aiShapeIds);
    setAiShapeIds([]);
    setMessages((m) => [
      ...m,
      { id: uid(), role: 'system', text: 'AI-added items removed from the board.' },
    ]);
  };

  const changeModel = (name: string) => {
    setModel(name);
    save(K.model, name);
    setMessages((m) => [...m, { id: uid(), role: 'system', text: `Switched AI model to ${name}.` }]);
  };

  const changeWidth = (w: number) => {
    const next = clamp(w, 300, 760);
    setPanelWidth(next);
    save(K.panelWidth, next);
  };

  return (
    <div className="app-shell">
      <TopBar
        models={models}
        connected={connected}
        loading={modelsLoading}
        error={modelsError}
        model={activeModel}
        onModelChange={changeModel}
        onRefreshModels={() => void refresh()}
        theme={theme}
        onThemeChange={changeTheme}
        grid={grid}
        onGridChange={(v) => {
          setGrid(v);
          save(K.grid, v);
        }}
        bg={bg}
        onBgChange={(v) => {
          setBg(v);
          save(K.bg, v);
        }}
      />
      <div className="app-main">
        <div className="board-area">
          <Whiteboard
            theme={theme}
            grid={grid}
            onMount={(editor) => {
              editorRef.current = editor;
              setEditorTick((t) => t + 1);
            }}
          />
          <div className="board-hint" title="Keyboard shortcuts for the whiteboard">
            <kbd>T</kbd> text · <kbd>D</kbd> pencil · <kbd>E</kbd> eraser · <kbd>V</kbd> select ·{' '}
            <kbd>H</kbd> pan · <kbd>Ctrl+Z</kbd> undo
          </div>
          <div className="board-tools">
            {aiShapeIds.length > 0 && (
              <button
                className="btn"
                onClick={undoAi}
                title="Remove only the items the AI added (your own work stays untouched)"
              >
                ↩︎ Undo AI changes ({aiShapeIds.length})
              </button>
            )}
            <button
              className="btn danger"
              onClick={clearBoard}
              title="Delete every shape on the current page (undoable with Ctrl+Z)"
            >
              🗑 Clear board
            </button>
          </div>
        </div>

        {panelOpen ? (
          <TutorPanel
            width={panelWidth}
            onWidthChange={changeWidth}
            onCollapse={() => {
              setPanelOpen(false);
              save(K.panelOpen, false);
            }}
            status={status}
            busy={busy}
            model={activeModel}
            messages={messages}
            autoAnalyze={autoAnalyze}
            onAutoAnalyzeChange={(v) => {
              setAutoAnalyze(v);
              save(K.autoAnalyze, v);
            }}
            onAsk={(prompt, mode) => void ask(prompt, mode)}
          />
        ) : (
          <CollapsedRail
            status={status}
            onExpand={() => {
              setPanelOpen(true);
              save(K.panelOpen, true);
            }}
          />
        )}
      </div>
    </div>
  );
}
