import type { EasyEdaExecutor } from './easyeda-api';

const MAX_PROJECT_DOCUMENTS = 128;
const MAX_DOCUMENT_UUID_LENGTH = 256;
const MAX_DOCUMENT_NAME_LENGTH = 128;
const MAX_PROJECT_NAME_LENGTH = 128;

export type EasyEdaProjectDocumentKind = 'schematic-page' | 'pcb';

export type EasyEdaProjectDocument = {
  uuid: string;
  name: string;
  kind: EasyEdaProjectDocumentKind;
  parentBoardName?: string;
  parentSchematicUuid?: string;
};

export type EasyEdaCurrentProjectDocuments = {
  version: 1;
  capturedAt: number;
  project: {
    uuid: string;
    friendlyName: string;
  } | null;
  documents: EasyEdaProjectDocument[];
};

export type EasyEdaOpenProjectDocumentFailure = 'no-project' | 'document-not-in-current-project' | 'open-failed';

export type EasyEdaOpenProjectDocumentResult = {
  version: 1;
  ok: boolean;
  documentUuid: string;
  tabId: string | null;
  reason?: EasyEdaOpenProjectDocumentFailure;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredBoundedString(record: Record<string, unknown>, key: string, maxLength: number): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid EasyEDA project documents: ${key} is invalid`);
  }
  return value;
}

function optionalBoundedString(record: Record<string, unknown>, key: string, maxLength: number): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid EasyEDA project documents: ${key} is invalid`);
  }
  return value;
}

export function normalizeEasyEdaDocumentUuid(documentUuid: string): string {
  if (typeof documentUuid !== 'string') throw new Error('EasyEDA document UUID must be a string');
  const trimmed = documentUuid.trim();
  if (!trimmed) throw new Error('EasyEDA document UUID cannot be empty');
  if (trimmed.length > MAX_DOCUMENT_UUID_LENGTH) {
    throw new Error(`EasyEDA document UUID is limited to ${MAX_DOCUMENT_UUID_LENGTH} characters`);
  }
  return trimmed;
}

function parseProjectDocument(value: unknown): EasyEdaProjectDocument {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA project documents: document must be an object');
  if (value.kind !== 'schematic-page' && value.kind !== 'pcb') {
    throw new Error('Invalid EasyEDA project documents: document kind is invalid');
  }

  return {
    uuid: requiredBoundedString(value, 'uuid', MAX_DOCUMENT_UUID_LENGTH),
    name: requiredBoundedString(value, 'name', MAX_DOCUMENT_NAME_LENGTH),
    kind: value.kind,
    parentBoardName: optionalBoundedString(value, 'parentBoardName', MAX_DOCUMENT_NAME_LENGTH),
    parentSchematicUuid: optionalBoundedString(value, 'parentSchematicUuid', MAX_DOCUMENT_UUID_LENGTH),
  };
}

export function parseEasyEdaCurrentProjectDocuments(value: unknown): EasyEdaCurrentProjectDocuments {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA project documents: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA project documents: unsupported version');
  if (typeof value.capturedAt !== 'number' || !Number.isFinite(value.capturedAt)) {
    throw new Error('Invalid EasyEDA project documents: capturedAt must be a number');
  }
  if (!Array.isArray(value.documents) || value.documents.length > MAX_PROJECT_DOCUMENTS) {
    throw new Error('Invalid EasyEDA project documents: documents are invalid');
  }

  let project: EasyEdaCurrentProjectDocuments['project'] = null;
  if (value.project !== null) {
    if (!isRecord(value.project)) throw new Error('Invalid EasyEDA project documents: project must be an object or null');
    project = {
      uuid: requiredBoundedString(value.project, 'uuid', MAX_DOCUMENT_UUID_LENGTH),
      friendlyName: requiredBoundedString(value.project, 'friendlyName', MAX_PROJECT_NAME_LENGTH),
    };
  }

  const documents = value.documents.map(parseProjectDocument);
  const seen = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.uuid)) throw new Error('Invalid EasyEDA project documents: duplicate document UUID');
    seen.add(document.uuid);
  }

  if (project === null && documents.length > 0) {
    throw new Error('Invalid EasyEDA project documents: documents require a current project');
  }

  return { version: 1, capturedAt: value.capturedAt, project, documents };
}

