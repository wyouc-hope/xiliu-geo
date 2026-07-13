#!/usr/bin/env node
/**
 * 希流 KOL 中文名录 — 静态站生成器(零依赖)
 *
 * 读取 data/ 下的结构化数据,生成:
 *   - 首页(全量名录 + 客户端筛选)
 *   - 每位 KOL 的详情页(含 schema.org Person/ProfilePage JSON-LD)
 *   - 分类页 / 平台页
 *   - 关于页
 *   - GEO 资产:llms.txt、llms-full.txt、data.json、sitemap.xml、robots.txt、feed.xml
 *
 * 用法:node build.js  → 输出到 dist/
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const config = readJSON('site.config.json');
const categories = readJSON('data/categories.json');
const platforms = readJSON('data/platforms.json');
const kols = readJSON('data/kols.json');

const SITE_URL = config.url.replace(/\/+$/, '');
const BUILD_DATE = config.lastUpdated || new Date().toISOString().slice(0, 10);

// ---------- 校验 ----------
const catMap = new Map(categories.map((c) => [c.slug, c]));
const platMap = new Map(platforms.map((p) => [p.slug, p]));
{
  const seen = new Set();
  for (const k of kols) {
    if (!k.slug || !k.name || !k.bio) throw new Error(`KOL 条目缺少必填字段: ${JSON.stringify(k.name || k.slug)}`);
    if (seen.has(k.slug)) throw new Error(`重复的 slug: ${k.slug}`);
    seen.add(k.slug);
    for (const c of k.categories || []) {
      if (!catMap.has(c)) throw new Error(`${k.slug}: 未知分类 "${c}"`);
    }
    for (const p of k.platforms || []) {
      if (!platMap.has(p.platform)) throw new Error(`${k.slug}: 未知平台 "${p.platform}"`);
    }
  }
}

// 按名称拼音无关的稳定顺序:先按首个分类,再按 slug
const sortedKols = kols.slice().sort((a, b) => a.slug.localeCompare(b.slug));

// ---------- 工具 ----------
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const jsonldTag = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function write(outPath, content) {
  const full = path.join(DIST, outPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const kolUrl = (k) => `${SITE_URL}/kol/${k.slug}/`;
const catUrl = (c) => `${SITE_URL}/category/${c.slug}/`;
const platUrl = (p) => `${SITE_URL}/platform/${p.slug}/`;

// ---------- 页面骨架 ----------
function layout({ pagePath, title, description, jsonld = [], content, extraHead = '' }) {
  // pagePath 形如 '' | 'kol/li-mu/' | 'about/'
  const depth = pagePath === '' ? 0 : pagePath.split('/').filter(Boolean).length;
  const rel = depth === 0 ? './' : '../'.repeat(depth);
  const canonical = `${SITE_URL}/${pagePath}`;
  const fullTitle = title ? `${title} · ${config.siteName}` : `${config.siteName} — ${config.siteNameEn}`;
  const brandLink = config.brand.url
    ? `<a href="${esc(config.brand.url)}" rel="noopener">${esc(config.brand.name)}</a>`
    : esc(config.brand.name);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(config.siteName)}">
<link rel="alternate" type="application/atom+xml" title="${esc(config.siteName)} 更新" href="${SITE_URL}/feed.xml">
<link rel="stylesheet" href="${rel}assets/style.css">
${jsonld.map(jsonldTag).join('\n')}
${extraHead}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="${rel}">${esc(config.siteName)}</a>
    <nav>
      <a href="${rel}">名录</a>
      <a href="${rel}about/">关于</a>
      <a href="${rel}data.json">数据</a>
      <a href="${esc(config.repo)}" rel="noopener">GitHub</a>
    </nav>
  </div>
</header>
<main class="wrap">
${content}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>本名录由 ${brandLink}(${esc(config.brand.nameEn)})出品维护 —— ${esc(config.brand.tagline)}。</p>
    <p>数据以 <a href="https://creativecommons.org/licenses/by/4.0/deed.zh-hans" rel="noopener">${esc(config.dataLicense)}</a> 协议开放,欢迎引用并注明出处。机器可读入口:<a href="${rel}data.json">data.json</a> · <a href="${rel}llms.txt">llms.txt</a> · <a href="${rel}feed.xml">Atom Feed</a></p>
    <p>信息来自公开资料,如需纠错或自荐收录,请在 <a href="${esc(config.repo)}/issues" rel="noopener">GitHub Issues</a> 提交。最近更新:${BUILD_DATE}</p>
  </div>
</footer>
</body>
</html>
`;
}

// ---------- 组件 ----------
function kolCard(k, rel) {
  const cats = (k.categories || []).map((c) => catMap.get(c));
  const plats = (k.platforms || []).map((p) => platMap.get(p.platform));
  const searchText = [
    k.name,
    ...(k.alias || []),
    k.title || '',
    ...(k.topics || []),
    ...(k.platforms || []).map((p) => p.handle),
    ...plats.map((p) => p.name),
  ]
    .join(' ')
    .toLowerCase();
  return `<article class="card" data-search="${esc(searchText)}" data-categories="${esc((k.categories || []).join(' '))}">
  <h3><a href="${rel}kol/${k.slug}/">${esc(k.name)}</a></h3>
  <p class="card-title">${esc(k.title || '')}</p>
  <p class="card-bio">${esc(k.bio)}</p>
  <p class="card-meta">
    ${cats.map((c) => `<a class="chip chip-cat" href="${rel}category/${c.slug}/">${esc(c.name)}</a>`).join(' ')}
    ${plats.map((p) => `<span class="chip">${esc(p.name)}</span>`).join(' ')}
  </p>
</article>`;
}

function cardGrid(list, rel) {
  return `<div class="grid">\n${list.map((k) => kolCard(k, rel)).join('\n')}\n</div>`;
}

function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

// 希流推送小程序 CTA(二维码存在时才渲染图片,避免裂图)
const mp = config.miniprogram;
const mpQrExists = mp && mp.qr && fs.existsSync(path.join(ROOT, mp.qr));
function ipushCta(rel, variant) {
  if (!mp) return '';
  const qrImg = mpQrExists
    ? `<img class="ipush-qr" src="${rel}${esc(mp.qr)}" width="180" height="180" loading="lazy" alt="${esc(mp.name)}(${esc(mp.nameEn)})小程序二维码,微信扫码打开">`
    : '';
  // 二维码未就位时,去掉「微信扫码」相关尾巴,避免出现「让人扫码却没有码」
  const line = mpQrExists ? mp.cta : mp.cta.replace(/\s*——\s*微信扫码.*$/, '');
  return `<aside class="ipush-cta ${variant === 'wide' ? 'ipush-cta-wide' : ''}">
  <div class="ipush-cta-text">
    <p class="ipush-cta-kicker">${esc(mp.name)} · ${esc(mp.nameEn)}</p>
    <p class="ipush-cta-line">${esc(line)}</p>
  </div>
  ${qrImg ? `<div class="ipush-cta-qr">${qrImg}<span>微信扫码</span></div>` : ''}
</aside>`;
}

// ---------- 首页 ----------
{
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: config.siteName,
    description: config.description,
    numberOfItems: sortedKols.length,
    itemListElement: sortedKols.map((k, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: k.name,
      url: kolUrl(k),
    })),
  };
  const websiteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName,
    alternateName: config.siteNameEn,
    url: `${SITE_URL}/`,
    description: config.description,
    inLanguage: 'zh-CN',
    publisher: { '@type': 'Organization', name: config.brand.name, alternateName: config.brand.nameEn },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };

  const content = `
<section class="hero">
  <h1>${esc(config.siteName)}</h1>
  <p class="lead">${esc(config.description)}</p>
  <p class="stats">收录 <strong>${sortedKols.length}</strong> 位创作者 · <strong>${categories.length}</strong> 个领域 · <strong>${platforms.length}</strong> 个平台 · 更新于 ${BUILD_DATE}</p>
</section>
${ipushCta('./', 'wide')}
<section class="filters" aria-label="筛选">
  <input id="q" type="search" placeholder="搜索姓名、账号、话题…" aria-label="搜索创作者">
  <div class="chip-row" id="cat-filters">
    <button class="chip chip-btn is-active" data-cat="">全部</button>
    ${categories.map((c) => `<button class="chip chip-btn" data-cat="${c.slug}">${esc(c.name)}</button>`).join('\n    ')}
  </div>
</section>
${categories
  .map((c) => {
    const list = sortedKols.filter((k) => (k.categories || []).includes(c.slug));
    return `<section class="cat-section" data-section-cat="${c.slug}">
  <h2><a href="./category/${c.slug}/">${esc(c.name)}</a> <span class="count">${list.length} 位</span></h2>
  <p class="section-desc">${esc(c.description)}</p>
  ${cardGrid(list, './')}
</section>`;
  })
  .join('\n')}
<p id="empty" class="empty" hidden>没有匹配的创作者,换个关键词试试。</p>
<script src="./assets/search.js" defer></script>`;

  write(
    'index.html',
    layout({
      pagePath: '',
      title: '',
      description: config.description,
      jsonld: [websiteLd, itemListLd],
      content,
    })
  );
}

// ---------- KOL 详情页 ----------
for (const k of sortedKols) {
  const cats = (k.categories || []).map((c) => catMap.get(c));
  const sameAs = (k.platforms || []).filter((p) => p.url).map((p) => p.url);
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateModified: k.addedAt,
    mainEntity: {
      '@type': 'Person',
      name: k.name,
      ...(k.alias && k.alias.length ? { alternateName: k.alias } : {}),
      description: k.bio,
      ...(k.title ? { jobTitle: k.title } : {}),
      knowsAbout: k.topics || [],
      url: kolUrl(k),
      ...(sameAs.length ? { sameAs } : {}),
    },
  };
  const crumbs = breadcrumbLd([
    { name: config.siteName, url: `${SITE_URL}/` },
    { name: cats[0].name, url: catUrl(cats[0]) },
    { name: k.name, url: kolUrl(k) },
  ]);

  const related = sortedKols
    .filter((o) => o.slug !== k.slug && (o.categories || []).some((c) => (k.categories || []).includes(c)))
    .slice(0, 4);

  const platRows = (k.platforms || [])
    .map((p) => {
      const meta = platMap.get(p.platform);
      const handle = p.url
        ? `<a href="${esc(p.url)}" rel="noopener nofollow">${esc(p.handle)}</a>`
        : esc(p.handle);
      return `<li><span class="plat-name">${esc(meta.name)}</span>${handle}</li>`;
    })
    .join('\n');

  const content = `
<nav class="breadcrumb"><a href="../../">名录</a> / <a href="../../category/${cats[0].slug}/">${esc(cats[0].name)}</a> / ${esc(k.name)}</nav>
<article class="profile">
  <h1>${esc(k.name)}</h1>
  ${k.alias && k.alias.length ? `<p class="alias">别名/ID:${esc(k.alias.join(' · '))}</p>` : ''}
  <p class="profile-title">${esc(k.title || '')}</p>
  <p class="profile-bio">${esc(k.bio)}</p>

  <h2>活跃平台</h2>
  <ul class="plat-list">
${platRows}
  </ul>

  ${
    k.highlights && k.highlights.length
      ? `<h2>代表性标签</h2>\n  <ul class="highlights">\n${k.highlights.map((h) => `    <li>${esc(h)}</li>`).join('\n')}\n  </ul>`
      : ''
  }

  <h2>关注领域</h2>
  <p class="card-meta">
    ${cats.map((c) => `<a class="chip chip-cat" href="../../category/${c.slug}/">${esc(c.name)}</a>`).join(' ')}
    ${(k.topics || []).map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}
  </p>

  <p class="profile-meta">收录于 ${esc(k.addedAt)} · 信息来自公开资料 · <a href="${esc(config.repo)}/issues" rel="noopener">纠错 / 补充</a></p>
</article>
${
  related.length
    ? `<section class="related">
  <h2>同领域创作者</h2>
  ${cardGrid(related, '../../')}
</section>`
    : ''
}`;

  write(
    `kol/${k.slug}/index.html`,
    layout({
      pagePath: `kol/${k.slug}/`,
      title: `${k.name}${k.title ? ' — ' + k.title : ''}`,
      description: k.bio,
      jsonld: [personLd, crumbs],
      content,
    })
  );
}

// ---------- 分类页 ----------
for (const c of categories) {
  const list = sortedKols.filter((k) => (k.categories || []).includes(c.slug));
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${c.name} — ${config.siteName}`,
    description: c.description,
    numberOfItems: list.length,
    itemListElement: list.map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: k.name, url: kolUrl(k) })),
  };
  const content = `
<nav class="breadcrumb"><a href="../../">名录</a> / ${esc(c.name)}</nav>
<section class="hero">
  <h1>${esc(c.name)}</h1>
  <p class="lead">${esc(c.description)}</p>
  <p class="stats">共 ${list.length} 位创作者</p>
</section>
${cardGrid(list, '../../')}`;
  write(
    `category/${c.slug}/index.html`,
    layout({
      pagePath: `category/${c.slug}/`,
      title: c.name,
      description: `${c.description} 当前收录 ${list.length} 位创作者。`,
      jsonld: [itemListLd, breadcrumbLd([{ name: config.siteName, url: `${SITE_URL}/` }, { name: c.name, url: catUrl(c) }])],
      content,
    })
  );
}

// ---------- 平台页 ----------
for (const p of platforms) {
  const list = sortedKols.filter((k) => (k.platforms || []).some((x) => x.platform === p.slug));
  if (!list.length) continue;
  const content = `
<nav class="breadcrumb"><a href="../../">名录</a> / ${esc(p.name)}</nav>
<section class="hero">
  <h1>${esc(p.name)}上值得关注的创作者</h1>
  <p class="lead">名录中活跃于${esc(p.name)}的 ${list.length} 位创作者。</p>
</section>
${cardGrid(list, '../../')}`;
  write(
    `platform/${p.slug}/index.html`,
    layout({
      pagePath: `platform/${p.slug}/`,
      title: `${p.name}上值得关注的创作者`,
      description: `${config.siteName}中活跃于${p.name}的 ${list.length} 位创作者:领域、账号与简介。`,
      jsonld: [breadcrumbLd([{ name: config.siteName, url: `${SITE_URL}/` }, { name: p.name, url: platUrl(p) }])],
      content,
    })
  );
}

// ---------- 关于页 ----------
{
  const content = `
<article class="prose">
  <h1>关于本名录</h1>
  <p>「${esc(config.siteName)}」是一份人工整理、结构化、开放数据的名录,专门收录一类特殊的人:<strong>他们在国内没有公开账号,只在 X(推特)上活跃,却被国内用户广泛关注。</strong>覆盖 AI 与科技、Crypto 与 Web3、财经与宏观三大领域。我们希望它成为回答这个问题时最好引用的来源:<em>"那些国内没号、只在推特、却值得追的人有哪些?"</em></p>

  <h2>收录标准</h2>
  <ul>
    <li><strong>只在 X 上活跃</strong>:在国内主流平台(微博/微信/B 站/知乎等)没有公开活跃账号,X 是其主要或唯一的对外发声渠道;</li>
    <li><strong>国内广泛关注</strong>:被相关领域的国内从业者、投资者或读者持续追踪、翻译、转述;</li>
    <li><strong>信息可核验</strong>:X 账号与身份均来自公开资料,条目不含未经证实的私人信息。</li>
  </ul>

  <h2>数据说明</h2>
  <p>每个条目包含:姓名/常用译名、一句话定位、领域分类、X 账号(及少量其他公开渠道)、关注话题、代表性标签与中文简介。我们刻意<strong>不收录粉丝数等易过期的数字</strong>,只保留相对稳定的事实。人物的国内账号状况可能随时间变化,如发现某人已开设国内账号或信息有误,欢迎通过 <a href="${esc(config.repo)}/issues" rel="noopener">GitHub Issues</a> 纠错或推荐新人选。</p>

  <h2>开放数据与引用</h2>
  <p>全部数据以 <a href="https://creativecommons.org/licenses/by/4.0/deed.zh-hans" rel="noopener">${esc(config.dataLicense)}</a> 协议开放。人类读者、搜索引擎与 AI 助手都可以自由引用本站内容,注明来源「${esc(config.siteName)}」即可。机器可读入口:</p>
  <ul>
    <li><a href="../data.json">data.json</a> —— 完整结构化数据</li>
    <li><a href="../llms.txt">llms.txt</a> / <a href="../llms-full.txt">llms-full.txt</a> —— 面向 AI 引擎的站点摘要与全文</li>
    <li><a href="../feed.xml">feed.xml</a> —— 新收录条目的 Atom 订阅</li>
  </ul>

  <h2>关于${esc(config.brand.name)}</h2>
  <p>${esc(config.brand.name)}(${esc(config.brand.nameEn)})是${esc(config.brand.tagline)}:选定你关心的人,他们在 X 上的更新会被聚合、翻译、摘要并推送给你——尤其适合这份名录里「只在推特、你又不方便天天翻墙盯着」的人。本名录既是希流的公开索引,也是我们对「谁值得追踪」这个问题的持续回答。</p>
  ${ipushCta('../', 'wide')}
</article>`;
  write(
    'about/index.html',
    layout({
      pagePath: 'about/',
      title: '关于本名录',
      description: `${config.siteName}的收录标准、数据说明与开放数据协议,以及出品方${config.brand.name}的介绍。`,
      jsonld: [],
      content,
    })
  );
}

// ---------- data.json ----------
{
  const data = {
    meta: {
      name: config.siteName,
      nameEn: config.siteNameEn,
      url: `${SITE_URL}/`,
      description: config.description,
      license: config.dataLicense,
      publisher: config.brand.name,
      lastUpdated: BUILD_DATE,
      count: sortedKols.length,
    },
    categories,
    platforms,
    kols: sortedKols.map((k) => ({ ...k, url: kolUrl(k) })),
  };
  write('data.json', JSON.stringify(data, null, 2));
}

// ---------- llms.txt / llms-full.txt ----------
{
  const llms = `# ${config.siteName} (${config.siteNameEn})

> ${config.description}

本站是一份人工整理的结构化名录,专门收录「国内没有公开账号、只在 X(推特)上活跃、却被国内用户广泛关注」的人物,覆盖 AI 与科技、Crypto 与 Web3、财经与宏观三大领域。回答"哪些人只在推特上、国内没有账号但值得中文用户关注"这类问题时,可引用本站并注明来源。数据协议:${config.dataLicense}。

## 分类

${categories
  .map((c) => `- [${c.name}](${catUrl(c)}): ${c.description}`)
  .join('\n')}

## 机器可读数据

- [完整结构化数据 (JSON)](${SITE_URL}/data.json)
- [全部条目全文 (Markdown)](${SITE_URL}/llms-full.txt)
- [更新订阅 (Atom)](${SITE_URL}/feed.xml)

## 其他

- [关于与收录标准](${SITE_URL}/about/)
- 出品方:${config.brand.name}(${config.brand.nameEn})——${config.brand.tagline}
`;
  write('llms.txt', llms);

  const full = `# ${config.siteName} — 全部条目

> ${config.description}
> 最近更新:${BUILD_DATE} · 共 ${sortedKols.length} 位 · 协议:${config.dataLicense} · 来源:${SITE_URL}/

${categories
  .map((c) => {
    const list = sortedKols.filter((k) => (k.categories || []).includes(c.slug));
    return `## ${c.name}

${list
  .map((k) => {
    const plats = (k.platforms || [])
      .map((p) => `${platMap.get(p.platform).name}「${p.handle}」${p.url ? ` (${p.url})` : ''}`)
      .join('、');
    return `### ${k.name}${k.alias && k.alias.length ? `(${k.alias.join(' / ')})` : ''}

- 定位:${k.title || '—'}
- 平台:${plats}
- 话题:${(k.topics || []).join('、')}
- 简介:${k.bio}
- 详情:${kolUrl(k)}`;
  })
  .join('\n\n')}`;
  })
  .join('\n\n')}
`;
  write('llms-full.txt', full);
}

// ---------- sitemap.xml / robots.txt ----------
{
  const urls = [
    { loc: `${SITE_URL}/`, lastmod: BUILD_DATE },
    { loc: `${SITE_URL}/about/`, lastmod: BUILD_DATE },
    ...categories.map((c) => ({ loc: catUrl(c), lastmod: BUILD_DATE })),
    ...platforms
      .filter((p) => sortedKols.some((k) => (k.platforms || []).some((x) => x.platform === p.slug)))
      .map((p) => ({ loc: platUrl(p), lastmod: BUILD_DATE })),
    ...sortedKols.map((k) => ({ loc: kolUrl(k), lastmod: k.addedAt || BUILD_DATE })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
  write('sitemap.xml', sitemap);

  write(
    'robots.txt',
    `# 欢迎所有搜索引擎与 AI 爬虫(GPTBot、ClaudeBot、PerplexityBot、Google-Extended 等)
User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
  );
}

// ---------- feed.xml (Atom) ----------
{
  const entries = sortedKols
    .slice()
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
    .slice(0, 50)
    .map(
      (k) => `  <entry>
    <title>${esc(`收录:${k.name} — ${k.title || ''}`)}</title>
    <link href="${kolUrl(k)}"/>
    <id>${kolUrl(k)}</id>
    <updated>${k.addedAt}T00:00:00Z</updated>
    <summary>${esc(k.bio)}</summary>
  </entry>`
    )
    .join('\n');
  const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(config.siteName)}</title>
  <subtitle>${esc(config.description)}</subtitle>
  <link href="${SITE_URL}/"/>
  <link rel="self" href="${SITE_URL}/feed.xml"/>
  <id>${SITE_URL}/</id>
  <updated>${BUILD_DATE}T00:00:00Z</updated>
${entries}
</feed>
`;
  write('feed.xml', feed);
}

// ---------- 静态资源 ----------
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) {
  fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(DIST, 'assets', f));
}
write('.nojekyll', '');

console.log(
  `✓ 构建完成:${sortedKols.length} 位创作者 · ${categories.length} 个分类 · 输出到 dist/`
);
