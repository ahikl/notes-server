import { Context } from 'hono';
import { Env, Note } from '../../index';
import { NoteRepo } from '../../db/';
import { validateSyncRequest } from './validators';
import {
	buildClientState,
	analyzeIncrementalUpdates,
	identifyNewNotes,
	checkDeleteStatusMismatch,
	mergeSyncResults,
	processSyncResult,
} from './syncStrategy';
import { buildSyncResponse, buildSyncErrorResponse } from './responseBuilder';
import { ServerNoteStatus, SyncRequest } from './types';

export {
	handleIncrementalSync,
	handleDeletionSync,
	handleRestoreSync,
	handleNewNotes,
	handleFullData,
	handleStatusCheck,
} from './handlers';

export async function handleSync(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const validation = validateSyncRequest(body);
		if (!validation.valid) {
			console.error(`[Sync] Invalid request: ${validation.message}`);
			const errorResponse = buildSyncErrorResponse(validation.error, validation.message);
			return c.json(errorResponse, 400);
		}

		const syncRequest = validation.data;
		logSyncStart(syncRequest);

		const { serverNotesStatus, serverActiveNoteIds, incrementalUpdates } = await fetchSyncData(c.env.DB, syncRequest.lastSyncTimestamp);

		const clientState = buildClientState(syncRequest.localNoteIds, syncRequest.localDeletedNoteIds);

		const syncResult = await calculateSyncStrategy(incrementalUpdates, serverNotesStatus, clientState, c.env.DB);

		const response = buildSyncResponse(
			syncResult.toUpdateNotes,
			syncResult.toDeleteMeta,
			syncResult.toRestoreNotes,
			serverActiveNoteIds.length,
		);

		logSyncComplete(response);
		return c.json(response);
	} catch (error) {
		console.error('[Sync] Sync error:', error);
		const errorResponse = buildSyncErrorResponse('InternalError', '同步失败');
		return c.json(errorResponse, 500);
	}
}

async function fetchSyncData(
	db: D1Database,
	lastSyncTimestamp: string,
): Promise<{
	serverNotesStatus: ServerNoteStatus[];
	serverActiveNoteIds: string[];
	incrementalUpdates: Note[];
}> {
	const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(db);
	const serverActiveNoteIds = serverNotesStatus.filter((n) => n.is_deleted === 0).map((n) => n.id);
	console.log(`[Sync] Server has ${serverNotesStatus.length} total notes (${serverActiveNoteIds.length} active)`);

	const incrementalUpdates = await NoteRepo.findByUpdatedAfter(db, lastSyncTimestamp);
	console.log(`[Sync] Found ${incrementalUpdates.length} incremental updates since ${lastSyncTimestamp}`);

	return { serverNotesStatus, serverActiveNoteIds, incrementalUpdates };
}

async function calculateSyncStrategy(
	incrementalUpdates: Note[],
	serverNotesStatus: ServerNoteStatus[],
	clientState: { clientDeletedIdSet: Set<string>; clientNoteIdSet: Set<string> },
	db: D1Database,
): Promise<{
	toUpdateNotes: Note[];
	toDeleteMeta: { id: string; is_deleted: 1; updated_at: string }[];
	toRestoreNotes: Note[];
}> {
	const baseResult = analyzeIncrementalUpdates(incrementalUpdates, clientState);

	const newNoteIds = identifyNewNotes(serverNotesStatus, clientState, baseResult.toUpdateNoteIds, baseResult.toRestoreNoteIds);

	const { additionalDeletes, additionalRestores } = checkDeleteStatusMismatch(
		serverNotesStatus,
		clientState,
		incrementalUpdates,
		baseResult.toDeleteMeta,
		baseResult.toRestoreNoteIds,
	);

	const finalResult = mergeSyncResults(baseResult, newNoteIds, additionalDeletes, additionalRestores);

	console.log(
		`[Sync] Sync analysis: ${finalResult.toUpdateNoteIds.length} to update, ${finalResult.toDeleteMeta.length} to delete, ${finalResult.toRestoreNoteIds.length} to restore`,
	);

	const needFullDataIds = [...new Set([...finalResult.toUpdateNoteIds, ...finalResult.toRestoreNoteIds])];
	let fullNotes: Note[] = [];
	if (needFullDataIds.length > 0) {
		fullNotes = await NoteRepo.findByIds(db, needFullDataIds);
		console.log(`[Sync] Fetched ${fullNotes.length} full notes from database`);
	}

	return processSyncResult(fullNotes, finalResult.toUpdateNoteIds, finalResult.toRestoreNoteIds, finalResult.toDeleteMeta);
}

function logSyncStart(syncRequest: SyncRequest): void {
	const deletedCount = syncRequest.localDeletedNoteIds?.length || 0;
	console.log(
		`[Sync] Starting sync - lastSyncTimestamp: ${syncRequest.lastSyncTimestamp}, client has ${syncRequest.localNoteIds.length} notes, ${deletedCount} deleted locally`,
	);
}

function logSyncComplete(response: {
	toUpdate: Note[];
	toDelete: { id: string; is_deleted: 1; updated_at: string }[];
	toRestore: Note[];
}): void {
	console.log(
		`[Sync] Returning to client: ${response.toUpdate.length} updates, ${response.toDelete.length} deletions, ${response.toRestore.length} restores`,
	);
}
