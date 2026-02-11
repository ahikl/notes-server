import { Note, PaginatedResult } from '../index';

interface SqlCountResult {
	total: number;
}

/**
 * Base64 字符串转换为 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * ArrayBuffer 转换为 Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * 将数据库返回的原始数据转换为 Note 对象
 */
function convertNoteFromDb(row: any): Note {
	return {
		...row,
		content: row.content ? arrayBufferToBase64(row.content) : '',
		iv: row.iv ? arrayBufferToBase64(row.iv) : undefined,
		auth_tag: row.auth_tag ? arrayBufferToBase64(row.auth_tag) : undefined,
	};
}

export const NoteRepo = {
	// 分页查询笔记列表
	findAll: async (
		db: D1Database,
		options: {
			search?: string;
			page: number;
			limit: number;
		},
	): Promise<PaginatedResult<Partial<Note>>> => {
		const { search, page, limit } = options;
		const offset = (page - 1) * limit;
		const whereConditions: string[] = ['is_deleted = 0'];
		const params: (string | number)[] = [];

		if (search) {
			whereConditions.push('(title LIKE ? OR content LIKE ?)');
			params.push(`%${search}%`, `%${search}%`);
		}

		const whereClause = whereConditions.length > 0 ? ' WHERE ' + whereConditions.join(' AND ') : '';

		const results = await db.batch([
			db
				.prepare(
					`SELECT COUNT(*) as total
							 FROM notes${whereClause}`,
				)
				.bind(...params),
			db
				.prepare(
					`SELECT id, title, is_encrypted, created_at, updated_at
							 FROM notes${whereClause}
							 ORDER BY updated_at DESC
							 LIMIT ? OFFSET ?`,
				)
				.bind(...params, limit, offset),
		]);

		const countResult = results[0];
		const listResult = results[1];
		const countRow = countResult.results[0] as unknown as SqlCountResult;
		return {
			total: countRow.total,
			data: listResult.results as unknown as Partial<Note>[],
			page,
			limit,
		};
	},

	// 根据ID查询笔记
	findById: async (db: D1Database, id: string): Promise<Note | null> => {
		const row = await db.prepare('SELECT * FROM notes WHERE id = ? AND is_deleted = 0').bind(id).first();
		return row ? convertNoteFromDb(row) : null;
	},

	// 创建笔记
	create: (
		db: D1Database,
		data: {
			id: string;
			title: string;
			content: string;
			iv?: string;
			auth_tag?: string;
			is_encrypted: number;
			created_at: string;
			updated_at: string;
		},
	) => {
		const contentBuffer = base64ToArrayBuffer(data.content);
		const ivBuffer = data.iv ? base64ToArrayBuffer(data.iv) : null;
		const authTagBuffer = data.auth_tag ? base64ToArrayBuffer(data.auth_tag) : null;

		return db
			.prepare(
				'INSERT INTO notes (id, title, content, iv, auth_tag, is_encrypted, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
			)
			.bind(data.id, data.title, contentBuffer, ivBuffer, authTagBuffer, data.is_encrypted, data.created_at, data.updated_at)
			.run();
	},
	// 更新笔记
	update: (
		db: D1Database,
		id: string,
		data: {
			title?: string;
			content?: string;
			iv?: string;
			auth_tag?: string;
			is_encrypted?: number;
			updated_at: string;
		},
	) => {
		const params: (string | number | ArrayBuffer | null)[] = [];
		const sets: string[] = [];

		if (data.title !== undefined) {
			sets.push('title = ?');
			params.push(data.title);
		}
		if (data.content !== undefined) {
			sets.push('content = ?');
			params.push(base64ToArrayBuffer(data.content));
		}
		if (data.iv !== undefined) {
			sets.push('iv = ?');
			params.push(data.iv ? base64ToArrayBuffer(data.iv) : null);
		}
		if (data.auth_tag !== undefined) {
			sets.push('auth_tag = ?');
			params.push(data.auth_tag ? base64ToArrayBuffer(data.auth_tag) : null);
		}
		if (data.is_encrypted !== undefined) {
			sets.push('is_encrypted = ?');
			params.push(data.is_encrypted);
		}
		if (data.updated_at !== undefined) {
			sets.push('updated_at = ?');
			params.push(data.updated_at);
		}

		if (sets.length === 0) return Promise.resolve(null);

		const query = `UPDATE notes
									 SET ${sets.join(', ')}
									 WHERE id = ? AND is_deleted = 0`;
		params.push(id);

		return db
			.prepare(query)
			.bind(...params)
			.run();
	},

	// 软删除笔记 - 只更新 is_deleted 和 updated_at，保持其他字段不变
	delete: async (db: D1Database, id: string) =>
		db.prepare('UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_deleted = 0').bind(new Date().toISOString(), id).run(),

	// 批量软删除笔记 - 只更新 is_deleted 和 updated_at，保持其他字段不变
	deleteMany: async (db: D1Database, ids: string[]): Promise<number> => {
		if (ids.length === 0) return 0;
		const placeholders = ids.map(() => '?').join(',');
		const query = `UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id IN (${placeholders}) AND is_deleted = 0`;
		const result = await db
			.prepare(query)
			.bind(new Date().toISOString(), ...ids)
			.run();
		return result.meta.changes ?? 0;
	},

	// 获取所有笔记
	getAllFull: async (db: D1Database) => {
		const result = await db.prepare('SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC').all();
		return {
			...result,
			results: result.results.map((row) => convertNoteFromDb(row)),
		};
	},

	// 批量插入笔记（用于批量上传，不覆盖已有数据）
	insertMany: async (db: D1Database, notes: Note[]) => {
		if (notes.length === 0) return;

		const stmt = db.prepare(`
			INSERT INTO notes (id, title, content, iv, auth_tag, is_encrypted, created_at, updated_at, is_deleted)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
		`);

		const batchInserts = notes.map((note) => {
			const contentBuffer = base64ToArrayBuffer(note.content);
			const ivBuffer = note.iv ? base64ToArrayBuffer(note.iv) : null;
			const authTagBuffer = note.auth_tag ? base64ToArrayBuffer(note.auth_tag) : null;
			return stmt.bind(note.id, note.title, contentBuffer, ivBuffer, authTagBuffer, note.is_encrypted, note.created_at, note.updated_at);
		});

		await db.batch(batchInserts);
	},

	// 批量更新笔记（基于时间戳优先原则，只更新客户端较新的数据）
	updateMany: async (db: D1Database, notes: Note[]) => {
		if (notes.length === 0) return;

		const stmt = db.prepare(`
			UPDATE notes SET
				title = ?,
				content = ?,
				iv = ?,
				auth_tag = ?,
				is_encrypted = ?,
				updated_at = ?,
				is_deleted = 0
			WHERE id = ?
		`);

		const batchUpdates = notes.map((note) => {
			const contentBuffer = base64ToArrayBuffer(note.content);
			const ivBuffer = note.iv ? base64ToArrayBuffer(note.iv) : null;
			const authTagBuffer = note.auth_tag ? base64ToArrayBuffer(note.auth_tag) : null;
			return stmt.bind(note.title, contentBuffer, ivBuffer, authTagBuffer, note.is_encrypted, note.updated_at, note.id);
		});

		await db.batch(batchUpdates);
	},

	// 批量插入或更新笔记（旧方法，保留用于兼容）
	upsertMany: async (db: D1Database, notes: Note[]) => {
		if (notes.length === 0) return;

		const stmt = db.prepare(`
			INSERT INTO notes (id, title, content, iv, auth_tag, is_encrypted, created_at, updated_at, is_deleted)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
			ON CONFLICT(id)
			DO UPDATE SET
				title = excluded.title,
				content = excluded.content,
				iv = excluded.iv,
				auth_tag = excluded.auth_tag,
				is_encrypted = excluded.is_encrypted,
				updated_at = excluded.updated_at,
				is_deleted = 0
		`);

		const batchInserts = notes.map((note) => {
			const contentBuffer = base64ToArrayBuffer(note.content);
			const ivBuffer = note.iv ? base64ToArrayBuffer(note.iv) : null;
			const authTagBuffer = note.auth_tag ? base64ToArrayBuffer(note.auth_tag) : null;
			return stmt.bind(note.id, note.title, contentBuffer, ivBuffer, authTagBuffer, note.is_encrypted, note.created_at, note.updated_at);
		});

		await db.batch(batchInserts);
	},

	// 根据ID列表查询笔记（包含已删除的，用于同步）
	findByIds: async (db: D1Database, ids: string[]): Promise<Note[]> => {
		if (ids.length === 0) return [];
		const placeholders = ids.map(() => '?').join(',');
		const query = `SELECT * FROM notes WHERE id IN (${placeholders})`;
		const result = await db
			.prepare(query)
			.bind(...ids)
			.all();
		return result.results.map((row) => convertNoteFromDb(row));
	},

	// 查询更新时间大于指定时间戳的笔记（增量同步）- 包含已删除的
	findByUpdatedAfter: async (db: D1Database, timestamp: string): Promise<Note[]> => {
		const result = await db.prepare('SELECT * FROM notes WHERE updated_at > ?').bind(timestamp).all();
		return result.results.map((row) => convertNoteFromDb(row));
	},

	// 查询所有未删除的笔记ID列表
	findAllIds: async (db: D1Database): Promise<string[]> => {
		const result = await db.prepare('SELECT id FROM notes WHERE is_deleted = 0').all();
		return result.results.map((row: any) => row.id as string);
	},

	// 查询所有笔记ID和删除状态（用于同步）
	findAllWithDeletedStatus: async (db: D1Database): Promise<{ id: string; is_deleted: number; updated_at: string }[]> => {
		const result = await db.prepare('SELECT id, is_deleted, updated_at FROM notes').all();
		return result.results.map((row: any) => ({
			id: row.id as string,
			is_deleted: row.is_deleted as number,
			updated_at: row.updated_at as string,
		}));
	},
};
