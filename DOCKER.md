# pi-web Docker 部署指南

## 📋 文件清单

| 文件 | 作用 |
|---|---|
| `Dockerfile` | 多阶段构建:deps → builder → runner |
| `docker-compose.yml` | 服务编排:端口、卷、环境变量、健康检查 |
| `.dockerignore` | 排除不需要进镜像的文件 |
| `.env.example` | 环境变量模板 |

## 🚀 5 步上手

### 1. 准备环境变量
```bash
cp .env.example .env
# 编辑 .env,填入 LLM API key
```

### 2. (可选)放进你的项目
把要操作的项目文件放进 `./workspace/`,或者改 `docker-compose.yml` 里的卷挂载路径。

### 3. 构建并启动
```bash
docker compose up -d --build
```

第一次构建约 3-8 分钟(取决于网络)。

### 4. 验证
```bash
# 看启动日志
docker compose logs -f

# 健康状态
docker compose ps
# STATUS 应显示 "Up (healthy)"

# 浏览器打开
open http://localhost:30141    # macOS
xdg-open http://localhost:30141 # Linux
start http://localhost:30141   # Windows
```

### 5. 日常管理
```bash
docker compose restart         # 重启
docker compose stop            # 停止
docker compose start           # 启动
docker compose down            # 停止并删除容器(数据保留)
docker compose logs --tail=100 # 看最近 100 行日志
docker compose exec pi-web sh  # 进容器调试
```

## 📁 持久化数据

| 容器内路径 | 宿主机路径 | 用途 |
|---|---|---|
| `/data/agent` | `./agent-data/` | 会话文件、模型配置 (`models.json`) |
| `/workspace` | `./workspace/` | agent 操作的工作目录 |

**备份**:直接打包 `./agent-data/` 即可恢复所有会话。

**重置**:删除 `./agent-data/` 下内容,容器下次启动会重建。

## ⚙️ 关键配置项

### 改端口
编辑 `docker-compose.yml`:
```yaml
ports:
  - "8080:30141"   # 宿主机 8080 → 容器 30141
```

### 改挂载路径(挂到现有项目)
```yaml
volumes:
  - ./agent-data:/data/agent
  # 把 ~/myproject 挂进去
  - /home/yourname/myproject:/workspace:rw
```

### 加 HTTPS(Nginx 反代)
参考 `nginx.conf` 模板(见 `docs/`),容器端口 30141 不动。

## 🐛 常见问题

### 构建失败,网络超时
换 npm registry 镜像,在 `Dockerfile` 的 `deps` 阶段加:
```dockerfile
RUN npm config set registry https://registry.npmmirror.com
```

### 容器启动后立刻退出
```bash
docker compose logs pi-web
```
通常是 `.env` 没填 API key,或端口被占用。

### 容器内 uid 1000 在 Linux 上没权限
```bash
sudo chown -R 1000:1000 ./agent-data ./workspace
```

### 想要更小的镜像
改 `Dockerfile` 加上 standalone 输出,先在 `next.config.ts` 加:
```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...
};
```
然后改 `Dockerfile` runner 阶段:
```dockerfile
COPY --from=builder --chown=piweb:piweb /app/.next/standalone ./
COPY --from=builder --chown=piweb:piweb /app/.next/static ./.next/static
COPY --from=builder --chown=piweb:piweb /app/public ./public
```
镜像能从 ~500MB 缩到 ~150MB。
