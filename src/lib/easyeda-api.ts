export const EASYEDA_DOCUMENT_TYPE = {
  SCHEMATIC_PAGE: 1,
  PCB: 3,
  FOOTPRINT: 4,
} as const;

const MAX_SELECTED_IDS = 100;
const MAX_SELECTED_SUMMARIES = 20;
const MAX_SUMMARY_FIELDS = 16;
const MAX_SUMMARY_STRING = 256;
const MAX_SELECTION_ID_LENGTH = 256;

export type EasyEdaDocumentSummary = {
  documentType: number;
  uuid: string;
  tabId: string;
  parentProjectUuid?: string;
  parentLibraryUuid?: string;
};

export type EasyEdaProjectSummary = {
  uuid: string;
  name: string;
  friendlyName: string;
  teamUuid: string;
  folderUuid?: string;
};

export type EasyEdaPcbContext = {
  kind: 'pcb';
  uuid?: string;
  name?: string;
  parentProjectUuid?: string;
  parentBoardName?: string;
};

export type EasyEdaFootprintContext = {
  kind: 'footprint';
};

export type EasyEdaSchematicContext = {
  kind: 'schematic';
  schematic?: {
    uuid: string;
    name: string;
    parentProjectUuid: string;
    parentBoardName?: string;
  };
  page?: {
    uuid: string;
    name: string;
    parentSchematicUuid: string;
  };
};

export type EasyEdaOtherContext = {
  kind: 'other';
};

export type EasyEdaContext =
  | EasyEdaPcbContext
  | EasyEdaFootprintContext
  | EasyEdaSchematicContext
  | EasyEdaOtherContext;

export type EasyEdaPrimitiveSummary = Record<string, string | number | boolean | null>;

export type EasyEdaSelectionSummary = {
  total: number;
  ids: string[];
  summaries: EasyEdaPrimitiveSummary[];
};

export type EasyEdaSnapshot = {
  version: 1;
  capturedAt: number;
  document: EasyEdaDocumentSummary | null;
  project: EasyEdaProjectSummary | null;
  context: EasyEdaContext;
  selection: EasyEdaSelectionSummary;
};

export type EasyEdaSelectionMutationOperation = 'clear' | 'select';
export type EasyEdaSelectionMutationFailure = 'no-document' | 'unsupported-document' | 'mutation-failed';

export type EasyEdaSelectionMutationResult = {
  version: 1;
  operation: EasyEdaSelectionMutationOperation;
  ok: boolean;
  documentType: number | null;
  requested: number;
  reason?: EasyEdaSelectionMutationFailure;
};

export interface EasyEdaExecutor {
  execute<T = unknown>(code: string, timeoutMs?: number): Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`Invalid EasyEDA snapshot: ${key} must be a string`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`Invalid EasyEDA snapshot: ${key} must be a string`);
  return value;
}

function parseDocument(value: unknown): EasyEdaDocumentSummary | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error('Invalid EasyEDA snapshot: document must be an object or null');
  if (typeof value.documentType !== 'number' || !Number.isInteger(value.documentType)) {
    throw new Error('Invalid EasyEDA snapshot: documentType must be an integer');
  }

  return {
    documentType: value.documentType,
    uuid: requiredString(value, 'uuid'),
    tabId: requiredString(value, 'tabId'),
    parentProjectUuid: optionalString(value, 'parentProjectUuid'),
    parentLibraryUuid: optionalString(value, 'parentLibraryUuid'),
  };
}

function parseProject(value: unknown): EasyEdaProjectSummary | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error('Invalid EasyEDA snapshot: project must be an object or null');
  return {
    uuid: requiredString(value, 'uuid'),
    name: requiredString(value, 'name'),
    friendlyName: requiredString(value, 'friendlyName'),
    teamUuid: requiredString(value, 'teamUuid'),
    folderUuid: optionalString(value, 'folderUuid'),
  };
}

