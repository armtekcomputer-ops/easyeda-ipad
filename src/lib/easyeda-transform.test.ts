import { describe, expect, it, vi } from 'vitest';
import type { EasyEdaExecutor } from './easyeda-api';
import {
  EASYEDA_COMPONENT_NUDGE_MM,
  EASYEDA_PCB_NUDGE_UNITS,
  EASYEDA_SCHEMATIC_NUDGE_UNITS,
  EasyEdaComponentTransformApi,
  buildEasyEdaComponentTransformCode,
  parseEasyEdaComponentTransformResult,
} from './easyeda-transform';

const expectedDocument = { documentType: 3, uuid: 'pcb-uuid', tabId: 'tab-1' };

async function executeGenerated(code: string, eda: unknown): Promise<unknown> {
  const runner = new Function('eda', `return (async () => { ${code} })();`) as (value: unknown) => Promise<unknown>;
  return runner(eda);
}

function componentState(options: { x?: number; y?: number; rotation?: number; locked?: boolean } = {}) {
  return {
    getState_X: vi.fn(() => options.x ?? 100),
    getState_Y: vi.fn(() => options.y ?? 200),
    getState_Rotation: vi.fn(() => options.rotation ?? 0),
    getState_PrimitiveLock: vi.fn(() => options.locked ?? false),
  };
}

function pcbEda(component: unknown, document = expectedDocument) {
  return {
    dmt_SelectControl: { getCurrentDocumentInfo: vi.fn(async () => document) },
    pcb_PrimitiveComponent: { get: vi.fn(async () => component), modify: vi.fn(async () => ({})) },
    sch_PrimitiveComponent: { get: vi.fn(), modify: vi.fn() },
  };
}

const pcbSnapshot = {
  version: 1, capturedAt: 1_790_000_000_200,
  document: { documentType: 3, uuid: 'pcb-uuid', tabId: 'tab-1', parentProjectUuid: 'project-uuid' },
  project: { uuid: 'project-uuid', name: 'project-link', friendlyName: 'Power board', teamUuid: 'team-uuid' },
  context: { kind: 'pcb', uuid: 'pcb-uuid', name: 'PCB1', parentProjectUuid: 'project-uuid' },
  selection: { total: 1, ids: ['component-1'], summaries: [{ primitiveId: 'component-1' }] },
};

class QueueExecutor implements EasyEdaExecutor {
  readonly calls: string[] = [];
  constructor(private readonly values: unknown[]) {}
  async execute<T = unknown>(code: string): Promise<T> {
    this.calls.push(code);
    if (this.values.length === 0) throw new Error('Unexpected executor call');
    return this.values.shift() as T;
  }
}

describe('guarded component transform', () => {
  it('embeds trusted document identity and documented component APIs', () => {
    const code = buildEasyEdaComponentTransformCode(expectedDocument, [' component-"1 '], 'x-positive');
    expect(code).toContain(JSON.stringify(expectedDocument));
    expect(code).toContain(`const primitiveId = ${JSON.stringify('component-"1')};`);
    expect(code).toContain('doc.uuid !== expectedDocument.uuid');
    expect(code).toContain('doc.tabId !== expectedDocument.tabId');
    expect(code).toContain('eda.pcb_PrimitiveComponent.modify(primitiveId, property)');
    expect(code).not.toContain('SYS_Math');
  });

  it('rejects document changes before any component lookup or modify', async () => {
    const component = componentState();
    const eda = pcbEda(component, { documentType: 3, uuid: 'other-pcb', tabId: 'tab-2' });
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(expectedDocument, ['component-1'], 'x-positive'), eda);
    expect(eda.pcb_PrimitiveComponent.get).not.toHaveBeenCalled();
    expect(eda.pcb_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'document-changed' });
  });

  it('nudges PCB X by 10 native units only after identity matches', async () => {
    const eda = pcbEda(componentState({ x: 100 }));
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(expectedDocument, ['component-1'], 'x-positive'), eda);
    expect(eda.pcb_PrimitiveComponent.modify).toHaveBeenCalledWith('component-1', { x: 110 });
    expect(result).toMatchObject({ ok: true, documentType: 3 });
  });

  it('rejects locked PCB components before modify', async () => {
    const eda = pcbEda(componentState({ locked: true }));
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(expectedDocument, ['component-1'], 'x-negative'), eda);
    expect(eda.pcb_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'locked-component' });
  });

  it('keeps documented physical step constants', () => {
    expect(EASYEDA_COMPONENT_NUDGE_MM).toBe(0.254);
    expect(EASYEDA_PCB_NUDGE_UNITS).toBe(10);
    expect(EASYEDA_SCHEMATIC_NUDGE_UNITS).toBe(1);
  });

  it('validates document-changed result', () => {
    expect(parseEasyEdaComponentTransformResult({ version: 1, operation: 'x-positive', ok: false, documentType: 3, primitiveId: 'component-1', reason: 'document-changed' }).reason).toBe('document-changed');
  });

  it('reads back a fresh snapshot only after success', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'x-positive', ok: true, documentType: 3, primitiveId: 'component-1' },
      pcbSnapshot,
    ]);
    const api = new EasyEdaComponentTransformApi(executor);
    const snapshot = await api.transform(expectedDocument, ['component-1'], 'x-positive');
    expect(snapshot.selection.ids).toEqual(['component-1']);
    expect(executor.calls).toHaveLength(2);
  });

  it('does not read back after document-changed failure', async () => {
    const executor = new QueueExecutor([
      { version: 1, operation: 'x-positive', ok: false, documentType: 3, primitiveId: 'component-1', reason: 'document-changed' },
    ]);
    const api = new EasyEdaComponentTransformApi(executor);
    await expect(api.transform(expectedDocument, ['component-1'], 'x-positive')).rejects.toThrow(/document changed/i);
    expect(executor.calls).toHaveLength(1);
  });
});
