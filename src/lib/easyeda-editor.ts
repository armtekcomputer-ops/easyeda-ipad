import type { EasyEdaExecutor } from './easyeda-api';

const MAX_EDITOR_TABS = 32;
const MAX_SPLIT_SCREENS = 16;
const MAX_EDITOR_ID_LENGTH = 256;
const MAX_TAB_TITLE_LENGTH = 128;

export type EasyEdaEditorTab = {
  tabId: string;
  title: string;
  documentType: number;
  draggable: boolean;
  isAbleDelete: boolean;
  splitScreenId: string;
};

export type EasyEdaEditorState = {
  version: 1;
  capturedAt: number;
  activeTabId: string | null;
  splitScreens: number;
  tabs: EasyEdaEditorTab[];
};

export type EasyEdaEditorOperation = 'activate-tab' | 'fit-all' | 'fit-selection';
export type EasyEdaEditorFailure = 'no-tab' | 'operation-failed';

export type EasyEdaEditorOperationResult = {
  version: 1;
  operation: EasyEdaEditorOperation;
  ok: boolean;
  tabId: string | null;
  reason?: EasyEdaEditorFailure;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`Invalid EasyEDA editor state: ${label} must be a string`);
  if (value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid EasyEDA editor state: ${label} has an invalid length`);
  }
  return value;
}

export function normalizeEasyEdaEditorTabId(tabId: string): string {
  if (typeof tabId !== 'string') throw new Error('EasyEDA tab ID must be a string');
  const trimmed = tabId.trim();
  if (!trimmed) throw new Error('EasyEDA tab ID cannot be empty');
  if (trimmed.length > MAX_EDITOR_ID_LENGTH) {
    throw new Error(`EasyEDA tab ID is limited to ${MAX_EDITOR_ID_LENGTH} characters`);
  }
  return trimmed;
}

function parseEditorTab(value: unknown): EasyEdaEditorTab {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA editor state: tab must be an object');
  if (typeof value.documentType !== 'number' || !Number.isInteger(value.documentType)) {
    throw new Error('Invalid EasyEDA editor state: documentType must be an integer');
  }
  if (typeof value.draggable !== 'boolean') {
    throw new Error('Invalid EasyEDA editor state: draggable must be boolean');
  }
  if (typeof value.isAbleDelete !== 'boolean') {
    throw new Error('Invalid EasyEDA editor state: isAbleDelete must be boolean');
  }

  return {
    tabId: boundedString(value.tabId, 'tabId', MAX_EDITOR_ID_LENGTH),
    title: boundedString(value.title, 'title', MAX_TAB_TITLE_LENGTH),
    documentType: value.documentType,
    draggable: value.draggable,
    isAbleDelete: value.isAbleDelete,
    splitScreenId: boundedString(value.splitScreenId, 'splitScreenId', MAX_EDITOR_ID_LENGTH),
  };
}

export function parseEasyEdaEditorState(value: unknown): EasyEdaEditorState {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA editor state: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA editor state: unsupported version');
  if (typeof value.capturedAt !== 'number' || !Number.isFinite(value.capturedAt)) {
    throw new Error('Invalid EasyEDA editor state: capturedAt must be a number');
  }
  if (value.activeTabId !== null && typeof value.activeTabId !== 'string') {
    throw new Error('Invalid EasyEDA editor state: activeTabId must be a string or null');
  }
  if (typeof value.splitScreens !== 'number' || !Number.isInteger(value.splitScreens) || value.splitScreens < 0 || value.splitScreens > MAX_SPLIT_SCREENS) {
    throw new Error('Invalid EasyEDA editor state: splitScreens is invalid');
  }
  if (!Array.isArray(value.tabs) || value.tabs.length > MAX_EDITOR_TABS) {
    throw new Error('Invalid EasyEDA editor state: tabs are invalid');
  }

  const activeTabId = value.activeTabId === null
    ? null
    : boundedString(value.activeTabId, 'activeTabId', MAX_EDITOR_ID_LENGTH);
  const tabs = value.tabs.map(parseEditorTab);
  if (activeTabId !== null && !tabs.some((tab) => tab.tabId === activeTabId)) {
    throw new Error('Invalid EasyEDA editor state: activeTabId is not present in tabs');
  }

  return {
    version: 1,
    capturedAt: value.capturedAt,
    activeTabId,
    splitScreens: value.splitScreens,
    tabs,
  };
}

export function buildEasyEdaEditorStateCode(): string {
  return `
const MAX_TABS = ${MAX_EDITOR_TABS};
const MAX_SPLITS = ${MAX_SPLIT_SCREENS};
const MAX_ID = ${MAX_EDITOR_ID_LENGTH};
const MAX_TITLE = ${MAX_TAB_TITLE_LENGTH};
const tree = await eda.dmt_EditorControl.getSplitScreenTree();
const currentDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo();
const tabs = [];
let splitScreens = 0;
const visit = (node) => {
  if (!node || typeof node !== 'object' || splitScreens >= MAX_SPLITS) return;
  splitScreens += 1;
  const splitScreenId = typeof node.id === 'string' ? node.id.slice(0, MAX_ID) : '';
  if (Array.isArray(node.tabs)) {
    for (const tab of node.tabs) {
      if (tabs.length >= MAX_TABS) break;
      if (!tab || typeof tab !== 'object' || !splitScreenId) continue;
      if (typeof tab.tabId !== 'string' || !tab.tabId || tab.tabId.length > MAX_ID) continue;
      if (typeof tab.title !== 'string' || !tab.title) continue;
      if (!Number.isInteger(tab.documentType)) continue;
      if (typeof tab.draggable !== 'boolean' || typeof tab.isAbleDelete !== 'boolean') continue;
      tabs.push({
        tabId: tab.tabId,
        title: tab.title.slice(0, MAX_TITLE),
        documentType: tab.documentType,
        draggable: tab.draggable,
        isAbleDelete: tab.isAbleDelete,
        splitScreenId,
      });
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (splitScreens >= MAX_SPLITS) break;
      visit(child);
    }
  }
};
visit(tree);
const activeTabId = typeof currentDocument?.tabId === 'string'
  && tabs.some((tab) => tab.tabId === currentDocument.tabId)
  ? currentDocument.tabId
  : null;
return {
  version: 1,
  capturedAt: Date.now(),
  activeTabId,
  splitScreens,
  tabs,
};
`.trim();
}

function buildOperationResultCode(operation: EasyEdaEditorOperation, tabIdExpression: string, successExpression: string): string {
  return `({ version: 1, operation: '${operation}', ok: ${successExpression}, tabId: ${tabIdExpression}, ...(${successExpression} ? {} : { reason: 'operation-failed' }) })`;
}

export function buildEasyEdaActivateTabCode(tabId: string): string {
  const normalizedTabId = normalizeEasyEdaEditorTabId(tabId);
  const serializedTabId = JSON.stringify(normalizedTabId);
  return `
const tabId = ${serializedTabId};
const ok = await eda.dmt_EditorControl.activateDocument(tabId);
return ${buildOperationResultCode('activate-tab', 'tabId', 'ok === true')};
`.trim();
}

export function buildEasyEdaFitAllCode(tabId: string): string {
  const normalizedTabId = normalizeEasyEdaEditorTabId(tabId);
  const serializedTabId = JSON.stringify(normalizedTabId);
  return `
const tabId = ${serializedTabId};
const bounds = await eda.dmt_EditorControl.zoomToAllPrimitives(tabId);
return ${buildOperationResultCode('fit-all', 'tabId', 'bounds !== false')};
`.trim();
}

export function buildEasyEdaFitSelectionCode(tabId: string): string {
  const normalizedTabId = normalizeEasyEdaEditorTabId(tabId);
  const serializedTabId = JSON.stringify(normalizedTabId);
  return `
const tabId = ${serializedTabId};
const bounds = await eda.dmt_EditorControl.zoomToSelectedPrimitives(tabId);
return ${buildOperationResultCode('fit-selection', 'tabId', 'bounds !== false')};
`.trim();
}

export function parseEasyEdaEditorOperationResult(value: unknown): EasyEdaEditorOperationResult {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA editor result: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA editor result: unsupported version');
  if (value.operation !== 'activate-tab' && value.operation !== 'fit-all' && value.operation !== 'fit-selection') {
    throw new Error('Invalid EasyEDA editor result: operation is invalid');
  }
  if (typeof value.ok !== 'boolean') throw new Error('Invalid EasyEDA editor result: ok must be boolean');
  if (value.tabId !== null && typeof value.tabId !== 'string') {
    throw new Error('Invalid EasyEDA editor result: tabId must be a string or null');
  }

  const tabId = value.tabId === null ? null : normalizeEasyEdaEditorTabId(value.tabId);
  let reason: EasyEdaEditorFailure | undefined;
  if (value.reason !== undefined) {
    if (value.reason !== 'no-tab' && value.reason !== 'operation-failed') {
      throw new Error('Invalid EasyEDA editor result: reason is invalid');
    }
    reason = value.reason;
  }
  if (value.ok && reason !== undefined) throw new Error('Invalid EasyEDA editor result: successful result cannot include a failure reason');
  if (!value.ok && reason === undefined) throw new Error('Invalid EasyEDA editor result: failed result requires a reason');

  return {
    version: 1,
    operation: value.operation,
    ok: value.ok,
    tabId,
    reason,
  };
}

function operationFailureMessage(result: EasyEdaEditorOperationResult): string {
  if (result.reason === 'no-tab') return 'No EasyEDA editor tab is available';
  if (result.operation === 'activate-tab') return 'EasyEDA could not activate that document tab';
  if (result.operation === 'fit-selection') return 'EasyEDA could not fit the current selection';
  return 'EasyEDA could not fit all primitives';
}

export class EasyEdaEditorApi {
  constructor(private readonly executor: EasyEdaExecutor) {}

  async getState(): Promise<EasyEdaEditorState> {
    const value = await this.executor.execute<unknown>(buildEasyEdaEditorStateCode());
    return parseEasyEdaEditorState(value);
  }

  async activateTab(tabId: string): Promise<EasyEdaEditorState> {
    const value = await this.executor.execute<unknown>(buildEasyEdaActivateTabCode(tabId));
    const result = parseEasyEdaEditorOperationResult(value);
    if (!result.ok) throw new Error(operationFailureMessage(result));
    return this.getState();
  }

  async fitAll(tabId: string): Promise<void> {
    const value = await this.executor.execute<unknown>(buildEasyEdaFitAllCode(tabId));
    const result = parseEasyEdaEditorOperationResult(value);
    if (!result.ok) throw new Error(operationFailureMessage(result));
  }

  async fitSelection(tabId: string): Promise<void> {
    const value = await this.executor.execute<unknown>(buildEasyEdaFitSelectionCode(tabId));
    const result = parseEasyEdaEditorOperationResult(value);
    if (!result.ok) throw new Error(operationFailureMessage(result));
  }
}
