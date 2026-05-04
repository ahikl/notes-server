import { Note } from '../../index';
import { ClientState, DeleteMeta, ServerNoteStatus, SyncAnalysisResult, SyncProcessResult } from './types';

export function buildClientState(localNoteIds: string[], localDeletedNoteIds?: string[]): ClientState {
	return {
		clientDeletedIdSet: new Set(localDeletedNoteIds || []),
		clientNoteIdSet: new Set(localNoteIds),
	};
}

export function analyzeIncrementalUpdates(incrementalUpdates: Note[], clientState: ClientState): SyncAnalysisResult {
	const toUpdateNoteIds: string[] = [];
	const toDeleteMeta: DeleteMeta[] = [];
	const toRestoreNoteIds: string[] = [];

	for (const note of incrementalUpdates) {
		if (!clientState.clientNoteIdSet.has(note.id)) continue;

		if (note.is_deleted === 1) {
			if (!clientState.clientDeletedIdSet.has(note.id)) {
				toDeleteMeta.push({
					id: note.id,
					is_deleted: 1,
					updated_at: note.updated_at,
				});
			}
		} else {
			if (clientState.clientDeletedIdSet.has(note.id)) {
				toRestoreNoteIds.push(note.id);
			} else {
				toUpdateNoteIds.push(note.id);
			}
		}
	}

	return { toUpdateNoteIds, toDeleteMeta, toRestoreNoteIds };
}

export function identifyNewNotes(
	serverNotesStatus: ServerNoteStatus[],
	clientState: ClientState,
	existingUpdateIds: string[],
	existingRestoreIds: string[],
): string[] {
	const newNoteIds: string[] = [];

	for (const serverNote of serverNotesStatus) {
		if (serverNote.is_deleted === 0 && !clientState.clientNoteIdSet.has(serverNote.id)) {
			if (!existingUpdateIds.includes(serverNote.id) && !existingRestoreIds.includes(serverNote.id)) {
				newNoteIds.push(serverNote.id);
			}
		}
	}

	return newNoteIds;
}

export function checkDeleteStatusMismatch(
	serverNotesStatus: ServerNoteStatus[],
	clientState: ClientState,
	incrementalUpdates: Note[],
	currentDeleteMeta: DeleteMeta[],
	currentRestoreIds: string[],
): { additionalDeletes: DeleteMeta[]; additionalRestores: string[] } {
	const additionalDeletes: DeleteMeta[] = [];
	const additionalRestores: string[] = [];

	const serverNoteMap = new Map(serverNotesStatus.map((n) => [n.id, n]));
	const incrementalUpdateIds = new Set(incrementalUpdates.map((n) => n.id));

	for (const noteId of clientState.clientNoteIdSet) {
		const serverNote = serverNoteMap.get(noteId);
		if (!serverNote) continue;

		const isClientDeleted = clientState.clientDeletedIdSet.has(noteId);
		const isServerDeleted = serverNote.is_deleted === 1;

		if (isClientDeleted && !isServerDeleted) {
			if (!currentRestoreIds.includes(noteId) && !incrementalUpdateIds.has(noteId)) {
				additionalRestores.push(noteId);
			}
		} else if (!isClientDeleted && isServerDeleted) {
			if (!currentDeleteMeta.some((m) => m.id === noteId)) {
				additionalDeletes.push({
					id: noteId,
					is_deleted: 1,
					updated_at: serverNote.updated_at,
				});
			}
		}
	}

	return { additionalDeletes, additionalRestores };
}

export function mergeSyncResults(
	baseResult: SyncAnalysisResult,
	newNoteIds: string[],
	additionalDeletes: DeleteMeta[],
	additionalRestores: string[],
): SyncAnalysisResult {
	return {
		toUpdateNoteIds: [...baseResult.toUpdateNoteIds, ...newNoteIds],
		toDeleteMeta: [...baseResult.toDeleteMeta, ...additionalDeletes],
		toRestoreNoteIds: [...baseResult.toRestoreNoteIds, ...additionalRestores],
	};
}

export function processSyncResult(
	fullNotes: Note[],
	toUpdateNoteIds: string[],
	toRestoreNoteIds: string[],
	toDeleteMeta: DeleteMeta[],
): SyncProcessResult {
	const toUpdateNotes: Note[] = [];
	const toRestoreNotes: Note[] = [];

	for (const note of fullNotes) {
		if (toRestoreNoteIds.includes(note.id)) {
			toRestoreNotes.push(note);
		} else {
			toUpdateNotes.push(note);
		}
	}

	return {
		toUpdateNotes,
		toDeleteMeta,
		toRestoreNotes,
	};
}
