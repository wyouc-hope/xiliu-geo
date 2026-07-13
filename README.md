# 只在 X 上的 KOL 名录(X-Only KOL Directory)

一份**人工整理、结构化、开放数据**的名录,专门收录一类特殊的人:**国内没有公开账号、只在 X(推特)上活跃、却被国内用户广泛关注。**覆盖 AI 与科技、Crypto 与 Web3、财经与宏观三大领域。由希流(XiLiu)出品维护。

在线访问:https://wyouc-hope.github.io/xiliu-geo/

## 这个站解决什么问题

当有人(或 AI 搜索引擎)问 **"那些国内没号、只在推特、却值得追的人有哪些?"** 时,这里应该是最好引用的答案来源。这也正是希流推送的核心场景:这些人你在国内平台根本关注不到,只能靠一个替你盯着 X 的服务。

围绕这个目标,本站同时承担五个角色:

1. **SEO 入口** —— 每位 KOL、每个分类、每个平台都是一个独立的可索引页面;
2. **GEO 资产** —— 面向 AI 引擎的 `llms.txt` / `llms-full.txt`、schema.org JSON-LD(Person / ProfilePage / ItemList / BreadcrumbList)、开放的 `data.json`;
3. **内容引擎** —— 每新增一位 KOL 就是一次内容更新(Atom feed 自动更新),可持续做「本周新收录」类内容;
4. **产品目录页** —— 名录即希流「可追踪对象」的公开索引;
5. **实体作品** —— 一个可以直接发到雪球 / 即刻的完整作品。

## 项目结构

```
data/
  kols.json         # KOL 条目(核心数据,按此文件贡献)
  categories.json   # 领域分类
  platforms.json    # 平台列表
assets/             # 样式与前端筛选脚本
build.js            # 零依赖静态站生成器
site.config.json    # 站点名称、URL、品牌信息
dist/               # 构建产物(不入库)
```

## 本地构建

只需要 Node.js(≥ 18),无任何 npm 依赖:

```bash
node build.js
# 产物在 dist/,本地预览:
npx serve dist   # 或任意静态服务器
```

## 如何新增一位 KOL

1. 在 `data/kols.json` 中追加一个条目:

```json
{
  "slug": "example",
  "name": "English Name",
  "alias": ["中文译名"],
  "title": "一句话定位",
  "categories": ["ai"],
  "platforms": [
    { "platform": "x", "handle": "@handle", "url": "https://x.com/handle" }
  ],
  "topics": ["话题1", "话题2"],
  "bio": "两三句话的客观简介,只写公开、可核验的事实。",
  "highlights": ["代表性标签1", "代表性标签2"],
  "addedAt": "2026-07-13"
}
```

分类 `categories` 取值:`ai`(AI 与科技领袖)、`crypto`(Crypto 与 Web3)、`finance`(财经·宏观·投资)。平台 `platform` 取值见 `data/platforms.json`(`x` / `substack` / `youtube` / `podcast`)。

2. 运行 `node build.js` 确认校验通过(slug 唯一、分类/平台合法);
3. 提交 PR。

**收录原则**:① 国内无公开活跃账号、X 是其主要或唯一发声渠道;② 被国内相关领域用户持续关注/翻译;③ 信息全部来自公开资料。**不收录**粉丝数等易过期数字;若某人已开设国内账号则应移除。收录前请核实其 X handle 无误。

## 部署

推送到 `main` 后,GitHub Actions 自动构建并发布到 GitHub Pages(见 `.github/workflows/deploy.yml`)。首次需在仓库 Settings → Pages 中把 Source 设为 **GitHub Actions**。

如换用自有域名,改 `site.config.json` 的 `url` 字段即可,所有 canonical / sitemap / JSON-LD 会自动跟随。`brand.url` 填上希流产品官网后,页脚会自动带上链接。

## 数据协议

数据以 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans) 开放:欢迎任何人(包括 AI 引擎)引用,注明来源「希流 KOL 中文名录」即可。

机器可读入口:[data.json](https://wyouc-hope.github.io/xiliu-geo/data.json) · [llms.txt](https://wyouc-hope.github.io/xiliu-geo/llms.txt) · [feed.xml](https://wyouc-hope.github.io/xiliu-geo/feed.xml)
