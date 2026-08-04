# 侦探推理阅读池：数据库配置

页面文件为 `detective.html`，阅读记录使用现有 Supabase 项目，并单独存入 `detective_reading_records` 表。

## 1. 创建数据表

1. 登录 Supabase Dashboard。
2. 打开当前文学阅读池使用的项目。
3. 进入 **SQL Editor**。
4. 新建 Query。
5. 复制并执行仓库中的 `supabase/detective-reading-records.sql`。
6. 在 **Table Editor** 中确认出现 `detective_reading_records` 表。

SQL 已包含：

- 阅读状态：想读、在读、已读、暂停
- 阅读进度：0—100
- 个人评分：1—5，支持半星
- 开始日期与完成日期
- 私人阅读笔记
- `user_id + work_id` 唯一约束
- Row Level Security 策略，用户只能读写自己的数据

## 2. 检查邮箱 Magic Link

1. 进入 **Authentication > Providers > Email**。
2. 确认 Email Provider 已启用。
3. 可保留 Confirm email，页面使用 Magic Link 登录。
4. 进入 **Authentication > URL Configuration**。
5. 将站点地址加入 Site URL 或 Redirect URLs：

```text
https://mrdream24.github.io/detective.html
```

本地调试时还可以加入：

```text
http://localhost:8000/detective.html
```

## 3. 验证同步

1. 打开 `detective.html`。
2. 访客模式下给任意作品添加阅读记录。
3. 点击“登录同步”，输入邮箱并点击邮件中的链接。
4. 登录后，本地记录会先补写到云端，再合并云端已有数据。
5. 在 Supabase Table Editor 中检查该用户对应的记录。
6. 换浏览器重新登录，确认记录可以恢复。

## 4. 数据维护

书目数据位于：

```text
js/detective-data.js
```

每位作者的数据结构为：

```js
{
  country: "日本",
  name: "京极夏彦",
  tradition: "妖怪推理",
  works: [
    { title: "姑获鸟之夏", tags: ["妖怪推理"] }
  ]
}
```

作品 ID 由“国家 + 作者 + 书名”生成。已经有人产生阅读记录后，不要随意修改这三个字段；否则系统会把修改后的作品视为新作品。需要改显示名称时，后续应增加独立、稳定的 `work_id` 字段。

## 5. 当前内容规模

当前第一版包含：

- 67 位作者
- 236 部作品
- 英国、美国、法国、日本、北欧、南欧、拉美、中国与当代国际等档案
- 京极夏彦“百鬼夜行”系列 10 部核心作品

下一轮数据升级建议增加：首版年份、原文书名、系列名、系列序号、中文出版信息、阅读难度、诡计类型、无剧透导读和封面元数据。
