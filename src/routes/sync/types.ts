import { Note } from '../../index';

export interface DeleteMeta {
	id: string;
	is_deleted: 1;
	updated_at: string;
}

export interface ServerNoteStatus {
	id: string;
	is_deleted: number;
	updated_at: string;
}

export interface ClientState {
	clientDeletedIdSet: Set<string>;
	clientNoteIdSet: Set<string>;
}

export interface SyncRequest {
	localNoteIds: string[];
	localDeletedNoteIds?: string[];
	lastSyncTimestamp: string;
}

export interface SyncResponse {
	success: true;
	toUpdate: Note[];
	toDelete: DeleteMeta[];
	toRestore: Note[];
	serverNoteCount: number;
	syncTimestamp: string;
}

export interface SyncAnalysisResult {
	toUpdateNoteIds: string[];
	toDeleteMeta: DeleteMeta[];
	toRestoreNoteIds: string[];
}

export interface SyncProcessResult {
	toUpdateNotes: Note[];
	toDeleteMeta: DeleteMeta[];
	toRestoreNotes: Note[];
}

export interface IncrementalSyncRequest {
	lastSyncTimestamp: string;
	localNoteIds: string[];
}

export interface IncrementalSyncResponse {
	success: true;
	notes: Note[];
	count: number;
}

export interface DeletionSyncRequest {
	localNoteIds: string[];
	localDeletedNoteIds: string[];
}

export interface DeletionSyncResponse {
	success: true;
	deletions: DeleteMeta[];
	count: number;
}

export interface RestoreSyncRequest {
	localNoteIds: string[];
	localDeletedNoteIds: string[];
}

export interface RestoreSyncResponse {
	success: true;
	restoreIds: string[];
	count: number;
}

export interface NewNotesRequest {
	localNoteIds: string[];
}

export interface NewNotesResponse {
	success: true;
	newNoteIds: string[];
	count: number;
}

export interface FullDataRequest {
	ids: string[];
}

export interface FullDataResponse {
	success: true;
	notes: Note[];
	count: number;
}

export interface StatusCheckRequest {
	localNoteIds: string[];
	localDeletedNoteIds: string[];
}

export interface StatusCheckResponse {
	success: true;
	serverNoteCount: number;
	clientHasServerMissing: number;
	serverHasClientMissing: number;
	deleteStatusMismatch: number;
}
