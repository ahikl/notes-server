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

// 导出各个独立接口的处理器
export {
	handleIncrementalSync,
	handleDeletionSync,
	handleRestoreSync,
	handleNewNotes,
	handleFullData,
	handleStatusCheck,
} from './handlers';

/**
 * 处理笔记同步请求（聚合接口）
 * 内部调用各个子模块完成完整的同步流程
 * @param c Hono 上下文
 * @returns 响应
 */
export async function handleSync(c: Context<{ Bindings: Env }>): Promise<Response> {
	try {
		const body = await c.req.json();

		// 1. 参数验证
		const validation = validateSyncRequest(body);
		if (!validation.valid) {
			console.error(`[Sync] Invalid request: ${validation.message}`);
			const errorResponse = buildSyncErrorResponse(validation.error, validation.message);
			return c.json(errorResponse, 400);
		}

		const syncRequest = validation.data;
		logSyncStart(syncRequest);

		// 2. 获取服务端数据
		const { serverNotesStatus, serverActiveNoteIds, incrementalUpdates } = await fetchSyncData(c.env.DB, syncRequest.lastSyncTimestamp);

		// 3. 构建客户端状态
		const clientState = buildClientState(syncRequest.localNoteIds, syncRequest.localDeletedNoteIds);

		// 4. 执行同步策略计算
		const syncResult = await calculateSyncStrategy(incrementalUpdates, serverNotesStatus, clientState, c.env.DB);

		// 5. 构建响应
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

/**
 * 获取同步所需的数据
 * @param db 数据库实例
 * @param lastSyncTimestamp 上次同步时间戳
 * @returns 服务端笔记状态、活跃笔记ID列表、增量更新
 */
async function fetchSyncData(
	db: D1Database,
	lastSyncTimestamp: string,
): Promise<{
	serverNotesStatus: ServerNoteStatus[];
	serverActiveNoteIds: string[];
	incrementalUpdates: Note[];
}> {
	// 获取服务端所有笔记（包括已删除的）的ID和状态
	const serverNotesStatus = await NoteRepo.findAllWithDeletedStatus(db);
	const serverActiveNoteIds = serverNotesStatus.filter((n) => n.is_deleted === 0).map((n) => n.id);
	console.log(`[Sync] Server has ${serverNotesStatus.length} total notes (${serverActiveNoteIds.length} active)`);

	// 查询数据库中 updated_at > lastSyncTimestamp 的所有笔记（增量更新部分，包含已删除的）
	const incrementalUpdates = await NoteRepo.findByUpdatedAfter(db, lastSyncTimestamp);
	console.log(`[Sync] Found ${incrementalUpdates.length} incremental updates since ${lastSyncTimestamp}`);

	return { serverNotesStatus, serverActiveNoteIds, incrementalUpdates };
}

/**
 * 计算同步策略
 * @param incrementalUpdates 增量更新的笔记
 * @param serverNotesStatus 服务端所有笔记状态
 * @param clientState 客户端状态
 * @param db 数据库实例
 * @returns 处理后的同步结果
 */
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
	// 1. 分析增量更新中的笔记
	const baseResult = analyzeIncrementalUpdates(incrementalUpdates, clientState);

	// 2. 识别服务端有但客户端没有的新增笔记
	const newNoteIds = identifyNewNotes(serverNotesStatus, clientState, baseResult.toUpdateNoteIds, baseResult.toRestoreNoteIds);

	// 3. 检查删除状态不一致的笔记
	const { additionalDeletes, additionalRestores } = checkDeleteStatusMismatch(
		serverNotesStatus,
		clientState,
		incrementalUpdates,
		baseResult.toDeleteMeta,
		baseResult.toRestoreNoteIds,
	);

	// 4. 合并所有结果
	const finalResult = mergeSyncResults(baseResult, newNoteIds, additionalDeletes, additionalRestores);

	console.log(
		`[Sync] Sync analysis: ${finalResult.toUpdateNoteIds.length} to update, ${finalResult.toDeleteMeta.length} to delete, ${finalResult.toRestoreNoteIds.length} to restore`,
	);

	// 5. 获取需要完整数据的笔记
	const needFullDataIds = [...new Set([...finalResult.toUpdateNoteIds, ...finalResult.toRestoreNoteIds])];
	let fullNotes: Note[] = [];
	if (needFullDataIds.length > 0) {
		fullNotes = await NoteRepo.findByIds(db, needFullDataIds);
		console.log(`[Sync] Fetched ${fullNotes.length} full notes from database`);
	}

	// 6. 处理同步结果数据
	return processSyncResult(fullNotes, finalResult.toUpdateNoteIds, finalResult.toRestoreNoteIds, finalResult.toDeleteMeta);
}

/**
 * 记录同步开始日志
 */
function logSyncStart(syncRequest: SyncRequest): void {
	const deletedCount = syncRequest.localDeletedNoteIds?.length || 0;
	console.log(
		`[Sync] Starting sync - lastSyncTimestamp: ${syncRequest.lastSyncTimestamp}, client has ${syncRequest.localNoteIds.length} notes, ${deletedCount} deleted locally`,
	);
}

/**
 * 记录同步完成日志
 */
function logSyncComplete(response: {
	toUpdate: Note[];
	toDelete: { id: string; is_deleted: 1; updated_at: string }[];
	toRestore: Note[];
}): void {
	console.log(
		`[Sync] Returning to client: ${response.toUpdate.length} updates, ${response.toDelete.length} deletions, ${response.toRestore.length} restores`,
	);
}
