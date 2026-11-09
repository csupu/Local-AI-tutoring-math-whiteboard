/** Top navigation: model selector, Ollama status, theme/grid/background controls. */

import type { OllamaModel } from '../hooks/useOllamaModels';

interface TopBarProps {
  models: OllamaModel[];
  connected: boolean;
  loading: boolean;
  error: string;
  model: string;
  onModelChange: (name: string) => void;
  onRefreshModels: () => void;
  theme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
  grid: boolean;
  onGridChange: (v: boolean) => void;
  bg: string;
  onBgChange: (v: string) => void;
}

export default function TopBar({
  models,
  connected,
  loading,
  error,
  model,
  onModelChange,
  onRefreshModels,
  theme,
  onThemeChange,
  grid,
  onGridChange,
  bg,
  onBgChange,
}: TopBarProps) {
  const activeModel = models.find((m) => m.name === model);

  return (
    <header className="topbar">
      <div className="logo">
        <span className="sigma">∑</span> MathTutor
      </div>

      <div className="topbar-group" title="Locally installed Ollama models">
        <label htmlFor="model-select">Model</label>
        <select
          id="model-select"
          value={model}
          disabled={loading || models.length === 0}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {models.length === 0 && (
            <option value="">{loading ? 'Loading…' : connected ? 'No chat models installed' : 'Models unavailable'}</option>
          )}
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
              {m.vision ? '  👁' : ''}
            </option>
          ))}
        </select>
        <span className="btn icon small" title="Refresh the list of installed Ollama models" onClick={onRefreshModels}>
          ⟳
        </span>
        {activeModel && (
          <span
            className={`vision-badge${activeModel.vision ? ' on' : ''}`}
            title={
              activeModel.vision
                ? 'Ollama reports image support. Board screenshot capture is not yet implemented.'
                : 'This model cannot analyze whiteboard images (text-only model).'
            }
          >
            {activeModel.vision ? '👁 vision' : 'text-only'}
          </span>
        )}
      </div>

      <div
        className={`ollama-dot ${connected ? (loading ? 'busy' : 'ok') : ''}`}
        title={
          error || (connected
            ? 'Connected to local Ollama.'
            : 'Ollama is unreachable — check the backend and Ollama service.')
        }
      >
        <span className="dot" />
        {loading ? 'Checking…' : connected ? 'Ollama connected' : 'Connection unavailable'}
      </div>

      <div className="spacer" />

      <div className="topbar-group">
        <label htmlFor="bg-color" title="Whiteboard background color">
          Board
        </label>
        <input
          id="bg-color"
          type="color"
          value={bg}
          onChange={(e) => onBgChange(e.target.value)}
        />
        <label className="auto-analyze" title="Show a drawing grid on the whiteboard">
          <input
            type="checkbox"
            checked={grid}
            onChange={(e) => onGridChange(e.target.checked)}
          />
          Grid
        </label>
        <button
          className="btn icon"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
