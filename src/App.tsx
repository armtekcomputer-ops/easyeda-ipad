import { useEffect, useMemo, useState } from 'react';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { EasyEdaApi, EASYEDA_DOCUMENT_TYPE, type EasyEdaSnapshot } from './lib/easyeda-api';
import { EasyEdaGatewayClient, type GatewayState, type GatewayStatus } from './lib/gateway';

const tools = [
  { id: 'select', label: 'Select', glyph: '↖' },
  { id: 'wire', label: 'Wire', glyph: '⌁' },
  { id: 'route', label: 'Route', glyph: '⌇' },
  { id: 'via', label: 'Via', glyph: '⊙' },
  { id: 'text', label: 'Text', glyph: 'T' },
] as const;

type ToolId = (typeof tools)[number]['id'];
type ConnectionMode = 'cloud' | 'direct';
type SnapshotState = 'idle' | 'loading' | 'ready' | 'error';

function stateLabel(state: GatewayState) {
  if (state === 'connected') return 'Connected';
  if (state === 'connecting') return 'Connecting';
  if (state === 'error') return 'Connection error';
  return 'Offline';
}

function yesNoUnknown(value: boolean | undefined) {
  if (value === undefined) return 'Unknown';
  return value ? 'Online' : 'Offline';
}

function documentTypeLabel(documentType: number | undefined) {
  if (documentType === EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE) return 'Schematic page';
  if (documentType === EASYEDA_DOCUMENT_TYPE.PCB) return 'PCB';
  if (documentType === EASYEDA_DOCUMENT_TYPE.FOOTPRINT) return 'Footprint';
  if (documentType === undefined) return 'No document';
  return `Type ${documentType}`;
}

function contextName(snapshot: EasyEdaSnapshot | null) {
  if (!snapshot) return null;
  if (snapshot.context.kind === 'pcb') return snapshot.context.name ?? 'PCB';
  if (snapshot.context.kind === 'schematic') {
    return snapshot.context.page?.name ?? snapshot.context.schematic?.name ?? 'Schematic';
  }
  if (snapshot.context.kind === 'footprint') return 'Footprint';
  return null;
}

