import type { EasyEdaDocumentSummary, EasyEdaExecutor } from './easyeda-api';

const MAX_PRIMITIVE_ID_LENGTH = 256;
const MAX_COMPONENT_TEXT_LENGTH = 128;
const MAX_DOCUMENT_ID_LENGTH = 256;

export type EasyEdaPcbComponentLayer = 'top' | 'bottom';
export type EasyEdaPcbComponentDocumentIdentity = Pick<EasyEdaDocumentSummary, 'documentType' | 'uuid' | 'tabId'>;

export type EasyEdaPcbComponentState = {
  version: 1;
  capturedAt: number;
  primitiveId: string;
  designator?: string;
  name?: string;
  x: number;
  y: number;
  rotation: number;
  primitiveLock: boolean;
  layer: EasyEdaPcbComponentLayer;
};

export type EasyEdaPcbComponentInspectFailure =
  | 'unsupported-document'
  | 'document-changed'
  | 'selection-mismatch'
  | 'not-component'
  | 'invalid-component-state';

export type EasyEdaPcbComponentInspectResult = {
  version: 1;
  ok: boolean;
  component: EasyEdaPcbComponentState | null;
  reason?: EasyEdaPcbComponentInspectFailure;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeEasyEdaPrimitiveId(primitiveId: string): string {
  if (typeof primitiveId !== 'string') throw new Error('EasyEDA primitive ID must be a string');
  const trimmed = primitiveId.trim();
  if (!trimmed) throw new Error('EasyEDA primitive ID cannot be empty');
  if (trimmed.length > MAX_PRIMITIVE_ID_LENGTH) {
    throw new Error(`EasyEDA primitive ID is limited to ${MAX_PRIMITIVE_ID_LENGTH} characters`);
  }
  return trimmed;
}

export function normalizeEasyEdaPcbComponentDocumentIdentity(
  document: EasyEdaPcbComponentDocumentIdentity,
): EasyEdaPcbComponentDocumentIdentity {
  if (!document || typeof document !== 'object') throw new Error('Trusted EasyEDA document identity is required');
  if (document.documentType !== 3 && document.documentType !== 4) {
    throw new Error('PCB component inspection requires a trusted PCB or footprint document');
  }
  if (typeof document.uuid !== 'string' || !document.uuid.trim() || document.uuid.length > MAX_DOCUMENT_ID_LENGTH) {
    throw new Error('Trusted EasyEDA document UUID is invalid');
  }
  if (typeof document.tabId !== 'string' || !document.tabId.trim() || document.tabId.length > MAX_DOCUMENT_ID_LENGTH) {
    throw new Error('Trusted EasyEDA tab ID is invalid');
  }

  return {
    documentType: document.documentType,
    uuid: document.uuid.trim(),
    tabId: document.tabId.trim(),
  };
}

function parseOptionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > MAX_COMPONENT_TEXT_LENGTH) {
    throw new Error(`Invalid EasyEDA PCB component state: ${label} is invalid`);
  }
  return value;
}

function parseFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid EasyEDA PCB component state: ${label} must be a finite number`);
  }
  return value;
}

export function parseEasyEdaPcbComponentState(value: unknown): EasyEdaPcbComponentState {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA PCB component state: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA PCB component state: unsupported version');
  if (typeof value.capturedAt !== 'number' || !Number.isFinite(value.capturedAt)) {
    throw new Error('Invalid EasyEDA PCB component state: capturedAt must be a finite number');
  }
  if (typeof value.primitiveId !== 'string') {
    throw new Error('Invalid EasyEDA PCB component state: primitiveId must be a string');
  }
  if (typeof value.primitiveLock !== 'boolean') {
    throw new Error('Invalid EasyEDA PCB component state: primitiveLock must be boolean');
  }
  if (value.layer !== 'top' && value.layer !== 'bottom') {
    throw new Error('Invalid EasyEDA PCB component state: layer must be top or bottom');
  }

  return {
    version: 1,
    capturedAt: value.capturedAt,
    primitiveId: normalizeEasyEdaPrimitiveId(value.primitiveId),
    designator: parseOptionalText(value.designator, 'designator'),
    name: parseOptionalText(value.name, 'name'),
    x: parseFiniteNumber(value.x, 'x'),
    y: parseFiniteNumber(value.y, 'y'),
    rotation: parseFiniteNumber(value.rotation, 'rotation'),
    primitiveLock: value.primitiveLock,
    layer: value.layer,
  };
}

export function parseEasyEdaPcbComponentInspectResult(value: unknown): EasyEdaPcbComponentInspectResult {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA PCB component inspect result: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA PCB component inspect result: unsupported version');
  if (typeof value.ok !== 'boolean') throw new Error('Invalid EasyEDA PCB component inspect result: ok must be boolean');

  let reason: EasyEdaPcbComponentInspectFailure | undefined;
  if (value.reason !== undefined) {
    if (
      value.reason !== 'unsupported-document'
      && value.reason !== 'document-changed'
      && value.reason !== 'selection-mismatch'
      && value.reason !== 'not-component'
      && value.reason !== 'invalid-component-state'
    ) {
      throw new Error('Invalid EasyEDA PCB component inspect result: reason is invalid');
    }
    reason = value.reason;
  }

  const component = value.component === null ? null : parseEasyEdaPcbComponentState(value.component);
  if (value.ok && (component === null || reason !== undefined)) {
    throw new Error('Invalid EasyEDA PCB component inspect result: successful result is inconsistent');
  }
  if (!value.ok && (component !== null || reason === undefined)) {
    throw new Error('Invalid EasyEDA PCB component inspect result: failed result is inconsistent');
  }

  return { version: 1, ok: value.ok, component, reason };
}

export function buildEasyEdaInspectSelectedPcbComponentCode(
  expectedDocument: EasyEdaPcbComponentDocumentIdentity,
  expectedPrimitiveId: string,
): string {
  const document = normalizeEasyEdaPcbComponentDocumentIdentity(expectedDocument);
  const primitiveId = normalizeEasyEdaPrimitiveId(expectedPrimitiveId);
  const serializedDocument = JSON.stringify(document);
  const serializedPrimitiveId = JSON.stringify(primitiveId);

  return `
