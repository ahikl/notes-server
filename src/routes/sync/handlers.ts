import { Context } from 'hono';
import { Env, Note } from '../../index';
import { NoteRepo } from '../../db/';
import { buildSyncErrorResponse } from './responseBuilder';
import {
	IncrementalSyncResponse,
	DeletionSyncResponse,
	RestoreSyncResponse,
	NewNotesResponse,
	FullDataResponse,
	StatusCheckResponse,
	DeleteMeta,
} from './types';

function validateTimestamp(timestamp: unknown): string | null {
	if (!timestamp || typeof timestamp !== 'string') return null;
	const date = new Date(timestamp);
	if (isNaN(date.getTime())) return null;
	return timestamp;
}

function validateStringArray(arr: unknown): string[] | null {
	if (!Array.isArray(arr)) return null;
	if (!arr.every((id) => typeof id === 'string')) return null;
	return arr as string[];
}

export async function handleIncrementalSync(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const lastSyncTimestamp = validateTimestamp(body.lastSyncTimestamp);
		if (!lastSyncTimestamp) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'lastSyncTimestamp is required'), 400);
		}

		const localNoteIds = validateStringArray(body.localNoteIds);
		if (localNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localNoteIds must be an array of strings'), 400);
		}

		const clientNoteIdSet = new Set(localNoteIds);

		const incrementalUpdates = await NoteRepo.findByUpdatedAfter(c.env.DB, lastSyncTimestamp);

		const notes: Note[] = incrementalUpdates.filter((note) => clientNoteIdSet.has(note.id) && note.is_deleted === 0);

		const response: IncrementalSyncResponse = {
			success: true,
			notes,
			count: notes.length,
		};

		return c.json(response);
	} catch (error) {
		console.error('[Sync/Incremental] Error:', error);
		return c.json(buildSyncErrorResponse('InternalError', '获取增量更新失败'), 500);
	}
}

export async function handleDeletionSync(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const localNoteIds = validateStringArray(body.localNoteIds);
		if (localNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localNoteIds must be an array of strings'), 400);
		}

		const localDeletedNoteIds = validateStringArray(body.localDeletedNoteIds);
		if (localDeletedNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localDeletedNoteIds must be an array of strings'), 400);
		}

		const clientDeletedIdSet = new Set(localDeletedNoteIds);
		const clientNoteIdSet = new Set(localNoteIds);

		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);

		const deletions: DeleteMeta[] = [];

		for (const serverNote of serverNotesStatus) {
			if (!clientNoteIdSet.has(serverNote.id)) continue;

			if (serverNote.is_deleted === 1 && !clientDeletedIdSet.has(serverNote.id)) {
				deletions.push({
					id: serverNote.id,
					is_deleted: 1,
					updated_at: serverNote.updated_at,
				});
			}
		}

		const response: DeletionSyncResponse = {
			success: true,
			deletions,
			count: deletions.length,
		};

		return c.json(response);
	} catch (error) {
		console.error('[Sync/Deletions] Error:', error);
		return c.json(buildSyncErrorResponse('InternalError', '获取删除列表失败'), 500);
	}
}

export async function handleRestoreSync(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const localNoteIds = validateStringArray(body.localNoteIds);
		if (localNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localNoteIds must be an array of strings'), 400);
		}

		const localDeletedNoteIds = validateStringArray(body.localDeletedNoteIds);
		if (localDeletedNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localDeletedNoteIds must be an array of strings'), 400);
		}

		const clientDeletedIdSet = new Set(localDeletedNoteIds);

		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);

		const restoreIds: string[] = [];

		for (const serverNote of serverNotesStatus) {
			if (serverNote.is_deleted === 0 && clientDeletedIdSet.has(serverNote.id)) {
				restoreIds.push(serverNote.id);
			}
		}

		const response: RestoreSyncResponse = {
			success: true,
			restoreIds,
			count: restoreIds.length,
		};

		return c.json(response);
	} catch (error) {
		console.error('[Sync/Restore] Error:', error);
		return c.json(buildSyncErrorResponse('InternalError', '获取恢复列表失败'), 500);
	}
}

export async function handleNewNotes(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const localNoteIds = validateStringArray(body.localNoteIds);
		if (localNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localNoteIds must be an array of strings'), 400);
		}

		const clientNoteIdSet = new Set(localNoteIds);

		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);

		const newNoteIds: string[] = [];

		for (const serverNote of serverNotesStatus) {
			if (serverNote.is_deleted === 0 && !clientNoteIdSet.has(serverNote.id)) {
				newNoteIds.push(serverNote.id);
			}
		}

		const response: NewNotesResponse = {
			success: true,
			newNoteIds,
			count: newNoteIds.length,
		};

		return c.json(response);
	} catch (error) {
		console.error('[Sync/New] Error:', error);
		return c.json(buildSyncErrorResponse('InternalError', '获取新增笔记列表失败'), 500);
	}
}

export async function handleFullData(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const ids = validateStringArray(body.ids);
		if (ids === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'ids must be an array of strings'), 400);
		}

		if (ids.length === 0) {
			const response: FullDataResponse = {
				success: true,
				notes: [],
				count: 0,
			};
			return c.json(response);
		}

		const notes = await NoteRepo.findByIds(c.env.DB, ids);

		const response: FullDataResponse = {
			success: true,
			notes,
			count: notes.length,
		};

		return c.json(response);
	} catch (error) {
		console.error('[Sync/FullData] Error:', error);
		return c.json(buildSyncErrorResponse('InternalError', '获取完整数据失败'), 500);
	}
}

export async function handleStatusCheck(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const localNoteIds = validateStringArray(body.localNoteIds);
		if (localNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localNoteIds must be an array of strings'), 400);
		}

		const localDeletedNoteIds = validateStringArray(body.localDeletedNoteIds);
		if (localDeletedNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localDeletedNoteIds must be an array of strings'), 400);
		}

		const clientDeletedIdSet = new Set(localDeletedNoteIds);
		const clientNoteIdSet = new Set(localNoteIds);

		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);
		const serverNoteMap = new Map(serverNotesStatus.map((n) => [n.id, n]));

		const serverActiveNoteIds = serverNotesStatus.filter((n) => n.is_deleted === 0).map((n) => n.id);
		let clientHasServerMissing = 0;
		let serverHasClientMissing = 0;
		let deleteStatusMismatch = 0;

		for (const noteId of clientNoteIdSet) {
			if (!serverNoteMap.has(noteId)) {
				clientHasServerMissing++;
			}
		}

		for (const serverNote of serverNotesStatus) {
			if (serverNote.is_deleted === 0 && !clientNoteIdSet.has(serverNote.id)) {
				serverHasClientMissing++;
			}

			if (clientNoteIdSet.has(serverNote.id)) {
				const isClientDeleted = clientDeletedIdSet.has(serverNote.id);
				const isServerDeleted = serverNote.is_deleted === 1;
				if (isClientDeleted !== isServerDeleted) {
					deleteStatusMismatch++;
				}
			}
		}

		const response: StatusCheckResponse = {
			success: true,
			serverNoteCount: serverActiveNoteIds.length,
			clientHasServerMissing,
			serverHasClientMissing,
			deleteStatusMismatch,
		};

		return c.json(response);
	} catch (error) {
		console.error('[Sync/Status] Error:', error);
		return c.json(buildSyncErrorResponse('InternalError', '获取状态信息失败'), 500);
	}
}
