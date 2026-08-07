# Notes 发布服务

这套服务使用 Cloudflare Worker + D1 + R2，并继续把每条 Notes 归档为 GitHub Markdown。

- D1：公开内容的运行数据库，发布后前台立即读取。
- R2：手机图片对象存储，不再让 Git 仓库被图片撑大。
- GitHub：每条内容生成独立 Markdown，作为长期可迁移的文本归档。
- Worker：GitHub OAuth、发布鉴权、D1/R2 写入、媒体读取和 GitHub 归档。

前端不会保存 GitHub Client Secret。OAuth 只申请 `public_repo` 权限，发布账号限制为 `mrdream24`。

## Cloudflare Dashboard 部署（不需要本地写代码）

### 1. 创建 D1

Cloudflare Dashboard → Storage & Databases → D1 → Create database。

数据库名：`mrdream24-notes`

创建后记录 Database ID。之后把 ID 告诉负责维护仓库代码的人，用它生成正式 `worker/wrangler.toml`。

### 2. 创建 R2

Cloudflare Dashboard → R2 Object Storage → Create bucket。

Bucket 名：`mrdream24-notes-media`

不需要开启 Public Development URL，也不需要把 Bucket 设为公开。图片统一通过 Worker `/media/*` 提供。

### 3. 初始化 D1 Schema

Worker 部署后，在 D1 数据库 Console 中执行 `worker/schema.sql` 的 SQL。只需要执行一次。

### 4. 创建 GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。

- Application name：`Mrdream24 Notes`
- Homepage URL：`https://mrdream24.github.io`
- Authorization callback URL：`https://<你的 Worker 域名>/auth/callback`

创建后保存 Client ID，并生成 Client Secret。

### 5. 通过 Cloudflare Git Integration 部署 Worker

Cloudflare Dashboard → Workers & Pages → Create application → Import a repository。

选择 `mrdream24/mrdream24.github.io`。

推荐设置：

- Production branch：`master`
- Root directory：`worker`
- Build command：留空
- Deploy command：`npx wrangler deploy`

Worker 名称必须与 Wrangler 配置中的 `name` 一致：`mrdream24-notes-api`。

### 6. Runtime variables / secrets

Worker → Settings → Variables & Secrets。

普通变量：

- `SITE_ORIGIN` = `https://mrdream24.github.io`
- `ALLOWED_GITHUB_LOGIN` = `mrdream24`
- `REPO_OWNER` = `mrdream24`
- `REPO_NAME` = `mrdream24.github.io`
- `REPO_BRANCH` = `master`

Secrets：

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `COOKIE_SECRET`

`COOKIE_SECRET` 使用密码管理器生成的高强度随机字符串即可，建议至少 32 字节。

### 7. Bindings

Wrangler 正式配置会绑定：

- D1 binding：`DB` → `mrdream24-notes`
- R2 binding：`MEDIA` → `mrdream24-notes-media`

Worker 代码通过 `env.DB` 和 `env.MEDIA` 使用这两个资源。

### 8. 把 Worker URL 接回网站

Worker 部署后会得到类似：

`https://mrdream24-notes-api.<subdomain>.workers.dev`

将该地址写入 `admin/config.js` 的 `apiBase`。该文件不包含秘密，可以公开提交。

## API

### Public

- `GET /health`
- `GET /notes?limit=50&before=<ISO date>&tag=<tag>`
- `GET /notes/:id`
- `GET /media/:key`

### Authenticated

- `GET /auth/login`
- `GET /auth/callback`
- `GET /auth/status`
- `POST /publish`

## 发布流程

1. 手机后台把图片压缩为 WebP。
2. Worker 将图片写入 R2。
3. Worker 将正文、标签和图片 key 写入 D1。
4. 此时公开前台已经可以立即读取新内容。
5. Worker 再将内容归档为 `content/notes/YYYY/MM/*.md`。
6. 如果 GitHub 归档失败，D1 中内容仍然保持公开，同时记录 `archive_status = failed`，后台会显示警告。

GitHub Markdown 只保存图片的 R2 key，不复制图片二进制，因此 Git 仓库不会随照片增长。
