# API接口文档

<cite>
**本文档引用的文件**
- [src/index.ts](file://src/index.ts)
- [src/routes/index.ts](file://src/routes/index.ts)
- [src/db/index.ts](file://src/db/index.ts)
- [api-doc.md](file://api-doc.md)
- [migrations/0001_init_schema.sql](file://migrations/0001_init_schema.sql)
- [wrangler.jsonc](file://wrangler.jsonc)
- [package.json](file://package.json)
- [test/index.spec.ts](file://test/index.spec.ts)
</cite>

## 目录

1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构概览](#架构概览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考虑](#性能考虑)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 简介

Notes Server是一个基于Cloudflare Workers的RESTful API服务，专门用于管理笔记数据。该服务使用Hono框架构建，支持笔记的创建、读取、更新、删除、批量操作、数据同步和数据导出等功能。所有笔记数据均存储在Cloudflare D1数据库中，并采用Base64编码存储加密内容。

## 项目结构

该项目采用模块化架构设计，主要包含以下核心目录和文件：

```mermaid
graph TB
subgraph "项目根目录"
Root[项目根目录]
Src[src/]
Test[test/]
Migrations[migrations/]
Config[配置文件]
end
subgraph "src/ 核心源码"
Index[src/index.ts]
Routes[routes/]
Db[db/]
end
subgraph "src/routes/"
RoutesIndex[routes/index.ts]
end
subgraph "src/db/"
DbIndex[db/index.ts]
end
subgraph "migrations/"
Schema[migrations/0001_init_schema.sql]
end
Root --> Src
Root --> Test
Root --> Migrations
Root --> Config
Src --> Index
Src --> Routes
Src --> Db
Routes --> RoutesIndex
Db --> DbIndex
Migrations --> Schema
```

**图表来源**

- [src/index.ts](file://src/index.ts#L1-L105)
- [src/routes/index.ts](file://src/routes/index.ts#L1-L234)
- [src/db/index.ts](file://src/db/index.ts#L1-L251)

**章节来源**

- [src/index.ts](file://src/index.ts#L1-L105)
- [package.json](file://package.json#L1-L41)

## 核心组件

### 应用入口与环境配置

应用入口位于`src/index.ts`，负责初始化Hono应用、设置CORS中间件、路由注册和全局错误处理。

**核心特性：**

- 使用Hono框架构建轻量级Web应用
- 配置CORS跨域资源共享
- 定义环境绑定接口（D1数据库和API密钥）
- 实现统一的错误处理机制
- 提供定时任务支持（清理过期数据）

### 数据模型定义

系统定义了标准的笔记数据结构，支持加密存储和版本控制：

```mermaid
classDiagram
class Note {
+string id
+string title
+string content
+string iv
+string auth_tag
+number is_encrypted
+number is_deleted
+string created_at
+string updated_at
}
class PaginatedResult {
+number total
+Note[] data
+number page
+number limit
}
class NoteRepo {
+findAll(db, options) PaginatedResult
+findById(db, id) Note
+create(db, data) void
+update(db, id, data) void
+delete(db, id) void
+deleteMany(db, ids) void
+getAllFull(db) Note[]
+upsertMany(db, notes) void
+findByIds(db, ids) Note[]
}
NoteRepo --> Note : "操作"
NoteRepo --> PaginatedResult : "返回"
```

**图表来源**

- [src/index.ts](file://src/index.ts#L16-L36)
- [src/db/index.ts](file://src/db/index.ts#L43-L250)

**章节来源**

- [src/index.ts](file://src/index.ts#L8-L36)

## 架构概览

Notes Server采用分层架构设计，实现了清晰的关注点分离：

```mermaid
graph TB
subgraph "客户端层"
Client[客户端应用]
Mobile[移动应用]
Web[Web应用]
end
subgraph "API网关层"
Hono[Hono框架]
Auth[认证中间件]
CORS[CORS中间件]
end
subgraph "业务逻辑层"
Routes[路由处理器]
Validation[参数验证]
Sync[数据同步引擎]
end
subgraph "数据访问层"
Repo[NoteRepo仓储]
D1[D1数据库]
Migration[数据库迁移]
end
subgraph "基础设施层"
Cloudflare[Cloudflare Workers]
KV[KV存储]
Cron[Cron触发器]
end
Client --> Hono
Mobile --> Hono
Web --> Hono
Hono --> Auth
Hono --> CORS
Hono --> Routes
Routes --> Validation
Routes --> Sync
Routes --> Repo
Repo --> D1
D1 --> Migration
Cloudflare --> Hono
Cloudflare --> Repo
Cloudflare --> Cron
```

**图表来源**

- [src/index.ts](file://src/index.ts#L38-L75)
- [src/routes/index.ts](file://src/routes/index.ts#L5-L15)
- [src/db/index.ts](file://src/db/index.ts#L43-L250)

## 详细组件分析

### 认证机制

系统采用简单的Bearer Token认证机制，确保API调用的安全性：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Middleware as 认证中间件
participant Handler as 路由处理器
participant DB as 数据库
Client->>Middleware : 发送请求(含Authorization头)
Middleware->>Middleware : 验证API密钥格式
Middleware->>Middleware : 比较期望值与实际值
alt 认证成功
Middleware->>Handler : 继续处理请求
Handler->>DB : 执行数据库操作
DB-->>Handler : 返回结果
Handler-->>Client : 返回响应
else 认证失败
Middleware-->>Client : 返回401错误
end
```

**图表来源**

- [src/routes/index.ts](file://src/routes/index.ts#L8-L15)

认证流程特点：

- 使用`Authorization: Bearer {API_KEY}`头部
- 支持动态API密钥配置
- 全局中间件保护所有路由
- 自动拒绝未认证请求

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L8-L15)

### 笔记CRUD操作

#### 列表查询接口

**GET** `/api/notes`

支持分页查询和搜索功能：

```mermaid
flowchart TD
Start([请求到达]) --> ParseParams["解析查询参数<br/>search, page, limit"]
ParseParams --> ValidateParams["验证参数有效性"]
ValidateParams --> BuildQuery["构建SQL查询<br/>添加WHERE条件"]
BuildQuery --> ExecuteQuery["执行数据库查询<br/>COUNT + SELECT"]
ExecuteQuery --> FormatResponse["格式化响应数据"]
FormatResponse --> End([返回结果])
ValidateParams --> |参数无效| ErrorResponse["返回400错误"]
ErrorResponse --> End
```

**图表来源**

- [src/routes/index.ts](file://src/routes/index.ts#L31-L37)
- [src/db/index.ts](file://src/db/index.ts#L45-L91)

**请求参数：**

- `search`: 可选，按标题或内容搜索
- `page`: 可选，默认1，最小1
- `limit`: 可选，默认20，最大100

**响应格式：**

```json
{
  "total": 25,
  "data": [...],
  "page": 1,
  "limit": 20
}
```

#### 详情查询接口

**GET** `/api/notes/:id`

根据ID获取单个笔记的完整信息，自动进行Base64解码处理。

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L40-L44)
- [src/db/index.ts](file://src/db/index.ts#L94-L97)

#### 创建笔记接口

**POST** `/api/notes`

支持客户端指定创建时间和自动时间验证：

```mermaid
sequenceDiagram
participant Client as 客户端
participant Route as 创建路由
participant Validator as 参数验证器
participant TimeHandler as 时间处理器
participant Repo as NoteRepo
participant DB as 数据库
Client->>Route : POST /api/notes
Route->>Validator : 验证必需字段(title, content)
Validator-->>Route : 验证通过
Route->>TimeHandler : 处理客户端时间戳
TimeHandler-->>Route : 返回标准化时间
Route->>Repo : create(noteData)
Repo->>DB : INSERT语句
DB-->>Repo : 操作成功
Repo-->>Route : 返回结果
Route-->>Client : 201 Created
```

**图表来源**

- [src/routes/index.ts](file://src/routes/index.ts#L47-L82)
- [src/db/index.ts](file://src/db/index.ts#L100-L123)

**请求体字段：**

- `id`: 必需，UUID格式
- `title`: 必需，笔记标题
- `content`: 必需，Base64编码的加密内容
- `iv`: 可选，Base64编码的初始化向量
- `auth_tag`: 可选，Base64编码的认证标签
- `is_encrypted`: 可选，默认1（已加密）
- `created_at`: 可选，客户端创建时间
- `updated_at`: 可选，客户端更新时间

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L47-L82)

#### 更新笔记接口

**PATCH** `/api/notes/:id`

支持部分字段更新和时间戳管理：

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L85-L106)
- [src/db/index.ts](file://src/db/index.ts#L125-L176)

#### 删除笔记接口

**DELETE** `/api/notes/:id`

实现软删除机制，保留数据历史：

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L109-L113)
- [src/db/index.ts](file://src/db/index.ts#L179-L183)

### 批量操作接口

#### 批量删除接口

**DELETE** `/api/notes/batch`

支持一次性删除多个笔记：

```mermaid
flowchart TD
Start([批量删除请求]) --> ParseBody["解析请求体<br/>提取ID数组"]
ParseBody --> ValidateArray["验证数组格式"]
ValidateArray --> ValidateIds["验证每个ID的有效性"]
ValidateIds --> |存在无效ID| ReturnError["返回400错误"]
ValidateIds --> |全部有效| ExecuteDelete["执行批量删除"]
ExecuteDelete --> ReturnSuccess["返回删除成功响应"]
ValidateArray --> |格式错误| ReturnError
```

**图表来源**

- [src/routes/index.ts](file://src/routes/index.ts#L116-L136)

**请求体格式：**

```json
{
	"ids": ["id1", "id2", "id3"]
}
```

**响应格式：**

```json
{
	"success": true,
	"deletedCount": 3
}
```

#### 批量插入/更新接口

**POST** `/api/notes/batch`

支持批量数据导入和更新：

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L199-L231)
- [src/db/index.ts](file://src/db/index.ts#L202-L237)

### 数据同步接口

**POST** `/api/notes/sync`

实现双向数据同步，处理冲突解决：

```mermaid
sequenceDiagram
participant Client as 客户端
participant SyncRoute as 同步路由
participant ServerNotes as 服务器笔记
participant Upsert as 批量插入
participant Response as 响应生成
Client->>SyncRoute : POST /api/notes/sync
SyncRoute->>ServerNotes : 查询服务器现有笔记
ServerNotes-->>SyncRoute : 返回服务器笔记列表
SyncRoute->>SyncRoute : 比较客户端与服务器时间戳
SyncRoute->>Upsert : 批量插入需要上传的笔记
Upsert-->>SyncRoute : 插入完成
SyncRoute->>Response : 生成同步响应
Response-->>Client : 返回需要下载的笔记和同步ID列表
```

**图表来源**

- [src/routes/index.ts](file://src/routes/index.ts#L139-L197)

**同步算法：**

1. 获取客户端提交的笔记列表
2. 查询服务器上对应的笔记
3. 比较每个笔记的更新时间
4. 将需要上传的笔记批量插入
5. 返回需要下载到客户端的笔记

**响应格式：**

```json
{
  "success": true,
  "updates": [...],  // 需要下载的笔记
  "syncedIds": [...] // 同步成功的笔记ID
}
```

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L139-L197)

### 数据导出接口

**GET** `/api/notes/export/all`

提供完整的数据导出功能：

**章节来源**

- [src/routes/index.ts](file://src/routes/index.ts#L18-L28)
- [src/db/index.ts](file://src/db/index.ts#L194-L200)

## 依赖关系分析

### 外部依赖

项目使用以下关键依赖：

```mermaid
graph LR
subgraph "运行时依赖"
Hono[hono ^4.11.1]
D1[D1 Database]
Workers[Cloudflare Workers Runtime]
end
subgraph "开发依赖"
Vitest[vitest ^3.2.0]
Wrangler[wrangler ^4.56.0]
ESLint[eslint ^9.39.2]
Prettier[prettier ^3.7.4]
end
subgraph "项目结构"
PackageJSON[package.json]
WranglerConfig[wrangler.jsonc]
TSConfig[tsconfig.json]
end
PackageJSON --> Hono
PackageJSON --> Vitest
PackageJSON --> Wrangler
PackageJSON --> ESLint
PackageJSON --> Prettier
WranglerConfig --> Workers
WranglerConfig --> D1
TSConfig --> Workers
```

**图表来源**

- [package.json](file://package.json#L32-L34)
- [wrangler.jsonc](file://wrangler.jsonc#L13-L19)

### 内部模块依赖

```mermaid
graph TB
subgraph "核心模块"
App[src/index.ts]
Routes[src/routes/index.ts]
DB[src/db/index.ts]
end
subgraph "数据模型"
Types[src/index.ts中的类型定义]
Interfaces[接口定义]
end
subgraph "配置文件"
EnvConfig[环境配置]
DBConfig[数据库配置]
Migration[数据库迁移]
end
App --> Routes
App --> DB
Routes --> DB
DB --> Types
Routes --> EnvConfig
DB --> DBConfig
App --> Migration
```

**图表来源**

- [src/index.ts](file://src/index.ts#L3-L40)
- [src/routes/index.ts](file://src/routes/index.ts#L1-L5)
- [src/db/index.ts](file://src/db/index.ts#L1-L6)

**章节来源**

- [package.json](file://package.json#L18-L34)

## 性能考虑

### 数据库优化

系统针对D1数据库进行了专门优化：

1. **索引策略**：
   - 标题索引：支持快速搜索
   - 软删除索引：快速过滤已删除笔记
   - 复合索引：按删除状态和更新时间排序

2. **查询优化**：
   - 使用批量查询减少网络往返
   - 分页查询避免大量数据传输
   - 条件查询精确匹配

3. **内存管理**：
   - Base64编码减少存储空间
   - 软删除避免物理删除开销
   - 定时清理过期数据

### 缓存策略

虽然当前实现未使用缓存，但建议考虑：

1. **读缓存**：热门笔记内容缓存
2. **查询缓存**：常用查询结果缓存
3. **元数据缓存**：统计信息缓存

### 并发处理

系统支持高并发请求处理：

1. **异步处理**：所有数据库操作都是异步的
2. **批处理**：批量操作减少事务开销
3. **连接池**：D1自动管理连接池

## 故障排除指南

### 常见错误类型

```mermaid
flowchart TD
Error[API错误] --> AuthError[认证错误]
Error --> ValidationError[验证错误]
Error --> NotFound[资源未找到]
Error --> ServerError[服务器错误]
AuthError --> Unauthorized[401 未授权]
AuthError --> InvalidKey[API密钥无效]
ValidationError --> BadRequest[400 请求错误]
ValidationError --> MissingFields[缺少必要字段]
ValidationError --> InvalidFormat[格式不正确]
NotFound --> ResourceNotFound[资源不存在]
ServerError --> InternalError[500 内部错误]
ServerError --> Timeout[超时]
```

### 错误响应格式

所有错误响应遵循统一格式：

```json
{
	"success": false,
	"error": "错误代码",
	"message": "错误描述",
	"timestamp": "ISO 8601时间戳"
}
```

### 调试技巧

1. **启用日志**：检查Cloudflare Workers日志
2. **参数验证**：确保所有必需字段都已提供
3. **时间戳格式**：使用ISO 8601格式的时间戳
4. **Base64编码**：确保加密内容正确编码

**章节来源**

- [src/index.ts](file://src/index.ts#L41-L63)
- [test/index.spec.ts](file://test/index.spec.ts#L35-L46)

## 结论

Notes Server提供了一个完整、高效且安全的笔记管理API解决方案。其设计特点包括：

1. **安全性**：基于Bearer Token的认证机制
2. **可靠性**：软删除机制和数据备份功能
3. **性能**：针对D1数据库优化的查询和索引
4. **可扩展性**：模块化架构支持功能扩展
5. **易用性**：简洁的RESTful API设计

该系统特别适合构建去中心化的笔记应用，支持多设备同步和数据备份需求。

## 附录

### 数据库表结构

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

### 部署配置

系统使用Cloudflare Workers部署，支持以下配置：

- **运行时**：Node.js 18+兼容
- **数据库**：Cloudflare D1
- **触发器**：定时清理任务
- **可观测性**：内置监控和日志

### 开发工具链

- **测试**：Vitest + Cloudflare Test
- **格式化**：Prettier
- **代码检查**：ESLint
- **构建**：Wrangler CLI
