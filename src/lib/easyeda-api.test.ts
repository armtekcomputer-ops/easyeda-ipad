import { describe, expect, it } from 'vitest';
import {
  EASYEDA_DOCUMENT_TYPE,
  buildEasyEdaSnapshotCode,
  parseEasyEdaSnapshot,
} from './easyeda-api';

describe('buildEasyEdaSnapshotCode', () => {
  it('uses only verified read APIs for the first snapshot milestone', () => {
    const code = buildEasyEdaSnapshotCode();

    expect(code).toContain('eda.dmt_SelectControl.getCurrentDocumentInfo()');
    expect(code).toContain('eda.dmt_Project.getCurrentProjectInfo()');
    expect(code).toContain('eda.dmt_Pcb.getCurrentPcbInfo()');
    expect(code).toContain('eda.dmt_Schematic.getCurrentSchematicInfo()');
    expect(code).toContain('eda.dmt_Schematic.getCurrentSchematicPageInfo()');
    expect(code).toContain('eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()');
    expect(code).toContain('eda.pcb_SelectControl.getAllSelectedPrimitives()');
    expect(code).toContain('eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId()');
    expect(code).toContain('eda.sch_SelectControl.getAllSelectedPrimitives()');

    expect(code).not.toContain('.clearSelected(');
    expect(code).not.toContain('.doSelectPrimitives(');
    expect(code).not.toContain('.doCrossProbeSelect(');
    expect(code).not.toContain('.save(');
  });

  it('uses the verified document type numbers', () => {
    expect(EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE).toBe(1);
    expect(EASYEDA_DOCUMENT_TYPE.PCB).toBe(3);
    expect(EASYEDA_DOCUMENT_TYPE.FOOTPRINT).toBe(4);
  });
});

describe('parseEasyEdaSnapshot', () => {
  it('accepts a normalized PCB snapshot', () => {
    const snapshot = parseEasyEdaSnapshot({
      version: 1,
      capturedAt: 1_790_000_000_000,
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
        summaries: [{ primitiveId: 'primitive-1', type: 12, locked: false }],
      },
    });

    expect(snapshot.context.kind).toBe('pcb');
    expect(snapshot.selection.ids).toEqual(['primitive-1']);
    expect(snapshot.project?.friendlyName).toBe('Power board');
  });

  it('accepts a normalized schematic snapshot', () => {
    const snapshot = parseEasyEdaSnapshot({
      version: 1,
      capturedAt: 1_790_000_000_001,
      document: {
        documentType: 1,
        uuid: 'page-uuid',
        tabId: 'tab-2',
        parentProjectUuid: 'project-uuid',
      },
      project: null,
      context: {
        kind: 'schematic',
        schematic: {
          uuid: 'sch-uuid',
          name: 'Main schematic',
          parentProjectUuid: 'project-uuid',
        },
        page: {
          uuid: 'page-uuid',
          name: 'Page 1',
          parentSchematicUuid: 'sch-uuid',
        },
      },
      selection: { total: 0, ids: [], summaries: [] },
    });

    expect(snapshot.context.kind).toBe('schematic');
    if (snapshot.context.kind === 'schematic') {
      expect(snapshot.context.page?.name).toBe('Page 1');
    }
  });

  it('rejects unexpected or unbounded data', () => {
    expect(() => parseEasyEdaSnapshot({
      version: 1,
      capturedAt: Date.now(),
      document: null,
      project: null,
      context: { kind: 'other' },
      selection: {
        total: 101,
        ids: Array.from({ length: 101 }, (_, index) => `id-${index}`),
        summaries: [],
      },
    })).toThrow(/selection ids are invalid/);

    expect(() => parseEasyEdaSnapshot({
      version: 1,
      capturedAt: Date.now(),
      document: null,
      project: null,
      context: { kind: 'other' },
      selection: {
        total: 1,
        ids: ['id-1'],
        summaries: [{ primitiveId: 'id-1', nested: { unsafe: true } }],
      },
    })).toThrow(/unsupported primitive summary field/);
  });
});
