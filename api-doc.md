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

### 7. 同步相关接口

同步接口支持两种使用模式：

- **聚合模式**：使用 `/api/notes/sync` 一次性完成所有同步操作
- **细粒度模式**：使用子接口分别获取增量更新、删除列表、恢复列表等

#### 7.1 聚合同步接口

**POST** `/api/notes/sync`

基于增量时间戳的双向删除状态同步策略，一次性返回所有需要同步的数据（更新、删除、恢复）。

##### 请求体

```json
{
	"localNoteIds": ["note-id-1", "note-id-2", "..."],
	"localDeletedNoteIds": ["note-id-2"],
	"lastSyncTimestamp": "2025-01-01T00:00:00.000Z"
}
```

| 字段                | 类型     | 必填 | 描述                                           |
| ------------------- | -------- | ---- | ---------------------------------------------- |
| localNoteIds        | string[] | 是   | 客户端当前拥有的所有笔记ID数组（包括已删除的） |
| localDeletedNoteIds | string[] | 否   | 客户端标记为已删除的笔记ID数组                 |
| lastSyncTimestamp   | string   | 是   | 客户端上次同步的时间戳（ISO 8601格式）         |

##### 请求示例

```bash
curl -X POST \
  "https://your-domain.com/api/notes/sync" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "localNoteIds": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002"
    ],
    "localDeletedNoteIds": [
      "550e8400-e29b-41d4-a716-446655440002"
    ],
    "lastSyncTimestamp": "2025-01-01T00:00:00.000Z"
  }'
```

##### 响应示例

```json
{
	"success": true,
	"toUpdate": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440003",
			"title": "服务器新增笔记",
			"content": "c2VydmVyTm90ZUJhc2U2NEVuY29kZWRDb250ZW50",
			"iv": "c2VydmVyTm90ZUJhc2U2NEVuY29kZWRJVg==",
			"auth_tag": "c2VydmVyTm90ZUJhc2U2NEVuY29kZWRBdXRoVGFn",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T07:00:00.000Z"
		}
	],
	"toDelete": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440001",
			"is_deleted": 1,
			"updated_at": "2025-12-24T07:30:00.000Z"
		}
	],
	"toRestore": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440002",
			"title": "需要恢复的笔记",
			"content": "cmVzdG9yZU5vdGVCYXNlNjRFbmNvZGVkQ29udGVudA==",
			"iv": "cmVzdG9yZU5vdGVCYXNlNjRFbmNvZGVkSVY=",
			"auth_tag": "cmVzdG9yZU5vdGVCYXNlNjRFbmNvZGVkQXV0aFRhZw==",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T06:00:00.000Z"
		}
	],
	"serverNoteCount": 9,
	"syncTimestamp": "2025-12-24T08:00:00.000Z"
}
```

##### 响应字段说明

| 字段            | 类型    | 描述                                                                     |
| --------------- | ------- | ------------------------------------------------------------------------ |
| success         | boolean | 同步是否成功                                                             |
| toUpdate        | Array   | 需要客户端更新的完整笔记数据列表（服务端有更新或新增的笔记）             |
| toDelete        | Array   | 需要客户端删除的笔记元数据列表，格式为 `{id, is_deleted: 1, updated_at}` |
| toRestore       | Array   | 需要客户端恢复的完整笔记数据列表（客户端已删除但服务端未删除的笔记）     |
| serverNoteCount | number  | 服务端当前未删除的笔记总数                                               |
| syncTimestamp   | string  | 本次同步时间戳，客户端应保存用于下次同步                                 |

##### 同步场景处理

| 场景                       | 服务端处理       | 返回字段    | 客户端处理         |
| -------------------------- | ---------------- | ----------- | ------------------ |
| 客户端已删除，服务端未删除 | 返回完整笔记数据 | `toRestore` | 恢复本地笔记       |
| 客户端未删除，服务端已删除 | 返回删除标记     | `toDelete`  | 同步删除状态到本地 |
| 时间戳后有更新且未删除     | 返回完整笔记数据 | `toUpdate`  | 更新本地内容       |
| 服务端有，客户端没有       | 返回完整笔记数据 | `toUpdate`  | 插入本地           |
| 客户端有，服务端没有       | 不在响应中       | -           | 客户端上传         |

---

#### 7.2 增量更新查询

**POST** `/api/notes/sync/incremental`

获取指定时间戳之后有更新的笔记（仅包含客户端已拥有的笔记，且未删除）。

