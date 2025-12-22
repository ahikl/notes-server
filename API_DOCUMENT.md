# Notes Server API 文档

本文档描述了Notes Server提供的RESTful API接口。

## 基础信息

- **基础URL**: `/api/notes`
- **认证方式**: Bearer Token (在请求头中设置 `Authorization: Bearer YOUR_API_KEY`)

## 认证

所有API端点都需要在请求头中包含有效的API密钥：

```
Authorization: Bearer YOUR_API_KEY
```

## API 端点

### 1. 导出所有笔记

#### 请求

```
GET /api/notes/export/all
```

#### 响应

```json
{
	"success": true,
	"timestamp": "2023-01-01T00:00:00.000Z",
	"count": 10,
	"data": [
		{
			"id": 1,
			"title": "笔记标题",
			"content": "笔记内容",
			"created_at": "2023-01-01T00:00:00.000Z",
			"updated_at": "2023-01-01T00:00:00.000Z"
		}
	]
}
```

#### 响应头

- `Content-Disposition: attachment; filename="notes_backup.json"`

### 2. 获取笔记列表（分页）

#### 请求

```
GET /api/notes/?page=1&limit=20&search=关键词
```

#### 查询参数

| 参数名 | 类型    | 必需 | 描述                        |
| ------ | ------- | ---- | --------------------------- |
| page   | integer | 否   | 页码，默认为1               |
| limit  | integer | 否   | 每页记录数，默认20，最大100 |
| search | string  | 否   | 搜索关键词                  |

#### 响应

```json
{
	"total": 100,
	"data": [
		{
			"id": 1,
			"title": "笔记标题",
			"created_at": "2023-01-01T00:00:00.000Z",
			"updated_at": "2023-01-01T00:00:00.000Z"
		}
	],
	"page": 1,
	"limit": 20
}
```

### 3. 获取笔记详情

#### 请求

```
GET /api/notes/{id}
```

#### 路径参数

| 参数名 | 类型    | 必需 | 描述   |
| ------ | ------- | ---- | ------ |
| id     | integer | 是   | 笔记ID |

#### 响应

```json
{
	"id": 1,
	"title": "笔记标题",
	"content": "笔记内容",
	"created_at": "2023-01-01T00:00:00.000Z",
	"updated_at": "2023-01-01T00:00:00.000Z"
}
```

### 4. 创建笔记

#### 请求

```
POST /api/notes/
```

#### 请求体

```json
{
	"title": "笔记标题",
	"content": "笔记内容"
}
```

#### 响应

```json
{
	"success": true,
	"id": 1
}
```

### 5. 更新笔记

#### 请求

```
PATCH /api/notes/{id}
```

#### 路径参数

| 参数名 | 类型    | 必需 | 描述   |
| ------ | ------- | ---- | ------ |
| id     | integer | 是   | 笔记ID |

#### 请求体

```json
{
	"title": "更新后的标题",
	"content": "更新后的内容"
}
```

#### 响应

```json
{
	"success": true
}
```

### 6. 删除笔记

#### 请求

```
DELETE /api/notes/{id}
```

#### 路径参数

| 参数名 | 类型    | 必需 | 描述   |
| ------ | ------- | ---- | ------ |
| id     | integer | 是   | 笔记ID |

#### 响应

```json
{
	"success": true
}
```

## 错误响应格式

所有错误响应都遵循以下格式：

```json
{
	"error": "错误信息"
}
```

常见的HTTP状态码：

- `400`: 请求参数错误
- `401`: 未授权访问（缺少或无效的API密钥）
- `404`: 请求的资源不存在
- `500`: 服务器内部错误
