import { Note, PaginatedResult } from '../index';

interface SqlCountResult {
	total: number;
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
	findById: async (db: D1Database, id: string): Promise<Note | null> =>
		db.prepare('SELECT * FROM notes WHERE id = ? AND is_deleted = 0').bind(id).first<Note>(),

	// 创建笔记
	create: (
		db: D1Database,
		data: {
			id: string;
			title: string;
			content: string;
			is_encrypted: number;
			created_at: string;
			updated_at: string;
		},
	) =>
		db
			.prepare('INSERT INTO notes (id,title, content, is_encrypted, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 0)')
			.bind(data.id, data.title, data.content, data.is_encrypted, data.created_at, data.updated_at)
			.run(),
	// 更新笔记
	update: (
		db: D1Database,
		id: string,
		data: {
			title?: string;
			content?: string;
			is_encrypted?: number;
			updated_at: string;
		},
	) => {
		const [sets, params] = Object.entries(data).reduce(
			([accSets, accParams], [key, value]) => {
				if (value !== undefined) {
					accSets.push(`${key} = ?`);
					accParams.push(value);
				}
				return [accSets, accParams];
			},
			[[] as string[], [] as (string | number)[]],
		);

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

	// 软删除笔记
	delete: async (db: D1Database, id: string) =>
		db
			.prepare('UPDATE notes SET is_deleted = 1, updated_at = ?, content = ?, title = ? WHERE id = ?')
			.bind(new Date().toISOString(), '', 'Deleted Note', id)
			.run(),

	// 获取所有笔记
	getAllFull: (db: D1Database) => db.prepare('SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC').all<Note>(),

	// 批量插入或更新笔记
	upsertMany: async (db: D1Database, notes: Note[]) => {
		if (notes.length === 0) return;

		const stmt = db.prepare(`
			INSERT INTO notes (id, title, content, is_encrypted, created_at, updated_at, is_deleted)
			VALUES (?, ?, ?, ?, ?, ?, 0)
			ON CONFLICT(id)
			DO UPDATE SET
				title = excluded.title,
				content = excluded.content,
				is_encrypted = excluded.is_encrypted,
				updated_at = excluded.updated_at,
				is_deleted = 0
		`);

		const batchInserts = notes.map((note) =>
			stmt.bind(note.id, note.title, note.content, note.is_encrypted, note.created_at, note.updated_at),
		);

		await db.batch(batchInserts);
	},

	// 根据ID列表查询笔记
	findByIds: async (db: D1Database, ids: string[]): Promise<Note[]> => {
		if (ids.length === 0) return [];
		const placeholders = ids.map(() => '?').join(',');
		const query = `SELECT * FROM notes WHERE id IN (${placeholders}) AND is_deleted = 0`;
		const result = await db
			.prepare(query)
			.bind(...ids)
			.all<Note>();
		return result.results;
	},
};
