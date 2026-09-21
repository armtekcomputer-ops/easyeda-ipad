import { describe, expect, it } from 'vitest';
import type { EasyEdaExecutor } from './easyeda-api';
import {
  EasyEdaSafeSelectionApi,
  buildSafeClearSelectionCode,
  buildSafeSelectPrimitiveIdsCode,
  normalizeDocumentIdentity,
  parseSafeSelectionResult,
} from './easyeda-safe-selection';

class QueueExecutor implements EasyEdaExecutor {
  readonly calls: string[] = [];

  constructor(private readonly values: unknown[]) {}

  async execute<T = unknown>(code: string): Promise<T> {
    this.calls.push(code);
    if (this.values.length === 0) throw new Error('Unexpected executor call');
    return this.values.shift() as T;
  }
}

const documentIdentity = {
  documentType: 3,
  uuid: 'pcb-uuid',
  tabId: 'tab-1',
};

const pcbSnapshot = {
  version: 1,
  capturedAt: 1_790_000_000_100,
  document: {
    ...documentIdentity,
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

describe('trusted EasyEDA document identity', () => {
  it('normalizes a bounded document identity', () => {
    expect(normalizeDocumentIdentity({ documentType: 3, uuid: ' pcb-uuid ', tabId: ' tab-1 ' })).toEqual(documentIdentity);
  });

  it('rejects missing and oversized identity fields', () => {
    expect(() => normalizeDocumentIdentity({ documentType: 3, uuid: ' ', tabId: 'tab-1' })).toThrow(/UUID is invalid/i);
    expect(() => normalizeDocumentIdentity({ documentType: 3, uuid: 'pcb-uuid', tabId: 'x'.repeat(257) })).toThrow(/tab ID is invalid/i);
  });
});

describe('safe selection command generation', () => {
  it('checks document type, UUID, and tab before clearSelected', () => {
    const code = buildSafeClearSelectionCode(documentIdentity);
    const guardIndex = code.indexOf('doc.uuid !== expectedDocument.uuid');
    const mutationIndex = code.indexOf('eda.pcb_SelectControl.clearSelected()');

    expect(code).toContain(`const expectedDocument = ${JSON.stringify(documentIdentity)};`);
    expect(code).toContain('doc.documentType !== expectedDocument.documentType');
    expect(code).toContain('doc.uuid !== expectedDocument.uuid');
    expect(code).toContain('doc.tabId !== expectedDocument.tabId');
    expect(code).toContain("reason: 'document-changed'");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(mutationIndex).toBeGreaterThan(guardIndex);
  });

  it('checks the same trusted identity before selecting IDs', () => {
    const code = buildSafeSelectPrimitiveIdsCode(documentIdentity, [' primitive-1 ', 'primitive-1']);
    const guardIndex = code.indexOf('doc.tabId !== expectedDocument.tabId');
    const mutationIndex = code.indexOf('doSelectPrimitives(primitiveIds)');

    expect(code).toContain('const primitiveIds = ["primitive-1"];');
    expect(mutationIndex).toBeGreaterThan(guardIndex);
  });
});

describe('safe selection result validation', () => {
  it('accepts document-changed as a bounded preflight failure', () => {
    expect(parseSafeSelectionResult({
      version: 1,
      operation: 'select',
      ok: false,
      documentType: 3,
      requested: 1,
      reason: 'document-changed',
    })).toEqual({
      version: 1,
      operation: 'select',
      ok: false,
      documentType: 3,
      requested: 1,
      reason: 'document-changed',
    });
  });

  it('rejects scalar and malformed result envelopes', () => {
    expect(() => parseSafeSelectionResult(null)).toThrow(/root must be an object/i);
    expect(() => parseSafeSelectionResult({
      version: 1,
      operation: 'select',
      ok: false,
      documentType: 3,
      requested: 1,
    })).toThrow(/requires a reason/i);
  });
});

describe('EasyEdaSafeSelectionApi', () => {
  it('does not read back or issue another request after document identity changes', async () => {
    const executor = new QueueExecutor([{
      version: 1,
      operation: 'select',
      ok: false,
      documentType: 3,
      requested: 1,
      reason: 'document-changed',
    }]);
    const api = new EasyEdaSafeSelectionApi(executor);

    await expect(api.selectPrimitiveIds(documentIdentity, ['primitive-1'])).rejects.toThrow(/document changed.*refresh/i);
    expect(executor.calls).toHaveLength(1);
  });

  it('reads a fresh snapshot only after a successful guarded mutation', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'clear', ok: true, documentType: 3, requested: 0 },
      { ...pcbSnapshot, selection: { total: 0, ids: [], summaries: [] } },
    ]);
    const api = new EasyEdaSafeSelectionApi(executor);

    const next = await api.clearSelection(documentIdentity);

    expect(next.selection.total).toBe(0);
    expect(executor.calls).toHaveLength(2);
    expect(executor.calls[0]).toContain('expectedDocument');
    expect(executor.calls[1]).toContain('getAllSelectedPrimitives_PrimitiveId()');
  });
});
