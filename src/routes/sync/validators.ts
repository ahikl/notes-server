import { SyncRequest } from './types';

/**
 * 验证错误结果
 */
export interface ValidationError {
	valid: false;
	error: string;
	message: string;
}

/**
 * 验证成功结果
 */
export interface ValidationSuccess {
	valid: true;
	data: SyncRequest;
}

export type ValidationResult = ValidationError | ValidationSuccess;

/**
 * 验证同步请求参数
 * @param body 请求体
 * @returns 验证结果
 */
export function validateSyncRequest(body: unknown): ValidationResult {
	// 验证基本结构
	if (typeof body !== 'object' || body === null) {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'localNoteIds must be an array',
		};
	}

	const bodyRecord = body as Record<string, unknown>;

	// 验证 localNoteIds
	if (!isValidLocalNoteIds(bodyRecord)) {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'localNoteIds must be an array',
		};
	}

	const localNoteIds = bodyRecord.localNoteIds as string[];

	// 验证 lastSyncTimestamp
	const timestampValidation = validateTimestamp(bodyRecord);
	if (!timestampValidation.valid) {
		return timestampValidation;
	}

	const lastSyncTimestamp = bodyRecord.lastSyncTimestamp as string;

	// 验证 localDeletedNoteIds（可选）
	const localDeletedNoteIds = validateDeletedNoteIds(bodyRecord);
	if (localDeletedNoteIds === null) {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'localDeletedNoteIds must be an array if provided',
		};
	}

	return {
		valid: true,
		data: {
			localNoteIds,
			localDeletedNoteIds,
			lastSyncTimestamp,
		},
	};
}

/**
 * 验证 localNoteIds 是否为有效数组
 */
function isValidLocalNoteIds(body: Record<string, unknown>): boolean {
	return Array.isArray(body.localNoteIds);
}

/**
 * 验证时间戳
 */
function validateTimestamp(body: Record<string, unknown>): ValidationResult {
	const lastSyncTimestamp = body.lastSyncTimestamp;

	if (!lastSyncTimestamp || typeof lastSyncTimestamp !== 'string') {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'lastSyncTimestamp is required',
		};
	}

	const syncTime = new Date(lastSyncTimestamp);
	if (isNaN(syncTime.getTime())) {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'Invalid lastSyncTimestamp format',
		};
	}

	return { valid: true, data: undefined as unknown as SyncRequest };
}

/**
 * 验证已删除笔记ID列表
 * @returns 验证通过的数组，如果格式无效返回 null
 */
function validateDeletedNoteIds(body: Record<string, unknown>): string[] | null | undefined {
	const { localDeletedNoteIds } = body;

	if (localDeletedNoteIds === undefined) {
		return undefined;
	}

	if (!Array.isArray(localDeletedNoteIds)) {
		return null;
	}

	return localDeletedNoteIds as string[];
}
