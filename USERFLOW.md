# pi-web 模型管理用户流程

> 适用版本:v0.7.0+(多用户 + admin 系统)

## 🎯 角色总览

| | Admin | 普通用户 |
|---|---|---|
| 设置"系统默认 model"(全局) | ✅ 可改 | 🔒 只读可见,不能改 |
| 用 admin 默认 model(chat) | ✅ | ✅ |
| 加 custom provider(`+ Add provider`) | ✅ | ✅(共享) |
| 改自己的 per-provider API key | ✅ | ✅ |
| chat 下拉里能选哪些 model | 所有 available | 所有 available |

> **关键设计**:`models.json` 是**共享**的,所有人加的 custom provider 互相可见可用。唯一隔离在 per-user 的 API key(用户的 key 只自己看)。

---

## 👑 Admin:添加 / 改系统默认 model

**目标**:给所有用户配置一个"开箱即用"的 model + key。登录后 chat 默认就是这个。

### 步骤

1. **打开 ModelsConfig**
   - 浏览器登录 admin
   - 点左下角 `Models` 按钮
   - 弹出 modal,左边是树形列表,右边是详情

2. **选"系统默认 model"**
   - 左边树最上面一行,带 **黄色 `admin` 徽章** 的 `🤖 系统默认 model`
   - 点一下

3. **填表单(右面板)**
   - **Provider**:下拉,选一个 LLM 提供商(anthropic / openai / google / 自定义...)
   - **Model**:下拉,选具体模型(选完 Provider 后才激活)
   - **API Key**:密码框,输入该 provider 的真实 API key(`sk-...` 开头)
   - 上面会有个提示:`Provider 的 key 如果已经通过环境变量配了,这里也必须填 — admin 默认优先级更高`

4. **保存**
   - 点底部 `保存` 按钮
   - 成功后:绿色提示 `✓ 已保存: anthropic/claude-sonnet-4-5`
   - 顶部 banner 变成绿色:`✅ 当前已配置: Claude Sonnet 4.5 · anthropic · Key ··5678 · by admin · 时间`

5. **(可选)改已有默认**
   - 重新进入这个面板
   - 表单预填了之前保存的值
   - 改任意字段,再次填 API Key(必填,即使没改),点 `保存`
   - 或点 `删除默认模型` 清掉配置

### 改完默认值后

- **所有用户**(包括你自己)**下一次点 `New` 开新 chat** 时,默认 model 切换为新的
- 已经在跑的 chat session 不受影响(每个 session 启动时锁定 model)
- 用户也随时可以**在 chat 下拉里手动切**到别的 model(只要那个 model 在 available 列表里)

### 改 admin 看到的模型列表

admin 的 `/api/models` = **registry 全部 available 模型**:
- env 变量配过 key 的(ANTHROPIC_API_KEY 等)
- models.json 里有 apiKey 的(custom provider)
- admin 自己默认的(provider 通过 setRuntimeApiKey 注入)

如果想"全员只能用某个 model",还得在 admin 文档 / 团队培训里说明,pi-web 本身不做硬限制。

### 故障排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 右边一直显示"加载中…" | /api/models 或 /api/admin/default-model 报错 | 刷新 modal,或点重试按钮 |
| 保存后 dropdown 显示空 | 保存的 modelId 不在 registry | 改用 registry 里的 model id,或检查 key 是不是对的 |
| 保存后 chat 里看不到新默认 | chat 还在用旧 session | 点 `New` 开新 session;老 session 不变 |
| 删除按钮点了没反应 | 浏览器没确认弹窗 | 允许 pop-up,或手动改用 admin 视图 |

---

## 👤 普通用户:用 admin 默认 model

**目标**:登录就能用,不用关心 key 怎么配。

### 步骤

1. **登录**
   - 浏览器打开 pi-web
   - 输用户名 + 密码,点登录
   - 第一个注册的自动是 admin;后面注册的普通用户

2. **选项目**
   - 左侧 sidebar,点 `Select project…` 选一个目录
   - 这是 agent 操作的工作空间(每个用户独立)

3. **点 `New` 开新 chat**
   - sidebar 顶部的 `+` 按钮
   - chat 出现,顶部 model 下拉**自动选中 admin 默认 model**

4. **直接打字发消息**
   - 在底部输入框打字
   - 按 Enter 发送
   - agent 用 admin 的 model + key 跑

