# Notes 发布服务

最终架构：Cloudflare Worker + D1 + Backblaze B2 + GitHub Markdown。

- **D1**：公开内容的运行数据库，发布后前台立即读取。
- **Backblaze B2**：手机图片对象存储；Bucket 保持 Private。
- **GitHub**：每条内容生成独立 Markdown，作为长期可迁移归档。
- **Worker**：GitHub OAuth、发布鉴权、D1 写入、B2 S3 API 上传/读取和 GitHub 归档。

前端不会保存 GitHub Client Secret 或 Backblaze Application Key。OAuth 只申请 `public_repo`，发布账号限制为 `mrdream24`。

## 已确定资源

- D1 database：`mrdream24-notes`
- D1 Database ID：`9865ec14-0192-410c-adea-882837ef10bd`
- B2 Bucket：`mrdream24-notes-media`
- B2 S3 Endpoint：`s3.us-east-005.backblazeb2.com`
- B2 Region：`us-east-005`

## 1. 初始化 D1（只做一次）

Cloudflare Dashboard → Storage & Databases → D1 → `mrdream24-notes` → Console。

把 `worker/schema.sql` 的全部 SQL 复制进去并执行。

执行成功后应该存在 `notes` 表。

## 2. Backblaze 创建 Application Key

Backblaze → B2 Cloud Storage → Application Keys → Add a New Application Key。

建议：

- Name：`mrdream24-notes-worker`
- Allow access to Bucket：`mrdream24-notes-media`
- Type of Access：Read and Write

创建后保存两项：

- `keyID`
- `applicationKey`

`applicationKey` 只显示一次。不要提交到 GitHub，也不要放进 `admin/config.js`。

Worker 通过 Backblaze 的 S3-Compatible API + AWS Signature V4 访问 Private Bucket。代码已内置签名逻辑，不需要 AWS SDK。

## 3. 创建 GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。

先填写：

- Application name：`Mrdream24 Notes`
- Homepage URL：`https://mrdream24.github.io`

Authorization callback URL 需要等 Worker 第一次部署后拿到 Worker URL，再填写：

`https://<你的 Worker 域名>/auth/callback`

创建完成后保存：

- Client ID
- Client Secret

## 4. 通过 Cloudflare Git Integration 部署 Worker

Cloudflare Dashboard → Workers & Pages → Create / Import a repository。

连接 GitHub 并选择：

`mrdream24/mrdream24.github.io`

部署分支：

`agent/notes-publishing`

首次联调阶段先部署这个 PR 分支，不需要先合并 `master`。

如果 Cloudflare 要求 Root directory，填写：

`worker`

Worker 名称：

`mrdream24-notes-api`

仓库内 `worker/wrangler.toml` / `worker/wrangler.toml.example` 已包含普通配置和 D1 binding。

## 5. Cloudflare Variables / Secrets

Worker → Settings → Variables and Secrets。

### 普通变量

- `SITE_ORIGIN` = `https://mrdream24.github.io`
- `ALLOWED_GITHUB_LOGIN` = `mrdream24`
- `REPO_OWNER` = `mrdream24`
- `REPO_NAME` = `mrdream24.github.io`
- `REPO_BRANCH` = `master`
- `B2_BUCKET` = `mrdream24-notes-media`
- `B2_ENDPOINT` = `s3.us-east-005.backblazeb2.com`
- `B2_REGION` = `us-east-005`

### Secrets

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `COOKIE_SECRET`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`

其中：

- `B2_KEY_ID` = Backblaze `keyID`
- `B2_APPLICATION_KEY` = Backblaze `applicationKey`
- `COOKIE_SECRET` 使用密码管理器生成至少 32 字节随机字符串。

## 6. D1 Binding

Cloudflare Worker 必须存在：

- Binding name：`DB`
- Database：`mrdream24-notes`

Wrangler 配置已经写入对应 Database ID。

不需要 R2 Binding。

## 7. 第一次部署后

部署后会得到类似：

`https://mrdream24-notes-api.<你的-subdomain>.workers.dev`

先打开：

`https://<Worker URL>/health`

正确结果：

```json
{"ok":true,"service":"mrdream24-notes-api"}
```

然后把完整 Worker URL 告诉代码维护者，用于更新 `admin/config.js` 和 `notes.html`。

## 8. 更新 GitHub OAuth callback

拿到 Worker URL 后，把 GitHub OAuth App 的 Authorization callback URL 设置为：

`https://<Worker URL>/auth/callback`

## 9. API

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

## 10. 发布流程

1. 手机后台把照片压缩为 WebP。
2. Worker 用 S3 Signature V4 把图片上传到 Backblaze B2 Private Bucket。
3. Worker 将正文、标签和 B2 object key 写入 D1。
4. 前台立刻从 Worker `/notes` 读取新内容，不等待 GitHub Pages rebuild。
5. Worker 将内容归档到 `content/notes/YYYY/MM/*.md`。
6. Markdown 中只保存 Worker 图片 URL，不复制图片二进制。
7. 如果 GitHub 归档失败，D1 内容仍然公开，`archive_status` 标记为 `failed`。

## 11. 图片访问

B2 Bucket 不需要公开。

前台访问：

`https://<Worker URL>/media/notes/<note-id>/01.webp`

Worker 会签名请求并从 B2 读取图片，再返回给浏览器，响应带一年 immutable cache。
