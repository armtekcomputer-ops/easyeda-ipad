import {
  EASYEDA_DOCUMENT_TYPE,
  buildEasyEdaSnapshotCode,
  normalizeEasyEdaPrimitiveIds,
  parseEasyEdaSnapshot,
  type EasyEdaDocumentSummary,
  type EasyEdaExecutor,
  type EasyEdaSnapshot,
} from './easyeda-api';
import { normalizeDocumentIdentity, type EasyEdaDocumentIdentity } from './easyeda-safe-selection';

export const EASYEDA_COMPONENT_NUDGE_MM = 0.254;
export const EASYEDA_PCB_NUDGE_UNITS = 10;
export const EASYEDA_SCHEMATIC_NUDGE_UNITS = 1;
export const EASYEDA_COMPONENT_ROTATION_STEP_DEGREES = 90;

export type EasyEdaComponentTransformOperation =
  | 'x-negative'
  | 'x-positive'
  | 'y-negative'
  | 'y-positive'
  | 'rotate-negative'
  | 'rotate-positive';

export type EasyEdaComponentTransformFailure =
  | 'no-document'
  | 'document-changed'
  | 'unsupported-document'
  | 'non-component-selection'
  | 'locked-component'
  | 'invalid-component-state'
  | 'mutation-failed';

export type EasyEdaComponentTransformResult = {
  version: 1;
  operation: EasyEdaComponentTransformOperation;
  ok: boolean;
  documentType: number | null;
  primitiveId: string;
  reason?: EasyEdaComponentTransformFailure;
};

