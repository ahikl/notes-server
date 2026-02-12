import { Note } from '../../index';

// ==================== 基础类型 ====================

/**
 * 删除元数据（用于通知客户端删除）
 */
export interface DeleteMeta {
	id: string;
	is_deleted: 1;
	updated_at: string;
}

/**
 * 服务端笔记状态
 */
export interface ServerNoteStatus {
	id: string;
	is_deleted: number;
	updated_at: string;
}

/**
 * 客户端状态集合
 */
export interface ClientState {
	clientDeletedIdSet: Set<string>;
	clientNoteIdSet: Set<string>;
}

// ==================== /sync 聚合接口 ====================

/**
 * 同步请求参数
 */
export interface SyncRequest {
	localNoteIds: string[];
	localDeletedNoteIds?: string[];
	lastSyncTimestamp: string;
}

/**
 * 同步响应数据
 */
export interface SyncResponse {
	success: true;
	toUpdate: Note[];
	toDelete: DeleteMeta[];
	toRestore: Note[];
	serverNoteCount: number;
	syncTimestamp: string;
}

/**
 * 同步分析结果
 */
export interface SyncAnalysisResult {
	toUpdateNoteIds: string[];
	toDeleteMeta: DeleteMeta[];
	toRestoreNoteIds: string[];
}

/**
 * 同步处理结果
 */
export interface SyncProcessResult {
	toUpdateNotes: Note[];
	toDeleteMeta: DeleteMeta[];
	toRestoreNotes: Note[];
}

// ==================== /sync/incremental 增量更新接口 ====================

/**
 * 增量更新请求
 */
export interface IncrementalSyncRequest {
	lastSyncTimestamp: string;
	localNoteIds: string[];
}

/**
 * 增量更新响应
 */
export interface IncrementalSyncResponse {
	success: true;
	notes: Note[];
	count: number;
}

// ==================== /sync/deletions 删除同步接口 ====================

/**
 * 删除同步请求
 */
export interface DeletionSyncRequest {
	localNoteIds: string[];
	localDeletedNoteIds: string[];
}

/**
 * 删除同步响应
 */
export interface DeletionSyncResponse {
	success: true;
	deletions: DeleteMeta[];
	count: number;
}

// ==================== /sync/restore 恢复同步接口 ====================

/**
 * 恢复同步请求
 */
export interface RestoreSyncRequest {
	localNoteIds: string[];
	localDeletedNoteIds: string[];
}

/**
 * 恢复同步响应
 */
export interface RestoreSyncResponse {
	success: true;
	restoreIds: string[];
	count: number;
}

// ==================== /sync/new 新增笔记接口 ====================

/**
 * 新增笔记查询请求
 */
export interface NewNotesRequest {
	localNoteIds: string[];
}

/**
 * 新增笔记查询响应
 */
export interface NewNotesResponse {
	success: true;
	newNoteIds: string[];
	count: number;
}

// ==================== /sync/full-data 完整数据接口 ====================

/**
 * 完整数据获取请求
 */
export interface FullDataRequest {
	ids: string[];
}

/**
 * 完整数据获取响应
 */
export interface FullDataResponse {
	success: true;
	notes: Note[];
	count: number;
}

// ==================== /sync/status 状态查询接口 ====================

/**
 * 状态查询请求
 */
export interface StatusCheckRequest {
	localNoteIds: string[];
	localDeletedNoteIds: string[];
}

/**
 * 状态查询响应
 */
export interface StatusCheckResponse {
	success: true;
	serverNoteCount: number;
	clientHasServerMissing: number;
	serverHasClientMissing: number;
	deleteStatusMismatch: number;
}
