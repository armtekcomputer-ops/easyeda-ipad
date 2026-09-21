import { useEffect, useMemo, useState } from 'react';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { EasyEdaApi, EASYEDA_DOCUMENT_TYPE, type EasyEdaSnapshot } from './lib/easyeda-api';
import { EasyEdaEditorApi, type EasyEdaEditorState } from './lib/easyeda-editor';
import { EasyEdaPcbComponentApi, type EasyEdaPcbComponentState } from './lib/easyeda-pcb-component';
import { EasyEdaProjectDocumentsApi, type EasyEdaCurrentProjectDocuments, type EasyEdaProjectDocumentKind } from './lib/easyeda-project-documents';
import { EasyEdaSafeSelectionApi } from './lib/easyeda-safe-selection';
import { EasyEdaComponentTransformApi, EASYEDA_COMPONENT_NUDGE_MM, type EasyEdaComponentTransformOperation } from './lib/easyeda-transform';
import { EasyEdaGatewayClient, type GatewayState, type GatewayStatus } from './lib/gateway';

const tools = [
  { id: 'select', label: 'Select', glyph: '↖' }, { id: 'wire', label: 'Wire', glyph: '⌁' },
  { id: 'route', label: 'Route', glyph: '⌇' }, { id: 'via', label: 'Via', glyph: '⊙' }, { id: 'text', label: 'Text', glyph: 'T' },
] as const;
type ToolId = (typeof tools)[number]['id'];
type ConnectionMode = 'cloud' | 'direct';
type SnapshotState = 'idle' | 'loading' | 'ready' | 'error';

