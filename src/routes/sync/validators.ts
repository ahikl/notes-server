import { SyncRequest } from './types';

export interface ValidationError {
	valid: false;
	error: string;
	message: string;
}

export interface ValidationSuccess {
	valid: true;
	data: SyncRequest;
}

export type ValidationResult = ValidationError | ValidationSuccess;

export function validateSyncRequest(body: unknown): ValidationResult {
	if (typeof body !== 'object' || body === null) {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'localNoteIds must be an array',
		};
	}

	const bodyRecord = body as Record<string, unknown>;

	if (!isValidLocalNoteIds(bodyRecord)) {
		return {
			valid: false,
			error: 'BAD_REQUEST',
			message: 'localNoteIds must be an array',
		};
	}

	const localNoteIds = bodyRecord.localNoteIds as string[];

	const timestampValidation = validateTimestamp(bodyRecord);
	if (!timestampValidation.valid) {
		return timestampValidation;
	}

	const lastSyncTimestamp = bodyRecord.lastSyncTimestamp as string;

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

function isValidLocalNoteIds(body: Record<string, unknown>): boolean {
	return Array.isArray(body.localNoteIds);
}

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