function projectDocumentCollectorCode(): string {
  return `
const MAX_DOCUMENTS = ${MAX_PROJECT_DOCUMENTS};
const MAX_UUID = ${MAX_DOCUMENT_UUID_LENGTH};
const MAX_NAME = ${MAX_DOCUMENT_NAME_LENGTH};
const documents = [];
const addPcb = (pcb, inheritedBoardName) => {
  if (documents.length >= MAX_DOCUMENTS || !pcb || typeof pcb !== 'object') return;
  if (typeof pcb.uuid !== 'string' || !pcb.uuid || pcb.uuid.length > MAX_UUID) return;
  if (typeof pcb.name !== 'string' || !pcb.name) return;
  const parentBoardName = typeof pcb.parentBoardName === 'string' && pcb.parentBoardName
    ? pcb.parentBoardName.slice(0, MAX_NAME)
    : (typeof inheritedBoardName === 'string' && inheritedBoardName ? inheritedBoardName.slice(0, MAX_NAME) : undefined);
  documents.push({
    uuid: pcb.uuid,
    name: pcb.name.slice(0, MAX_NAME),
    kind: 'pcb',
    ...(parentBoardName ? { parentBoardName } : {}),
  });
};
const addSchematic = (schematic, inheritedBoardName) => {
  if (!schematic || typeof schematic !== 'object' || !Array.isArray(schematic.page)) return;
  const parentBoardName = typeof schematic.parentBoardName === 'string' && schematic.parentBoardName
    ? schematic.parentBoardName.slice(0, MAX_NAME)
    : (typeof inheritedBoardName === 'string' && inheritedBoardName ? inheritedBoardName.slice(0, MAX_NAME) : undefined);
  for (const page of schematic.page) {
    if (documents.length >= MAX_DOCUMENTS) break;
    if (!page || typeof page !== 'object') continue;
    if (typeof page.uuid !== 'string' || !page.uuid || page.uuid.length > MAX_UUID) continue;
    if (typeof page.name !== 'string' || !page.name) continue;
    if (typeof page.parentSchematicUuid !== 'string' || !page.parentSchematicUuid || page.parentSchematicUuid.length > MAX_UUID) continue;
    documents.push({
      uuid: page.uuid,
      name: page.name.slice(0, MAX_NAME),
      kind: 'schematic-page',
      parentSchematicUuid: page.parentSchematicUuid,
      ...(parentBoardName ? { parentBoardName } : {}),
    });
  }
};
const collect = (project) => {
  if (!project || !Array.isArray(project.data)) return;
  for (const item of project.data) {
    if (documents.length >= MAX_DOCUMENTS) break;
    if (!item || typeof item !== 'object') continue;
    if (item.itemType === 'PCB' || item.itemType === 'CBB PCB') {
      addPcb(item);
    } else if (item.itemType === 'Schematic' || item.itemType === 'CBB Schematic') {
      addSchematic(item);
    } else if (item.itemType === 'Board') {
      const boardName = typeof item.name === 'string' ? item.name : undefined;
      addSchematic(item.schematic, boardName);
      addPcb(item.pcb, boardName);
    }
  }
};`;
}

export function buildEasyEdaCurrentProjectDocumentsCode(): string {
  return `
${projectDocumentCollectorCode()}
const project = await eda.dmt_Project.getCurrentProjectInfo();
collect(project);
return {
  version: 1,
  capturedAt: Date.now(),
  project: project && typeof project.uuid === 'string' && project.uuid && project.uuid.length <= MAX_UUID
    && typeof project.friendlyName === 'string' && project.friendlyName
    ? { uuid: project.uuid, friendlyName: project.friendlyName.slice(0, ${MAX_PROJECT_NAME_LENGTH}) }
    : null,
  documents,
};
`.trim();
}