function stateLabel(state: GatewayState) { return state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting' : state === 'error' ? 'Connection error' : 'Offline'; }
function yesNoUnknown(value: boolean | undefined) { return value === undefined ? 'Unknown' : value ? 'Online' : 'Offline'; }
function documentTypeLabel(type: number | undefined) {
  if (type === EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE) return 'Schematic page';
  if (type === EASYEDA_DOCUMENT_TYPE.PCB) return 'PCB';
  if (type === EASYEDA_DOCUMENT_TYPE.FOOTPRINT) return 'Footprint';
  return type === undefined ? 'No document' : `Type ${type}`;
}
function projectDocumentKindLabel(kind: EasyEdaProjectDocumentKind) { return kind === 'pcb' ? 'PCB' : 'Schematic page'; }
function selectionDocumentSupported(type: number | undefined) { return type === EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE || type === EASYEDA_DOCUMENT_TYPE.PCB || type === EASYEDA_DOCUMENT_TYPE.FOOTPRINT; }
function transformDocumentSupported(type: number | undefined) { return type === EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE || type === EASYEDA_DOCUMENT_TYPE.PCB; }
function pcbComponentInspectionSupported(type: number | undefined) { return type === EASYEDA_DOCUMENT_TYPE.PCB || type === EASYEDA_DOCUMENT_TYPE.FOOTPRINT; }
function contextName(snapshot: EasyEdaSnapshot | null) {
  if (!snapshot) return null;
  if (snapshot.context.kind === 'pcb') return snapshot.context.name ?? 'PCB';
  if (snapshot.context.kind === 'schematic') return snapshot.context.page?.name ?? snapshot.context.schematic?.name ?? 'Schematic';
  return snapshot.context.kind === 'footprint' ? 'Footprint' : null;
}
function cloudSocketUrl(session: string, token: string) {
  const url = new URL(window.location.origin); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = '/ws/ipad'; url.search = '';
  url.searchParams.set('session', session); url.searchParams.set('token', token); return url.toString();
}

export default function App() {
  const gateway = useMemo(() => new EasyEdaGatewayClient(), []);
  const easyeda = useMemo(() => new EasyEdaApi(gateway), [gateway]);
  const safeSelection = useMemo(() => new EasyEdaSafeSelectionApi(gateway), [gateway]);
  const transformApi = useMemo(() => new EasyEdaComponentTransformApi(gateway), [gateway]);
  const editor = useMemo(() => new EasyEdaEditorApi(gateway), [gateway]);
  const pcbComponentApi = useMemo(() => new EasyEdaPcbComponentApi(gateway), [gateway]);
  const projectDocumentsApi = useMemo(() => new EasyEdaProjectDocumentsApi(gateway), [gateway]);
  const [gatewayState, setGatewayState] = useState<GatewayState>('disconnected');
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({});
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => localStorage.getItem('easyeda-ipad-mode') === 'direct' ? 'direct' : 'cloud');
  const [gatewayUrl, setGatewayUrl] = useState(() => localStorage.getItem('easyeda-ipad-gateway') ?? '');
  const [cloudSession, setCloudSession] = useState(() => localStorage.getItem('easyeda-ipad-session') ?? 'default');
  const [cloudToken, setCloudToken] = useState(() => sessionStorage.getItem('easyeda-ipad-token') ?? '');
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const [snapshot, setSnapshot] = useState<EasyEdaSnapshot | null>(null);
  const [snapshotState, setSnapshotState] = useState<SnapshotState>('idle');
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [transformBusy, setTransformBusy] = useState(false);
  const [editorState, setEditorState] = useState<EasyEdaEditorState | null>(null);
  const [editorBusy, setEditorBusy] = useState(false); const [editorError, setEditorError] = useState<string | null>(null);
  const [pcbComponent, setPcbComponent] = useState<EasyEdaPcbComponentState | null>(null);
  const [pcbComponentBusy, setPcbComponentBusy] = useState(false); const [pcbComponentError, setPcbComponentError] = useState<string | null>(null);
  const [projectDocuments, setProjectDocuments] = useState<EasyEdaCurrentProjectDocuments | null>(null);
  const [projectDocumentsBusy, setProjectDocumentsBusy] = useState(false); const [projectDocumentsError, setProjectDocumentsError] = useState<string | null>(null);
  const [selectedProjectDocumentUuid, setSelectedProjectDocumentUuid] = useState('');
  const { zoom, offset, inputMode, resetView, handlers } = useCanvasViewport();

  const interactionBusy = selectionBusy || transformBusy || editorBusy || pcbComponentBusy || projectDocumentsBusy;
  const invalidateTrustedState = (message: string) => { setSnapshot(null); setEditorState(null); setPcbComponent(null); setPcbComponentError(null); setProjectDocuments(null); setSelectedProjectDocumentUuid(''); setSnapshotState('error'); setSnapshotError(message); };

  useEffect(() => {
    const state = (event: Event) => { const next = (event as CustomEvent<GatewayState>).detail; setGatewayState(next); if (next !== 'connected') { setSnapshot(null); setSnapshotState('idle'); setSnapshotError(null); setEditorState(null); setPcbComponent(null); setProjectDocuments(null); } };
    const status = (event: Event) => setGatewayStatus((current) => ({ ...current, ...(event as CustomEvent<GatewayStatus>).detail }));
    gateway.addEventListener('statechange', state); gateway.addEventListener('statuschange', status);
    return () => { gateway.removeEventListener('statechange', state); gateway.removeEventListener('statuschange', status); gateway.disconnect(); };
  }, [gateway]);
  useEffect(() => { const docs = projectDocuments?.documents ?? []; setSelectedProjectDocumentUuid((current) => docs.some((d) => d.uuid === current) ? current : docs[0]?.uuid ?? ''); }, [projectDocuments]);
  useEffect(() => { setPcbComponent(null); setPcbComponentError(null); }, [snapshot?.capturedAt]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return; if (event.key === '1') setActiveTool('select'); if (event.key === '2') setActiveTool('wire'); if (event.key === '3') setActiveTool('route'); if (event.key === '0') resetView(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [resetView]);

  const toggleConnection = () => {
    if (gatewayState === 'connected' || gatewayState === 'connecting') return gateway.disconnect();
    localStorage.setItem('easyeda-ipad-mode', connectionMode);
    if (connectionMode === 'cloud') { const session = cloudSession.trim(), token = cloudToken.trim(); if (!session || !token) return; localStorage.setItem('easyeda-ipad-session', session); sessionStorage.setItem('easyeda-ipad-token', token); gateway.connect(cloudSocketUrl(session, token)); }
    else { const url = gatewayUrl.trim(); if (!url) return; localStorage.setItem('easyeda-ipad-gateway', url); gateway.connect(url); }
  };
  const refreshSnapshot = async () => {
    if (gatewayState !== 'connected' || snapshotState === 'loading' || interactionBusy) return; setSnapshotState('loading'); setSnapshotError(null);
    try { const [s, e, p] = await Promise.all([easyeda.getSnapshot(), editor.getState(), projectDocumentsApi.getCurrentProjectDocuments()]); setSnapshot(s); setEditorState(e); setProjectDocuments(p); setSnapshotState('ready'); }
    catch (error) { invalidateTrustedState(error instanceof Error ? error.message : 'Unable to read EasyEDA state'); }
  };
  const runSelectionMutation = async (mutation: () => Promise<EasyEdaSnapshot>) => {
    if (gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !snapshot?.document) return; setSelectionBusy(true); setSnapshot(null); setPcbComponent(null); setSnapshotState('loading'); setSnapshotError(null);
    try { setSnapshot(await mutation()); setSnapshotState('ready'); } catch (error) { invalidateTrustedState(`${error instanceof Error ? error.message : 'Unable to synchronize EasyEDA selection'}. The operation may have completed; refresh from EasyEDA before another write.`); } finally { setSelectionBusy(false); }
  };
  const runTransform = async (operation: EasyEdaComponentTransformOperation) => {
    const document = snapshot?.document, ids = snapshot?.selection.ids ?? [];
    if (gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !document || !transformDocumentSupported(document.documentType) || ids.length !== 1) return;
    setTransformBusy(true); setSnapshot(null); setPcbComponent(null); setPcbComponentError(null); setSnapshotState('loading'); setSnapshotError(null);
    try { const next = await transformApi.transform(document, ids, operation); setSnapshot(next); setSnapshotState('ready'); }
    catch (error) { invalidateTrustedState(`${error instanceof Error ? error.message : 'Unable to transform EasyEDA component'}. The operation may have completed; refresh from EasyEDA before another write.`); }
    finally { setTransformBusy(false); }
  };
  const inspect = async () => { const document = snapshot?.document, ids = snapshot?.selection.ids ?? []; if (!document || interactionBusy || ids.length !== 1 || !pcbComponentInspectionSupported(document.documentType)) return; setPcbComponentBusy(true); setPcbComponentError(null); try { setPcbComponent(await pcbComponentApi.inspectSelectedComponent(document, ids[0])); } catch (e) { setPcbComponentError(e instanceof Error ? e.message : 'Unable to inspect component'); } finally { setPcbComponentBusy(false); } };
  const activateTab = async (tabId: string) => { if (!snapshot?.document || interactionBusy || snapshotState !== 'ready') return; setEditorBusy(true); setSnapshot(null); setSnapshotState('loading'); try { const e = await editor.activateTab(tabId); const [s, p] = await Promise.all([easyeda.getSnapshot(), projectDocumentsApi.getCurrentProjectDocuments()]); setEditorState(e); setSnapshot(s); setProjectDocuments(p); setSnapshotState('ready'); } catch (err) { invalidateTrustedState(`${err instanceof Error ? err.message : 'Unable to activate tab'}. Refresh from EasyEDA.`); } finally { setEditorBusy(false); } };
  const fitEditor = async (mode: 'all' | 'selection') => { const tabId = editorState?.activeTabId; if (!tabId || interactionBusy) return; setEditorBusy(true); setEditorError(null); try { if (mode === 'selection') await editor.fitSelection(tabId); else await editor.fitAll(tabId); } catch (e) { setEditorError(e instanceof Error ? e.message : 'Unable to change viewport'); } finally { setEditorBusy(false); } };
  const openProjectDocument = async () => { const uuid = selectedProjectDocumentUuid; if (!uuid || !projectDocuments?.documents.some((d) => d.uuid === uuid) || interactionBusy) return; setProjectDocumentsBusy(true); setSnapshot(null); setSnapshotState('loading'); try { const opened = await projectDocumentsApi.openCurrentProjectDocument(uuid); const e = await editor.activateTab(opened.tabId ?? ''); const [s, p] = await Promise.all([easyeda.getSnapshot(), projectDocumentsApi.getCurrentProjectDocuments()]); setEditorState(e); setSnapshot(s); setProjectDocuments(p); setSnapshotState('ready'); } catch (err) { setProjectDocumentsError(err instanceof Error ? err.message : 'Unable to open document'); invalidateTrustedState('Document opening had an uncertain outcome. Refresh from EasyEDA.'); } finally { setProjectDocumentsBusy(false); } };

  const projectTitle = projectDocuments?.project?.friendlyName ?? snapshot?.project?.friendlyName ?? contextName(snapshot) ?? 'EasyEDA workspace';
  const selectionSupported = selectionDocumentSupported(snapshot?.document?.documentType);
  const transformSupported = transformDocumentSupported(snapshot?.document?.documentType);
  const transformDisabled = gatewayState !== 'connected' || interactionBusy || snapshotState !== 'ready' || !snapshot?.document || !transformSupported || snapshot.selection.ids.length !== 1;
  const canConnect = connectionMode === 'cloud' ? Boolean(cloudSession.trim() && cloudToken.trim()) : Boolean(gatewayUrl.trim());

  return <main className="app-shell">
    <header className="topbar"><div className="brand-block"><div className="brand-mark">E</div><div><strong>EDA iPad</strong><span>Touch workspace</span></div></div><div className="project-pill"><span className="eyebrow">PROJECT</span><strong>{projectTitle}</strong></div><div className="top-actions"><button className="primary-button" onClick={() => void refreshSnapshot()} disabled={gatewayState !== 'connected' || interactionBusy}>{snapshotState === 'loading' ? 'Refreshing…' : 'Refresh from EasyEDA'}</button></div></header>
    <section className="workspace">
      <nav className="tool-rail" aria-label="Drawing tools">{tools.map((t) => <button key={t.id} className={`tool-button ${activeTool === t.id ? 'active' : ''}`} aria-label={t.label} aria-pressed={activeTool === t.id} onClick={() => setActiveTool(t.id)}><span className="tool-glyph">{t.glyph}</span><span>{t.label}</span></button>)}</nav>
      <section className="canvas-column"><div className="canvas-toolbar"><span>{Math.round(zoom * 100)}%</span><span className="input-badge">{inputMode}</span><button onClick={resetView}>Preview Fit</button></div><div className="eda-canvas" {...handlers}><div className="canvas-world" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}><div className="demo-board"><div className="board-title">EASYEDA CURRENT PROJECT</div><div className="component component-a"><span>LIVE STATE</span><strong>{documentTypeLabel(snapshot?.document?.documentType)}</strong></div><div className="component component-b"><span>PROJECT DOCS</span><strong>{projectDocuments?.documents.length ?? 0}</strong></div><div className="component component-c"><span>CONTEXT</span><strong>{contextName(snapshot) ?? 'Not refreshed'}</strong></div></div></div>
      {gatewayState !== 'connected' && <div className="gateway-card" onPointerDown={(e) => e.stopPropagation()}><span className="eyebrow">CONNECTION</span><h2>Connect to EasyEDA</h2><label>Mode<select value={connectionMode} onChange={(e) => setConnectionMode(e.target.value as ConnectionMode)}><option value="cloud">Cloudflare + PC companion</option><option value="direct">Direct / LAN companion</option></select></label>{connectionMode === 'cloud' ? <><label>Session<input value={cloudSession} onChange={(e) => setCloudSession(e.target.value)} /></label><label>iPad access token<input type="password" value={cloudToken} onChange={(e) => setCloudToken(e.target.value)} /></label></> : <label>Gateway URL<input value={gatewayUrl} onChange={(e) => setGatewayUrl(e.target.value)} /></label>}<button className="primary-button wide" onClick={toggleConnection} disabled={!canConnect || gatewayState === 'connecting'}>{gatewayState === 'connecting' ? 'Connecting…' : 'Connect'}</button></div>}</div></section>
      <aside className="inspector">
        <div className="panel-heading"><div><span className="eyebrow">EASYEDA STATE</span><h2>{contextName(snapshot) ?? 'Not refreshed'}</h2></div><span className="selection-chip">{snapshot?.selection.total ?? 0} selected</span></div>
        <div className="panel-section snapshot-section"><span className="eyebrow">DOCUMENT</span><div className="setting-row"><span>Type</span><strong>{documentTypeLabel(snapshot?.document?.documentType)}</strong></div><div className="setting-row"><span>Project</span><strong className="truncate-value">{projectTitle}</strong></div>{snapshotError && <p className="snapshot-error" role="alert">{snapshotError}</p>}<button className="secondary-button wide" onClick={() => void refreshSnapshot()} disabled={gatewayState !== 'connected' || interactionBusy}>Refresh from EasyEDA</button></div>
        <div className="panel-section"><span className="eyebrow">COMPONENT TRANSFORM</span><div className="setting-row"><span>Scope</span><strong>{transformSupported ? 'Single component' : 'Unavailable'}</strong></div><div className="setting-row"><span>Move step</span><strong>{EASYEDA_COMPONENT_NUDGE_MM} mm</strong></div><div className="selection-actions"><button className="secondary-button wide" disabled={transformDisabled} onClick={() => void runTransform('x-negative')}>X −</button><button className="secondary-button wide" disabled={transformDisabled} onClick={() => void runTransform('x-positive')}>X +</button><button className="secondary-button wide" disabled={transformDisabled} onClick={() => void runTransform('y-negative')}>Y −</button><button className="secondary-button wide" disabled={transformDisabled} onClick={() => void runTransform('y-positive')}>Y +</button><button className="secondary-button wide" disabled={transformDisabled} onClick={() => void runTransform('rotate-negative')}>Rotate −90°</button><button className="secondary-button wide" disabled={transformDisabled} onClick={() => void runTransform('rotate-positive')}>Rotate +90°</button></div><p className="panel-note">Writes are limited to exactly one PCB or schematic component. The trusted document type, UUID and tab ID are checked inside the same execute request before mutation. State is discarded before every write and restored only by a successful fresh read-back.</p></div>
        <div className="panel-section"><span className="eyebrow">SELECTED PCB COMPONENT</span><button className="secondary-button wide" onClick={() => void inspect()} disabled={interactionBusy || snapshotState !== 'ready' || !snapshot?.document || !pcbComponentInspectionSupported(snapshot.document.documentType) || snapshot.selection.ids.length !== 1}>{pcbComponentBusy ? 'Inspecting…' : 'Inspect selected component'}</button>{pcbComponent && <><div className="setting-row"><span>Designator</span><strong>{pcbComponent.designator || '—'}</strong></div><div className="setting-row"><span>X</span><strong>{pcbComponent.x}</strong></div><div className="setting-row"><span>Y</span><strong>{pcbComponent.y}</strong></div><div className="setting-row"><span>Rotation</span><strong>{pcbComponent.rotation}°</strong></div><div className="setting-row"><span>Locked</span><strong>{pcbComponent.primitiveLock ? 'Yes' : 'No'}</strong></div></>}{pcbComponentError && <p className="snapshot-error">{pcbComponentError}</p>}</div>
        <div className="panel-section"><span className="eyebrow">CURRENT PROJECT DOCUMENTS</span><label className="editor-tab-label">Document<select className="editor-tab-select" value={selectedProjectDocumentUuid} disabled={interactionBusy || !projectDocuments?.documents.length} onChange={(e) => setSelectedProjectDocumentUuid(e.target.value)}>{projectDocuments?.documents.map((d) => <option key={d.uuid} value={d.uuid}>{d.name} — {projectDocumentKindLabel(d.kind)}</option>)}</select></label><button className="secondary-button wide" disabled={interactionBusy || !selectedProjectDocumentUuid} onClick={() => void openProjectDocument()}>Open in EasyEDA</button>{projectDocumentsError && <p className="snapshot-error">{projectDocumentsError}</p>}</div>
        <div className="panel-section"><span className="eyebrow">EDITOR NAVIGATION</span><label className="editor-tab-label">Active tab<select className="editor-tab-select" value={editorState?.activeTabId ?? ''} disabled={interactionBusy || !editorState?.tabs.length} onChange={(e) => void activateTab(e.target.value)}>{editorState?.tabs.map((t) => <option key={t.tabId} value={t.tabId}>{t.title} — {documentTypeLabel(t.documentType)}</option>)}</select></label><div className="selection-actions"><button className="secondary-button wide" disabled={interactionBusy || !editorState?.activeTabId} onClick={() => void fitEditor('all')}>Fit all</button><button className="secondary-button wide" disabled={interactionBusy || !editorState?.activeTabId || !snapshot?.selection.total} onClick={() => void fitEditor('selection')}>Fit selection</button></div>{editorError && <p className="snapshot-error">{editorError}</p>}</div>
        <div className="panel-section"><span className="eyebrow">SELECTION SYNC</span><div className="selection-actions"><button className="secondary-button wide" disabled={interactionBusy || !selectionSupported || !snapshot?.document || !snapshot.selection.ids.length} onClick={() => { const d = snapshot?.document, ids = snapshot?.selection.ids ?? []; if (d) void runSelectionMutation(() => safeSelection.selectPrimitiveIds(d, ids)); }}>Re-apply snapshot IDs</button><button className="secondary-button wide" disabled={interactionBusy || !selectionSupported || !snapshot?.document || !snapshot.selection.total} onClick={() => { const d = snapshot?.document; if (d) void runSelectionMutation(() => safeSelection.clearSelection(d)); }}>Clear selection</button></div></div>
        <div className="panel-section"><span className="eyebrow">GATEWAY</span><div className="setting-row"><span>Status</span><strong>{stateLabel(gatewayState)}</strong></div><div className="setting-row"><span>PC companion</span><strong>{yesNoUnknown(gatewayStatus.vpsConnected)}</strong></div><div className="setting-row"><span>EasyEDA</span><strong>{yesNoUnknown(gatewayStatus.edaConnected)}</strong></div>{gatewayState === 'connected' && <button className="secondary-button wide" onClick={toggleConnection}>Disconnect</button>}</div>
      </aside>
    </section>
    <footer className="statusbar"><span>Tool: {activeTool}</span><span>{transformBusy ? 'Transforming component…' : 'Guarded component transforms'}</span><span className={`status-dot-wrap status-${gatewayState}`}><i />{stateLabel(gatewayState)}</span></footer>
  </main>;
}