##### 请求体

```json
{
	"lastSyncTimestamp": "2025-01-01T00:00:00.000Z",
	"localNoteIds": ["note-id-1", "note-id-2"]
}
```

| 字段              | 类型     | 必填 | 描述                           |
| ----------------- | -------- | ---- | ------------------------------ |
| lastSyncTimestamp | string   | 是   | 上次同步时间戳（ISO 8601格式） |
| localNoteIds      | string[] | 是   | 客户端拥有的笔记ID数组         |

##### 响应示例

```json
{
	"success": true,
	"notes": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "更新的笔记",
			"content": "...",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T07:00:00.000Z"
		}
	],
	"count": 1
}
```

---

#### 7.3 删除同步

**POST** `/api/notes/sync/deletions`

获取服务端已删除但客户端未删除的笔记列表（需要通知客户端删除）。

##### 请求体

```json
{
	"localNoteIds": ["note-id-1", "note-id-2"],
	"localDeletedNoteIds": ["note-id-2"]
}
```

| 字段                | 类型     | 必填 | 描述                     |
| ------------------- | -------- | ---- | ------------------------ |
| localNoteIds        | string[] | 是   | 客户端拥有的笔记ID数组   |
| localDeletedNoteIds | string[] | 是   | 客户端已删除的笔记ID数组 |

##### 响应示例

```json
{
	"success": true,
	"deletions": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440001",
			"is_deleted": 1,
			"updated_at": "2025-12-24T07:30:00.000Z"
		}
	],
	"count": 1
}
```

---

#### 7.4 恢复同步

**POST** `/api/notes/sync/restore`

获取客户端已删除但服务端未删除的笔记ID列表（需要通知客户端恢复）。

##### 请求体

```json
{
	"localNoteIds": ["note-id-1", "note-id-2"],
	"localDeletedNoteIds": ["note-id-2"]
}
```

| 字段                | 类型     | 必填 | 描述                     |
| ------------------- | -------- | ---- | ------------------------ |
| localNoteIds        | string[] | 是   | 客户端拥有的笔记ID数组   |
| localDeletedNoteIds | string[] | 是   | 客户端已删除的笔记ID数组 |

##### 响应示例

```json
{
	"success": true,
	"restoreIds": ["550e8400-e29b-41d4-a716-446655440002"],
	"count": 1
}
```

---

#### 7.5 新增笔记查询

**POST** `/api/notes/sync/new`

获取服务端有但客户端没有的笔记ID列表（服务端新增或客户端从未同步过的笔记）。

##### 请求体

```json
{
	"localNoteIds": ["note-id-1", "note-id-2"]
}
```

| 字段         | 类型     | 必填 | 描述                   |
| ------------ | -------- | ---- | ---------------------- |
| localNoteIds | string[] | 是   | 客户端拥有的笔记ID数组 |

##### 响应示例

```json
{
	"success": true,
	"newNoteIds": ["550e8400-e29b-41d4-a716-446655440003", "550e8400-e29b-41d4-a716-446655440004"],
	"count": 2
}
```

---

#### 7.6 完整数据获取

**POST** `/api/notes/sync/full-data`

根据ID列表批量获取笔记的完整数据。

##### 请求体

```json
{
	"ids": ["note-id-1", "note-id-2", "note-id-3"]
}
```

| 字段 | 类型     | 必填 | 描述                         |
| ---- | -------- | ---- | ---------------------------- |
| ids  | string[] | 是   | 需要获取完整数据的笔记ID数组 |

##### 响应示例

```json
{
	"success": true,
	"notes": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"title": "笔记标题",
			"content": "...",
			"is_encrypted": 1,
			"created_at": "2025-12-24T05:43:29.724Z",
			"updated_at": "2025-12-24T07:00:00.000Z"
		}
	],
	"count": 1
}
```

---

#### 7.7 同步状态查询

**POST** `/api/notes/sync/status`

获取客户端与服务端的状态差异统计信息，用于评估同步需求。

##### 请求体

```json
{
	"localNoteIds": ["note-id-1", "note-id-2"],
	"localDeletedNoteIds": ["note-id-2"]
}
```

| 字段                | 类型     | 必填 | 描述                     |
| ------------------- | -------- | ---- | ------------------------ |
| localNoteIds        | string[] | 是   | 客户端拥有的笔记ID数组   |
| localDeletedNoteIds | string[] | 是   | 客户端已删除的笔记ID数组 |

