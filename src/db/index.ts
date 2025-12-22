import { Note, PaginatedResult } from '../index';

interface SqlCountResult {
	total: number;
}

export const NoteRepo = {
	// 分页查询笔记列表
	async findAll(db: D1Database, options: { search?: string; page: number; limit: number }): Promise<PaginatedResult<Partial<Note>>> {
		const { search, page, limit } = options;
		const offset = (page - 1) * limit;
		let whereClause = '';
		const params: (string | number)[] = [];

		if (search) {
			whereClause = ' WHERE title LIKE ?';
			params.push(`%${search}%`);
		}

		const [countResult, listResult] = await db.batch([
			db
				.prepare(
					`SELECT COUNT(*) as total
									FROM notes${whereClause}`,
				)
				.bind(...params),
			db
				.prepare(
					`SELECT id, title, created_at, updated_at
				 FROM notes${whereClause}
				 ORDER BY created_at DESC
				 LIMIT ? OFFSET ?`,
				)
				.bind(...params, limit, offset),
		]);

		const countRow = countResult.results[0] as unknown as SqlCountResult;

		return {
			total: countRow.total,
			data: listResult.results as unknown as Partial<Note>[],
			page,
			limit,
		};
	},

	// 根据ID查询笔记
	async findById(db: D1Database, id: string): Promise<Note | null> {
		return db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<Note>();
	},

	// 创建笔记
	async create(db: D1Database, data: { title: string; content: string }) {
		return db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)').bind(data.title, data.content).run();
	},
	// 更新笔记
	async update(db: D1Database, id: string, data: { title?: string; content?: string }) {
		const sets: string[] = [];
		const params: (string | number)[] = [];

		if (data.title !== undefined) {
			sets.push('title = ?');
			params.push(data.title);
		}
		if (data.content !== undefined) {
			sets.push('content = ?');
			params.push(data.content);
		}

		if (sets.length === 0) return null;

		sets.push('updated_at = CURRENT_TIMESTAMP');
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
	async delete(db: D1Database, id: string) {
		return db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
	},

	// 获取所有笔记
	async getAllFull(db: D1Database) {
		return db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all<Note>();
	},
};
