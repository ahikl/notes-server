import { Hono } from 'hono';
import { Env } from '../index';
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
notes.get('/', (c) => {
	const search = c.req.query('search');
	const page = Math.max(1, parseInt(c.req.query('page') || '1'));
	const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '20')));
	return NoteRepo.findAll(c.env.DB, { search, page, limit }).then((result) => c.json(result));
});

// 获取笔记详情
notes.get('/:id', (c) => {
	const id = c.req.param('id');
	return NoteRepo.findById(c.env.DB, id).then((note) =>
		note ? c.json(note) : c.json({ error: 'Note not found', message: '笔记未找到' }, 404),
	);
});

// 创建笔记
notes.post('/', async (c) => {
	const body = await c.req.json();
	if (!body.title || !body.content) {
		return c.json({ error: 'BAD_REQUEST', message: '标题和内容不能为空' }, 400);
	} // 生成 ISO 8601 格式的当前时间
	const now = new Date().toISOString();
	const noteData = {
		...body,
		created_at: now,
		updated_at: now,
	};
	await NoteRepo.create(c.env.DB, noteData);
	return c.json({ success: true }, 201);
});

// 更新笔记
notes.patch('/:id', async (c) => {
	const id = c.req.param('id');
	const body = await c.req.json();
	const now = new Date().toISOString();
	const noteData = {
		...body,
		updated_at: now,
	};
	const result = await NoteRepo.update(c.env.DB, id, noteData);
	if (!result) return c.json({ error: 'BAD_REQUEST', message: '没有可更新的字段' }, 400);
	return c.json({ success: true });
});

// 删除笔记
notes.delete('/:id', (c) => {
	const id = c.req.param('id');
	return NoteRepo.delete(c.env.DB, id).then(() => c.json({ success: true }));
});

export default notes;