function cloudSocketUrl(session: string, token: string) {
  const url = new URL(window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/ipad';
  url.search = '';
  url.searchParams.set('session', session);
  url.searchParams.set('token', token);
  return url.toString();
}

export default function App() {
  const gateway = useMemo(() => new EasyEdaGatewayClient(), []);
  const easyeda = useMemo(() => new EasyEdaApi(gateway), [gateway]);
  const [gatewayState, setGatewayState] = useState<GatewayState>('disconnected');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({});
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => (
    localStorage.getItem('easyeda-ipad-mode') === 'direct' ? 'direct' : 'cloud'
  ));
  const [gatewayUrl, setGatewayUrl] = useState(() => localStorage.getItem('easyeda-ipad-gateway') ?? '');
  const [cloudSession, setCloudSession] = useState(() => localStorage.getItem('easyeda-ipad-session') ?? 'default');
  const [cloudToken, setCloudToken] = useState(() => sessionStorage.getItem('easyeda-ipad-token') ?? '');
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const [snapshot, setSnapshot] = useState<EasyEdaSnapshot | null>(null);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>('idle');
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const { zoom, offset, inputMode, resetView, handlers } = useCanvasViewport();

  useEffect(() => {
    const onStateChange = (event: Event) => {
      const next = (event as CustomEvent<GatewayState>).detail;
      setGatewayState(next);
      if (next !== 'connected') {
        setSnapshot(null);
        setSnapshotState('idle');
        setSnapshotError(null);
      }
    };
    const onStatusChange = (event: Event) => {
      const next = (event as CustomEvent<GatewayStatus>).detail;
      setGatewayStatus((current) => ({ ...current, ...next }));
    };
    gateway.addEventListener('statechange', onStateChange);
    gateway.addEventListener('statuschange', onStatusChange);
    return () => {
      gateway.removeEventListener('statechange', onStateChange);
      gateway.removeEventListener('statuschange', onStatusChange);
      gateway.disconnect();
    };
  }, [gateway]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === '1') setActiveTool('select');
      if (event.key === '2') setActiveTool('wire');
      if (event.key === '3') setActiveTool('route');
      if (event.key === '0') resetView();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [resetView]);

  const canConnect = connectionMode === 'cloud'
    ? Boolean(cloudSession.trim() && cloudToken.trim())
    : Boolean(gatewayUrl.trim());

  const toggleConnection = () => {
    if (gatewayState === 'connected' || gatewayState === 'connecting') {
      gateway.disconnect();
      return;
    }

    localStorage.setItem('easyeda-ipad-mode', connectionMode);

    if (connectionMode === 'cloud') {
      const session = cloudSession.trim();
      const token = cloudToken.trim();
      if (!session || !token) return;
      localStorage.setItem('easyeda-ipad-session', session);
      sessionStorage.setItem('easyeda-ipad-token', token);
      gateway.connect(cloudSocketUrl(session, token));
      return;
    }

    const url = gatewayUrl.trim();
    if (!url) return;
    localStorage.setItem('easyeda-ipad-gateway', url);
    gateway.connect(url);
  };

  const refreshSnapshot = async () => {
    if (gatewayState !== 'connected' || snapshotState === 'loading') return;
    setSnapshotState('loading');
    setSnapshotError(null);
    try {
      const next = await easyeda.getSnapshot();
      setSnapshot(next);
      setSnapshotState('ready');
    } catch (error) {
      setSnapshotState('error');
      setSnapshotError(error instanceof Error ? error.message : 'Unable to read EasyEDA state');
    }
  };

  const projectTitle = snapshot?.project?.friendlyName ?? contextName(snapshot) ?? 'EasyEDA workspace';
  const firstSelectedId = snapshot?.selection.ids[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">E</div>
          <div>
            <strong>EDA iPad</strong>
            <span>Touch workspace</span>
          </div>
        </div>

        <div className="project-pill">
          <span className="eyebrow">PROJECT</span>
          <strong>{projectTitle}</strong>
        </div>

        <div className="top-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => void refreshSnapshot()}
            disabled={gatewayState !== 'connected' || snapshotState === 'loading'}
          >
            {snapshotState === 'loading' ? 'Refreshing…' : 'Refresh from EasyEDA'}
          </button>
        </div>
      </header>

      <section className="workspace">
        <nav className="tool-rail" aria-label="Drawing tools">
          {tools.map((tool) => (
            <button
              key={tool.id}
              className={`tool-button ${activeTool === tool.id ? 'active' : ''}`}
              type="button"
              aria-label={tool.label}
              aria-pressed={activeTool === tool.id}
              onClick={() => setActiveTool(tool.id)}
            >
              <span className="tool-glyph">{tool.glyph}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </nav>

        <section className="canvas-column">
          <div className="canvas-toolbar">
            <span>{Math.round(zoom * 100)}%</span>
            <span className="input-badge">{inputMode}</span>
            <button type="button" onClick={resetView}>Fit</button>
          </div>

          <div className="eda-canvas" {...handlers}>
            <div
              className="canvas-world"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            >
              <div className="demo-board">
                <div className="board-title">READ-ONLY WORKSPACE PREVIEW</div>
                <div className="component component-a">
                  <span>LIVE STATE</span>
                  <strong>{documentTypeLabel(snapshot?.document?.documentType)}</strong>
                </div>
                <div className="component component-b">
                  <span>SELECTION</span>
                  <strong>{snapshot?.selection.total ?? 0} items</strong>
                </div>
                <div className="component component-c">
                  <span>CONTEXT</span>
                  <strong>{contextName(snapshot) ?? 'Not refreshed'}</strong>
                </div>
                <svg className="demo-traces" viewBox="0 0 760 420" aria-hidden="true">
                  <path d="M210 195 H330 V115 H445" />
                  <path d="M210 225 H360 V300 H470" />
                  <path d="M560 170 V260 H470" />
                </svg>
              </div>
            </div>

            {gatewayState !== 'connected' && (
              <div className="gateway-card" onPointerDown={(event) => event.stopPropagation()}>
                <span className="eyebrow">CONNECTION</span>
                <h2>Connect to EasyEDA</h2>
                <p>Cloud mode connects this PWA through Cloudflare to the outbound VPS agent. Direct mode keeps the original LAN companion option.</p>

                <label>
                  Mode
                  <select
                    value={connectionMode}
                    onChange={(event) => setConnectionMode(event.target.value as ConnectionMode)}
                  >
                    <option value="cloud">Cloudflare + VPS</option>
                    <option value="direct">Direct / LAN companion</option>
                  </select>
                </label>

                {connectionMode === 'cloud' ? (
                  <>
                    <label>
                      Session
                      <input
                        value={cloudSession}
                        onChange={(event) => setCloudSession(event.target.value)}
                        placeholder="default"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </label>
                    <label>
                      iPad access token
                      <input
                        type="password"
                        value={cloudToken}
                        onChange={(event) => setCloudToken(event.target.value)}
                        placeholder="Cloudflare IPAD_TOKEN"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </label>
                  </>
                ) : (
                  <label>
                    Gateway URL
                    <input
                      value={gatewayUrl}
                      onChange={(event) => setGatewayUrl(event.target.value)}
                      placeholder="ws://192.168.1.20:49700/ipad?token=..."
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </label>
                )}

                <button
                  className="primary-button wide"
                  type="button"
                  onClick={toggleConnection}
                  disabled={!canConnect || gatewayState === 'connecting'}
                >
                  {gatewayState === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="inspector">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">EASYEDA STATE</span>
              <h2>{contextName(snapshot) ?? 'Not refreshed'}</h2>
            </div>
            <span className="selection-chip">{snapshot?.selection.total ?? 0} selected</span>
          </div>

          <div className="panel-section snapshot-section">
            <span className="eyebrow">DOCUMENT</span>
            <div className="setting-row"><span>Type</span><strong>{documentTypeLabel(snapshot?.document?.documentType)}</strong></div>
            <div className="setting-row"><span>Document</span><strong className="truncate-value">{snapshot?.document?.uuid ?? '—'}</strong></div>
            <div className="setting-row"><span>Project</span><strong className="truncate-value">{snapshot?.project?.friendlyName ?? '—'}</strong></div>
            <div className="setting-row"><span>Selected</span><strong>{snapshot?.selection.total ?? 0}</strong></div>
            {firstSelectedId && (
              <div className="setting-row"><span>First ID</span><strong className="truncate-value">{firstSelectedId}</strong></div>
            )}
            {snapshot && (
              <div className="setting-row">
                <span>Captured</span>
                <strong>{new Date(snapshot.capturedAt).toLocaleTimeString()}</strong>
              </div>
            )}
            {snapshotError && <p className="snapshot-error" role="alert">{snapshotError}</p>}
            <button
              className="secondary-button wide"
              type="button"
              onClick={() => void refreshSnapshot()}
              disabled={gatewayState !== 'connected' || snapshotState === 'loading'}
            >
              {snapshotState === 'loading' ? 'Reading EasyEDA…' : 'Refresh from EasyEDA'}
            </button>
          </div>

          <div className="panel-section">
            <span className="eyebrow">INPUT</span>
            <div className="setting-row"><span>Apple Pencil</span><strong>{inputMode === 'pencil' ? 'Active' : 'Ready'}</strong></div>
            <div className="setting-row"><span>Pinch zoom</span><strong>On</strong></div>
            <div className="setting-row"><span>Two-finger pan</span><strong>On</strong></div>
          </div>

          <div className="panel-section">
            <span className="eyebrow">GATEWAY</span>
            <div className="setting-row">
              <span>Status</span>
              <strong className={`status-text status-${gatewayState}`}>{stateLabel(gatewayState)}</strong>
            </div>
            <div className="setting-row"><span>Mode</span><strong>{connectionMode === 'cloud' ? 'Cloudflare' : 'Direct'}</strong></div>
            {connectionMode === 'cloud' && <div className="setting-row"><span>Session</span><strong>{cloudSession || 'default'}</strong></div>}
            <div className="setting-row"><span>VPS relay</span><strong>{yesNoUnknown(gatewayStatus.vpsConnected)}</strong></div>
            <div className="setting-row"><span>EasyEDA</span><strong>{yesNoUnknown(gatewayStatus.edaConnected)}</strong></div>
            {gatewayStatus.localBridgePort && (
              <div className="setting-row"><span>Bridge</span><strong>:{gatewayStatus.localBridgePort}</strong></div>
            )}
            {gatewayState === 'connected' && (
              <button className="secondary-button wide" type="button" onClick={toggleConnection}>Disconnect</button>
            )}
          </div>
        </aside>
      </section>

      <footer className="statusbar">
        <span>Tool: {activeTool}</span>
        <span>Read-only EasyEDA snapshot</span>
        <span>{snapshot ? `${snapshot.selection.total} selected` : 'No snapshot'}</span>
        <span className={`status-dot-wrap status-${gatewayState}`}><i />{stateLabel(gatewayState)}</span>
      </footer>
    </main>
  );
}