function parseContext(value: unknown): EasyEdaContext {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new Error('Invalid EasyEDA snapshot: context is invalid');
  }

  if (value.kind === 'pcb') {
    return {
      kind: 'pcb',
      uuid: optionalString(value, 'uuid'),
      name: optionalString(value, 'name'),
      parentProjectUuid: optionalString(value, 'parentProjectUuid'),
      parentBoardName: optionalString(value, 'parentBoardName'),
    };
  }

  if (value.kind === 'footprint') return { kind: 'footprint' };

  if (value.kind === 'schematic') {
    let schematic: EasyEdaSchematicContext['schematic'];
    let page: EasyEdaSchematicContext['page'];

    if (value.schematic !== undefined && value.schematic !== null) {
      if (!isRecord(value.schematic)) throw new Error('Invalid EasyEDA snapshot: schematic metadata is invalid');
      schematic = {
        uuid: requiredString(value.schematic, 'uuid'),
        name: requiredString(value.schematic, 'name'),
        parentProjectUuid: requiredString(value.schematic, 'parentProjectUuid'),
        parentBoardName: optionalString(value.schematic, 'parentBoardName'),
      };
    }

    if (value.page !== undefined && value.page !== null) {
      if (!isRecord(value.page)) throw new Error('Invalid EasyEDA snapshot: schematic page metadata is invalid');
      page = {
        uuid: requiredString(value.page, 'uuid'),
        name: requiredString(value.page, 'name'),
        parentSchematicUuid: requiredString(value.page, 'parentSchematicUuid'),
      };
    }

    return { kind: 'schematic', schematic, page };
  }

  if (value.kind === 'other') return { kind: 'other' };
  throw new Error(`Invalid EasyEDA snapshot: unsupported context kind ${value.kind}`);
}

function parsePrimitiveSummary(value: unknown): EasyEdaPrimitiveSummary {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA snapshot: primitive summary must be an object');
  const entries = Object.entries(value);
  if (entries.length > MAX_SUMMARY_FIELDS) {
    throw new Error('Invalid EasyEDA snapshot: primitive summary has too many fields');
  }

  const result: EasyEdaPrimitiveSummary = {};
  for (const [key, field] of entries) {
    if (key.length > 64) throw new Error('Invalid EasyEDA snapshot: primitive summary key is too long');
    if (field === null || typeof field === 'number' || typeof field === 'boolean') {
      result[key] = field;
      continue;
    }
    if (typeof field === 'string' && field.length <= MAX_SUMMARY_STRING) {
      result[key] = field;
      continue;
    }
    throw new Error(`Invalid EasyEDA snapshot: unsupported primitive summary field ${key}`);
  }
  return result;
}

function parseSelection(value: unknown): EasyEdaSelectionSummary {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA snapshot: selection must be an object');
  if (typeof value.total !== 'number' || !Number.isInteger(value.total) || value.total < 0) {
    throw new Error('Invalid EasyEDA snapshot: selection total must be a non-negative integer');
  }
  if (!Array.isArray(value.ids) || value.ids.length > MAX_SELECTED_IDS || value.ids.some((id) => typeof id !== 'string')) {
    throw new Error('Invalid EasyEDA snapshot: selection ids are invalid');
  }
  if (!Array.isArray(value.summaries) || value.summaries.length > MAX_SELECTED_SUMMARIES) {
    throw new Error('Invalid EasyEDA snapshot: selection summaries are invalid');
  }

  return {
    total: value.total,
    ids: [...value.ids],
    summaries: value.summaries.map(parsePrimitiveSummary),
  };
}

export function parseEasyEdaSnapshot(value: unknown): EasyEdaSnapshot {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA snapshot: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA snapshot: unsupported version');
  if (typeof value.capturedAt !== 'number' || !Number.isFinite(value.capturedAt)) {
    throw new Error('Invalid EasyEDA snapshot: capturedAt must be a number');
  }

  return {
    version: 1,
    capturedAt: value.capturedAt,
    document: parseDocument(value.document),
    project: parseProject(value.project),
    context: parseContext(value.context),
    selection: parseSelection(value.selection),
  };
}

