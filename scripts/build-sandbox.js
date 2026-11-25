'use strict';

// Builds the sandbox: the whole game, everything unlocked, no login and no
// database — the real server routes run inside the browser on localStorage.
//
//   npm run build:sandbox             → public/sandbox.html + public/sandbox/*
//   npm run build:sandbox -- --single dist/sandbox.html
//                                     → also one self-contained HTML file
//
// Re-run it after changing routes/ or the client: the generated files are
// committed so the deployed site serves /sandbox.html without a build step.

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const OUT_DIR = path.join(PUB, 'sandbox');
const SHIMS = path.join(ROOT, 'sandbox', 'shims');

const shimPlugin = {
  name: 'sandbox-shims',
  setup(build) {
    build.onResolve({ filter: /^express$/ }, () => ({ path: path.join(SHIMS, 'express.js') }));
    build.onResolve({ filter: /^(node:)?crypto$/ }, () => ({ path: path.join(SHIMS, 'crypto.js') }));
    build.onResolve({ filter: /^(node:)?(fs|path)$/ }, () => ({ path: path.join(SHIMS, 'empty.js') }));
    build.onResolve({ filter: /(^|\/)config$/ }, args =>
      args.importer.startsWith(SHIMS) ? undefined : { path: path.join(SHIMS, 'config.js') });
    build.onResolve({ filter: /\/db\/database$/ }, () => ({ path: path.join(SHIMS, 'database.js') }));
  }
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(ROOT, 'sandbox', 'server.js')],
    bundle: true,
    format: 'iife',
    globalName: 'SandboxServer',
    platform: 'browser',
    target: ['es2019'],
    minify: true,
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"sandbox"', 'process.env': '{}' },
    plugins: [shimPlugin],
    outfile: path.join(OUT_DIR, 'server.js'),
    logLevel: 'warning'
  });
  fs.copyFileSync(path.join(ROOT, 'sandbox', 'client.js'), path.join(OUT_DIR, 'client.js'));

  // sandbox.html = index.html + the sandbox scripts right after utils.js
  let html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const anchor = '<script src="/js/utils.js"></script>';
  if (!html.includes(anchor)) throw new Error('index.html: utils.js script tag not found');
  html = html.replace(anchor, anchor +
    '\n  <script src="/sandbox/server.js"></script>\n  <script src="/sandbox/client.js"></script>');
  html = html.replace(/<title>([^<]*)<\/title>/, '<title>$1 · Sandbox</title>');
  html = html.replace('</body>', '  <div class="sandbox-badge" title="Tutto sbloccato · dati salvati solo in questo browser · aggiungi ?reset all\'indirizzo per ricominciare">SANDBOX</div>\n</body>');
  html = html.replace('</head>', '  <style>.sandbox-badge{position:fixed;left:8px;bottom:8px;z-index:9999;font:8px "Press Start 2P",monospace;color:#0a0a14;background:#ffcc33;padding:4px 6px;border-radius:3px;opacity:.85;pointer-events:auto}</style>\n</head>');
  fs.writeFileSync(path.join(PUB, 'sandbox.html'), html);
  console.log('Sandbox built: public/sandbox.html');

  // Optional: one self-contained file (scripts + CSS inlined)
  const i = process.argv.indexOf('--single');
  if (i !== -1) {
    const target = path.resolve(process.argv[i + 1] || path.join(ROOT, 'dist', 'sandbox.html'));
    let single = html;
    single = single.replace(/<link rel="stylesheet" href="\/css\/([^"]+)">/g, (_, f) =>
      `<style>\n${fs.readFileSync(path.join(PUB, 'css', f), 'utf8')}\n</style>`);
    single = single.replace(/<script src="\/(js|sandbox)\/([^"]+)"><\/script>/g, (_, dir, f) => {
      const code = fs.readFileSync(path.join(PUB, dir, f), 'utf8').replace(/<\/script/gi, '<\\/script');
      return `<script>\n${code}\n</script>`;
    });
    if (/src="\/(js|sandbox)\//.test(single) || /href="\/css\//.test(single)) {
      throw new Error('single-file build: a local asset was not inlined');
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, single);
    console.log(`Single-file sandbox: ${target} (${Math.round(single.length / 1024)} KB)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
