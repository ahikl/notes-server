# Notes Server API 文档

## 概述

这是一个用于管理笔记的 RESTful API 服务，使用 Hono 框架构建，支持创建、读取、更新、删除和同步笔记。笔记ID使用UUID格式。

## 基础信息

- **基础 URL**: `/api/notes`
- **认证方式**: Bearer Token (通过 `Authorization` 请求头传递)
- **请求头**: `Authorization: Bearer {API_KEY}`
- **响应格式**: JSON

## 数据结构

### Note 对象

```typescript
{
  "id": string;           // 笔记唯一标识符 (UUID格式)
  "title": string;        // 笔记标题
  "content": string;      // 笔记内容
  "is_encrypted": number; // 是否加密 (0: 未加密, 1: 已加密)
  "created_at": string;   // 创建时间 (ISO 8601 格式)
  "updated_at": string;   // 更新时间 (ISO 8601 格式)
}
```

### 分页响应对象

```typescript
{
  "total": number;        // 总记录数
  "data": Array;          // 数据数组
  "page": number;         // 当前页码
  "limit": number;        // 每页记录数
}
```

## API 端点

### 1. 获取笔记列表

**GET** `/api/notes`

#### 参数

| 参数名 | 类型   | 必填 | 描述                            |
| ------ | ------ | ---- | ------------------------------- |
| search | string | 否   | 按标题搜索笔记                  |
| page   | number | 否   | 页码，默认为 1                  |
| limit  | number | 否   | 每页数量，默认为 20，最大为 100 |

#### 请求示例

```bash
curl -X GET \
  "https://your-domain.com/api/notes?page=1&limit=10&search=test" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 响应示例

```json
{
	"total": 25,
	"data": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "测试笔记",
			"is_encrypted": 0,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T05:43:29.724Z"
		}
	],
	"page": 1,
	"limit": 10
}
```

### 2. 获取笔记详情

**GET** `/api/notes/{id}`

#### 参数

| 参数名 | 类型   | 必填 | 描述                  |
| ------ | ------ | ---- | --------------------- |
| id     | string | 是   | 笔记唯一ID (UUID格式) |

#### 请求示例

```bash
curl -X GET \
  "https://your-domain.com/api/notes/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 响应示例

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"title": "完整笔记",
	"content": "这是笔记的完整内容",
	"is_encrypted": 0,
	"created_at": "2025-12-24T05:43:29.724Z",
	"updated_at": "2025-12-24T06:00:00.000Z"
}
```

### 3. 创建笔记

**POST** `/api/notes`

#### 请求体

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"title": "笔记标题",
	"content": "笔记内容",
	"is_encrypted": 0
}
```

#### 请求示例

```bash
curl -X POST \
  "https://your-domain.com/api/notes" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "新笔记",
    "content": "这是新笔记的内容",
    "is_encrypted": 0
  }'
```

#### 响应示例

```json
{
	"success": true
}
```

### 4. 更新笔记

**PATCH** `/api/notes/{id}`

#### 参数

| 参数名 | 类型   | 必填 | 描述                  |
| ------ | ------ | ---- | --------------------- |
| id     | string | 是   | 笔记唯一ID (UUID格式) |

#### 请求体

```json
{
	"title": "更新后的标题",
	"content": "更新后的内容",
	"is_encrypted": 1
}
```

#### 请求示例

```bash
curl -X PATCH \
  "https://your-domain.com/api/notes/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新标题",
    "content": "更新内容"
  }'
```

#### 响应示例

```json
{
	"success": true
}
```

### 5. 删除笔记

**DELETE** `/api/notes/{id}`

#### 参数

| 参数名 | 类型   | 必填 | 描述                  |
| ------ | ------ | ---- | --------------------- |
| id     | string | 是   | 笔记唯一ID (UUID格式) |

#### 请求示例

```bash
curl -X DELETE \
  "https://your-domain.com/api/notes/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 响应示例

```json
{
	"success": true
}
```

### 6. 笔记同步

**POST** `/api/notes/sync`

#### 请求体

```json
{
	"clientNotes": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "笔记标题",
			"content": "笔记内容",
			"is_encrypted": 0,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T06:00:00.000Z"
		}
	]
}
```

#### 请求示例

```bash
curl -X POST \
  "https://your-domain.com/api/notes/sync" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "clientNotes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "客户端笔记",
        "content": "客户端笔记内容",
        "is_encrypted": 0,
        "created_at": "2025-12-24T05:43:29.724Z",
        "updated_at": "2025-12-24T06:00:00.000Z"
      }
    ]
  }'
```

#### 响应示例

```json
{
	"success": true,
	"updates": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440001",
			"title": "服务器笔记",
			"content": "服务器笔记内容",
			"is_encrypted": 0,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T07:00:00.000Z"
		}
	],
	"syncedIds": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

### 7. 导出所有笔记

**GET** `/api/notes/export/all`

#### 请求示例

```bash
curl -X GET \
  "https://your-domain.com/api/notes/export/all" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 响应示例

```json
{
	"success": true,
	"timestamp": "2025-12-24T05:43:29.724Z",
	"count": 5,
	"data": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "笔记1",
			"content": "内容1",
			"is_encrypted": 0,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T05:43:29.724Z"
		}
	]
}
```

## 错误响应

所有错误响应都遵循以下格式：

```json
{
	"success": false,
	"error": "错误代码",
	"message": "错误消息",
	"timestamp": "ISO 8601 时间戳"
}
```

### 常见错误代码

| HTTP 状态码 | 错误代码      | 描述               |
| ----------- | ------------- | ------------------ |
| 401         | Unauthorized  | API Key 无效       |
| 404         | NOT_FOUND     | 请求的资源不存在   |
| 400         | BAD_REQUEST   | 请求参数错误或缺失 |
| 500         | InternalError | 服务器内部错误     |

## 数据库表结构

```sql
CREATE TABLE notes (
  id           TEXT PRIMARY KEY,  -- 笔记唯一标识符 (UUID格式)
  title        TEXT    NOT NULL,
  content      TEXT    NOT NULL,
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT,
  updated_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_notes_title ON notes (title);
```