export function buildEasyEdaOpenCurrentProjectDocumentCode(documentUuid: string): string {
  const normalizedUuid = normalizeEasyEdaDocumentUuid(documentUuid);
  const serializedUuid = JSON.stringify(normalizedUuid);
  return `
${projectDocumentCollectorCode()}
const documentUuid = ${serializedUuid};
const project = await eda.dmt_Project.getCurrentProjectInfo();
if (!project) {
  return { version: 1, ok: false, documentUuid, tabId: null, reason: 'no-project' };
}
collect(project);
if (!documents.some((document) => document.uuid === documentUuid)) {
  return { version: 1, ok: false, documentUuid, tabId: null, reason: 'document-not-in-current-project' };
}
const tabId = await eda.dmt_EditorControl.openDocument(documentUuid);
if (typeof tabId !== 'string' || !tabId) {
  return { version: 1, ok: false, documentUuid, tabId: null, reason: 'open-failed' };
}
return { version: 1, ok: true, documentUuid, tabId };
`.trim();
}

export function parseEasyEdaOpenProjectDocumentResult(value: unknown): EasyEdaOpenProjectDocumentResult {
  if (!isRecord(value)) throw new Error('Invalid EasyEDA open-document result: root must be an object');
  if (value.version !== 1) throw new Error('Invalid EasyEDA open-document result: unsupported version');
  if (typeof value.ok !== 'boolean') throw new Error('Invalid EasyEDA open-document result: ok must be boolean');
  const documentUuid = normalizeEasyEdaDocumentUuid(String(value.documentUuid ?? ''));
  const tabId = value.tabId === null ? null : normalizeEasyEdaDocumentUuid(String(value.tabId ?? ''));

  let reason: EasyEdaOpenProjectDocumentFailure | undefined;
  if (value.reason !== undefined) {
    if (value.reason !== 'no-project' && value.reason !== 'document-not-in-current-project' && value.reason !== 'open-failed') {
      throw new Error('Invalid EasyEDA open-document result: reason is invalid');
    }
    reason = value.reason;
  }
  if (value.ok && (tabId === null || reason !== undefined)) {
    throw new Error('Invalid EasyEDA open-document result: successful result is inconsistent');
  }
  if (!value.ok && (tabId !== null || reason === undefined)) {
    throw new Error('Invalid EasyEDA open-document result: failed result is inconsistent');
  }

  return { version: 1, ok: value.ok, documentUuid, tabId, reason };
}

function openFailureMessage(result: EasyEdaOpenProjectDocumentResult): string {
  if (result.reason === 'no-project') return 'No current EasyEDA project is available';
  if (result.reason === 'document-not-in-current-project') return 'That document is no longer in the current EasyEDA project';
  return 'EasyEDA could not open that project document';
}

export class EasyEdaProjectDocumentsApi {
  constructor(private readonly executor: EasyEdaExecutor) {}

  async getCurrentProjectDocuments(): Promise<EasyEdaCurrentProjectDocuments> {
    const value = await this.executor.execute<unknown>(buildEasyEdaCurrentProjectDocumentsCode());
    return parseEasyEdaCurrentProjectDocuments(value);
  }

  async openCurrentProjectDocument(documentUuid: string): Promise<EasyEdaOpenProjectDocumentResult> {
    const value = await this.executor.execute<unknown>(buildEasyEdaOpenCurrentProjectDocumentCode(documentUuid));
    const result = parseEasyEdaOpenProjectDocumentResult(value);
    if (!result.ok) throw new Error(openFailureMessage(result));
    return result;
  }
}
