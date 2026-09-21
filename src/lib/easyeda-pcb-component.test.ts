import { describe, expect, it } from 'vitest';
import type { EasyEdaExecutor } from './easyeda-api';
import {
  EasyEdaPcbComponentApi,
  buildEasyEdaInspectSelectedPcbComponentCode,
  normalizeEasyEdaPcbComponentDocumentIdentity,
  normalizeEasyEdaPrimitiveId,
  parseEasyEdaPcbComponentInspectResult,
  parseEasyEdaPcbComponentState,
} from './easyeda-pcb-component';

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
  uuid: 'pcb-document-a',
  tabId: 'tab-a',
};

const componentState = {
  version: 1,
  capturedAt: 1_790_000_000_200,
  primitiveId: 'component-1',
  designator: 'U1',
  name: 'MCU',
  x: 100,
  y: 200,
  rotation: 90,
  primitiveLock: false,
  layer: 'top',
};

describe('PCB component primitive ID validation', () => {
  it('trims bounded primitive IDs', () => {
    expect(normalizeEasyEdaPrimitiveId(' component-1 ')).toBe('component-1');
  });

  it('rejects empty and oversized primitive IDs', () => {
    expect(() => normalizeEasyEdaPrimitiveId('   ')).toThrow(/cannot be empty/i);
    expect(() => normalizeEasyEdaPrimitiveId('x'.repeat(257))).toThrow(/256 characters/i);
  });
});

describe('PCB component document identity validation', () => {
  it('normalizes a trusted PCB or footprint identity', () => {
    expect(normalizeEasyEdaPcbComponentDocumentIdentity({
      documentType: 4,
      uuid: ' footprint-document ',
      tabId: ' footprint-tab ',
    })).toEqual({
      documentType: 4,
      uuid: 'footprint-document',
      tabId: 'footprint-tab',
    });
  });

  it('rejects unsupported, missing, and oversized document identity fields', () => {
    expect(() => normalizeEasyEdaPcbComponentDocumentIdentity({
      documentType: 1,
      uuid: 'schematic-page',
      tabId: 'tab-1',
    })).toThrow(/PCB or footprint/i);
    expect(() => normalizeEasyEdaPcbComponentDocumentIdentity({
      documentType: 3,
      uuid: '   ',
      tabId: 'tab-1',
    })).toThrow(/UUID is invalid/i);
    expect(() => normalizeEasyEdaPcbComponentDocumentIdentity({
      documentType: 3,
      uuid: 'pcb-1',
      tabId: 'x'.repeat(257),
    })).toThrow(/tab ID is invalid/i);
  });
});

describe('PCB component inspector command generation', () => {
  it('guards document identity before selection and documented component getters', () => {
    const code = buildEasyEdaInspectSelectedPcbComponentCode(documentIdentity, 'component-1');
    const documentGuardIndex = code.indexOf('currentDocument.uuid !== expectedDocument.uuid');
    const tabGuardIndex = code.indexOf('currentDocument.tabId !== expectedDocument.tabId');
    const selectionIndex = code.indexOf('getAllSelectedPrimitives_PrimitiveId()');
    const componentIndex = code.indexOf('pcb_PrimitiveComponent.get(expectedPrimitiveId)');

    expect(code).toContain(`const expectedDocument = ${JSON.stringify(documentIdentity)};`);
    expect(code).toContain('eda.dmt_SelectControl.getCurrentDocumentInfo()');
    expect(code).toContain('currentDocument.documentType !== expectedDocument.documentType');
    expect(code).toContain('currentDocument.uuid !== expectedDocument.uuid');
    expect(code).toContain('currentDocument.tabId !== expectedDocument.tabId');
    expect(code).toContain("reason: 'document-changed'");
    expect(code).toContain('eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId()');
    expect(code).toContain('eda.pcb_PrimitiveComponent.get(expectedPrimitiveId)');
    expect(code).toContain('component.getState_PrimitiveId()');
    expect(code).toContain('component.getState_X()');
    expect(code).toContain('component.getState_Y()');
    expect(code).toContain('component.getState_Rotation()');
    expect(code).toContain('component.getState_PrimitiveLock()');
    expect(code).toContain('component.getState_Layer()');
    expect(code).toContain('component.getState_Designator()');
    expect(code).toContain('component.getState_Name()');
    expect(documentGuardIndex).toBeGreaterThanOrEqual(0);
    expect(tabGuardIndex).toBeGreaterThan(documentGuardIndex);
    expect(selectionIndex).toBeGreaterThan(tabGuardIndex);
    expect(componentIndex).toBeGreaterThan(selectionIndex);
    expect(code).not.toContain('.modify(');
    expect(code).not.toContain('.create(');
    expect(code).not.toContain('.delete(');
    expect(code).not.toContain('.save(');
  });

  it('serializes the expected document and primitive ID safely', () => {
    const primitiveId = 'component-"-1';
    const expectedDocument = {
      documentType: 3,
      uuid: 'pcb-"-1',
      tabId: 'tab-\\-1',
    };
    const code = buildEasyEdaInspectSelectedPcbComponentCode(expectedDocument, primitiveId);
    expect(code).toContain(`const expectedDocument = ${JSON.stringify(expectedDocument)};`);
    expect(code).toContain(`const expectedPrimitiveId = ${JSON.stringify(primitiveId)};`);
  });
});

