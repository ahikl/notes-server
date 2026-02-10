import { Hono } from 'hono';
import { Env, Note } from '../index';
import { NoteRepo } from '../db/';

const notes = new Hono<{ Bindings: Env }>();

// 鉴权
notes.use('*', async (c, next) => {
	const authHeader = c.req.header('Authorization');
	const EXPECTED_KEY = c.env.API_KEY;
	if (!EXPECTED_KEY || authHeader !== `Bearer ${EXPECTED_KEY}`) {
		return c.json({ error: 'Unauthorized', message: 'API Key 无效' }, 401);
	}
	return next();
});

// 导出所有笔记
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

// 获取笔记标题列表
notes.get('/', async (c) => {
	const search = c.req.query('search');
	const page = Math.max(1, parseInt(c.req.query('page') || '1'));
	const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '20')));
	const result_1 = await NoteRepo.findAll(c.env.DB, { search, page, limit });
	return c.json(result_1);
});

// 获取笔记详情
notes.get('/:id', async (c) => {
	const id = c.req.param('id');
	const note = await NoteRepo.findById(c.env.DB, id);
	return note ? c.json(note) : c.json({ error: 'Note not found', message: '笔记未找到' }, 404);
});

// 创建笔记
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

// 更新笔记
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

// 批量删除笔记 - 必须放在 /:id 路由之前
notes.delete('/batch', async (c) => {
	try {
		const { ids }: { ids: string[] } = await c.req.json();

		if (!Array.isArray(ids) || ids.length === 0) {
			return c.json({ error: 'BAD_REQUEST', message: 'ID列表不能为空' }, 400);
		}

		// 验证每个ID是否为有效字符串
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

// 删除单条笔记 - 放在 /batch 路由之后
notes.delete('/:id', async (c) => {
	const id = c.req.param('id');
	await NoteRepo.delete(c.env.DB, id);
	return c.json({ success: true });
});

// 同步笔记接口
notes.post('/sync', async (c) => {
	try {
		const { clientNotes, deletedIds }: { clientNotes: Note[]; deletedIds?: string[] } = await c.req.json();
		if (!Array.isArray(clientNotes)) {
			return c.json({ error: 'Invalid request', message: 'clientNotes must be an array' }, 400);
		}

		// 处理客户端已删除的笔记
		let syncDeletedCount = 0;
		if (deletedIds && Array.isArray(deletedIds) && deletedIds.length > 0) {
			// 验证每个ID是否为有效字符串
			const validIds = deletedIds.filter((id) => typeof id === 'string' && id.trim());
			if (validIds.length > 0) {
				syncDeletedCount = await NoteRepo.deleteMany(c.env.DB, validIds);
			}
		}

		// 获取服务器上已存在的笔记
		const clientNoteIds = clientNotes.map((note) => note.id).filter((id) => id);
		const serverNotes = clientNoteIds.length > 0 ? await NoteRepo.findByIds(c.env.DB, clientNoteIds) : [];

		// 将服务器笔记转换为以ID为键的对象，便于查找
		const serverNotesMap = new Map(serverNotes.map((note) => [note.id, note]));

		// 用于存储需要上传到服务器的笔记
		const toUpload: Note[] = [];
		// 用于存储需要下载到客户端的笔记
		const toDownload: Note[] = [];

		for (const clientNote of clientNotes) {
			const serverNote = serverNotesMap.get(clientNote.id);

			if (!serverNote) {
				// 客户端有但服务器没有的笔记，直接上传
				toUpload.push(clientNote);
			} else {
				// 比较更新时间，决定是否需要上传或下载
				const clientUpdatedTime = new Date(clientNote.updated_at).getTime();
				const serverUpdatedTime = new Date(serverNote.updated_at).getTime();

				if (clientUpdatedTime > serverUpdatedTime) {
					// 客户端更新，需要上传到服务器
					toUpload.push(clientNote);
				} else if (serverUpdatedTime > clientUpdatedTime) {
					// 服务器更新，需要下载到客户端
					toDownload.push(serverNote);
				}
				// 如果更新时间相同，则无需操作
			}
		}

		// 将需要上传的笔记保存到服务器
		if (toUpload.length > 0) {
			await NoteRepo.upsertMany(c.env.DB, toUpload);
		}

		// 返回需要下载的笔记和同步成功的ID列表
		const syncedIds = [...toUpload, ...clientNotes.filter((note) => !serverNotesMap.has(note.id))].map((note) => note.id);

		return c.json({
			success: true,
			updates: toDownload,
			syncedIds: syncedIds,
			deletedCount: syncDeletedCount,
		});
	} catch (error) {
		console.error('Sync error:', error);
		return c.json({ error: 'Sync failed', message: '同步失败' }, 500);
	}
});

// 批量插入或更新笔记
notes.post('/batch', async (c) => {
	try {
		const { notes }: { notes: Note[] } = await c.req.json();

		if (!Array.isArray(notes) || notes.length === 0) {
			return c.json({ error: 'BAD_REQUEST', message: '笔记列表不能为空' }, 400);
		}

		// 验证每条笔记数据
		for (const note of notes) {
			if (!note.id || !note.title || note.content === undefined) {
				return c.json({ error: 'BAD_REQUEST', message: '每条笔记必须包含ID、标题和内容' }, 400);
			}

			// 验证ID格式（基本验证）
			if (typeof note.id !== 'string' || !note.id.trim()) {
				return c.json({ error: 'BAD_REQUEST', message: '笔记ID必须为非空字符串' }, 400);
			}

			// 验证标题和内容
			if (typeof note.title !== 'string' || typeof note.content !== 'string') {
				return c.json({ error: 'BAD_REQUEST', message: '笔记标题和内容必须为字符串' }, 400);
			}
		}

		await NoteRepo.upsertMany(c.env.DB, notes);
		return c.json({ success: true, insertedUpdatedCount: notes.length });
	} catch (error) {
		console.error('Batch upsert error:', error);
		return c.json({ error: 'BAD_REQUEST', message: '请求数据格式错误' }, 400);
	}
});

export default notes;