export function buildEasyEdaSnapshotCode(): string {
  return `
const MAX_IDS = ${MAX_SELECTED_IDS};
const MAX_SUMMARIES = ${MAX_SELECTED_SUMMARIES};
const MAX_FIELDS = ${MAX_SUMMARY_FIELDS};
const MAX_STRING = ${MAX_SUMMARY_STRING};
const scalarSummary = (value, primitiveId) => {
  const summary = { primitiveId };
  if (!value || typeof value !== 'object') return summary;
  let count = 1;
  for (const [key, field] of Object.entries(value)) {
    if (count >= MAX_FIELDS || key.length > 64 || key === 'primitiveId') continue;
    if (field === null || typeof field === 'number' || typeof field === 'boolean') {
      summary[key] = field;
      count += 1;
    } else if (typeof field === 'string') {
      summary[key] = field.slice(0, MAX_STRING);
      count += 1;
    }
  }
  return summary;
};
const pickDocument = (doc) => doc ? ({
  documentType: doc.documentType,
  uuid: doc.uuid,
  tabId: doc.tabId,
  ...(doc.parentProjectUuid ? { parentProjectUuid: doc.parentProjectUuid } : {}),
  ...(doc.parentLibraryUuid ? { parentLibraryUuid: doc.parentLibraryUuid } : {}),
}) : null;
const pickProject = (project) => project ? ({
  uuid: project.uuid,
  name: project.name,
  friendlyName: project.friendlyName,
  teamUuid: project.teamUuid,
  ...(project.folderUuid ? { folderUuid: project.folderUuid } : {}),
}) : null;
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
const project = await eda.dmt_Project.getCurrentProjectInfo();
const snapshot = {
  version: 1,
  capturedAt: Date.now(),
  document: pickDocument(doc),
  project: pickProject(project),
  context: { kind: 'other' },
  selection: { total: 0, ids: [], summaries: [] },
};
if (doc?.documentType === ${EASYEDA_DOCUMENT_TYPE.PCB}) {
  const pcb = await eda.dmt_Pcb.getCurrentPcbInfo();
  snapshot.context = pcb ? {
    kind: 'pcb',
    uuid: pcb.uuid,
    name: pcb.name,
    parentProjectUuid: pcb.parentProjectUuid,
    ...(pcb.parentBoardName ? { parentBoardName: pcb.parentBoardName } : {}),
  } : { kind: 'pcb' };
  const ids = await eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId();
  const primitives = await eda.pcb_SelectControl.getAllSelectedPrimitives();
  const safeIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  const safePrimitives = Array.isArray(primitives) ? primitives : [];
  snapshot.selection = {
    total: safeIds.length,
    ids: safeIds.slice(0, MAX_IDS),
    summaries: safePrimitives.slice(0, MAX_SUMMARIES).map((primitive, index) => scalarSummary(primitive, safeIds[index] || '')),
  };
} else if (doc?.documentType === ${EASYEDA_DOCUMENT_TYPE.FOOTPRINT}) {
  snapshot.context = { kind: 'footprint' };
  const ids = await eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId();
  const primitives = await eda.pcb_SelectControl.getAllSelectedPrimitives();
  const safeIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  const safePrimitives = Array.isArray(primitives) ? primitives : [];
  snapshot.selection = {
    total: safeIds.length,
    ids: safeIds.slice(0, MAX_IDS),
    summaries: safePrimitives.slice(0, MAX_SUMMARIES).map((primitive, index) => scalarSummary(primitive, safeIds[index] || '')),
  };
} else if (doc?.documentType === ${EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE}) {
  const schematic = await eda.dmt_Schematic.getCurrentSchematicInfo();
  const page = await eda.dmt_Schematic.getCurrentSchematicPageInfo();
  snapshot.context = {
    kind: 'schematic',
    ...(schematic ? { schematic: {
      uuid: schematic.uuid,
      name: schematic.name,
      parentProjectUuid: schematic.parentProjectUuid,
      ...(schematic.parentBoardName ? { parentBoardName: schematic.parentBoardName } : {}),
    } } : {}),
    ...(page ? { page: {
      uuid: page.uuid,
      name: page.name,
      parentSchematicUuid: page.parentSchematicUuid,
    } } : {}),
  };
  const ids = await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
  const primitives = await eda.sch_SelectControl.getAllSelectedPrimitives();
  const safeIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  const safePrimitives = Array.isArray(primitives) ? primitives : [];
  snapshot.selection = {
    total: safeIds.length,
    ids: safeIds.slice(0, MAX_IDS),
    summaries: safePrimitives.slice(0, MAX_SUMMARIES).map((primitive, index) => scalarSummary(primitive, safeIds[index] || '')),
  };
}
return snapshot;
`.trim();
}

export function normalizeEasyEdaPrimitiveIds(ids: readonly string[]): string[] {
  if (!Array.isArray(ids)) throw new Error('Selection IDs must be an array');
  if (ids.length === 0) throw new Error('Select at least one primitive ID');
  if (ids.length > MAX_SELECTED_IDS) throw new Error(`Selection is limited to ${MAX_SELECTED_IDS} primitive IDs`);

  const unique = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string') throw new Error('Every primitive ID must be a string');
    if (id.length > MAX_SELECTION_ID_LENGTH) {
      throw new Error(`Primitive IDs are limited to ${MAX_SELECTION_ID_LENGTH} characters`);
    }
    const trimmed = id.trim();
    if (!trimmed) throw new Error('Primitive IDs cannot be empty');
    unique.add(trimmed);
  }

  return [...unique];
}

function mutationResultCode(
  operation: EasyEdaSelectionMutationOperation,
  documentTypeExpression: string,
  requested: number,
  successExpression: string,
): string {
  return `({ version: 1, operation: '${operation}', ok: ${successExpression} === true, documentType: ${documentTypeExpression}, requested: ${requested}, ...(${successExpression} === true ? {} : { reason: 'mutation-failed' }) })`;
}

