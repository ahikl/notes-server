import { Note } from '../../index';
import { DeleteMeta, SyncResponse } from './types';

/**
 * 构建同步成功响应
 * @param toUpdateNotes 需要更新的笔记列表
 * @param toDeleteMeta 需要删除的笔记元数据
 * @param toRestoreNotes 需要恢复的笔记列表
 * @param serverNoteCount 服务端活跃笔记数量
 * @returns 同步响应对象
 */
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

/**
 * 构建同步错误响应
 * @param error 错误代码
 * @param message 错误消息
 * @returns 错误响应对象
 */
export function buildSyncErrorResponse(error: string, message: string): { error: string; message: string } {
	return { error, message };
}
