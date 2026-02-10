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
  "content": string;      // 笔记内容（Base64编码的加密数据）
  "iv": string;           // 初始化向量（Base64编码，可选）
  "auth_tag": string;     // 认证标签（Base64编码，可选）
  "is_encrypted": number; // 是否加密 (0: 未加密, 1: 已加密，默认1)
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
	"content": "YmFzZTY0RW5jb2RlZEVuY3J5cHRlZENvbnRlbnQ9",
	"iv": "YmFzZTY0RW5jb2RlZElWPQ==",
	"auth_tag": "YmFzZTY0RW5jb2RlZEF1dGhUYWc9",
	"is_encrypted": 1,
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
	"content": "YmFzZTY0RW5jb2RlZEVuY3J5cHRlZENvbnRlbnQ9",
	"iv": "YmFzZTY0RW5jb2RlZElWPQ==",
	"auth_tag": "YmFzZTY0RW5jb2RlZEF1dGhUYWc9",
	"is_encrypted": 1
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
    "content": "YmFzZTY0RW5jb2RlZEVuY3J5cHRlZENvbnRlbnQ9",
    "iv": "YmFzZTY0RW5jb2RlZElWPQ==",
    "auth_tag": "YmFzZTY0RW5jb2RlZEF1dGhUYWc9",
    "is_encrypted": 1
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
	"content": "dXBkYXRlZEJhc2U2NEVuY29kZWRDb250ZW50",
	"iv": "dXBkYXRlZEJhc2U2NEVuY29kZWRJVg==",
	"auth_tag": "dXBkYXRlZEJhc2U2NEVuY29kZWRBdXRoVGFn",
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

### 6. 批量删除笔记

**DELETE** `/api/notes/batch`

#### 请求体

```json
{
	"ids": ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"]
}
```

#### 请求示例

```bash
curl -X DELETE \
  "https://your-domain.com/api/notes/batch" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001"
    ]
  }'
```

#### 响应示例

```json
{
	"success": true,
	"deletedCount": 2
}
```

### 7. 笔记同步

**POST** `/api/notes/sync`

#### 请求体

```json
{
	"clientNotes": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "笔记标题",
			"content": "Y2xpZW50Tm90ZUJhc2U2NEVuY29kZWRDb250ZW50",
			"iv": "Y2xpZW50Tm90ZUJhc2U2NEVuY29kZWRJVg==",
			"auth_tag": "Y2xpZW50Tm90ZUJhc2U2NEVuY29kZWRBdXRoVGFn",
			"is_encrypted": 1,
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
        "content": "Y2xpZW50Tm90ZUJhc2U2NEVuY29kZWRDb250ZW50",
        "iv": "Y2xpZW50Tm90ZUJhc2U2NEVuY29kZWRJVg==",
        "auth_tag": "Y2xpZW50Tm90ZUJhc2U2NEVuY29kZWRBdXRoVGFn",
        "is_encrypted": 1,
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
			"content": "c2VydmVyTm90ZUJhc2U2NEVuY29kZWRDb250ZW50",
			"iv": "c2VydmVyTm90ZUJhc2U2NEVuY29kZWRJVg==",
			"auth_tag": "c2VydmVyTm90ZUJhc2U2NEVuY29kZWRBdXRoVGFn",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T07:00:00.000Z"
		}
	],
	"syncedIds": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

### 8. 导出所有笔记

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
			"content": "bm90ZTFCYXNlNjRFbmNvZGVkQ29udGVudA==",
			"iv": "bm90ZTFCYXNlNjRFbmNvZGVkSVY=",
			"auth_tag": "bm90ZTFCYXNlNjRFbmNvZGVkQXV0aFRhZw==",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T05:43:29.724Z"
		}
	]
}
```

### 9. 批量插入或更新笔记

**POST** `/api/notes/batch`

#### 请求体

```json
{
	"notes": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "笔记标题",
			"content": "Ymxvd0ZpZWxkQmFzZTY0RW5jb2RlZENvbnRlbnQ=",
			"iv": "Ymxvd0ZpZWxkQmFzZTY0RW5jb2RlZElW",
			"auth_tag": "Ymxvd0ZpZWxkQmFzZTY0RW5jb2RlZEF1dGhUYWc=",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T05:43:29.724Z"
		},
		{
			"id": "550e8400-e29b-41d4-a716-446655440001",
			"title": "另一个笔记",
			"content": "YW5vdGhlckJhc2U2NEVuY29kZWRDb250ZW50",
			"iv": "YW5vdGhlckJhc2U2NEVuY29kZWRJVg==",
			"auth_tag": "YW5vdGhlckJhc2U2NEVuY29kZWRBdXRoVGFn",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T05:43:29.724Z"
		}
	]
}
```

#### 请求示例

```bash
curl -X POST \
  "https://your-domain.com/api/notes/batch" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "批量插入的笔记",
        "content": "Ymxvd0ZpZWxkQmFzZTY0RW5jb2RlZENvbnRlbnQ=",
        "iv": "Ymxvd0ZpZWxkQmFzZTY0RW5jb2RlZElW",
        "auth_tag": "Ymxvd0ZpZWxkQmFzZTY0RW5jb2RlZEF1dGhUYWc=",
        "is_encrypted": 1,
        "created_at": "2025-12-24T05:43:29.724Z",
        "updated_at": "2025-12-24T05:43:29.724Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "另一个批量插入的笔记",
        "content": "YW5vdGhlckJhc2U2NEVuY29kZWRDb250ZW50",
        "iv": "YW5vdGhlckJhc2U2NEVuY29kZWRJVg==",
        "auth_tag": "YW5vdGhlckJhc2U2NEVuY29kZWRBdXRoVGFn",
        "is_encrypted": 1,
        "created_at": "2025-12-24T05:43:29.724Z",
        "updated_at": "2025-12-24T05:43:29.724Z"
      }
    ]
  }'
```

#### 响应示例

```json
{
	"success": true,
	"insertedUpdatedCount": 2
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
  id           TEXT PRIMARY KEY NOT NULL,
  title        TEXT             NOT NULL,
  content      BLOB             NOT NULL,
  iv           BLOB,
  auth_tag     BLOB,
  is_encrypted INTEGER          NOT NULL DEFAULT 1,
  is_deleted   INTEGER          NOT NULL DEFAULT 0,
  created_at   TEXT             NOT NULL,
  updated_at   TEXT             NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_title ON notes (title);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes (is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted_updated_at ON notes (is_deleted, updated_at DESC);
```
