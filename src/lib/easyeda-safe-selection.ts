import {
  EASYEDA_DOCUMENT_TYPE,
  buildEasyEdaSnapshotCode,
  normalizeEasyEdaPrimitiveIds,
  parseEasyEdaSnapshot,
  type EasyEdaDocumentSummary,
  type EasyEdaExecutor,
  type EasyEdaSnapshot,
} from './easyeda-api';

const MAX_DOCUMENT_ID_LENGTH = 256;

export type EasyEdaDocumentIdentity = Pick<EasyEdaDocumentSummary, 'documentType' | 'uuid' | 'tabId'>;
export type SafeSelectionOperation = 'clear' | 'select';
export type SafeSelectionFailure = 'no-document' | 'document-changed' | 'unsupported-document' | 'mutation-failed';

export type SafeSelectionResult = {
  version: 1;
  operation: SafeSelectionOperation;
  ok: boolean;
  documentType: number | null;
  requested: number;
  reason?: SafeSelectionFailure;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeDocumentIdentity(document: EasyEdaDocumentIdentity): EasyEdaDocumentIdentity {
  if (!document || typeof document !== 'object') throw new Error('Trusted EasyEDA document identity is required');
  if (!Number.isInteger(document.documentType)) throw new Error('Trusted EasyEDA document type is invalid');
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

function mutationResultCode(
  operation: SafeSelectionOperation,
  requested: number,
  successExpression: string,
): string {
  return `({ version: 1, operation: '${operation}', ok: ${successExpression} === true, documentType, requested: ${requested}, ...(${successExpression} === true ? {} : { reason: 'mutation-failed' }) })`;
}

function guardPrefix(
  expectedDocument: EasyEdaDocumentIdentity,
  operation: SafeSelectionOperation,
  requested: number,
): string {
  const expected = normalizeDocumentIdentity(expectedDocument);
  return `
const expectedDocument = ${JSON.stringify(expected)};
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
const documentType = doc?.documentType ?? null;
if (!doc) {
  return { version: 1, operation: '${operation}', ok: false, documentType, requested: ${requested}, reason: 'no-document' };
}
if (
  doc.documentType !== expectedDocument.documentType
  || doc.uuid !== expectedDocument.uuid
  || doc.tabId !== expectedDocument.tabId
) {
  return { version: 1, operation: '${operation}', ok: false, documentType, requested: ${requested}, reason: 'document-changed' };
}
`.trim();
}

export function buildSafeClearSelectionCode(expectedDocument: EasyEdaDocumentIdentity): string {
  const prefix = guardPrefix(expectedDocument, 'clear', 0);

  return `
${prefix}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.PCB} || documentType === ${EASYEDA_DOCUMENT_TYPE.FOOTPRINT}) {
  const ok = await eda.pcb_SelectControl.clearSelected();
  return ${mutationResultCode('clear', 0, 'ok')};
}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE}) {
  const ok = eda.sch_SelectControl.clearSelected();
  return ${mutationResultCode('clear', 0, 'ok')};
}
return { version: 1, operation: 'clear', ok: false, documentType, requested: 0, reason: 'unsupported-document' };
`.trim();
}

export function buildSafeSelectPrimitiveIdsCode(
  expectedDocument: EasyEdaDocumentIdentity,
  ids: readonly string[],
): string {
  const primitiveIds = normalizeEasyEdaPrimitiveIds(ids);
  const prefix = guardPrefix(expectedDocument, 'select', primitiveIds.length);

  return `
const primitiveIds = ${JSON.stringify(primitiveIds)};
${prefix}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.PCB} || documentType === ${EASYEDA_DOCUMENT_TYPE.FOOTPRINT}) {
  const ok = await eda.pcb_SelectControl.doSelectPrimitives(primitiveIds);
  return ${mutationResultCode('select', primitiveIds.length, 'ok')};
}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE}) {
  const ok = await eda.sch_SelectControl.doSelectPrimitives(primitiveIds);
  return ${mutationResultCode('select', primitiveIds.length, 'ok')};
}
return { version: 1, operation: 'select', ok: false, documentType, requested: primitiveIds.length, reason: 'unsupported-document' };
`.trim();
}

export function parseSafeSelectionResult(value: unknown): SafeSelectionResult {
  if (!isRecord(value)) throw new Error('Invalid safe selection result: root must be an object');
  if (value.version !== 1) throw new Error('Invalid safe selection result: unsupported version');
  if (value.operation !== 'clear' && value.operation !== 'select') throw new Error('Invalid safe selection result: operation is invalid');
  if (typeof value.ok !== 'boolean') throw new Error('Invalid safe selection result: ok must be boolean');
  if (
    value.documentType !== null
    && (typeof value.documentType !== 'number' || !Number.isInteger(value.documentType))
  ) {
    throw new Error('Invalid safe selection result: documentType is invalid');
  }
  if (
    typeof value.requested !== 'number'
    || !Number.isInteger(value.requested)
    || value.requested < 0
    || value.requested > 100
  ) {
    throw new Error('Invalid safe selection result: requested is invalid');
  }

  let reason: SafeSelectionFailure | undefined;
  if (value.reason !== undefined) {
    if (
      value.reason !== 'no-document'
      && value.reason !== 'document-changed'
      && value.reason !== 'unsupported-document'
      && value.reason !== 'mutation-failed'
    ) throw new Error('Invalid safe selection result: reason is invalid');
    reason = value.reason;
  }

  if (value.ok && reason !== undefined) throw new Error('Invalid safe selection result: successful result cannot include a reason');
  if (!value.ok && reason === undefined) throw new Error('Invalid safe selection result: failed result requires a reason');

  return {
    version: 1,
    operation: value.operation,
    ok: value.ok,
    documentType: value.documentType,
    requested: value.requested,
    reason,
  };
}

function failureMessage(result: SafeSelectionResult): string {
  if (result.reason === 'no-document') return 'No active EasyEDA document is available for selection';
  if (result.reason === 'document-changed') return 'The active EasyEDA document changed; refresh before changing selection';
  if (result.reason === 'unsupported-document') return `Selection is not supported for EasyEDA document type ${result.documentType ?? 'unknown'}`;
  return `EasyEDA ${result.operation} selection operation failed`;
}

export class EasyEdaSafeSelectionApi {
  constructor(private readonly executor: EasyEdaExecutor) {}

  private async refreshSnapshot(): Promise<EasyEdaSnapshot> {
    const value = await this.executor.execute<unknown>(buildEasyEdaSnapshotCode());
    return parseEasyEdaSnapshot(value);
  }

  async clearSelection(expectedDocument: EasyEdaDocumentIdentity): Promise<EasyEdaSnapshot> {
    const value = await this.executor.execute<unknown>(buildSafeClearSelectionCode(expectedDocument));
    const result = parseSafeSelectionResult(value);
    if (!result.ok) throw new Error(failureMessage(result));
    return this.refreshSnapshot();
  }

  async selectPrimitiveIds(
    expectedDocument: EasyEdaDocumentIdentity,
    ids: readonly string[],
  ): Promise<EasyEdaSnapshot> {
    const value = await this.executor.execute<unknown>(buildSafeSelectPrimitiveIdsCode(expectedDocument, ids));
    const result = parseSafeSelectionResult(value);
    if (!result.ok) throw new Error(failureMessage(result));
    return this.refreshSnapshot();
  }
}
