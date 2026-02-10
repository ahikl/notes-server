import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Notes Server worker', () => {
	it('responds with not found for root path (unit style)', async () => {
		const request = new IncomingRequest('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404); // 应用程序应返回404，因为我们没有根路由
		expect(await response.json()).toEqual({
			success: false,
			error: 'NOT_FOUND',
			message: '请求的资源不存在',
		});
	});

	it('responds with not found for root path (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			success: false,
			error: 'NOT_FOUND',
			message: '请求的资源不存在',
		});
	});

	it('should have the notes route', async () => {
		const request = new IncomingRequest('http://example.com/api/notes');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		// 不带认证头应该返回401
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: 'Unauthorized',
			message: 'API Key 无效',
		});
	});

	it('should support batch delete endpoint', async () => {
		const fakeEnv = { ...env, API_KEY: 'test-api-key' };
		const request = new IncomingRequest('http://example.com/api/notes/batch', {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer test-api-key',
			},
			body: JSON.stringify({ ids: ['test-id-1', 'test-id-2'] }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, fakeEnv, ctx);
		await waitOnExecutionContext(ctx);

		// 由于我们只是测试路由是否存在，而不是实际的数据库操作，
		// 我们期望它至少不会返回404，而是其他状态码
		expect(response.status).not.toBe(404);
	});

	it('should support batch insert/update endpoint', async () => {
		const fakeEnv = { ...env, API_KEY: 'test-api-key' };
		const sampleNotes = [
			{
				id: 'test-note-1',
				title: 'Test Note 1',
				content: 'Test Content 1',
				is_encrypted: 0,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
			{
				id: 'test-note-2',
				title: 'Test Note 2',
				content: 'Test Content 2',
				is_encrypted: 1,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			},
		];
		const request = new IncomingRequest('http://example.com/api/notes/batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer test-api-key',
			},
			body: JSON.stringify({ notes: sampleNotes }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, fakeEnv, ctx);
		await waitOnExecutionContext(ctx);

		// 由于我们只是测试路由是否存在，而不是实际的数据库操作，
		// 我们期望它至少不会返回404，而是其他状态码
		expect(response.status).not.toBe(404);
	});
});
