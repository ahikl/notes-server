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

// ==================== 通用验证函数 ====================

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

// ==================== /sync/incremental 增量更新 ====================

/**
 * 处理增量更新查询请求
 * 获取指定时间戳之后有更新的笔记（且未被删除）
 */
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

		// 获取增量更新（包含已删除的）
		const incrementalUpdates = await NoteRepo.findByUpdatedAfter(c.env.DB, lastSyncTimestamp);

		// 只返回客户端拥有的、且未删除的笔记
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

// ==================== /sync/deletions 删除同步 ====================

/**
 * 处理删除同步请求
 * 获取服务端已删除但客户端未删除的笔记
 */
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

		// 获取服务端所有笔记状态
		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);

		// 找出服务端已删除但客户端未删除的笔记
		const deletions: DeleteMeta[] = [];

		for (const serverNote of serverNotesStatus) {
			// 只处理客户端拥有的笔记
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

// ==================== /sync/restore 恢复同步 ====================

/**
 * 处理恢复同步请求
 * 获取客户端已删除但服务端未删除的笔记（需要恢复）
 */
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

		// 获取服务端所有活跃笔记ID
		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);

		// 找出客户端已删除但服务端未删除的笔记
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

// ==================== /sync/new 新增笔记 ====================

/**
 * 处理新增笔记查询请求
 * 获取服务端有但客户端没有的笔记ID
 */
export async function handleNewNotes(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		const localNoteIds = validateStringArray(body.localNoteIds);
		if (localNoteIds === null) {
			return c.json(buildSyncErrorResponse('BAD_REQUEST', 'localNoteIds must be an array of strings'), 400);
		}

		const clientNoteIdSet = new Set(localNoteIds);

		// 获取服务端所有活跃笔记
		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);

		// 找出服务端有但客户端没有的活跃笔记
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

// ==================== /sync/full-data 完整数据 ====================

/**
 * 处理完整数据获取请求
 * 根据ID列表获取笔记完整数据
 */
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

		// 获取完整笔记数据
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

// ==================== /sync/status 状态查询 ====================

/**
 * 处理状态查询请求
 * 获取客户端与服务端的状态差异统计
 */
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

		// 获取服务端所有笔记状态
		const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(c.env.DB);
		const serverNoteMap = new Map(serverNotesStatus.map((n) => [n.id, n]));

		// 统计
		const serverActiveNoteIds = serverNotesStatus.filter((n) => n.is_deleted === 0).map((n) => n.id);
		let clientHasServerMissing = 0; // 客户端有但服务端没有的笔记
		let serverHasClientMissing = 0; // 服务端有但客户端没有的笔记
		let deleteStatusMismatch = 0; // 删除状态不一致的数量

		// 检查客户端笔记
		for (const noteId of clientNoteIdSet) {
			if (!serverNoteMap.has(noteId)) {
				clientHasServerMissing++;
			}
		}

		// 检查服务端笔记
		for (const serverNote of serverNotesStatus) {
			if (serverNote.is_deleted === 0 && !clientNoteIdSet.has(serverNote.id)) {
				serverHasClientMissing++;
			}

			// 检查删除状态不一致
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
