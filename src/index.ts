import { Hono } from 'hono';
import { cors } from 'hono/cors';
import noteRoutes from './routes';

export interface Env {
	DB: D1Database;
	API_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());
app.route('/api/notes', noteRoutes);

app.onError((err, c) => {
	console.error(`[Global Error] ${c.req.method} ${c.req.url}:`, err);

	return c.json(
		{
			success: false,
			error: err.name || 'InternalError',
			message: err.message || '服务器内部错误',
			timestamp: new Date().toISOString(),
		},
		500,
	);
});

app.notFound((c) => {
	return c.json(
		{
			success: false,
			error: 'NOT_FOUND',
			message: '请求的资源不存在',
		},
		404,
	);
});

export default app;

export interface Note {
	id: number;
	title: string;
	content: string;
	created_at: string;
	updated_at: string;
}

export interface PaginatedResult<T> {
	total: number;
	data: T[];
	page: number;
	limit: number;
}
