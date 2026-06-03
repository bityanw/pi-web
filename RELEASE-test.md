# pi-web v0.7.0-test (多用户 + admin + 共享权限测试版)

> ⚠️ **测试版**,不保证 API 稳定。请勿用于生产。

## 🆕 主要新功能

### 1. 多用户认证系统
- 用户名 + 密码(Node scrypt 哈希)
- 第一个注册的用户自动成为 admin
- JWT session cookie(jose v6)
- 支持 `PI_ALLOW_REGISTER` 关掉公开注册(邀请制)
- `lib/auth/{password,users,session,current-user}.ts`

### 2. Per-user 工作空间隔离
- 每个用户独立 `~/.pi/agent/workspaces/<userId>/` 目录
- `/api/files/[...path]` 强制 `allowedRoots` 校验
- `/api/sessions` 按 user workspace prefix 过滤
- `/api/agent/new` 校验 cwd 必须在 user home 内
- `/api/agent/[id]` 校验 session 所有权(404 if not yours)

### 3. Admin 系统
- 用户管理(`/admin/users`):查看、停用、改密、删用户
- 统计仪表盘(`/admin`):用户活跃度、存储占用、3 天活跃阈值
- 第一个注册用户自动 admin(`isAdmin: true`)

### 4. LLM API Key 体系(3 级优先级)
```
1. 用户自己的 per-provider key(ModelsConfig 里可配)       最高
2. Admin 配置的系统默认 model + key                      ← 共享
3. 环境变量(ANTHROPIC_API_KEY / OPENAI_API_KEY 等)
4. models.json 里的 apiKey                                最低
```
- 用户级 key 用 **AES-256-GCM 加密** 存(自动生成的 key 在 `pi-web-enc-key`)
- Admin 默认 key **明文存**(匹配 `models.json` 约定)
- 所有 API 只返回 `last4`,从不返回明文

### 5. ModelsConfig 统一入口(admin/普通用户)
- 所有用户都看得到:
  - **🤖 系统默认 model** 入口(都看得到,但 admin 可改、普通用户只读)
  - OAuth providers
  - API key providers(各自可改自己的 key)
  - **Custom providers 列表**(都可见、可编辑)
  - **+ Add provider** 按钮
  - **Save / Cancel** 按钮
- 唯一差异(本次新校准):
  - **Admin**:系统默认 model 详情页 = 完整编辑表单(Provider/Model 下拉 + API Key 输入框 + Save/Delete)
  - **普通用户**:系统默认 model 详情页 = 只读展示(API Key 显示 `••••••••(普通用户不可见)`)
- 普通用户不能调 `POST / DELETE /api/admin/default-model`(返回 403)

### 6. Admin 默认 model 的 AuthStorage 注入
- `lib/rpc-manager.ts:startRpcSession()` 注入 admin default key
- `/api/models` 注入 admin default key
- 这两步让 `AuthStorage.hasAuth(provider)` 识别 admin default,`ModelRegistry.getAvailable()` 把它列出来

### 7. 平台支持
- **Docker**:多阶段 `Dockerfile`(deps → builder → runner)+ `docker-compose.yml`(端口/卷/健康检查/资源限制)
- **Next.js 16 proxy.ts**(替代 middleware.ts)
- 端口 30142(30141 被占用)

## 📁 关键数据文件(`$PI_CODING_AGENT_DIR/`)

| 文件 | 内容 |
|---|---|
| `pi-web-users.json` | 用户列表(密码 hash) |
| `pi-web-default-model.json` | Admin 配置的系统默认 model + 明文 key |
| `pi-web-user-keys.json` | 用户级 per-provider key(**AES-256-GCM 加密**) |
| `pi-web-jwt-secret` | JWT 签名密钥 |
| `pi-web-enc-key` | 用户级 key 加密密钥(AES) |
| `workspaces/<userId>/` | 每个用户独立工作空间 |
| `models.json` | 共享的 custom providers 配置(可选) |

## 🔐 测试账号(默认数据)

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `admin123` | admin |
| `alice` | `alice123` | 普通 |
| `test` | `test123` | 普通 |
| `opt` | `opt123` | 普通 |

> 生产环境请用 `PI_ALLOW_REGISTER=false` 关闭公开注册,并立即改 admin 密码。

## 🚀 快速跑起来

### 方式 1:dev
```bash
git clone -b v0.7.0-test https://github.com/bityanw/pi-web.git
cd pi-web
npm install
npm run dev        # 默认 localhost:30141
# 局域网:
npm run dev:lan    # 0.0.0.0:30141
```

### 方式 2:Docker
```bash
cp .env.example .env
# 编辑 .env 填 PI_JWT_SECRET (至少 32 字节) 和 LLM API key
docker compose up -d
# 浏览器:http://localhost:30141
```

### 必填环境变量(生产)
```bash
PI_JWT_SECRET=<random 32+ bytes>   # JWT 签名
PI_ALLOW_REGISTER=false             # 邀请制
PI_COOKIE_SECURE=true               # HTTPS only
ANTHROPIC_API_KEY=...               # 或其它 LLM key
```

## 🐛 已知小问题

- dev 模式用 Turbopack 跑(避开 webpack + Tailwind v4 CSS 解析问题),有 1 个无害的字体 fetch warning
- OAuth provider filter 仍跳过 anthropic(pre-existing),用 admin 默认 model 解决
- 端口 30142 是为了避开本机 30141 占用

## 📊 本次 commit 列表(4 commits, +1230 / -487)

```
4c005cd feat: 重新校准权限模型 — 共享 + 默认 model 只读差异
3e784af feat: admin/普通用户 模型管理权限分级
c0cff80 refactor: 默认模型统一进 ModelsConfig,删除独立 admin key 配置页
3a483e4 feat: 多用户认证、管理员系统与按用户隔离的工作空间
```

## 🔗 链接

- 仓库:https://github.com/bityanw/pi-web
- 上一个稳定版:980e9d2(原版单用户)
- 测试版 commit:4c005cd