5. **(可选)换 model**
   - 点 chat 输入框上方的 model 下拉
   - 看到所有 available 的 model(同上:env 变量配过的 + models.json 里的 + admin 默认)
   - 选一个就用

### 查看 admin 配了什么

- 点左下角 `Models` 按钮
- 左边选 `🤖 系统默认 model`(带 🔒 锁图标)
- 右边 readonly 显示:
  - Provider:`anthropic`
  - Model:`Claude Sonnet 4.5`(+ 下面灰字 `id: claude-sonnet-4-5`)
  - API Key:`••••••••(普通用户不可见)`
- 提示:🔒 您是普通用户,无法修改或查看默认 key

---

## 👤 普通用户:创建自己的 model(2 种)

### A. 加 custom provider(共享给所有人)

**场景**:团队需要用一个 registry 里没有的 LLM 端点(自家部署的 vLLM / Ollama / OpenRouter 等)。

1. **打开 ModelsConfig**
2. **点左下角 `+ Add provider`**
3. **在 picker 里选 `Custom`**
4. **右边填表单**
   - **Name**:`my-vllm` (内部用的 key)
   - **API**:下拉,协议类型(`openai-completions` / `anthropic-messages` / 等)
   - **Base URL**:端点地址,比如 `http://gpu-server:8000/v1`
   - **API Key**:该端点的 key(如果需要)
   - **Models**:`+ model` 加 model id,比如 `Qwen2.5-72B-Instruct`
5. **点底部 `保存`**(共享的 Save 按钮,作用于 models.json)
6. **左侧树出现新的 provider**
7. **chat 下拉里就能选这个 model 了**(所有人)

### B. 加自己的 API key(per-provider 覆盖)

**场景**:admin 配的默认是 Anthropic,你想用**自己的** Anthropic key(自费)或加一个 admin 没配的 provider。

1. **打开 ModelsConfig**
2. **左侧树选一个 API key provider**,比如 `anthropic` (带 `默认` 黄色徽章的,表示 admin 配了默认)
3. **右边填表单**
   - 显示当前状态:`默认 Key ··5678(生效中)`
   - 输入你自己的 key(覆盖 admin 默认)
4. **点底部 `保存`**
5. **该 provider 徽章变成 `您的` 绿色**
6. **chat 里用这个 provider 的 model 时,用你的 key**(优先级最高)

### 改回 admin 默认

- 同一面板,把 key 输入框**清空**,点 `保存`
- (前提是 admin 默认存在;否则需要自己留个 key)

---

## 🔑 4 级 key 优先级(解析顺序)

```
1️⃣ 用户在 ModelsConfig 配的 自己的 Key
   位置:左侧 API key provider 详情
   作用域:仅当前用户
   存储:pi-web-user-keys.json (AES-256-GCM 加密)

2️⃣ Admin 配置的 系统默认 model + Key
   位置:左侧 🤖 系统默认 model 详情
   作用域:所有用户
   存储:pi-web-default-model.json (明文,admin 信任)

3️⃣ 环境变量
   例:ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY
   作用域:整个进程
   配置:.env / docker-compose env_file

4️⃣ models.json 里的 apiKey
   位置:每个 custom provider 的配置里
   作用域:所有用这个 provider 的用户
   存储:models.json (明文,所有人可见)
```

**举例**:
- alice 在 anthropic provider 下配了自己的 key `sk-alice-1234`(优先级 1)
- admin 配了默认 anthropic,key 是 `sk-admin-5678`(优先级 2)
- alice 用 anthropic 的 model 时,**用 alice 自己的 key**(`sk-alice-1234`)
- 如果 alice 删了自己的 key,fallback 到 admin 的 `sk-admin-5678`
- 如果 admin 也没配,fallback 到环境变量 `ANTHROPIC_API_KEY`
- 如果环境变量也没,fallback 到 `models.json` 里 anthropic 那个 provider 的 apiKey

---

## 📋 快速检查表

- [ ] 第一个注册的用户 = admin
- [ ] admin 设默认 model 后,**点 `New` 开新 chat** 才能看到新默认(老 session 不变)
- [ ] 改完默认后,所有用户的 chat 下拉里都有这个 model
- [ ] 普通用户能看默认 model,但看不到 key
- [ ] 普通用户能加 custom provider(共享)或自己的 API key(私有)
- [ ] 4 级 key 优先级:用户 > admin > env > models.json
