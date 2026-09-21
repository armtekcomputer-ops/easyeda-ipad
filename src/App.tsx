import { useEffect, useMemo, useState } from 'react';
import { useCanvasViewport } from './hooks/useCanvasViewport';
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
  const [gatewayState, setGatewayState] = useState<GatewayState>('disconnected');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({});
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => (
    localStorage.getItem('easyeda-ipad-mode') === 'direct' ? 'direct' : 'cloud'
  ));
  const [gatewayUrl, setGatewayUrl] = useState(() => localStorage.getItem('easyeda-ipad-gateway') ?? '');
  const [cloudSession, setCloudSession] = useState(() => localStorage.getItem('easyeda-ipad-session') ?? 'default');
  const [cloudToken, setCloudToken] = useState(() => sessionStorage.getItem('easyeda-ipad-token') ?? '');
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const { zoom, offset, inputMode, resetView, handlers } = useCanvasViewport();

  useEffect(() => {
    const onStateChange = (event: Event) => {
      setGatewayState((event as CustomEvent<GatewayState>).detail);
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
          <strong>Untitled board</strong>
        </div>

        <div className="top-actions">
          <button className="icon-button" type="button" aria-label="Undo">↶</button>
          <button className="icon-button" type="button" aria-label="Redo">↷</button>
          <button className="primary-button" type="button">Save</button>
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
                <div className="board-title">PCB WORKSPACE</div>
                <div className="component component-a">
                  <span>U1</span>
                  <strong>RP2040</strong>
                </div>
                <div className="component component-b">
                  <span>J1</span>
                  <strong>USB</strong>
                </div>
                <div className="component component-c">
                  <span>U2</span>
                  <strong>ESP-12F</strong>
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
              <span className="eyebrow">INSPECTOR</span>
              <h2>Selection</h2>
            </div>
            <span className="selection-chip">U1</span>
          </div>

          <div className="field-grid">
            <label>X <input value="42.00" readOnly /></label>
            <label>Y <input value="28.00" readOnly /></label>
            <label>Rotation <input value="0°" readOnly /></label>
            <label>Layer <input value="Top" readOnly /></label>
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
        <span>Grid 0.25 mm</span>
        <span>X 42.00 · Y 28.00</span>
        <span className={`status-dot-wrap status-${gatewayState}`}><i />{stateLabel(gatewayState)}</span>
      </footer>
    </main>
  );
}
