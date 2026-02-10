import { Hono } from 'hono';
import { cors } from 'hono/cors';
import noteRoutes from './routes';

/**
 * 环境绑定定义
 */
export interface Env {
	DB: D1Database;
	API_KEY: string;
}

/**
 * 笔记数据结构定义
 */
export interface Note {
	id: string;
	title: string;
	content: string; // Base64编码的二进制数据
	iv?: string; // Base64编码的IV（初始化向量）
	auth_tag?: string; // Base64编码的认证标签
	is_encrypted: number;
	is_deleted: number;
	created_at: string;
	updated_at: string;
}

/**
 * 分页返回结构定义
 */
export interface PaginatedResult<T> {
	total: number;
	data: T[];
	page: number;
	limit: number;
}

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors());
app.route('/api/notes', noteRoutes);
app.onError((err, c) =>
	c.json(
		{
			success: false,
			error: err.name || 'InternalError',
			message: err.message || '服务器内部错误',
			timestamp: new Date().toISOString(),
		},
		500,
	),
);

// 4. 404 处理
app.notFound((c) =>
	c.json(
		{
			success: false,
			error: 'NOT_FOUND',
			message: '请求的资源不存在',
		},
		404,
	),
);

export default {
	fetch: app.fetch,

	/**
	 * 处理定时任务 (Cron Trigger)
	 */
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		console.warn(`[Scheduled Task] 启动时间: ${new Date().toISOString()} | 触发规则: ${event.cron}`);
		ctx.waitUntil(cleanupExpiredNotes(env));
	},
};

/**
 * 辅助函数：清理 30 天前的软删除笔记
 */
async function cleanupExpiredNotes(env: Env) {
	try {
		const RETENTION_DAYS = 30;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
		const cutoffString = cutoffDate.toISOString();
		const result = await env.DB.prepare(
			`
      DELETE FROM notes
      WHERE is_deleted = 1
      AND updated_at < ?
    `,
		)
			.bind(cutoffString)
			.run();

		if (result.meta.changes > 0) {
			console.warn(`[Cleanup Success] 清理了 ${result.meta.changes} 条超过 ${RETENTION_DAYS} 天的软删除笔记。`);
		} else {
			console.warn(`[Cleanup Info] 无需清理的数据。`);
		}
	} catch (err: unknown) {
		console.error(`[Cleanup Error] 清理任务执行失败: ${(err as Error).message}`);
	}
}
