# 侦探推理阅读池：Supabase 配置

页面代码已经连接到现有 Supabase 项目，并使用 Magic Link 登录。完成以下配置后，阅读状态、进度、评分、日期和笔记即可跨设备同步。

## 1. 创建数据库表

1. 登录 Supabase Dashboard。
2. 打开当前网站使用的项目。
3. 进入 **SQL Editor**。
4. 打开仓库中的 `sql/detective-reading-records.sql`。
5. 复制全部 SQL，粘贴到 SQL Editor 并执行。
6. 在 **Table Editor** 中确认出现 `detective_reading_records` 表。

SQL 已包含：

- 阅读状态：想读、在读、已读、暂停
- 阅读进度：0—100
- 个人评分：1—5，支持半星
- 开始日期与完成日期
- 私人笔记
- `user_id + work_id` 唯一约束
- Row Level Security（RLS）
- 自动更新 `updated_at` 的触发器

## 2. 配置 Magic Link 登录

进入 **Authentication > URL Configuration**：

- **Site URL** 设置为：`https://mrdream24.github.io`
- 在 **Redirect URLs** 中加入：
  - `https://mrdream24.github.io/detective.html`
  - `http://localhost:*`
  - 本地调试时实际使用的其他地址

进入 **Authentication > Providers > Email**，确认 Email Provider 已开启。Magic Link 登录不需要网站保存用户密码。

## 3. 验证 RLS

登录页面后新增一条阅读记录，再到 Supabase Table Editor 查看。记录应包含当前用户的 `user_id`。

建议再用另一个邮箱登录验证：第二个账号不能读取、修改或删除第一个账号的记录。

## 4. 同步策略

页面在未登录时使用浏览器 `localStorage`，键名为：

```text
detectiveReadingRecords
```

用户首次登录后：

1. 从云端读取当前账号的记录。
2. 将本地存在、云端不存在的记录上传。
3. 对同一作品，以云端记录覆盖本地记录。
4. 后续每次保存或删除都会同步到 Supabase。

## 5. 数据与记录分离

作者和作品目录保存在 `js/detective-data.js`，个人记录保存在 Supabase。这样扩充作品目录时，不需要迁移每位用户的阅读记录。

作品的稳定标识 `work_id` 由“国家、作者、书名”生成。已经上线并产生阅读记录后，不应随意修改这三个字段；需要改译名时，建议增加别名字段，而不是直接改动稳定标识。

## 6. 安全说明

前端使用的是 Supabase Publishable Key，可以公开出现在浏览器代码中。真正的数据权限由 RLS 控制。不要把 `service_role` key 写入仓库或前端页面。