export function buildEasyEdaClearSelectionCode(): string {
  return `
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
const documentType = doc?.documentType ?? null;
if (documentType === ${EASYEDA_DOCUMENT_TYPE.PCB} || documentType === ${EASYEDA_DOCUMENT_TYPE.FOOTPRINT}) {
  const ok = await eda.pcb_SelectControl.clearSelected();
  return ${mutationResultCode('clear', 'documentType', 0, 'ok')};
}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE}) {
  const ok = eda.sch_SelectControl.clearSelected();
  return ${mutationResultCode('clear', 'documentType', 0, 'ok')};
}
return { version: 1, operation: 'clear', ok: false, documentType, requested: 0, reason: doc ? 'unsupported-document' : 'no-document' };
`.trim();
}

export function buildEasyEdaSelectPrimitiveIdsCode(ids: readonly string[]): string {
  const primitiveIds = normalizeEasyEdaPrimitiveIds(ids);
  const serializedIds = JSON.stringify(primitiveIds);
  return `
const primitiveIds = ${serializedIds};
const doc = await eda.dmt_SelectControl.getCurrentDocumentInfo();
const documentType = doc?.documentType ?? null;
if (documentType === ${EASYEDA_DOCUMENT_TYPE.PCB} || documentType === ${EASYEDA_DOCUMENT_TYPE.FOOTPRINT}) {
  const ok = await eda.pcb_SelectControl.doSelectPrimitives(primitiveIds);
  return ${mutationResultCode('select', 'documentType', primitiveIds.length, 'ok')};
}
if (documentType === ${EASYEDA_DOCUMENT_TYPE.SCHEMATIC_PAGE}) {
  const ok = await eda.sch_SelectControl.doSelectPrimitives(primitiveIds);
  return ${mutationResultCode('select', 'documentType', primitiveIds.length, 'ok')};
}
return { version: 1, operation: 'select', ok: false, documentType, requested: primitiveIds.length, reason: doc ? 'unsupported-document' : 'no-document' };
`.trim();
}

export function parseEasyEdaSelectionMutationResult(value: unknown): EasyEdaSelectionMutationResult {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA selection result: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA selection result: unsupported version');
  if (value.operation !== 'clear' && value.operation !== 'select') {
    throw new Error('Invalid EasyEDA selection result: operation is invalid');
  }
  if (typeof value.ok !== 'boolean') throw new Error('Invalid EasyEDA selection result: ok must be boolean');
  if (value.documentType !== null && (typeof value.documentType !== 'number' || !Number.isInteger(value.documentType))) {
    throw new Error('Invalid EasyEDA selection result: documentType is invalid');
  }
  if (typeof value.requested !== 'number' || !Number.isInteger(value.requested) || value.requested < 0 || value.requested > MAX_SELECTED_IDS) {
    throw new Error('Invalid EasyEDA selection result: requested is invalid');
  }

  let reason: EasyEdaSelectionMutationFailure | undefined;
  if (value.reason !== undefined) {
    if (value.reason !== 'no-document' && value.reason !== 'unsupported-document' && value.reason !== 'mutation-failed') {
      throw new Error('Invalid EasyEDA selection result: reason is invalid');
    }
    reason = value.reason;
  }

  if (value.ok && reason !== undefined) throw new Error('Invalid EasyEDA selection result: successful result cannot include a failure reason');
  if (!value.ok && reason === undefined) throw new Error('Invalid EasyEDA selection result: failed result requires a reason');

  return {
    version: 1,
    operation: value.operation,
    ok: value.ok,
    documentType: value.documentType,
    requested: value.requested,
    reason,
  };
}

function mutationFailureMessage(result: EasyEdaSelectionMutationResult): string {
  if (result.reason === 'no-document') return 'No active EasyEDA document is available for selection';
  if (result.reason === 'unsupported-document') return `Selection is not supported for EasyEDA document type ${result.documentType ?? 'unknown'}`;
  return `EasyEDA ${result.operation} selection operation failed`;
}

export class EasyEdaApi {
  constructor(private readonly executor: EasyEdaExecutor) {}

  async getSnapshot(): Promise<EasyEdaSnapshot> {
    const value = await this.executor.execute<unknown>(buildEasyEdaSnapshotCode());
    return parseEasyEdaSnapshot(value);
  }

  async clearSelection(): Promise<EasyEdaSnapshot> {
    const value = await this.executor.execute<unknown>(buildEasyEdaClearSelectionCode());
    const result = parseEasyEdaSelectionMutationResult(value);
    if (!result.ok) throw new Error(mutationFailureMessage(result));
    return this.getSnapshot();
  }

  async selectPrimitiveIds(ids: readonly string[]): Promise<EasyEdaSnapshot> {
    const code = buildEasyEdaSelectPrimitiveIdsCode(ids);
    const value = await this.executor.execute<unknown>(code);
    const result = parseEasyEdaSelectionMutationResult(value);
    if (!result.ok) throw new Error(mutationFailureMessage(result));
    return this.getSnapshot();
  }
}
