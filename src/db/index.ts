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
		let whereClause = '';
		const params: (string | number)[] = [];

		if (search) {
			whereClause = ' WHERE title LIKE ?';
			params.push(`%${search}%`);
		}

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
						 ORDER BY created_at DESC
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
	findById: (db: D1Database, id: string): Promise<Note | null> => db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<Note>(),

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
			.prepare('INSERT INTO notes (id,title, content, is_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
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
									 WHERE id = ?`;
		params.push(id);

		return db
			.prepare(query)
			.bind(...params)
			.run();
	},

	// 删除笔记
	delete: (db: D1Database, id: string) => db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run(),

	// 获取所有笔记
	getAllFull: (db: D1Database) => db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all<Note>(),
};