##### 响应示例

```json
{
	"success": true,
	"serverNoteCount": 10,
	"clientHasServerMissing": 2,
	"serverHasClientMissing": 3,
	"deleteStatusMismatch": 1
}
```

##### 响应字段说明

| 字段                   | 类型   | 描述                                       |
| ---------------------- | ------ | ------------------------------------------ |
| serverNoteCount        | number | 服务端当前未删除的笔记总数                 |
| clientHasServerMissing | number | 客户端有但服务端没有的笔记数量             |
| serverHasClientMissing | number | 服务端有但客户端没有的笔记数量（新增笔记） |
| deleteStatusMismatch   | number | 删除状态不一致的笔记数量                   |

---

#### 细粒度同步流程示例

客户端可以选择使用细粒度接口进行更灵活的同步控制：

```bash
# 1. 首先查询状态，评估同步需求
curl -X POST "/api/notes/sync/status" -d '{
  "localNoteIds": ["id1", "id2"],
  "localDeletedNoteIds": ["id2"]
}'

# 2. 获取增量更新（已有笔记的更新）
curl -X POST "/api/notes/sync/incremental" -d '{
  "lastSyncTimestamp": "2025-01-01T00:00:00Z",
  "localNoteIds": ["id1", "id2"]
}'

# 3. 获取新增笔记ID
curl -X POST "/api/notes/sync/new" -d '{
  "localNoteIds": ["id1", "id2"]
}'

# 4. 获取新增笔记的完整数据
curl -X POST "/api/notes/sync/full-data" -d '{
  "ids": ["new-id1", "new-id2"]
}'

# 5. 获取需要删除的笔记
curl -X POST "/api/notes/sync/deletions" -d '{
  "localNoteIds": ["id1", "id2"],
  "localDeletedNoteIds": ["id2"]
}'

# 6. 获取需要恢复的笔记ID
curl -X POST "/api/notes/sync/restore" -d '{
  "localNoteIds": ["id1", "id2"],
  "localDeletedNoteIds": ["id2"]
}'

# 7. 获取恢复笔记的完整数据
curl -X POST "/api/notes/sync/full-data" -d '{
  "ids": ["restore-id1"]
}'
```

### 8. 导出所有笔记

**GET** `/api/notes/export/all`

导出所有未删除的笔记（完整数据），用于数据备份。

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

基于**时间戳优先原则**的批量同步接口。服务端会比较客户端笔记与服务端笔记的 `updated_at` 时间戳，仅当客户端时间戳较新时才更新服务端数据，避免覆盖服务端的删除状态或其他更新。

#### 请求体

| 字段  | 类型  | 必填 | 描述                                                                  |
| ----- | ----- | ---- | --------------------------------------------------------------------- |
| notes | Array | 是   | 笔记对象数组，每条笔记必须包含 `id`、`title`、`content`、`updated_at` |

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

#### 同步策略

服务端按照以下规则处理每条笔记：

| 场景                                   | 服务端处理     | 说明                           |
| -------------------------------------- | -------------- | ------------------------------ |
| 笔记在服务端不存在                     | 插入新笔记     | 新增数据                       |
| 客户端 updated_at > 服务端 updated_at  | 更新服务端笔记 | 客户端数据较新，覆盖服务端     |
| 客户端 updated_at <= 服务端 updated_at | 跳过更新       | 服务端数据较新，保留服务端版本 |

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
	"insertedCount": 1,
	"updatedCount": 1,
	"skippedCount": 0,
	"skippedIds": []
}
```

#### 响应字段说明

| 字段          | 类型     | 描述                                                             |
| ------------- | -------- | ---------------------------------------------------------------- |
| success       | boolean  | 操作是否成功                                                     |
| insertedCount | number   | 新插入的笔记数量                                                 |
| updatedCount  | number   | 更新的笔记数量（客户端时间戳较新）                               |
| skippedCount  | number   | 跳过的笔记数量（服务端时间戳较新）                               |
| skippedIds    | string[] | 被跳过的笔记ID列表，客户端应在后续同步中拉取这些笔记的服务端版本 |

#### 客户端处理建议

1. **上传前**：确保每条笔记都有准确的 `updated_at` 时间戳
2. **收到响应后**：检查 `skippedIds`，对这些笔记调用 `/api/notes/sync` 接口拉取服务端版本
3. **冲突解决**：如果笔记被跳过，说明服务端有更新，客户端应使用同步接口获取最新状态

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
