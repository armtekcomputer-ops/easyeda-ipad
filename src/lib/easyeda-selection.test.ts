import { describe, expect, it } from 'vitest';
import {
  EasyEdaApi,
  type EasyEdaExecutor,
  buildEasyEdaClearSelectionCode,
  buildEasyEdaSelectPrimitiveIdsCode,
  normalizeEasyEdaPrimitiveIds,
  parseEasyEdaSelectionMutationResult,
} from './easyeda-api';

class QueueExecutor implements EasyEdaExecutor {
  readonly calls: string[] = [];

  constructor(private readonly values: unknown[]) {}

  async execute<T = unknown>(code: string): Promise<T> {
    this.calls.push(code);
    if (this.values.length === 0) throw new Error('Unexpected executor call');
    return this.values.shift() as T;
  }
}

const pcbSnapshot = {
  version: 1,
  capturedAt: 1_790_000_000_100,
  document: {
    documentType: 3,
    uuid: 'pcb-uuid',
    tabId: 'tab-1',
    parentProjectUuid: 'project-uuid',
  },
  project: {
    uuid: 'project-uuid',
    name: 'project-link',
    friendlyName: 'Power board',
    teamUuid: 'team-uuid',
  },
  context: {
    kind: 'pcb',
    uuid: 'pcb-uuid',
    name: 'PCB1',
    parentProjectUuid: 'project-uuid',
  },
  selection: {
    total: 1,
    ids: ['primitive-1'],
    summaries: [{ primitiveId: 'primitive-1' }],
  },
};

describe('selection mutation command generation', () => {
  it('uses only the verified clearSelected APIs with document dispatch', () => {
    const code = buildEasyEdaClearSelectionCode();

    expect(code).toContain('eda.dmt_SelectControl.getCurrentDocumentInfo()');
    expect(code).toContain('await eda.pcb_SelectControl.clearSelected()');
    expect(code).toContain('eda.sch_SelectControl.clearSelected()');
    expect(code).not.toContain('.doCrossProbeSelect(');
    expect(code).not.toContain('.save(');
    expect(code).not.toContain('addPrimitiveEventListener');
  });

  it('serializes validated IDs as JSON before calling verified doSelectPrimitives APIs', () => {
    const raw = [' primitive-1 ', 'primitive-1', 'quoted-"-id'];
    const normalized = ['primitive-1', 'quoted-"-id'];
    const code = buildEasyEdaSelectPrimitiveIdsCode(raw);

    expect(code).toContain(`const primitiveIds = ${JSON.stringify(normalized)};`);
    expect(code).toContain('await eda.pcb_SelectControl.doSelectPrimitives(primitiveIds)');
    expect(code).toContain('await eda.sch_SelectControl.doSelectPrimitives(primitiveIds)');
    expect(code).not.toContain('.doCrossProbeSelect(');
    expect(code).not.toContain('addPrimitiveEventListener');
  });
});

describe('selection ID validation', () => {
  it('trims and de-duplicates IDs while preserving order', () => {
    expect(normalizeEasyEdaPrimitiveIds(['  a  ', 'b', 'a'])).toEqual(['a', 'b']);
  });

  it('rejects empty, oversized, and over-count inputs before execution', () => {
    expect(() => normalizeEasyEdaPrimitiveIds([])).toThrow(/at least one/i);
    expect(() => normalizeEasyEdaPrimitiveIds(['   '])).toThrow(/cannot be empty/i);
    expect(() => normalizeEasyEdaPrimitiveIds(['x'.repeat(257)])).toThrow(/256 characters/i);
    expect(() => normalizeEasyEdaPrimitiveIds(Array.from({ length: 101 }, (_, index) => `id-${index}`))).toThrow(/100 primitive IDs/i);
  });
});

describe('parseEasyEdaSelectionMutationResult', () => {
  it('accepts a compact successful result', () => {
    expect(parseEasyEdaSelectionMutationResult({
      version: 1,
      operation: 'select',
      ok: true,
      documentType: 3,
      requested: 2,
    })).toEqual({
      version: 1,
      operation: 'select',
      ok: true,
      documentType: 3,
      requested: 2,
      reason: undefined,
    });
  });

  it('rejects malformed mutation results', () => {
    expect(() => parseEasyEdaSelectionMutationResult({
      version: 1,
      operation: 'select',
      ok: false,
      documentType: 3,
      requested: 1,
    })).toThrow(/requires a reason/i);

    expect(() => parseEasyEdaSelectionMutationResult({
      version: 1,
      operation: 'clear',
      ok: true,
      documentType: 1,
      requested: 0,
      reason: 'mutation-failed',
    })).toThrow(/cannot include a failure reason/i);
  });
});

describe('EasyEdaApi selection synchronization', () => {
  it('refreshes from EasyEDA after a successful select mutation', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'select', ok: true, documentType: 3, requested: 1 },
      pcbSnapshot,
    ]);
    const api = new EasyEdaApi(executor);

    const snapshot = await api.selectPrimitiveIds(['primitive-1']);

    expect(snapshot.selection.ids).toEqual(['primitive-1']);
    expect(executor.calls).toHaveLength(2);
    expect(executor.calls[0]).toContain('doSelectPrimitives(primitiveIds)');
    expect(executor.calls[1]).toContain('getAllSelectedPrimitives_PrimitiveId()');
  });

  it('refreshes from EasyEDA after a successful clear mutation', async () => {
    const clearedSnapshot = {
      ...pcbSnapshot,
      selection: { total: 0, ids: [], summaries: [] },
    };
    const executor = new QueueExecutor([
      { version: 1, operation: 'clear', ok: true, documentType: 3, requested: 0 },
      clearedSnapshot,
    ]);
    const api = new EasyEdaApi(executor);

    const snapshot = await api.clearSelection();

    expect(snapshot.selection.total).toBe(0);
    expect(executor.calls).toHaveLength(2);
    expect(executor.calls[0]).toContain('clearSelected()');
  });

  it('does not read back state after an unsupported-document failure', async () => {
    const executor = new QueueExecutor([
      {
        version: 1,
        operation: 'select',
        ok: false,
        documentType: 26,
        requested: 1,
        reason: 'unsupported-document',
      },
    ]);
    const api = new EasyEdaApi(executor);

    await expect(api.selectPrimitiveIds(['primitive-1'])).rejects.toThrow(/not supported.*26/i);
    expect(executor.calls).toHaveLength(1);
  });
});
