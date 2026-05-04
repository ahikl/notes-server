import { Note } from '../../index';
import { DeleteMeta, SyncResponse } from './types';

export function buildSyncResponse(
	toUpdateNotes: Note[],
	toDeleteMeta: DeleteMeta[],
	toRestoreNotes: Note[],
	serverNoteCount: number,
): SyncResponse {
	return {
		success: true,
		toUpdate: toUpdateNotes,
		toDelete: toDeleteMeta,
		toRestore: toRestoreNotes,
		serverNoteCount,
		syncTimestamp: new Date().toISOString(),
	};
}

export function buildSyncErrorResponse(error: string, message: string): { error: string; message: string } {
	return { error, message };
}
