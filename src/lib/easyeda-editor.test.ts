import { describe, expect, it } from 'vitest';
import type { EasyEdaExecutor } from './easyeda-api';
import {
  EasyEdaEditorApi,
  buildEasyEdaActivateTabCode,
  buildEasyEdaEditorStateCode,
  buildEasyEdaFitAllCode,
  buildEasyEdaFitSelectionCode,
  normalizeEasyEdaEditorTabId,
  parseEasyEdaEditorOperationResult,
  parseEasyEdaEditorState,
} from './easyeda-editor';

class QueueExecutor implements EasyEdaExecutor {
  readonly calls: string[] = [];

  constructor(private readonly values: unknown[]) {}

  async execute<T = unknown>(code: string): Promise<T> {
    this.calls.push(code);
    if (this.values.length === 0) throw new Error('Unexpected executor call');
    return this.values.shift() as T;
  }
}

const editorState = {
  version: 1,
  capturedAt: 1_790_000_000_200,
  activeTabId: 'pcb-tab',
  splitScreens: 1,
  tabs: [
    {
      tabId: 'schematic-tab',
      title: 'Main schematic',
      documentType: 1,
      draggable: true,
      isAbleDelete: true,
      splitScreenId: 'split-1',
    },
    {
      tabId: 'pcb-tab',
      title: 'PCB1',
      documentType: 3,
      draggable: true,
      isAbleDelete: true,
      splitScreenId: 'split-1',
    },
  ],
};

describe('editor navigation command generation', () => {
  it('reads only the documented editor tree and current document APIs', () => {
    const code = buildEasyEdaEditorStateCode();

    expect(code).toContain('eda.dmt_EditorControl.getSplitScreenTree()');
    expect(code).toContain('eda.dmt_SelectControl.getCurrentDocumentInfo()');
    expect(code).not.toContain('.closeDocument(');
    expect(code).not.toContain('.openDocument(');
    expect(code).not.toContain('.save(');
  });

  it('serializes tab IDs before activating a documented editor tab', () => {
    const code = buildEasyEdaActivateTabCode(' pcb-"tab ');

    expect(code).toContain(`const tabId = ${JSON.stringify('pcb-"tab')};`);
    expect(code).toContain('await eda.dmt_EditorControl.activateDocument(tabId)');
  });

  it('uses the documented viewport fit APIs', () => {
    expect(buildEasyEdaFitAllCode('pcb-tab')).toContain('await eda.dmt_EditorControl.zoomToAllPrimitives(tabId)');
    expect(buildEasyEdaFitSelectionCode('pcb-tab')).toContain('await eda.dmt_EditorControl.zoomToSelectedPrimitives(tabId)');
  });
});

describe('editor navigation validation', () => {
  it('normalizes bounded tab IDs', () => {
    expect(normalizeEasyEdaEditorTabId('  pcb-tab  ')).toBe('pcb-tab');
    expect(() => normalizeEasyEdaEditorTabId('   ')).toThrow(/cannot be empty/i);
    expect(() => normalizeEasyEdaEditorTabId('x'.repeat(257))).toThrow(/256 characters/i);
  });

  it('accepts a bounded editor state with an active tab', () => {
    expect(parseEasyEdaEditorState(editorState)).toEqual(editorState);
  });

  it('rejects states whose active tab is not in the validated tab list', () => {
    expect(() => parseEasyEdaEditorState({ ...editorState, activeTabId: 'missing-tab' })).toThrow(/not present in tabs/i);
  });

  it('rejects oversized tab lists', () => {
    const tabs = Array.from({ length: 33 }, (_, index) => ({
      tabId: `tab-${index}`,
      title: `Tab ${index}`,
      documentType: 3,
      draggable: true,
      isAbleDelete: true,
      splitScreenId: 'split-1',
    }));
    expect(() => parseEasyEdaEditorState({ ...editorState, activeTabId: null, tabs })).toThrow(/tabs are invalid/i);
  });
});

describe('editor operation result validation', () => {
  it('accepts successful activation results', () => {
    expect(parseEasyEdaEditorOperationResult({
      version: 1,
      operation: 'activate-tab',
      ok: true,
      tabId: 'pcb-tab',
    })).toEqual({
      version: 1,
      operation: 'activate-tab',
      ok: true,
      tabId: 'pcb-tab',
      reason: undefined,
    });
  });

  it('rejects failed results without a bounded reason', () => {
    expect(() => parseEasyEdaEditorOperationResult({
      version: 1,
      operation: 'fit-selection',
      ok: false,
      tabId: 'pcb-tab',
    })).toThrow(/requires a reason/i);
  });
});

describe('EasyEdaEditorApi', () => {
  it('reads back editor state after a successful tab activation', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'activate-tab', ok: true, tabId: 'schematic-tab' },
      { ...editorState, activeTabId: 'schematic-tab' },
    ]);
    const api = new EasyEdaEditorApi(executor);

    const state = await api.activateTab('schematic-tab');

    expect(state.activeTabId).toBe('schematic-tab');
    expect(executor.calls).toHaveLength(2);
    expect(executor.calls[0]).toContain('activateDocument(tabId)');
    expect(executor.calls[1]).toContain('getSplitScreenTree()');
  });

  it('does not read back editor state after a failed activation', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'activate-tab', ok: false, tabId: 'missing-tab', reason: 'operation-failed' },
    ]);
    const api = new EasyEdaEditorApi(executor);

    await expect(api.activateTab('missing-tab')).rejects.toThrow(/could not activate/i);
    expect(executor.calls).toHaveLength(1);
  });

  it('runs fit selection without mutating document data', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'fit-selection', ok: true, tabId: 'pcb-tab' },
    ]);
    const api = new EasyEdaEditorApi(executor);

    await api.fitSelection('pcb-tab');

    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0]).toContain('zoomToSelectedPrimitives(tabId)');
    expect(executor.calls[0]).not.toContain('.save(');
  });
});
