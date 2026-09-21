import { describe, expect, it } from 'vitest';
import type { EasyEdaExecutor } from './easyeda-api';
import {
  EasyEdaProjectDocumentsApi,
  buildEasyEdaCurrentProjectDocumentsCode,
  buildEasyEdaOpenCurrentProjectDocumentCode,
  normalizeEasyEdaDocumentUuid,
  parseEasyEdaCurrentProjectDocuments,
  parseEasyEdaOpenProjectDocumentResult,
} from './easyeda-project-documents';

class QueueExecutor implements EasyEdaExecutor {
  readonly calls: string[] = [];

  constructor(private readonly values: unknown[]) {}

  async execute<T = unknown>(code: string): Promise<T> {
    this.calls.push(code);
    if (this.values.length === 0) throw new Error('Unexpected executor call');
    return this.values.shift() as T;
  }
}

const documentsState = {
  version: 1,
  capturedAt: 1_790_000_000_300,
  project: {
    uuid: 'project-uuid',
    friendlyName: 'Power board',
  },
  documents: [
    {
      uuid: 'sheet-uuid',
      name: 'Main schematic',
      kind: 'schematic-page',
      parentSchematicUuid: 'schematic-uuid',
      parentBoardName: 'Main board',
    },
    {
      uuid: 'pcb-uuid',
      name: 'PCB1',
      kind: 'pcb',
      parentBoardName: 'Main board',
    },
  ],
};

describe('current-project document command generation', () => {
  it('reads only the current project and bounded schematic-page/PCB data', () => {
    const code = buildEasyEdaCurrentProjectDocumentsCode();

    expect(code).toContain('eda.dmt_Project.getCurrentProjectInfo()');
    expect(code).toContain("item.itemType === 'PCB'");
    expect(code).toContain("item.itemType === 'Schematic'");
    expect(code).toContain("item.itemType === 'Board'");
    expect(code).not.toContain('openProject(');
    expect(code).not.toContain('closeDocument(');
    expect(code).not.toContain('.save(');
  });

  it('re-validates membership in the current project before openDocument', () => {
    const code = buildEasyEdaOpenCurrentProjectDocumentCode(' sheet-"uuid ');

    expect(code).toContain(`const documentUuid = ${JSON.stringify('sheet-"uuid')};`);
    expect(code).toContain('eda.dmt_Project.getCurrentProjectInfo()');
    expect(code).toContain('documents.some((document) => document.uuid === documentUuid)');
    expect(code).toContain('await eda.dmt_EditorControl.openDocument(documentUuid)');
    expect(code).not.toContain('openProject(');
    expect(code).not.toContain('closeDocument(');
    expect(code).not.toContain('.save(');
  });
});

describe('current-project document validation', () => {
  it('normalizes bounded document UUIDs', () => {
    expect(normalizeEasyEdaDocumentUuid('  pcb-uuid  ')).toBe('pcb-uuid');
    expect(() => normalizeEasyEdaDocumentUuid('   ')).toThrow(/cannot be empty/i);
    expect(() => normalizeEasyEdaDocumentUuid('x'.repeat(257))).toThrow(/256 characters/i);
  });

  it('accepts a bounded unique document list', () => {
    expect(parseEasyEdaCurrentProjectDocuments(documentsState)).toEqual(documentsState);
  });

  it('rejects duplicate document UUIDs and documents without a current project', () => {
    expect(() => parseEasyEdaCurrentProjectDocuments({
      ...documentsState,
      documents: [documentsState.documents[0], documentsState.documents[0]],
    })).toThrow(/duplicate document UUID/i);

    expect(() => parseEasyEdaCurrentProjectDocuments({
      ...documentsState,
      project: null,
    })).toThrow(/require a current project/i);
  });

  it('rejects oversized document lists', () => {
    const documents = Array.from({ length: 129 }, (_, index) => ({
      uuid: `pcb-${index}`,
      name: `PCB ${index}`,
      kind: 'pcb',
    }));
    expect(() => parseEasyEdaCurrentProjectDocuments({ ...documentsState, documents })).toThrow(/documents are invalid/i);
  });
});

describe('open-document result validation', () => {
  it('accepts successful openDocument results', () => {
    expect(parseEasyEdaOpenProjectDocumentResult({
      version: 1,
      ok: true,
      documentUuid: 'pcb-uuid',
      tabId: 'pcb-tab',
    })).toEqual({
      version: 1,
      ok: true,
      documentUuid: 'pcb-uuid',
      tabId: 'pcb-tab',
      reason: undefined,
    });
  });

  it('rejects inconsistent failures', () => {
    expect(() => parseEasyEdaOpenProjectDocumentResult({
      version: 1,
      ok: false,
      documentUuid: 'pcb-uuid',
      tabId: null,
    })).toThrow(/failed result is inconsistent/i);
  });
});

describe('EasyEdaProjectDocumentsApi', () => {
  it('reads validated current-project documents', async () => {
    const executor = new QueueExecutor([documentsState]);
    const api = new EasyEdaProjectDocumentsApi(executor);

    const state = await api.getCurrentProjectDocuments();

    expect(state.documents.map((document) => document.uuid)).toEqual(['sheet-uuid', 'pcb-uuid']);
    expect(executor.calls).toHaveLength(1);
  });

  it('returns the validated tab ID after a successful open', async () => {
    const executor = new QueueExecutor([
      { version: 1, ok: true, documentUuid: 'pcb-uuid', tabId: 'pcb-tab' },
    ]);
    const api = new EasyEdaProjectDocumentsApi(executor);

    const result = await api.openCurrentProjectDocument('pcb-uuid');

    expect(result.tabId).toBe('pcb-tab');
    expect(executor.calls[0]).toContain('openDocument(documentUuid)');
  });

  it('does not retry or trust a document that is no longer in the current project', async () => {
    const executor = new QueueExecutor([
      {
        version: 1,
        ok: false,
        documentUuid: 'old-uuid',
        tabId: null,
        reason: 'document-not-in-current-project',
      },
    ]);
    const api = new EasyEdaProjectDocumentsApi(executor);

    await expect(api.openCurrentProjectDocument('old-uuid')).rejects.toThrow(/no longer in the current/i);
    expect(executor.calls).toHaveLength(1);
  });
});