const expectedDocument = ${serializedDocument};
const expectedPrimitiveId = ${serializedPrimitiveId};
const currentDocument = await eda.dmt_SelectControl.getCurrentDocumentInfo();
if (!currentDocument || (currentDocument.documentType !== 3 && currentDocument.documentType !== 4)) {
  return { version: 1, ok: false, component: null, reason: 'unsupported-document' };
}
if (
  currentDocument.documentType !== expectedDocument.documentType
  || currentDocument.uuid !== expectedDocument.uuid
  || currentDocument.tabId !== expectedDocument.tabId
) {
  return { version: 1, ok: false, component: null, reason: 'document-changed' };
}
const selectedIds = await eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId();
if (!Array.isArray(selectedIds) || selectedIds.length !== 1 || selectedIds[0] !== expectedPrimitiveId) {
  return { version: 1, ok: false, component: null, reason: 'selection-mismatch' };
}
const component = await eda.pcb_PrimitiveComponent.get(expectedPrimitiveId);
if (!component) {
  return { version: 1, ok: false, component: null, reason: 'not-component' };
}
const actualPrimitiveId = component.getState_PrimitiveId();
const x = component.getState_X();
const y = component.getState_Y();
const rotation = component.getState_Rotation();
const primitiveLock = component.getState_PrimitiveLock();
const layerId = component.getState_Layer();
const designator = component.getState_Designator();
const name = component.getState_Name();
if (
  typeof actualPrimitiveId !== 'string'
  || actualPrimitiveId !== expectedPrimitiveId
  || actualPrimitiveId.length === 0
  || actualPrimitiveId.length > ${MAX_PRIMITIVE_ID_LENGTH}
  || typeof x !== 'number'
  || !Number.isFinite(x)
  || typeof y !== 'number'
  || !Number.isFinite(y)
  || typeof rotation !== 'number'
  || !Number.isFinite(rotation)
  || typeof primitiveLock !== 'boolean'
  || (layerId !== 1 && layerId !== 2)
  || (designator !== undefined && (typeof designator !== 'string' || designator.length > ${MAX_COMPONENT_TEXT_LENGTH}))
  || (name !== undefined && (typeof name !== 'string' || name.length > ${MAX_COMPONENT_TEXT_LENGTH}))
) {
  return { version: 1, ok: false, component: null, reason: 'invalid-component-state' };
}
return {
  version: 1,
  ok: true,
  component: {
    version: 1,
    capturedAt: Date.now(),
    primitiveId: actualPrimitiveId,
    ...(designator === undefined ? {} : { designator }),
    ...(name === undefined ? {} : { name }),
    x,
    y,
    rotation,
    primitiveLock,
    layer: layerId === 1 ? 'top' : 'bottom',
  },
};
`.trim();
}

function inspectFailureMessage(result: EasyEdaPcbComponentInspectResult): string {
  if (result.reason === 'unsupported-document') return 'PCB component inspection is available only for PCB or footprint documents';
  if (result.reason === 'document-changed') return 'The active EasyEDA document changed; refresh before inspecting the component';
  if (result.reason === 'selection-mismatch') return 'The EasyEDA selection changed; refresh before inspecting the component';
  if (result.reason === 'not-component') return 'The selected PCB primitive is not a component/device';
  return 'EasyEDA returned invalid PCB component state';
}

export class EasyEdaPcbComponentApi {
  constructor(private readonly executor: EasyEdaExecutor) {}

  async inspectSelectedComponent(
    expectedDocument: EasyEdaPcbComponentDocumentIdentity,
    expectedPrimitiveId: string,
  ): Promise<EasyEdaPcbComponentState> {
    const value = await this.executor.execute<unknown>(
      buildEasyEdaInspectSelectedPcbComponentCode(expectedDocument, expectedPrimitiveId),
    );
    const result = parseEasyEdaPcbComponentInspectResult(value);
    if (!result.ok || result.component === null) throw new Error(inspectFailureMessage(result));
    return result.component;
  }
}
