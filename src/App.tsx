import { useEffect, useMemo, useState } from 'react';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { EasyEdaApi, EASYEDA_DOCUMENT_TYPE, type EasyEdaSnapshot } from './lib/easyeda-api';
import { EasyEdaEditorApi, type EasyEdaEditorState } from './lib/easyeda-editor';
import {
  EasyEdaProjectDocumentsApi,
  type EasyEdaCurrentProjectDocuments,
  type EasyEdaProjectDocumentKind,
} from './lib/easyeda-project-documents';
import { EasyEdaSafeSelectionApi } from './lib/easyeda-safe-selection';
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

function projectDocumentKindLabel(kind: EasyEdaProjectDocumentKind) {
  return kind === 'pcb' ? 'PCB' : 'Schematic page';
}

function selectionDocumentSupported(documentType: number | undefined) {
  return documentType === EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE
    || documentType === EASYEDA_DOCUMENT_TYPE.PCB
    || documentType === EASYEDA_DOCUMENT_TYPE.FOOTPRINT;
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
  const safeSelection = useMemo(() => new EasyEdaSafeSelectionApi(gateway), [gateway]);
  const editor = useMemo(() => new EasyEdaEditorApi(gateway), [gateway]);
  const projectDocumentsApi = useMemo(() => new EasyEdaProjectDocumentsApi(gateway), [gateway]);
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
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [editorState, setEditorState] = useState<EasyEdaEditorState | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<EasyEdaCurrentProjectDocuments | null>(null);
  const [projectDocumentsBusy, setProjectDocumentsBusy] = useState(false);
  const [projectDocumentsError, setProjectDocumentsError] = useState<string | null>(null);
  const [selectedProjectDocumentUuid, setSelectedProjectDocumentUuid] = useState('');
  const { zoom, offset, inputMode, resetView, handlers } = useCanvasViewport();

  const invalidateTrustedState = (message: string) => {
    setSnapshot(null);
    setEditorState(null);
    setProjectDocuments(null);
    setSelectedProjectDocumentUuid('');
    setSnapshotState('error');
    setSnapshotError(message);
  };

  useEffect(() => {
    const onStateChange = (event: Event) => {
      const next = (event as CustomEvent<GatewayState>).detail;
      setGatewayState(next);
      if (next !== 'connected') {
        setSnapshot(null);
        setSnapshotState('idle');
        setSnapshotError(null);
        setEditorState(null);
        setEditorError(null);
        setProjectDocuments(null);
        setProjectDocumentsError(null);
        setSelectedProjectDocumentUuid('');
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
    const documents = projectDocuments?.documents ?? [];
    setSelectedProjectDocumentUuid((current) => (
      documents.some((document) => document.uuid === current)
        ? current
        : (documents[0]?.uuid ?? '')
    ));
  }, [projectDocuments]);

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

  const interactionBusy = selectionBusy || editorBusy || projectDocumentsBusy;
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
    if (gatewayState !== 'connected' || snapshotState === 'loading' || interactionBusy) return;
    setSnapshotState('loading');
    setSnapshotError(null);
    setEditorError(null);
    setProjectDocumentsError(null);
    try {
      const [nextSnapshot, nextEditorState, nextProjectDocuments] = await Promise.all([
        easyeda.getSnapshot(),
        editor.getState(),
        projectDocumentsApi.getCurrentProjectDocuments(),
      ]);
      setSnapshot(nextSnapshot);
      setEditorState(nextEditorState);
      setProjectDocuments(nextProjectDocuments);
      setSnapshotState('ready');
    } catch (error) {
      setSnapshot(null);
      setEditorState(null);
      setProjectDocuments(null);
      setSnapshotState('error');
      setSnapshotError(error instanceof Error ? error.message : 'Unable to read EasyEDA state');
    }
  };

  const runSelectionMutation = async (mutation: () => Promise<EasyEdaSnapshot>) => {
    if (gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !snapshot?.document) return;
    setSelectionBusy(true);
    setSnapshot(null);
    setSnapshotState('loading');
    setSnapshotError(null);
    try {
      const next = await mutation();
      setSnapshot(next);
      setSnapshotState('ready');
    } catch (error) {
      invalidateTrustedState(
        `${error instanceof Error ? error.message : 'Unable to synchronize EasyEDA selection'}. The operation may have completed; refresh from EasyEDA before another write.`,
      );
    } finally {
      setSelectionBusy(false);
    }
  };

  const clearSelection = () => {
    const document = snapshot?.document;
    if (!document || snapshotState !== 'ready') return;
    void runSelectionMutation(() => safeSelection.clearSelection(document));
  };

  const reapplySnapshotSelection = () => {
    const document = snapshot?.document;
    const ids = snapshot?.selection.ids ?? [];
    if (!document || snapshotState !== 'ready' || ids.length === 0) return;
    void runSelectionMutation(() => safeSelection.selectPrimitiveIds(document, ids));
  };

  const activateEditorTab = async (tabId: string) => {
    if (gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !snapshot?.document) return;
    if (!editorState?.tabs.some((tab) => tab.tabId === tabId)) return;
    setEditorBusy(true);
    setEditorError(null);
    setSnapshotError(null);
    setProjectDocumentsError(null);
    setSnapshot(null);
    setEditorState(null);
    setProjectDocuments(null);
    setSnapshotState('loading');
    try {
      const nextEditorState = await editor.activateTab(tabId);
      const [nextSnapshot, nextProjectDocuments] = await Promise.all([
        easyeda.getSnapshot(),
        projectDocumentsApi.getCurrentProjectDocuments(),
      ]);
      setEditorState(nextEditorState);
      setSnapshot(nextSnapshot);
      setProjectDocuments(nextProjectDocuments);
      setSnapshotState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to activate EasyEDA tab';
      setEditorError(`${message}. The active tab may have changed; refresh from EasyEDA before another action.`);
      invalidateTrustedState('Trusted EasyEDA state was invalidated because tab activation had an uncertain outcome. Refresh from EasyEDA.');
    } finally {
      setEditorBusy(false);
    }
  };

  const fitEditor = async (mode: 'all' | 'selection') => {
    const tabId = editorState?.activeTabId;
    if (!tabId || gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready') return;
    setEditorBusy(true);
    setEditorError(null);
    try {
      if (mode === 'selection') await editor.fitSelection(tabId);
      else await editor.fitAll(tabId);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Unable to change EasyEDA viewport');
    } finally {
      setEditorBusy(false);
    }
  };

  const openCurrentProjectDocument = async () => {
    const documentUuid = selectedProjectDocumentUuid;
    const trustedDocuments = projectDocuments;
    if (gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !snapshot?.document || !documentUuid) return;
    if (!trustedDocuments?.documents.some((document) => document.uuid === documentUuid)) return;

    setProjectDocumentsBusy(true);
    setProjectDocumentsError(null);
    setEditorError(null);
    setSnapshotError(null);
    setSnapshot(null);
    setEditorState(null);
    setProjectDocuments(null);
    setSelectedProjectDocumentUuid('');
    setSnapshotState('loading');
    try {
      const opened = await projectDocumentsApi.openCurrentProjectDocument(documentUuid);
      const nextEditorState = await editor.activateTab(opened.tabId ?? '');
      const [nextSnapshot, nextProjectDocuments] = await Promise.all([
        easyeda.getSnapshot(),
        projectDocumentsApi.getCurrentProjectDocuments(),
      ]);
      setEditorState(nextEditorState);
      setSnapshot(nextSnapshot);
      setProjectDocuments(nextProjectDocuments);
      setSnapshotState('ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open EasyEDA project document';
      setProjectDocumentsError(`${message}. The document may have opened; refresh from EasyEDA before another action.`);
      invalidateTrustedState('Trusted EasyEDA state was invalidated because document opening had an uncertain outcome. Refresh from EasyEDA.');
    } finally {
      setProjectDocumentsBusy(false);
    }
  };

  const projectTitle = projectDocuments?.project?.friendlyName
    ?? snapshot?.project?.friendlyName
    ?? contextName(snapshot)
    ?? 'EasyEDA workspace';
  const firstSelectedId = snapshot?.selection.ids[0];
  const selectionSupported = selectionDocumentSupported(snapshot?.document?.documentType);
  const selectionControlsDisabled = gatewayState !== 'connected'
    || interactionBusy
    || snapshotState !== 'ready'
    || !snapshot?.document
    || !selectionSupported;
  const editorControlsDisabled = gatewayState !== 'connected'
    || interactionBusy
    || snapshotState !== 'ready'
    || !snapshot?.document
    || !editorState?.activeTabId;
  const projectDocumentControlsDisabled = gatewayState !== 'connected'
    || interactionBusy
    || snapshotState !== 'ready'
    || !snapshot?.document
    || !projectDocuments?.project
    || projectDocuments.documents.length === 0;

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
            disabled={gatewayState !== 'connected' || snapshotState === 'loading' || interactionBusy}
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
            <button type="button" onClick={resetView}>Preview Fit</button>
          </div>

          <div className="eda-canvas" {...handlers}>
            <div
              className="canvas-world"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            >
              <div className="demo-board">
                <div className="board-title">EASYEDA CURRENT PROJECT</div>
                <div className="component component-a">
                  <span>LIVE STATE</span>
                  <strong>{documentTypeLabel(snapshot?.document?.documentType)}</strong>
                </div>
                <div className="component component-b">
                  <span>PROJECT DOCS</span>
                  <strong>{projectDocuments?.documents.length ?? 0}</strong>
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
            <div className="setting-row"><span>Project</span><strong className="truncate-value">{projectTitle}</strong></div>
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
              disabled={gatewayState !== 'connected' || snapshotState === 'loading' || interactionBusy}
            >
              {snapshotState === 'loading' ? 'Reading EasyEDA…' : 'Refresh from EasyEDA'}
            </button>
          </div>

          <div className="panel-section">
            <span className="eyebrow">CURRENT PROJECT DOCUMENTS</span>
            <div className="setting-row"><span>Project</span><strong className="truncate-value">{projectDocuments?.project?.friendlyName ?? '—'}</strong></div>
            <div className="setting-row"><span>Documents</span><strong>{projectDocuments?.documents.length ?? 0}</strong></div>
            <label className="editor-tab-label">
              Document
              <select
                className="editor-tab-select"
                value={selectedProjectDocumentUuid}
                disabled={projectDocumentControlsDisabled}
                onChange={(event) => setSelectedProjectDocumentUuid(event.target.value)}
              >
                {!projectDocuments?.documents.length && <option value="">No validated documents</option>}
                {projectDocuments?.documents.map((document) => (
                  <option key={document.uuid} value={document.uuid}>
                    {document.name} — {projectDocumentKindLabel(document.kind)}{document.parentBoardName ? ` — ${document.parentBoardName}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button wide"
              type="button"
              onClick={() => void openCurrentProjectDocument()}
              disabled={projectDocumentControlsDisabled || !selectedProjectDocumentUuid}
            >
              {projectDocumentsBusy ? 'Opening…' : 'Open in EasyEDA'}
            </button>
            {projectDocumentsError && <p className="snapshot-error" role="alert">{projectDocumentsError}</p>}
            <p className="panel-note">Only validated schematic pages and PCBs from the already-current project can be opened. Project switching is intentionally disabled to avoid unsaved-data loss.</p>
          </div>

          <div className="panel-section">
            <span className="eyebrow">EDITOR NAVIGATION</span>
            <div className="setting-row"><span>Open tabs</span><strong>{editorState?.tabs.length ?? 0}</strong></div>
            <div className="setting-row"><span>Split screens</span><strong>{editorState?.splitScreens ?? 0}</strong></div>
            <label className="editor-tab-label">
              Active tab
              <select
                className="editor-tab-select"
                value={editorState?.activeTabId ?? ''}
                disabled={gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !snapshot?.document || !editorState?.tabs.length}
                onChange={(event) => void activateEditorTab(event.target.value)}
              >
                {!editorState?.activeTabId && <option value="">No active tab</option>}
                {editorState?.tabs.map((tab) => (
                  <option key={tab.tabId} value={tab.tabId}>
                    {tab.title} — {documentTypeLabel(tab.documentType)}
                  </option>
                ))}
              </select>
            </label>
            <div className="selection-actions">
              <button
                className="secondary-button wide"
                type="button"
                onClick={() => void fitEditor('all')}
                disabled={editorControlsDisabled}
              >
                {editorBusy ? 'Working…' : 'Fit all in EasyEDA'}
              </button>
              <button
                className="secondary-button wide"
                type="button"
                onClick={() => void fitEditor('selection')}
                disabled={editorControlsDisabled || (snapshot?.selection.total ?? 0) === 0}
              >
                {editorBusy ? 'Working…' : 'Fit selection in EasyEDA'}
              </button>
            </div>
            {editorError && <p className="snapshot-error" role="alert">{editorError}</p>}
            <p className="panel-note">Navigation uses only validated open-tab IDs. It does not close, save, move, rotate, or edit document data.</p>
          </div>

          <div className="panel-section">
            <span className="eyebrow">SELECTION SYNC</span>
            <div className="setting-row"><span>API domain</span><strong>{selectionSupported ? 'Supported' : 'Unavailable'}</strong></div>
            <div className="setting-row"><span>Validated IDs</span><strong>{snapshot?.selection.ids.length ?? 0}</strong></div>
            <div className="selection-actions">
              <button
                className="secondary-button wide"
                type="button"
                onClick={reapplySnapshotSelection}
                disabled={selectionControlsDisabled || (snapshot?.selection.ids.length ?? 0) === 0}
              >
                {selectionBusy ? 'Syncing…' : 'Re-apply snapshot IDs'}
              </button>
              <button
                className="secondary-button wide"
                type="button"
                onClick={clearSelection}
                disabled={selectionControlsDisabled || (snapshot?.selection.total ?? 0) === 0}
              >
                {selectionBusy ? 'Syncing…' : 'Clear EasyEDA selection'}
              </button>
            </div>
            <p className="panel-note">Selection writes require the same validated document type, UUID, and tab ID that produced the snapshot. Trusted state is invalidated before each write and restored only by a successful read-back.</p>
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
        <span>Current-project document browser</span>
        <span>{projectDocuments ? `${projectDocuments.documents.length} project docs` : 'No project document state'}</span>
        <span className={`status-dot-wrap status-${gatewayState}`}><i />{stateLabel(gatewayState)}</span>
      </footer>
    </main>
  );
}
