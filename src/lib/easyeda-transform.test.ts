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

async function executeGenerated(code: string, eda: unknown): Promise<unknown> {
  const runner = new Function('eda', `return (async () => { ${code} })();`) as (value: unknown) => Promise<unknown>;
  return runner(eda);
}

function componentState(options: {
  x?: number;
  y?: number;
  rotation?: number;
  locked?: boolean;
} = {}) {
  return {
    getState_X: vi.fn(() => options.x ?? 100),
    getState_Y: vi.fn(() => options.y ?? 200),
    getState_Rotation: vi.fn(() => options.rotation ?? 0),
    getState_PrimitiveLock: vi.fn(() => options.locked ?? false),
  };
}

function pcbEda(component: unknown) {
  return {
    dmt_SelectControl: {
      getCurrentDocumentInfo: vi.fn(async () => ({ documentType: 3 })),
    },
    pcb_PrimitiveComponent: {
      get: vi.fn(async () => component),
      modify: vi.fn(async () => ({})),
    },
    sch_PrimitiveComponent: {
      get: vi.fn(),
      modify: vi.fn(),
    },
  };
}

function schematicEda(component: unknown) {
  return {
    dmt_SelectControl: {
      getCurrentDocumentInfo: vi.fn(async () => ({ documentType: 1 })),
    },
    pcb_PrimitiveComponent: {
      get: vi.fn(),
      modify: vi.fn(),
    },
    sch_PrimitiveComponent: {
      get: vi.fn(async () => component),
      modify: vi.fn(async () => ({})),
    },
  };
}

const pcbSnapshot = {
  version: 1,
  capturedAt: 1_790_000_000_200,
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
    ids: ['component-1'],
    summaries: [{ primitiveId: 'component-1' }],
  },
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

describe('component transform command generation', () => {
  it('uses only verified component get/modify APIs and JSON-serialized ID', () => {
    const code = buildEasyEdaComponentTransformCode([' component-"1 '], 'x-positive');

    expect(code).toContain(`const primitiveId = ${JSON.stringify('component-"1')};`);
    expect(code).toContain('eda.dmt_SelectControl.getCurrentDocumentInfo()');
    expect(code).toContain('eda.pcb_PrimitiveComponent.get(primitiveId)');
    expect(code).toContain('eda.pcb_PrimitiveComponent.modify(primitiveId, property)');
    expect(code).toContain('eda.sch_PrimitiveComponent.get(primitiveId)');
    expect(code).toContain('eda.sch_PrimitiveComponent.modify(primitiveId, property)');
    expect(code).not.toContain('movePrimitive');
    expect(code).not.toContain('rotatePrimitive');
    expect(code).not.toContain('SYS_Math');
  });

  it('rejects zero or multiple distinct IDs before generating write code', () => {
    expect(() => buildEasyEdaComponentTransformCode([], 'x-positive')).toThrow(/at least one/i);
    expect(() => buildEasyEdaComponentTransformCode(['a', 'b'], 'x-positive')).toThrow(/exactly one/i);
  });

  it('uses one physical 0.254 mm step in each editor domain', () => {
    expect(EASYEDA_COMPONENT_NUDGE_MM).toBe(0.254);
    expect(EASYEDA_PCB_NUDGE_UNITS).toBe(10);
    expect(EASYEDA_SCHEMATIC_NUDGE_UNITS).toBe(1);
  });
});

