// scripts/pack.mjs のテスト。
// 2026-08-11実測の配布欠陥（room[95]）: stable unpacked面が増分コピーのまま
// 放置され、リポジトリ側で撤去したファイル（youtube_watch.js）がユーザーの読み込み中拡張に
// 残留し続けた。pack.mjsをchild processとして実際に実行し、ZIP/unpacked面の同一性と
// 「stable unpacked面は削除差分込みで再生成される（撤去済みファイルが残らない）」ことを検証する。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packScript = path.join(repoRoot, 'scripts', 'pack.mjs');

function readManifestVersion() {
  return JSON.parse(readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8')).version;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function listZipEntries(zipPath) {
  const output = execFileSync('python3', [
    '-c',
    'import zipfile, sys; zf = zipfile.ZipFile(sys.argv[1]); print("\\n".join(sorted(zf.namelist())))',
    zipPath,
  ]).toString();
  return output.split('\n').filter(Boolean);
}

test('pack.mjs: ZIPとunpacked面のファイル一覧が一致する', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pack-test-'));
  try {
    const version = readManifestVersion();
    const zipPath = path.join(outDir, `nope-v${version}.zip`);
    execFileSync('node', [packScript, zipPath], { cwd: repoRoot });

    const unpackedPath = path.join(outDir, `nope-v${version}-unpacked`);
    assert.ok(existsSync(unpackedPath), 'unpacked面が生成されていない');
    assert.ok(existsSync(path.join(unpackedPath, 'manifest.json')), 'unpacked直下にmanifest.jsonが無い');

    const zipEntries = listZipEntries(zipPath);
    const unpackedFiles = listFilesRecursive(unpackedPath)
      .map((f) => path.relative(unpackedPath, f).split(path.sep).join('/'))
      .sort();

    assert.deepEqual(zipEntries, unpackedFiles, 'ZIPとunpacked面のファイル一覧が一致しない');
    for (const entry of unpackedFiles) {
      assert.deepEqual(
        readFileSync(path.join(unpackedPath, ...entry.split('/'))),
        readFileSync(path.join(repoRoot, ...entry.split('/'))),
        `${entry}がリポジトリの同名ファイルと一致しない`,
      );
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('pack.mjs: 通常・hover両方のマスコット画像を配布物へ同梱する', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pack-test-'));
  try {
    const version = readManifestVersion();
    const zipPath = path.join(outDir, `nope-v${version}.zip`);
    const unpackedPath = path.join(outDir, `nope-v${version}-unpacked`);
    execFileSync('node', [packScript, zipPath], { cwd: repoRoot });

    const mascotEntries = [
      'assets/mascot-blocked.png',
      'assets/mascot-blocked-hover.png',
    ];
    const zipEntries = listZipEntries(zipPath);
    for (const entry of mascotEntries) {
      const packagedPath = path.join(unpackedPath, ...entry.split('/'));
      assert.ok(existsSync(packagedPath), `${entry}がunpacked面に含まれていない`);
      assert.ok(zipEntries.includes(entry), `${entry}がZIPに含まれていない`);
      assert.deepEqual(readFileSync(packagedPath), readFileSync(path.join(repoRoot, entry)),
        `${entry}がソース資産と一致しない`);
    }
    assert.ok(!zipEntries.includes('assets/kitepon-dev-primary.png'),
      '撤去済みの別ロゴ資産がZIPに含まれている');
    assert.ok(!zipEntries.some((entry) => entry.startsWith('assets/store/')),
      'Chrome Web Store掲載素材がextension runtime ZIPへ混入している');
    assert.ok(zipEntries.includes('_locales/en/messages.json'),
      '英語catalogがZIPに含まれていない');
    assert.ok(zipEntries.includes('_locales/ja/messages.json'),
      '日本語catalogがZIPに含まれていない');
    assert.equal(existsSync(path.join(unpackedPath, 'assets', 'kitepon-dev-primary.png')), false,
      '撤去済みの別ロゴ資産がunpacked面に含まれている');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('pack.mjs: unpacked面は削除差分込みで再生成される（撤去済みファイルが残らない）', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pack-test-'));
  try {
    const version = readManifestVersion();
    const zipPath = path.join(outDir, `nope-v${version}.zip`);
    const unpackedPath = path.join(outDir, `nope-v${version}-unpacked`);

    // リポジトリでは既に撤去されたファイルが、前回のpack実行の残骸として
    // unpacked面にだけ残っている状態を模す（2026-08-11実測のyoutube_watch.js残存と同じ形）。
    const staleFile = path.join(unpackedPath, 'src', 'adapters', 'stale-retired-file.js');
    mkdirSync(path.dirname(staleFile), { recursive: true });
    writeFileSync(staleFile, '// 撤去済みのはずの残骸ファイル\n');
    assert.ok(existsSync(staleFile), '前提: staleファイルを作れているはず');

    execFileSync('node', [packScript, zipPath], { cwd: repoRoot });

    assert.equal(existsSync(staleFile), false,
      '削除差分込みで再生成されていない（撤去済みファイルがunpacked面に残留している）');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('pack.mjs: 撤去済みのyoutube_watch.jsが現在の同梱物に含まれない', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pack-test-'));
  try {
    const version = readManifestVersion();
    const zipPath = path.join(outDir, `nope-v${version}.zip`);
    const unpackedPath = path.join(outDir, `nope-v${version}-unpacked`);
    execFileSync('node', [packScript, zipPath], { cwd: repoRoot });

    assert.equal(existsSync(path.join(unpackedPath, 'src', 'adapters', 'youtube_watch.js')), false,
      'youtube_watch.js（yt-watch-retireで撤去済み）がunpacked面に含まれている');
    const zipEntries = listZipEntries(zipPath);
    assert.ok(!zipEntries.includes('src/adapters/youtube_watch.js'),
      'youtube_watch.jsがZIPに含まれている');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('pack.mjs: 同じsourceから同じSHA-256のZIPを再生成できる', () => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'pack-test-'));
  try {
    const version = readManifestVersion();
    const zipPath = path.join(outDir, `nope-v${version}.zip`);

    execFileSync('node', [packScript, zipPath], { cwd: repoRoot });
    const firstHash = sha256(zipPath);
    execFileSync('node', [packScript, zipPath], { cwd: repoRoot });

    assert.equal(sha256(zipPath), firstHash,
      '同じsourceをpackし直したZIPのSHA-256が変化した');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
