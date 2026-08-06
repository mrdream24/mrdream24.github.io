# Notes 发布服务

该 Worker 负责 GitHub OAuth、发布权限校验、图片上传和 `data/notes.json` 更新。GitHub Client Secret 与访问令牌不会写入静态网站。

## 1. 创建 GitHub OAuth App

- Homepage URL：`https://mrdream24.github.io`
- Authorization callback URL：`https://<你的 Worker 域名>/auth/callback`

## 2. 部署 Worker

复制 `wrangler.toml.example` 为 `wrangler.toml`，然后设置密钥：

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_SECRET
wrangler deploy
```

`COOKIE_SECRET` 使用随机长字符串，例如密码管理器生成的 32 字节以上内容。

## 3. 连接后台

把部署后的 Worker 地址写入 `admin/config.js` 的 `apiBase`。合并部署后，访问：

`https://mrdream24.github.io/admin/notes.html`

登录账号必须与 Worker 中的 `ALLOWED_GITHUB_LOGIN` 一致。发布会串行写入图片文件，最后更新 `data/notes.json`。
