import { Note } from '../../index';
import { ClientState, DeleteMeta, ServerNoteStatus, SyncAnalysisResult, SyncProcessResult } from './types';

/**
 * 构建客户端状态集合
 * @param localNoteIds 客户端笔记ID列表
 * @param localDeletedNoteIds 客户端已删除笔记ID列表
 * @returns 客户端状态集合
 */
export function buildClientState(localNoteIds: string[], localDeletedNoteIds?: string[]): ClientState {
	return {
		clientDeletedIdSet: new Set(localDeletedNoteIds || []),
		clientNoteIdSet: new Set(localNoteIds),
	};
}

/**
 * 分析增量更新中的笔记
 * @param incrementalUpdates 增量更新的笔记列表
 * @param clientState 客户端状态
 * @returns 分析结果
 */
export function analyzeIncrementalUpdates(incrementalUpdates: Note[], clientState: ClientState): SyncAnalysisResult {
	const toUpdateNoteIds: string[] = [];
	const toDeleteMeta: DeleteMeta[] = [];
	const toRestoreNoteIds: string[] = [];

	for (const note of incrementalUpdates) {
		// 关键修复：只处理客户端拥有的笔记
		if (!clientState.clientNoteIdSet.has(note.id)) continue;

		if (note.is_deleted === 1) {
			// 服务端已删除的笔记
			// 只有客户端未标记为删除的才需要通知客户端删除
			if (!clientState.clientDeletedIdSet.has(note.id)) {
				toDeleteMeta.push({
					id: note.id,
					is_deleted: 1,
					updated_at: note.updated_at,
				});
			}
		} else {
			// 服务端未删除的笔记
			// 检查客户端是否标记为已删除
			if (clientState.clientDeletedIdSet.has(note.id)) {
				// 客户端已删除但服务端未删除 → 需要恢复
				toRestoreNoteIds.push(note.id);
			} else {
				// 正常更新
				toUpdateNoteIds.push(note.id);
			}
		}
	}

	return { toUpdateNoteIds, toDeleteMeta, toRestoreNoteIds };
}

/**
 * 识别服务端有但客户端没有的新增笔记
 * @param serverNotesStatus 服务端所有笔记状态
 * @param clientState 客户端状态
 * @param existingUpdateIds 已标记为更新的笔记ID
 * @param existingRestoreIds 已标记为恢复的笔记ID
 * @returns 需要新增的笔记ID列表
 */
export function identifyNewNotes(
	serverNotesStatus: ServerNoteStatus[],
	clientState: ClientState,
	existingUpdateIds: string[],
	existingRestoreIds: string[],
): string[] {
	const newNoteIds: string[] = [];

	for (const serverNote of serverNotesStatus) {
		if (serverNote.is_deleted === 0 && !clientState.clientNoteIdSet.has(serverNote.id)) {
			// 服务端有且未删除，客户端完全没有 → 新增笔记
			if (!existingUpdateIds.includes(serverNote.id) && !existingRestoreIds.includes(serverNote.id)) {
				newNoteIds.push(serverNote.id);
			}
		}
	}

	return newNoteIds;
}

/**
 * 检查删除状态不一致的笔记
 * @param serverNotesStatus 服务端所有笔记状态
 * @param clientState 客户端状态
 * @param incrementalUpdates 增量更新的笔记列表（用于排除已处理的）
 * @param currentDeleteMeta 当前已标记为删除的元数据
 * @param currentRestoreIds 当前已标记为恢复的笔记ID
 * @returns 需要补充的删除元数据和恢复ID
 */
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
		if (!serverNote) continue; // 服务端没有这条笔记，跳过

		const isClientDeleted = clientState.clientDeletedIdSet.has(noteId);
		const isServerDeleted = serverNote.is_deleted === 1;

		if (isClientDeleted && !isServerDeleted) {
			// 客户端已删除但服务端未删除 → 需要恢复
			if (!currentRestoreIds.includes(noteId) && !incrementalUpdateIds.has(noteId)) {
				additionalRestores.push(noteId);
			}
		} else if (!isClientDeleted && isServerDeleted) {
			// 客户端未删除但服务端已删除 → 需要通知客户端删除
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

/**
 * 合并同步分析结果
 * @param baseResult 基础分析结果
 * @param newNoteIds 新增笔记ID
 * @param additionalDeletes 补充删除元数据
 * @param additionalRestores 补充恢复ID
 * @returns 合并后的完整分析结果
 */
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

/**
 * 处理同步结果数据
 * @param fullNotes 从数据库获取的完整笔记数据
 * @param toUpdateNoteIds 需要更新的笔记ID
 * @param toRestoreNoteIds 需要恢复的笔记ID
 * @param toDeleteMeta 删除元数据
 * @returns 处理后的同步结果
 */
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