describe('PCB component state parsing', () => {
  it('accepts a bounded finite component state', () => {
    expect(parseEasyEdaPcbComponentState(componentState)).toEqual(componentState);
  });

  it('accepts empty optional labels but rejects invalid numeric/layer state', () => {
    expect(parseEasyEdaPcbComponentState({ ...componentState, designator: '', name: '' }).designator).toBe('');
    expect(() => parseEasyEdaPcbComponentState({ ...componentState, x: Number.NaN })).toThrow(/x must be a finite number/i);
    expect(() => parseEasyEdaPcbComponentState({ ...componentState, layer: 'inner' })).toThrow(/layer must be top or bottom/i);
  });
});

describe('PCB component inspect result parsing', () => {
  it('accepts a successful component result', () => {
    expect(parseEasyEdaPcbComponentInspectResult({
      version: 1,
      ok: true,
      component: componentState,
    })).toEqual({
      version: 1,
      ok: true,
      component: componentState,
      reason: undefined,
    });
  });

  it('accepts document-changed as a bounded failure reason', () => {
    expect(parseEasyEdaPcbComponentInspectResult({
      version: 1,
      ok: false,
      component: null,
      reason: 'document-changed',
    })).toEqual({
      version: 1,
      ok: false,
      component: null,
      reason: 'document-changed',
    });
  });

  it('rejects malformed and inconsistent envelopes', () => {
    expect(() => parseEasyEdaPcbComponentInspectResult(null)).toThrow(/root must be an object/i);
    expect(() => parseEasyEdaPcbComponentInspectResult({
      version: 1,
      ok: false,
      component: null,
    })).toThrow(/failed result is inconsistent/i);
    expect(() => parseEasyEdaPcbComponentInspectResult({
      version: 1,
      ok: true,
      component: null,
    })).toThrow(/successful result is inconsistent/i);
  });
});

describe('EasyEdaPcbComponentApi', () => {
  it('returns the validated selected component state', async () => {
    const executor = new QueueExecutor([{
      version: 1,
      ok: true,
      component: componentState,
    }]);
    const api = new EasyEdaPcbComponentApi(executor);

    const result = await api.inspectSelectedComponent(documentIdentity, 'component-1');

    expect(result).toEqual(componentState);
    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0]).toContain('document-changed');
    expect(executor.calls[0]).toContain('selection-mismatch');
  });

  it('rejects a switched document even when the primitive ID could be the same', async () => {
    const executor = new QueueExecutor([{
      version: 1,
      ok: false,
      component: null,
      reason: 'document-changed',
    }]);
    const api = new EasyEdaPcbComponentApi(executor);

    await expect(api.inspectSelectedComponent(documentIdentity, 'component-1')).rejects.toThrow(/document changed.*refresh/i);
    expect(executor.calls).toHaveLength(1);
    const code = executor.calls[0];
    expect(code.indexOf('currentDocument.uuid !== expectedDocument.uuid'))
      .toBeLessThan(code.indexOf('getAllSelectedPrimitives_PrimitiveId()'));
    expect(code.indexOf('currentDocument.tabId !== expectedDocument.tabId'))
      .toBeLessThan(code.indexOf('getAllSelectedPrimitives_PrimitiveId()'));
    expect(code).not.toContain('.modify(');
  });

  it('surfaces selection changes without any write fallback', async () => {
    const executor = new QueueExecutor([{
      version: 1,
      ok: false,
      component: null,
      reason: 'selection-mismatch',
    }]);
    const api = new EasyEdaPcbComponentApi(executor);

    await expect(api.inspectSelectedComponent(documentIdentity, 'component-1')).rejects.toThrow(/selection changed.*refresh/i);
    expect(executor.calls).toHaveLength(1);
    expect(executor.calls[0]).not.toContain('.modify(');
  });
});
