// 配布用 ZIP と、README記載の「開発者モードでの読み込み（Load unpacked）」用の
// 展開済みディレクトリ（stable unpacked面）を生成するスクリプト。
// 同梱するのは manifest.json / _locales/ / src/ / popup/ / icons/ / 実行時に使うマスコット2画像のみ。
// assets/mascot-source.png(2048x2048、開発用の原本)は実行時に参照されないため、
// 配布物に含めない。ディレクトリ丸ごとではなく個別ファイルとして指定することで除外している。
//
// 【stable unpacked面は必ず削除差分込みで再生成する】2026-08-11実測: 増分コピーだと
// リポジトリ側で撤去されたファイル（例: youtube_watch.js）がunpacked面に残留し続け、
// ユーザーがLoad unpackedで読み込んでいる拡張が「撤去したはずの旧コードのまま」になる
// 配布欠陥を起こした（room[95]）。既存のunpacked面を丸ごと削除してから作り直すことで、
// 撤去されたファイルが残らないことを保証する。ZIPはこのunpacked面から生成するため、
// 両者は常に同一内容になる（ZIPだけを別経路で作ると同種の乖離が再発するので避ける）。
//
// 実行: node scripts/pack.mjs [出力先ZIPパス]
//   省略時は dist/nope-v<manifestのversion>.zip
//   unpacked面は同じディレクトリの dist/nope-v<version>-unpacked/ に生成する
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const INCLUDE_ENTRIES = [
  "manifest.json",
  "_locales",
  "src",
  "popup",
  "icons",
  "assets/mascot-blocked.png",
  "assets/mascot-blocked-hover.png",
];

function readManifestVersion() {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "manifest.json"), "utf-8"),
  );
  return manifest.version;
}

function main() {
  for (const entry of INCLUDE_ENTRIES) {
    const p = join(repoRoot, entry);
    if (!existsSync(p)) {
      throw new Error(`同梱対象が見つからない: ${entry} (${p})`);
    }
  }

  const version = readManifestVersion();
  const outArg = process.argv[2];
  const outPath = outArg
    ? resolve(outArg)
    : join(repoRoot, "dist", `nope-v${version}.zip`);
  const unpackedPath = join(dirname(outPath), `nope-v${version}-unpacked`);

  mkdirSync(dirname(outPath), { recursive: true });
  if (existsSync(outPath)) {
    rmSync(outPath);
  }

  // stable unpacked面を丸ごと削除してから作り直す（削除差分込みの再生成。上記コメント参照）。
  if (existsSync(unpackedPath)) {
    rmSync(unpackedPath, { recursive: true, force: true });
  }
  mkdirSync(unpackedPath, { recursive: true });

  for (const entry of INCLUDE_ENTRIES) {
    const dest = join(unpackedPath, entry);
    // entry が "assets/mascot-blocked.png" のようなネストしたファイルの場合、
    // 親ディレクトリ(unpackedPath/assets/)を先に作っておく必要がある。
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(repoRoot, entry), dest, {
      recursive: true,
    });
  }

  // ZIPはunpacked面から生成する（同じソースなのでZIPとunpackedの内容が必ず一致する）。
  // エントリ名は必ずフォワードスラッシュで統一する（PowerShell の Compress-Archive は
  // バックスラッシュで保存するため WSL 上での展開時に平坦ファイル名になる問題がある。
  // Python zipfile は常にフォワードスラッシュを使う）。
  // entry順・timestamp・permissionも固定し、同じsourceから同じSHA-256を再現できるようにする。
  execFileSync(
    "python3",
    [
      "-c",
      [
        "import zipfile, os, sys",
        "staging, outpath = sys.argv[1], sys.argv[2]",
        "entries = []",
        "for root, dirs, files in os.walk(staging):",
        "    dirs.sort()",
        "    for f in sorted(files):",
        "        entries.append((os.path.relpath(os.path.join(root, f), staging).replace(os.sep, '/'), os.path.join(root, f)))",
        "with zipfile.ZipFile(outpath, 'w') as zf:",
        "    for arcname, fp in sorted(entries):",
        "        info = zipfile.ZipInfo(arcname, date_time=(1980, 1, 1, 0, 0, 0))",
        "        info.create_system = 3",
        "        info.external_attr = (0o100644 & 0xFFFF) << 16",
        "        info.compress_type = zipfile.ZIP_DEFLATED",
        "        with open(fp, 'rb') as source:",
        "            zf.writestr(info, source.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)",
      ].join("\n"),
      unpackedPath,
      outPath,
    ],
    { stdio: "inherit" },
  );

  console.log(`wrote ${outPath}`);
  console.log(`wrote ${unpackedPath}`);
}

main();
