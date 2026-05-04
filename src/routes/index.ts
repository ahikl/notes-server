import { Hono } from 'hono';
import { Env, Note } from '../index';
import { NoteRepo } from '../db/';
import {
	handleSync,
	handleIncrementalSync,
	handleDeletionSync,
	handleRestoreSync,
	handleNewNotes,
	handleFullData,
	handleStatusCheck,
} from './sync';

const notes = new Hono<{ Bindings: Env }>();

notes.use('*', async (c, next) => {
	const authHeader = c.req.header('Authorization');
	const EXPECTED_KEY = c.env.API_KEY;
	if (!EXPECTED_KEY || authHeader !== `Bearer ${EXPECTED_KEY}`) {
		return c.json({ error: 'Unauthorized', message: 'API Key 无效' }, 401);
	}
	return next();
});

notes.get('/export/all', (c) =>
	NoteRepo.getAllFull(c.env.DB).then((result) => {
		c.header('Content-Disposition', 'attachment; filename="notes_backup.json"');
		return c.json({
			success: true,
			timestamp: new Date().toISOString(),
			count: result.results.length,
			data: result.results,
		});
	}),
);

notes.get('/export/paged', async (c) => {
	const page = Math.max(1, parseInt(c.req.query('page') || '1'));
	const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '50')));

	const result = await NoteRepo.getAllFullPaged(c.env.DB, { page, limit });

	return c.json({
		success: true,
		timestamp: new Date().toISOString(),
		page,
		limit,
		total: result.total,
		hasMore: result.hasMore,
		count: result.data.length,
		data: result.data,
	});
});

notes.get('/', async (c) => {
	const search = c.req.query('search');
	const page = Math.max(1, parseInt(c.req.query('page') || '1'));
	const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '20')));
	const result_1 = await NoteRepo.findAll(c.env.DB, { search, page, limit });
	return c.json(result_1);
});

notes.get('/:id', async (c) => {
	const id = c.req.param('id');
	const note = await NoteRepo.findById(c.env.DB, id);
	return note ? c.json(note) : c.json({ error: 'Note not found', message: '笔记未找到' }, 404);
});

notes.post('/', async (c) => {
	const body = await c.req.json();
	if (!body.title || !body.content) {
		return c.json({ error: 'BAD_REQUEST', message: '标题和内容不能为空' }, 400);
	}

	const clientCreatedAt = body.created_at;
	const clientUpdatedAt = body.updated_at;
	const serverTime = new Date().toISOString();

	let validatedCreatedAt = serverTime;
	let validatedUpdatedAt = serverTime;

	if (clientCreatedAt) {
		const date = new Date(clientCreatedAt);
		if (!isNaN(date.getTime())) {
			validatedCreatedAt = date.toISOString();
		}
	}

	if (clientUpdatedAt) {
		const date = new Date(clientUpdatedAt);
		if (!isNaN(date.getTime())) {
			validatedUpdatedAt = date.toISOString();
		}
	}

	const noteData = {
		...body,
		is_encrypted: body.is_encrypted ?? 1,
		created_at: validatedCreatedAt,
		updated_at: validatedUpdatedAt,
	};
	await NoteRepo.create(c.env.DB, noteData);
	return c.json({ success: true }, 201);
});

notes.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json();
	const clientUpdatedAt = body.updated_at;

	let validatedUpdatedAt = new Date().toISOString();

	if (clientUpdatedAt) {
		const date = new Date(clientUpdatedAt);
		if (!isNaN(date.getTime())) {
			validatedUpdatedAt = date.toISOString();
		}
	}

	const noteData = {
		...body,
		updated_at: validatedUpdatedAt,
	};
	const result = await NoteRepo.update(c.env.DB, id, noteData);
	if (!result) return c.json({ error: 'BAD_REQUEST', message: '没有可更新的字段' }, 400);
	return c.json({ success: true });
});

