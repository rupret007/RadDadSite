'use strict';

// Public arcade import. The private band lab is deliberately outside this source list.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const PIN = '1a8a6edaf679ca3eaec37347d80ef885650a97ca';
const FILES = ['index.html', 'hub.html', 'TurdAnoid.html', 'turdomania.html', 'turdtris.html',
  'turdjack.html', 'crapeights.html', 'turdrummy.html', 'turdspades.html', 'chess.html',
  'neon-arkanoid.html', 'game.js', 'favicon.svg', 'assets', 'games'];
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function replaceRequired(text, before, after, label) {
  if (!text.includes(before)) throw new Error(`Upstream integration changed: ${label}`);
  return text.replace(before, after);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const args = process.argv.slice(2);
let source = 'https://github.com/rupret007/Turdanoid.git';
if (args[0] === '--source' && args[1]) { source = fs.realpathSync(args[1]); args.splice(0, 2); }
if (args.length > 1 || args.some(arg => arg.startsWith('-'))) throw new Error('Usage: node scripts/sync-arcade.cjs [--source local-repo] [ref]');
const ref = args[0] || PIN;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'raddad-arcade-'));
const stage = fs.mkdtempSync(path.join(ROOT, '.arcade-stage-'));
try {
  let sha;
  if (source.startsWith('/')) {
    sha = git(['rev-parse', '--verify', `${ref}^{commit}`], source);
    // Extract only the committed public files; don't duplicate history/screenshots locally.
    const archive = execFileSync('git', ['archive', sha, ...FILES], { cwd: source, maxBuffer: 50 * 1024 * 1024 });
    execFileSync('tar', ['-xf', '-', '-C', tmp], { input: archive });
  } else {
    git(['init', '--quiet', tmp], ROOT);
    git(['remote', 'add', 'origin', source], tmp);
    git(['fetch', '--quiet', '--depth=1', 'origin', ref], tmp);
    sha = git(['rev-parse', '--verify', 'FETCH_HEAD^{commit}'], tmp);
    git(['checkout', '--quiet', '--detach', sha], tmp);
  }
  for (const name of FILES) fs.cpSync(path.join(tmp, name), path.join(stage, name), { recursive: true });
  fs.rmSync(path.join(stage, 'assets/stalemate'), { recursive: true, force: true });
  for (const file of walk(stage)) if (/\.test\./.test(file)) fs.unlinkSync(file);

  // Keep the game audio contract and sound effects, with no Stalemate playlist or music UI.
  // Rad Dad's approved recordings remain on the existing video and streaming destinations.
  const suiteFile = path.join(stage, 'assets/turdsuite.js');
  let suite = fs.readFileSync(suiteFile, 'utf8');
  suite = replaceRequired(suite, "const STALEMATE_MUSIC_KEY = 'stalemate.music';", "const STALEMATE_MUSIC_KEY = 'raddad.music';", 'music preference');
  suite = replaceRequired(suite, 'isMusicEnabled() { return musicEnabled; }', 'isMusicEnabled() { return false; }', 'music contract');
  suite = replaceRequired(suite, "    return (location.pathname || '').split('/').pop() || '';",
    "    if (document.body?.dataset.arcadeGame === 'hub') return 'index.html';\n    const raw = (location.pathname || '').split('/').pop() || '';\n    return LIVE_HUB_GAMES.find(name => name.replace(/\\.html$/i, '').toLowerCase() === raw.toLowerCase()) || raw;", 'clean game URLs');
  suite = suite.replace(/Suite\.music = function \(\) \{[\s\S]*?\n  let fxEngine = null;/,
    'Suite.music = function () { return Promise.resolve(null); };\n\n  let fxEngine = null;');
  if (suite.includes('m.createSuiteMusic(')) throw new Error('Music adapter was not applied');
  suite = replaceRequired(suite, '    injectMusicToggle();\n    injectListenManic();', '    // Rad Dad uses game SFX; approved band performances are linked from the hub.', 'music UI');
  fs.writeFileSync(suiteFile, suite);
  fs.rmSync(path.join(stage, 'assets/suite-music.js'));
  const shareFile = path.join(stage, 'assets/suite-share.js');
  fs.writeFileSync(shareFile, fs.readFileSync(shareFile, 'utf8').replaceAll('Stalemate Arcade', 'Rad Dad Arcade').replaceAll('STALEMATE ARCADE', 'RAD DAD ARCADE'));

  // Reuse the game's actual cover art on the band homepage.
  const originalHub = fs.readFileSync(path.join(stage, 'index.html'), 'utf8');
  for (const match of originalHub.matchAll(/<a href="([^"]+\.html)" class="game-card"[\s\S]*?<svg\b([\s\S]*?)<\/svg>/g)) {
    const name = match[1].replace(/\.html$/, '').toLowerCase();
    fs.writeFileSync(path.join(stage, `assets/cover-${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg"${match[2]}</svg>\n`);
  }
  fs.copyFileSync(path.join(ROOT, 'scripts/arcade/raddad-arcade.css'), path.join(stage, 'assets/raddad-arcade.css'));
  for (const file of walk(stage).filter(file => file.endsWith('.html')).map(file => path.relative(stage, file))) {
    let html = fs.readFileSync(path.join(stage, file), 'utf8');
    html = html.replace(/<meta\b[^>]*\bname=["']robots["'][^>]*>\s*/gi, '')
      .replace(/<meta\b[^>]*\bhttp-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi, '');
    html = html.replace(/<head\b[^>]*>/i, `$&\n<meta name="robots" content="noindex,nofollow">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
    const themePath = path.relative(path.dirname(file), 'assets/raddad-arcade.css').split(path.sep).join('/');
    html = html.replace('</head>', `<link rel="stylesheet" href="${themePath}">\n</head>`);
    if (file === 'turdtris.html') {
      // This review uses game effects, with approved performances on the band
      // pages. Don't expose a game-specific switch for the disabled playlist.
      html = replaceRequired(html, '          <button class="btn subtle" id="musicToggle" type="button" onclick="toggleMusic()">♫ Music on</button>\n', '', 'Turdtris music control');
      html = replaceRequired(html, 'movement tuning and music.', 'movement tuning and sound effects.', 'Turdtris audio help');
    }
    if (file === 'index.html') {
      html = html.replaceAll('Stalemate Arcade', 'Rad Dad Arcade')
        .replace('Punk rock. Bathroom humor. One more round.', 'Loud guitars. Silly games. One more round.')
        .replace('Eight games. Zero dignity.', 'Pick a game. Beat your best.')
        .replace('Eight games • one sewer • Stalemate punk rock on every table', 'Eight free games. Sound effects optional. No sign-in.')
        .replace(/\s*<details class="changelog">[\s\S]*?<\/details>/, '');
      html = html.replace(/<body\b[^>]*>/, '$&\n<nav class="rad-arcade-nav" aria-label="Rad Dad"><a href="../"><img src="../RadDad_Logo.jpg" width="40" height="40" alt="">Rad Dad</a><a href="../#watch">Do your homework ↗</a></nav>');
    }
    fs.writeFileSync(path.join(stage, file), html);
  }
  fs.writeFileSync(path.join(stage, 'VENDORED.txt'), `Rad Dad Arcade: github.com/rupret007/Turdanoid@${sha}\nOriginal arcade material: same owner as RadDadSite. New chess modules/page and Chessground10.5.0: GPL-3.0-or-later. Spatial piece artwork by Maurizio Monge: MIT. chess.js 1.4.0: BSD-2-Clause. Stockfish.js 19.0.1: GPL-3.0. See assets/chess/credits.html, included licenses and corresponding-source archive.\nGenerated with node scripts/sync-arcade.cjs ${sha}. Edit the importer and scripts/arcade/, not play/.\nNo Stalemate recordings or private band-lab files are included.\n`);
  const inventory = walk(stage).map(file => `play/${path.relative(stage, file).split(path.sep).join('/')}`).sort();
  const dest = path.join(ROOT, 'play');
  const backup = `${stage}-previous`;
  if (fs.existsSync(dest)) fs.renameSync(dest, backup);
  try { fs.renameSync(stage, dest); }
  catch (error) { if (fs.existsSync(backup)) fs.renameSync(backup, dest); throw error; }
  fs.rmSync(backup, { recursive: true, force: true });
  fs.writeFileSync(path.join(ROOT, 'scripts/arcade/client-paths.json'), JSON.stringify(inventory, null, 2) + '\n');
  const deployFile = path.join(ROOT, 'scripts/deploy/server-deploy.sh');
  const deploy = fs.readFileSync(deployFile, 'utf8');
  const marker = /    # BEGIN GENERATED RAD DAD ARCADE[\s\S]*?    # END GENERATED RAD DAD ARCADE/;
  if (!marker.test(deploy)) throw new Error('Server artifact allowlist markers missing');
  fs.writeFileSync(deployFile, deploy.replace(marker,
    '    # BEGIN GENERATED RAD DAD ARCADE\n' + [...inventory, 'raddad.css'].map(file => `    ${JSON.stringify(file)},`).join('\n') + '\n    # END GENERATED RAD DAD ARCADE'));
  console.log(`Imported ${sha}: ${inventory.length} explicitly listed public arcade files.`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(stage, { recursive: true, force: true });
}
