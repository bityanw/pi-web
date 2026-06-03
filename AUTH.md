# pi-web 多用户改造说明

## 🎯 改造后的能力

| 项 | 改造前 | 改造后 |
|---|---|---|
| 用户登录 | ❌ 无 | ✅ 用户名+密码 |
| 角色 | ❌ | ✅ admin / user |
| 第一个注册用户 | - | ✅ 自动成为 admin |
| 工作目录 | ❌ 全员共享 | ✅ 每人独立 |
| API Key | ❌ 全员共享 | ✅ Admin 配默认 + 用户可覆盖 |
| 默认模型 | ❌ | ✅ Admin 选一个 model + key,用户登录后默认使用 |
| Provider 列表 | ❌ | ✅ 动态 29 个 provider(不写死) |
| 用户管理 | ❌ | ✅ Admin 界面 |
| 会话数据 | 共享 | 物理隔离(在用户目录里) |

## 📂 数据文件(都存 `$PI_CODING_AGENT_DIR/`)

```
$PI_CODING_AGENT_DIR/
├── pi-web-users.json           # 用户列表
├── pi-web-default-keys.json    # Admin 配的默认 API Key(加密, 按 provider)
├── pi-web-default-model.json   # Admin 配的系统默认 model + key(明文,与 models.json 风格一致)
├── pi-web-user-keys.json       # 每个用户自己的 API Key(加密)
├── pi-web-jwt-secret           # JWT 签名密钥(自动生成)
├── pi-web-enc-key              # API key 加密密钥(自动生成)
├── workspaces/                 # 每用户工作目录
│   ├── <userId-1>/
│   └── <userId-2>/
├── sessions/                   # (原有)pi session 文件
├── models.json                 # (原有)模型配置
└── auth.json                   # (原有)OAuth 凭据
```

## 🚀 第一次使用流程

### 1. 启动服务
```bash
docker compose up -d --build
# 或开发模式
npm run dev
```

### 2. 访问 `http://localhost:30141`
会被重定向到 `/login`,看到"请注册第一个用户"。

### 3. 注册第一个用户(自动成为 admin)
- 用户名:任取(如 `admin`)
- 密码:至少 6 位
- 注册后立刻登录,拥有 admin 权限

### 4. 后续用户
- 默认可以自由注册(`PI_ALLOW_REGISTER=true`)
- 想关闭自由注册:在 `.env` 设 `PI_ALLOW_REGISTER=false`,只能由 admin 邀请

## 🔐 角色能力对比

| 功能 | user | admin |
|---|---|---|
| 聊天/会话 | ✅ | ✅ |
| 自己的 API key | ✅ | ✅ |
| 切换模型 | ✅ | ✅ |
| 用户管理 | ❌ | ✅ `/admin/users` |
| 配置默认 API Key | ❌ | ✅ `/admin/default-keys` |
| 看其他用户 | ❌ | ❌(隐私) |

**注意:admin 看到的界面和 user 一样**,只是右上角菜单多了两项管理入口。

## 🔑 API Key 解析优先级

调用 LLM 时,key 解析顺序:

```
1. 用户自己的 key    ← 最高优先级
   (在 $PI_CODING_AGENT_DIR/pi-web-user-keys.json)

2. Admin 默认 key   ← 用户没配时的回退
   (在 $PI_CODING_AGENT_DIR/pi-web-default-keys.json)

3. 用户自己的 OAuth 登录(如 OpenAI/Claude 登录)
   (由 pi-coding-agent 库管理,原有逻辑)

4. 都没有 → 报 401/未配置
```

## 🛠️ 管理操作示例

### 邀请新用户(关掉自由注册时)
admin 登录 → 右上角菜单 → "用户管理" → "+ 新建用户"

### 批量配 API key
1. 右上角菜单 → "默认 API Key"
2. 给 Anthropic / OpenAI / Google 等填 key
3. 所有用户自动能用

### 用户自带 key
用户在 "Models" 面板里给某个 provider 填自己的 key,会覆盖 admin 的。

### 重置用户密码
暂未提供 UI,直接编辑 `pi-web-users.json`:
```bash
# 进入容器
docker compose exec pi-web sh

# 写个小脚本(在容器里执行)
node -e "
const fs = require('fs');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');
const p = '/data/agent/pi-web-users.json';
const data = JSON.parse(fs.readFileSync(p));
const u = data.users.find(x => x.username === 'alice');
const salt = randomBytes(16);
p(salt, 'newpassword', 64).then(hash => {
  u.passwordHash = 'scrypt\$1\$16384\$8\$' + salt.toString('base64') + '\$' + hash.toString('base64');
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log('done');
});
" 2>&1
```

## ⚠️ 安全建议

1. **生产必须设 `PI_JWT_SECRET`**:否则容器重建会让所有用户重新登录。
   ```bash
   openssl rand -hex 32
   # 填到 .env 的 PI_JWT_SECRET
   ```

2. **生产关闭自由注册**:`PI_ALLOW_REGISTER=false`

3. **HTTPS**:在 Nginx/Caddy 层加,cookie 才能设 `secure` 标志。

4. **定期备份** `$PI_CODING_AGENT_DIR/`。

5. **不要删除数据卷**(`pi-web-jwt-secret`、`pi-web-enc-key`):
   丢了 JWT secret → 全部重新登录
   丢了 enc key → 全部 API key 失效(用户要重新填)

## 🐛 故障排查

### 登录后白屏
- 检查 `$PI_CODING_AGENT_DIR/pi-web-jwt-secret` 是否存在且有读权限

### 改了密码登不上
- 直接看 `pi-web-users.json` 的 passwordHash 字段是否被改

### 第一次注册是 user 而不是 admin
- `pi-web-users.json` 已经存在其他用户,新用户默认 user
- 解决:删掉 `pi-web-users.json` 重启(⚠️ 会清空所有用户),或用 admin 账号提权

### Admin 误删自己
- 至少保留一个 admin,代码已做保护
- 真的全删了:在 `pi-web-users.json` 里手动把第一个用户 role 改回 "admin"

## 🆚 跟原版(无 auth)的对比

代码层面,改动范围:

```
新增:
  lib/auth/{users,password,session,current-user}.ts
  lib/api-keys-store.ts
  lib/user-workspace.ts
  middleware.ts (现 proxy.ts,Next.js 16 推荐 proxy.ts)
  components/UserMenu.tsx
  app/{login,register}/page.tsx
  app/admin/{users,default-keys}/page.tsx
  app/api/auth/{login,register,logout,me}/route.ts
  app/api/admin/{users,users/[id],default-keys}/route.ts

修改:
  app/layout.tsx            (未改,通过 AppShell 注入)
  components/AppShell.tsx   (顶部加 UserMenu,改动 < 10 行)
  app/api/default-cwd/route.ts  (用每用户目录)
  app/api/home/route.ts          (返回用户目录)
  app/api/auth/api-key/[provider]/route.ts  (用户覆盖)
  package.json            (加 jose)
```