notes.delete('/batch', async (c) => {
	try {
		const { ids }: { ids: string[] } = await c.req.json();

		if (!Array.isArray(ids) || ids.length === 0) {
			return c.json({ error: 'BAD_REQUEST', message: 'ID列表不能为空' }, 400);
		}

		const invalidIds = ids.filter((id) => typeof id !== 'string' || !id.trim());
		if (invalidIds.length > 0) {
			return c.json({ error: 'BAD_REQUEST', message: '所有ID必须为非空字符串' }, 400);
		}

		const deletedCount = await NoteRepo.deleteMany(c.env.DB, ids);
		return c.json({ success: true, deletedCount, requestedCount: ids.length });
	} catch (error) {
		console.error('Batch delete error:', error);
		return c.json({ error: 'BAD_REQUEST', message: '请求数据格式错误' }, 400);
	}
});

notes.delete('/:id', async (c) => {
	const id = c.req.param('id');
	await NoteRepo.delete(c.env.DB, id);
	return c.json({ success: true });
});

notes.post('/sync', handleSync);

notes.post('/sync/incremental', handleIncrementalSync);

notes.post('/sync/deletions', handleDeletionSync);

notes.post('/sync/restore', handleRestoreSync);

notes.post('/sync/new', handleNewNotes);

notes.post('/sync/full-data', handleFullData);

notes.post('/sync/status', handleStatusCheck);

notes.post('/batch', async (c) => {
	try {
		const { notes }: { notes: Note[] } = await c.req.json();

		if (!Array.isArray(notes) || notes.length === 0) {
			return c.json({ error: 'BAD_REQUEST', message: '笔记列表不能为空' }, 400);
		}

		for (const note of notes) {
			if (!note.id || !note.title || note.content === undefined) {
				return c.json({ error: 'BAD_REQUEST', message: '每条笔记必须包含ID、标题和内容' }, 400);
			}

			if (typeof note.id !== 'string' || !note.id.trim()) {
				return c.json({ error: 'BAD_REQUEST', message: '笔记ID必须为非空字符串' }, 400);
			}

			if (typeof note.title !== 'string' || typeof note.content !== 'string') {
				return c.json({ error: 'BAD_REQUEST', message: '笔记标题和内容必须为字符串' }, 400);
			}

			if (!note.updated_at || typeof note.updated_at !== 'string') {
				return c.json({ error: 'BAD_REQUEST', message: '每条笔记必须包含 updated_at 时间戳' }, 400);
			}
		}

		const existingNotes = await NoteRepo.findByIds(
			c.env.DB,
			notes.map((n) => n.id),
		);
		const existingMap = new Map(existingNotes.map((n) => [n.id, n]));

		const notesToInsert: Note[] = [];
		const notesToUpdate: Note[] = [];
		const notesToSkip: string[] = [];

		for (const note of notes) {
			const existing = existingMap.get(note.id);
			if (!existing) {
				notesToInsert.push(note);
			} else {
				const clientTime = new Date(note.updated_at).getTime();
				const serverTime = new Date(existing.updated_at).getTime();

				if (clientTime > serverTime) {
					notesToUpdate.push(note);
				} else {
					notesToSkip.push(note.id);
				}
			}
		}

		console.warn(`[Batch] Insert: ${notesToInsert.length}, Update: ${notesToUpdate.length}, Skip: ${notesToSkip.length}`);

		if (notesToInsert.length > 0) {
			await NoteRepo.insertMany(c.env.DB, notesToInsert);
		}
		if (notesToUpdate.length > 0) {
			await NoteRepo.updateMany(c.env.DB, notesToUpdate);
		}

		return c.json({
			success: true,
			insertedCount: notesToInsert.length,
			updatedCount: notesToUpdate.length,
			skippedCount: notesToSkip.length,
			skippedIds: notesToSkip,
		});
	} catch (error) {
		console.error('Batch upsert error:', error);
		return c.json({ error: 'BAD_REQUEST', message: '请求数据格式错误' }, 400);
	}
});

export default notes;
