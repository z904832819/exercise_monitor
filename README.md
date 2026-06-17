# FitAgent

运动监测智能体 App 原型，包含 React 前端、Express 后端、DeepSeek 智能体服务，以及 LangChain 对接层。

## 启动

```bash
conda activate exercise_monitor
npm install
npm run db:create
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://127.0.0.1:8787

## Docker 一键部署

部署包包含：

- `app`：Node 22 运行 Express API，并直接托管 `dist/` 里的 React 前端
- `postgres`：`pgvector/pgvector:pg16`，用于业务数据和本地 RAG 向量库
- `exercise_monitor_pgdata`：PostgreSQL 数据卷
- `exercise_monitor_uploads`：头像、运动视频、食物图片等上传文件卷

在新服务器上只需要 Docker 和 Docker Compose：

```bash
cp .env.docker.example .env
# 修改 .env 里的 POSTGRES_PASSWORD、DATABASE_URL、RAG_DATABASE_URL 和模型 API Key
docker compose up -d --build
```

访问：

```text
http://服务器IP:8787
```

容器启动时会：

1. 等待 PostgreSQL 健康检查通过
2. 自动创建业务表和 RAG 表
3. 自动索引 `rag/knowledge/*.md`
4. 启动 API 和前端静态服务

常用命令：

```bash
docker compose ps
docker compose logs -f app
docker compose exec postgres pg_dump -U exercise_monitor exercise_monitor > exercise_monitor_backup.sql
docker compose down
```

如果你暂时没有模型 API Key，`.env` 保持 `AGENT_AUTH_MODE=off` 也能启动，接口会返回本地 fallback 结果。需要 AI 能力时改为 `AGENT_AUTH_MODE=api-key` 并配置对应供应商。

## 模型配置（参考 ccswitch 风格）

你可以用一个环境变量定义多个供应商，或直接用各厂商前缀环境变量（兼容 DeepSeek / OpenAI / Anthropic）：

```bash
CCSWITCH_PROVIDERS_JSON='[{"id":"openai","provider":"openai","displayName":"OpenAI","model":"gpt-4o-mini","baseUrl":"https://api.openai.com/v1","apiKey":"你的key"}]'
AGENT_AUTH_MODE=api-key
CCSWITCH_ACTIVE_PROVIDER=openai
npm run dev
```

也可继续按原来的单供应商方式配置：

```bash
DEEPSEEK_API_KEY=你的key AGENT_AUTH_MODE=api-key npm run dev
```

## 登录和用户数据

应用启动后先注册或登录。每个用户的数据互相独立，后端会保存：

- 个人目标
- 健康同步记录
- 饮食记录
- 动作分析结果
- Agent 对话记录

业务数据保存到本机 PostgreSQL，不写入浏览器本地存储。默认连接：

```text
postgresql://127.0.0.1:5432/exercise_monitor
```

项目根目录的 `.env.local` 已配置为连接本机 PostgreSQL：

```bash
DATABASE_URL=postgresql://laixufei@127.0.0.1:5432/exercise_monitor
PORT=8787
```

如果你使用本机 Homebrew PostgreSQL，先创建数据库：

```bash
npm run db:create
```

如果不想使用已有 PostgreSQL，也可以启动项目自带的 Docker PostgreSQL，端口是 `55432`，不会占用本机 `5432`：

```bash
npm run db:docker
DATABASE_URL=postgres://exercise_monitor:exercise_monitor@127.0.0.1:55432/exercise_monitor npm run dev
```

前端只保存登录 token 用于恢复会话；用户目标、饮食记录、动作分析、健康同步和对话记录都由后端写入 PostgreSQL。

## Agent 聊天

Agent 对话会自动读取当前登录用户自己的 PostgreSQL 数据：

- 长期记忆：从用户聊天中提到的偏好、目标、身体限制、训练时间和器械条件提炼
- 当前记录：个人目标、饮食记录、运动记录、健康建议、动作分析
- 最近对话：最近消息用于保持上下文
- 本地 RAG：从 `rag/knowledge/*.md` 检索健康运动知识

后端内置健康 skill hub：

- 用户记忆召回
- 热量与宏量营养
- 训练负荷规划
- 恢复与风险控制
- 习惯与执行

聊天不会读取其他用户数据；涉及疼痛、伤病、疾病或用药时只给风险控制建议，不做医疗诊断。

## 本地 RAG

RAG 使用 PostgreSQL 表 `app_rag_chunks` 保存知识库切块和本地 embedding。默认会复用 `DATABASE_URL`；如果设置了 `RAG_DATABASE_URL`，RAG 会单独连接这个数据库，适合把向量库放到本机 Docker 的 pgvector 里。项目自带知识库位于：

```text
rag/knowledge/
```

索引知识库：

```bash
npm run rag:index
```

如果使用 Docker PG：

```bash
npm run db:docker
RAG_DATABASE_URL=postgres://exercise_monitor:exercise_monitor@127.0.0.1:55432/exercise_monitor npm run rag:index
RAG_DATABASE_URL=postgres://exercise_monitor:exercise_monitor@127.0.0.1:55432/exercise_monitor AGENT_AUTH_MODE=off npm run dev
```

Docker 服务使用 `pgvector/pgvector:pg16` 镜像；连接到支持 `vector` 扩展的数据库时会使用 `pgvector` 向量列排序。若连接的是本机普通 PostgreSQL，会自动回退到本地哈希 embedding 和数组相似度检索，不依赖外部 embedding API。

## 使用 API Key（兼容多供应商）

按你当前环境设置，优先支持：

```bash
DEEPSEEK_API_KEY / DEEPSEEK_MODEL / DEEPSEEK_BASE_URL / DEEPSEEK_TIMEOUT_MS
OPENAI_API_KEY / OPENAI_MODEL / OPENAI_BASE_URL / OPENAI_TIMEOUT_MS
ANTHROPIC_AUTH_TOKEN / ANTHROPIC_MODEL / ANTHROPIC_BASE_URL / ANTHROPIC_TIMEOUT_MS
```

若需要同时配置多个供应商，推荐设置：

```bash
CCSWITCH_PROVIDERS_JSON='[{...}, {...}]'
CCSWITCH_ACTIVE_PROVIDER=openai
AGENT_AUTH_MODE=api-key
```

## 关闭 AI 智能体

```bash
AGENT_AUTH_MODE=off npm run dev
```

关闭后接口会返回本地 fallback 结果，方便离线开发。

## 接口

- `GET /api/health`：查看 Agent 运行模式
- `POST /api/auth/register`：注册
- `POST /api/auth/login`：登录
- `GET /api/auth/me`：读取当前用户
- `GET /api/user/state`：读取当前用户数据
- `POST /api/user/meals`：保存当前用户饮食记录
- `DELETE /api/user/meals/:mealId`：删除当前用户饮食记录
- `GET /api/user/memories`：读取当前用户健康记忆
- `POST /api/agent/motion`：运动视频动作建议
- `POST /api/agent/food`：食物热量估算
- `POST /api/agent/health-advice`：健康数据和恢复建议
- `POST /api/agent/chat`：Agent 对话，会自动读取当前登录用户的数据
# exercise_monitor