const TRANSFORM_OPERATIONS = new Set<EasyEdaComponentTransformOperation>([
  'x-negative', 'x-positive', 'y-negative', 'y-positive', 'rotate-negative', 'rotate-positive',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSinglePrimitiveId(ids: readonly string[]): string {
  const normalized = normalizeEasyEdaPrimitiveIds(ids);
  if (normalized.length !== 1) throw new Error('Component transform requires exactly one selected primitive ID');
  return normalized[0];
}

function validateOperation(operation: EasyEdaComponentTransformOperation) {
  if (!TRANSFORM_OPERATIONS.has(operation)) throw new Error('Unsupported EasyEDA component transform operation');
  return operation;
}

export function buildEasyEdaComponentTransformCode(
  expectedDocument: EasyEdaDocumentIdentity,
  ids: readonly string[],
  operation: EasyEdaComponentTransformOperation,
): string {
  const expected = normalizeDocumentIdentity(expectedDocument);
  const primitiveId = normalizeSinglePrimitiveId(ids);
  const safeOperation = validateOperation(operation);
  return `
const expectedDocument = ${JSON.stringify(expected)};
const primitiveId = ${JSON.stringify(primitiveId)};
const operation = ${JSON.stringify(safeOperation)};
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
const documentType = doc?.documentType ?? null;
const fail = (reason) => ({ version: 1, operation, ok: false, documentType, primitiveId, reason });
const success = () => ({ version: 1, operation, ok: true, documentType, primitiveId });
if (!doc) return fail('no-document');
if (doc.documentType !== expectedDocument.documentType || doc.uuid !== expectedDocument.uuid || doc.tabId !== expectedDocument.tabId) {
  return fail('document-changed');
}
const propertyFor = (component, nudgeUnits) => {
  if (operation === 'x-negative' || operation === 'x-positive') {
    const current = component.getState_X();
    if (!Number.isFinite(current)) return null;
    const next = current + (operation === 'x-positive' ? nudgeUnits : -nudgeUnits);
    return Number.isFinite(next) ? { x: next } : null;
  }
  if (operation === 'y-negative' || operation === 'y-positive') {
    const current = component.getState_Y();
    if (!Number.isFinite(current)) return null;
    const next = current + (operation === 'y-positive' ? nudgeUnits : -nudgeUnits);
    return Number.isFinite(next) ? { y: next } : null;
  }
  const current = component.getState_Rotation();
  if (!Number.isFinite(current)) return null;
  const next = current + (operation === 'rotate-positive' ? ${EASYEDA_COMPONENT_ROTATION_STEP_DEGREES} : -${EASYEDA_COMPONENT_ROTATION_STEP_DEGREES});
  return Number.isFinite(next) ? { rotation: next } : null;
};
if (documentType === ${EASYEDA_DOCUMENT_TYPE.PCB}) {
  const component = await eda.pcb_PrimitiveComponent.get(primitiveId);
  if (!component) return fail('non-component-selection');
  if (component.getState_PrimitiveLock() === true) return fail('locked-component');
  const property = propertyFor(component, ${EASYEDA_PCB_NUDGE_UNITS});
  if (!property) return fail('invalid-component-state');
  const modified = await eda.pcb_PrimitiveComponent.modify(primitiveId, property);
  return modified ? success() : fail('mutation-failed');
}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE}) {
  const component = await eda.sch_PrimitiveComponent.get(primitiveId);
  if (!component) return fail('non-component-selection');
  const property = propertyFor(component, ${EASYEDA_SCHEMATIC_NUDGE_UNITS});
  if (!property) return fail('invalid-component-state');
  const modified = await eda.sch_PrimitiveComponent.modify(primitiveId, property);
  return modified ? success() : fail('mutation-failed');
}
return fail('unsupported-document');
`.trim();
}

export function parseEasyEdaComponentTransformResult(value: unknown): EasyEdaComponentTransformResult {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA transform result: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA transform result: unsupported version');
  if (typeof value.operation !== 'string' || !TRANSFORM_OPERATIONS.has(value.operation as EasyEdaComponentTransformOperation)) throw new Error('Invalid EasyEDA transform result: operation is invalid');
  if (typeof value.ok !== 'boolean') throw new Error('Invalid EasyEDA transform result: ok must be boolean');
  if (value.documentType !== null && (typeof value.documentType !== 'number' || !Number.isInteger(value.documentType))) throw new Error('Invalid EasyEDA transform result: documentType is invalid');
  if (typeof value.primitiveId !== 'string' || !value.primitiveId || value.primitiveId.length > 256) throw new Error('Invalid EasyEDA transform result: primitiveId is invalid');
  const allowedReasons = new Set<EasyEdaComponentTransformFailure>(['no-document','document-changed','unsupported-document','non-component-selection','locked-component','invalid-component-state','mutation-failed']);
  let reason: EasyEdaComponentTransformFailure | undefined;
  if (value.reason !== undefined) {
    if (typeof value.reason !== 'string' || !allowedReasons.has(value.reason as EasyEdaComponentTransformFailure)) throw new Error('Invalid EasyEDA transform result: reason is invalid');
    reason = value.reason as EasyEdaComponentTransformFailure;
  }
  if (value.ok && reason !== undefined) throw new Error('Invalid EasyEDA transform result: successful result cannot include a failure reason');
  if (!value.ok && reason === undefined) throw new Error('Invalid EasyEDA transform result: failed result requires a reason');
  return { version: 1, operation: value.operation as EasyEdaComponentTransformOperation, ok: value.ok, documentType: value.documentType as number | null, primitiveId: value.primitiveId, reason };
}

function failureMessage(result: EasyEdaComponentTransformResult) {
  if (result.reason === 'no-document') return 'No active EasyEDA document is available for component transform';
  if (result.reason === 'document-changed') return 'The active EasyEDA document changed; refresh before transforming a component';
  if (result.reason === 'unsupported-document') return `Component transform is not supported for EasyEDA document type ${result.documentType ?? 'unknown'}`;
  if (result.reason === 'non-component-selection') return 'The selected EasyEDA primitive is not a device component';
  if (result.reason === 'locked-component') return 'The selected PCB component is locked';
  if (result.reason === 'invalid-component-state') return 'EasyEDA returned an invalid component position or rotation state';
  return 'EasyEDA component transform operation failed';
}

export class EasyEdaComponentTransformApi {
  constructor(private readonly executor: EasyEdaExecutor) {}

  private async refreshSnapshot(): Promise<EasyEdaSnapshot> {
    return parseEasyEdaSnapshot(await this.executor.execute<unknown>(buildEasyEdaSnapshotCode()));
  }

  async transform(expectedDocument: Pick<EasyEdaDocumentSummary, 'documentType' | 'uuid' | 'tabId'>, ids: readonly string[], operation: EasyEdaComponentTransformOperation): Promise<EasyEdaSnapshot> {
    const value = await this.executor.execute<unknown>(buildEasyEdaComponentTransformCode(expectedDocument, ids, operation));
    const result = parseEasyEdaComponentTransformResult(value);
    if (!result.ok) throw new Error(failureMessage(result));
    return this.refreshSnapshot();
  }
}