describe('generated component transform execution', () => {
  it('nudges a PCB component X+ by 10 PCB native units', async () => {
    const component = componentState({ x: 100 });
    const eda = pcbEda(component);
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(['component-1'], 'x-positive'), eda);

    expect(eda.pcb_PrimitiveComponent.get).toHaveBeenCalledWith('component-1');
    expect(eda.pcb_PrimitiveComponent.modify).toHaveBeenCalledTimes(1);
    expect(eda.pcb_PrimitiveComponent.modify).toHaveBeenCalledWith('component-1', { x: 110 });
    expect(eda.sch_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ version: 1, operation: 'x-positive', ok: true, documentType: 3 });
  });

  it('nudges a schematic component Y- by one schematic native unit', async () => {
    const component = componentState({ y: 20 });
    const eda = schematicEda(component);
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(['component-1'], 'y-negative'), eda);

    expect(eda.sch_PrimitiveComponent.modify).toHaveBeenCalledTimes(1);
    expect(eda.sch_PrimitiveComponent.modify).toHaveBeenCalledWith('component-1', { y: 19 });
    expect(eda.pcb_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ version: 1, operation: 'y-negative', ok: true, documentType: 1 });
  });

  it('rotates a schematic component +90 degrees using its current rotation', async () => {
    const component = componentState({ rotation: 90 });
    const eda = schematicEda(component);
    await executeGenerated(buildEasyEdaComponentTransformCode(['component-1'], 'rotate-positive'), eda);

    expect(eda.sch_PrimitiveComponent.modify).toHaveBeenCalledWith('component-1', { rotation: 180 });
  });

  it('rejects locked PCB components before modify', async () => {
    const component = componentState({ locked: true });
    const eda = pcbEda(component);
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(['component-1'], 'x-negative'), eda);

    expect(eda.pcb_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'locked-component' });
  });

  it('rejects non-component selection before modify', async () => {
    const eda = schematicEda(undefined);
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(['track-or-text'], 'rotate-negative'), eda);

    expect(eda.sch_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'non-component-selection' });
  });

  it('rejects invalid numeric state before modify', async () => {
    const component = componentState({ x: Number.NaN });
    const eda = pcbEda(component);
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(['component-1'], 'x-positive'), eda);

    expect(eda.pcb_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'invalid-component-state' });
  });

  it('rejects footprint documents without calling a component mutation API', async () => {
    const eda = {
      dmt_SelectControl: { getCurrentDocumentInfo: vi.fn(async () => ({ documentType: 4 })) },
      pcb_PrimitiveComponent: { get: vi.fn(), modify: vi.fn() },
      sch_PrimitiveComponent: { get: vi.fn(), modify: vi.fn() },
    };
    const result = await executeGenerated(buildEasyEdaComponentTransformCode(['component-1'], 'x-positive'), eda);

    expect(eda.pcb_PrimitiveComponent.get).not.toHaveBeenCalled();
    expect(eda.pcb_PrimitiveComponent.modify).not.toHaveBeenCalled();
    expect(eda.sch_PrimitiveComponent.get).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, reason: 'unsupported-document', documentType: 4 });
  });
});

describe('component transform result validation', () => {
  it('accepts compact success and rejects malformed failures', () => {
    expect(parseEasyEdaComponentTransformResult({
      version: 1,
      operation: 'rotate-positive',
      ok: true,
      documentType: 3,
      primitiveId: 'component-1',
    })).toEqual({
      version: 1,
      operation: 'rotate-positive',
      ok: true,
      documentType: 3,
      primitiveId: 'component-1',
      reason: undefined,
    });

    expect(() => parseEasyEdaComponentTransformResult({
      version: 1,
      operation: 'x-positive',
      ok: false,
      documentType: 3,
      primitiveId: 'component-1',
    })).toThrow(/requires a reason/i);
  });
});

describe('EasyEdaComponentTransformApi', () => {
  it('reads a fresh EasyEDA snapshot only after successful transform', async () => {
    const executor = new QueueExecutor([
      {
        version: 1,
        operation: 'x-positive',
        ok: true,
        documentType: 3,
        primitiveId: 'component-1',
      },
      pcbSnapshot,
    ]);
    const api = new EasyEdaComponentTransformApi(executor);

    const snapshot = await api.transform(['component-1'], 'x-positive');

    expect(snapshot.selection.ids).toEqual(['component-1']);
    expect(executor.calls).toHaveLength(2);
    expect(executor.calls[0]).toContain('pcb_PrimitiveComponent.modify');
    expect(executor.calls[1]).toContain('getAllSelectedPrimitives_PrimitiveId()');
  });

  it('does not read back after a preflight failure result', async () => {
    const executor = new QueueExecutor([
      {
        version: 1,
        operation: 'x-positive',
        ok: false,
        documentType: 3,
        primitiveId: 'component-1',
        reason: 'locked-component',
      },
    ]);
    const api = new EasyEdaComponentTransformApi(executor);

    await expect(api.transform(['component-1'], 'x-positive')).rejects.toThrow(/locked/i);
    expect(executor.calls).toHaveLength(1);
  });
});
