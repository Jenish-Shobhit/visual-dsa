#!/usr/bin/env node
/* Wires studies/dsa-*.html into the site shell and refreshes their "Related lesson" links.
   Usage: node dev/link-studies.js        (safe to re-run; run again whenever lessons/*.html changes)

   1. Structural migration (first run only, detected by data-page="study"): swaps the old atlas/catalogue/site-shell
      includes for tokens.css + vdsa.css + core/curriculum/shell, removes the old nav/masthead/progress bar and wraps
      the content in <main id="main">.
   2. Related lesson link: derived from the `study` field in js/curriculum.js. A lesson whose page is missing from
      lessons/ is shown as plain text with "(coming soon)".
   3. Bottom navigation (previous / next deep-study cards, the index and the related lessons) and the studies.css
      cache-buster, both regenerated on every run. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const C = require(path.join(root, 'js', 'curriculum.js'));
const { GROUPS, ASSET_V } = require('./build-studies-index.js');   // reading order, titles, asset cache-buster
const order = GROUPS.flatMap(g => g.items);
const dir = path.join(root, 'studies');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const files = fs.readdirSync(dir).filter(f => /^dsa-\d+.*\.html$/.test(f)).sort();
const report = [];
for (const file of files) {
  const p = path.join(dir, file);
  let h = fs.readFileSync(p, 'utf8');
  const id = file.replace(/\.html$/, '');
  const num = id.match(/^dsa-(\d+)/)[1];

  if (!/data-page="study"/.test(h)) {
    // head: shared design system first, study styles last (studies.css overrides the inline :root)
    h = h.replace(/<link rel="stylesheet" href="\.\.\/css\/atlas\.css[^>]*>\s*/, '<link rel="stylesheet" href="../css/tokens.css">\n<link rel="stylesheet" href="../css/vdsa.css">\n<script src="../js/vdsa/core.js"></script>\n<script src="../js/curriculum.js" defer></script>\n<script src="../js/vdsa/shell.js" defer></script>\n');
    h = h.replace(/<link rel="stylesheet" href="studies\.css[^>]*>/, '<link rel="stylesheet" href="studies.css?v=vdsa1">');
    h = h.replace(/<script src="\.\.\/js\/catalogue\.js[^>]*><\/script>\s*<script src="\.\.\/js\/site-shell\.js[^>]*><\/script>/, '');
    if (!/<meta name="color-scheme"/.test(h)) h = h.replace(/<meta name="viewport"[^>]*>/, m => m + '\n<meta name="color-scheme" content="light dark">');
    h = h.replace(/color-scheme: light;[^\n]*\n/, '\n');
    // body + old chrome
    h = h.replace(/<body class="study-page">/, `<body class="study-page" data-page="study" data-crumb="Deep study ${num}">`);
    h = h.replace(/<nav class="study-nav"[\s\S]*?<\/nav>\s*/, '');
    h = h.replace(/<div class="progress" aria-hidden="true"><\/div>\s*/, '');
    h = h.replace(/<header class="(?:masthead|mast)">[\s\S]*?<\/header>\s*/, '');
    if (!/<main[\s>]/.test(h)) {
      // wrap everything between the body start and the first body script / bottom nav
      const b = h.indexOf('<body');
      const start = h.indexOf('>', b) + 1;
      const tail = h.slice(start);
      const cut = tail.search(/<script>|<nav class="study-bottom"/);
      h = h.slice(0, start) + '\n<main id="main">' + tail.slice(0, cut) + '</main>\n' + tail.slice(cut);
    }
  }

  // related lessons (always regenerated)
  h = h.replace(/<p class="study-related"[\s\S]*?<\/p>\s*/, '');
  const rel = C.lessons.filter(l => l.study === 'studies/' + file);
  if (rel.length) {
    const items = rel.map(l => {
      const label = 'Lesson ' + l.number + ' · ' + esc(l.title);
      return fs.existsSync(path.join(root, 'lessons', l.id + '.html'))
        ? `<a href="../lessons/${l.id}.html">${label}</a>`
        : `<span class="study-related__soon">${label} (coming soon)</span>`;
    });
    const html = `<p class="study-related"><span class="study-related__label">Related ${rel.length > 1 ? 'lessons' : 'lesson'}</span>${items.join('')}</p>\n`;
    h = h.replace(/<div class="study-brief"/, html + '<div class="study-brief"');
  }
  // bottom navigation: previous / next deep study by reading order, plus the index and the companion lessons
  const at = order.findIndex(it => it.file === file);
  const card = (it, dir) => it
    ? `<a class="study-bottom__card study-bottom__${dir}" href="${it.file}" rel="${dir}"><span>${dir === 'prev' ? '&larr; ' : ''}Deep study ${it.no}${dir === 'next' ? ' &rarr;' : ''}</span><strong>${esc(it.title)}</strong></a>`
    : `<a class="study-bottom__card study-bottom__${dir}" href="../index.html"><span>${dir === 'prev' ? '&larr; ' : ''}The course${dir === 'next' ? ' &rarr;' : ''}</span><strong>${dir === 'prev' ? 'Back to the lessons' : 'End of the arc: back to the lessons'}</strong></a>`;
  const lessonLinks = rel.map(l => fs.existsSync(path.join(root, 'lessons', l.id + '.html'))
    ? `<a href="../lessons/${l.id}.html">Lesson ${l.number} &middot; ${esc(l.title)}</a>` : '').join('');
  const bottom = `<nav class="study-bottom" aria-label="Continue learning">${card(order[at - 1], 'prev')}${card(order[at + 1], 'next')}<p class="study-bottom__more"><a href="index.html">All deep studies</a>${lessonLinks ? '<span>Practice it:</span>' + lessonLinks : ''}</p></nav>`;
  h = /<nav class="study-bottom"/.test(h)
    ? h.replace(/<nav class="study-bottom"[\s\S]*?<\/nav>/, bottom)
    : h.replace(/<\/body>/, bottom + '\n</body>');
  h = h.replace(/studies\.css\?v=[A-Za-z0-9]+/, 'studies.css?v=' + ASSET_V);

  report.push(`${file}: ${rel.length ? rel.map(l => l.id).join(', ') : '(no lesson references this study)'}`);
  fs.writeFileSync(p, h);
}
console.log(report.join('\n'));
