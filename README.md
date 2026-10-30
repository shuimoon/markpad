# MarkPad

A small, offline Markdown notebook for your phone. Write in plain Markdown, read it typeset, keep
everything on the device — no accounts, no sync, no network.

> **中文简介**:一个纯本地的安卓 Markdown 笔记本。分屏实时预览、编辑器自带语法高亮、大纲跳转、
> 三种阅读主题、`.md` 导入/导出,以及「导入文件 / 导入文件夹 / 直接拖进来」。所有数据只存在手机上,
> 不联网、不需要账号。仓库里 `dist/MarkPad-1.1.0.apk` 可直接安装。

Built as a real Android app (WebView shell + a tiny local asset server) from a zero-dependency
TypeScript/React codebase. No Vite, no Tailwind, no Gradle: `tsc` compiles the app, a hand-written
CSS file carries the design, and `aapt2`/`d8`/`apksigner` assemble the APK.

## What it does

- **Library** — every note in one list, pinned notes first, full-text search (title + body) with
  match highlighting, relative timestamps and word counts.
- **Editor** — three views: *edit* (raw Markdown with live syntax colouring layered under the
  textarea), *split* (write on top, live preview below, draggable divider) and *preview* (reading
  only). The last used view is remembered.
- **Markdown** — headings, emphasis, strikethrough, inline code, links, images, fenced code with
  highlighting, block quotes, ordered/unordered/task lists, horizontal rules and tables.
- **Toolbar** — bold, italic, strike, heading, quote, bullet, numbered list, task, inline code,
  link, image, divider and table, plus smart Enter (continues lists and tasks) and Tab indent.
- **Reading comfort** — theme (light / sepia / dark), serif or sans body, font size, line height
  and page margins, all applied through CSS variables.
- **Organise** — pin, duplicate, delete, outline sheet for long notes, one-tap copy of a note.
- **Import** — pick one or more `.md`/`.txt` files, import a whole folder (WebView uses the system
  folder picker, the browser uses `webkitdirectory`), or just drag files/folders onto the library
  list. Duplicates (same body) are skipped, folders are walked recursively, and the note title comes
  from the file name when it is more specific than the first heading.
- **Export** — one note as Markdown, or the whole library as a single backup file; share as text.
- **First run** — five sample notes (welcome tour, weekly todos, reading notes, syntax cheat sheet,
  half-formed ideas) so the empty state is never empty.

## Run it

```bash
npm run build          # tools/build.mjs (CSS + vendor) then tsc, then import rewrite -> www/
npm run static         # http://127.0.0.1:5173
```

Then open <http://127.0.0.1:5173>. On a narrow window it behaves exactly like the phone app.

## Build the APK

Requires JDK 17 and the Android SDK (`platforms;android-34`, `build-tools;34.0.0`) — the SDK is
downloaded on demand by `tools/fetch-sdk.mjs`, and the script expects it next to this folder:

```
android-sdk/
  platforms/android-34/android.jar
  build-tools/34.0.0/{aapt2,d8,zipalign,apksigner}
```

```bash
node tools/fetch-sdk.mjs                       # 150 MB, once
sdkmanager "platforms;android-34" "build-tools;34.0.0"
npm run icons                                  # launcher icons (Pillow)
npm run apk                                    # -> android/build/MarkPad-1.1.0.apk
```

The build is a straight pipeline: `aapt2 compile` + `aapt2 link` (resources, manifest, assets) →
`javac` (R.java + the Java sources) → `d8` (dex) → repack so `resources.arsc` stays stored (required
for `targetSdk 34`) → `zipalign` → `apksigner` with `android/debug.keystore`.

Install with `adb install android/build/MarkPad-1.1.0.apk`, or copy the APK to the phone and open it
(allow installing from unknown sources).

## How the shell works

- `MainActivity` hosts one `WebView`. The web app is **not** loaded from `file://` (ES modules and
  `localStorage` need a real origin), so `AssetServer` serves `assets/www` on
  `http://127.0.0.1:47413` from a daemon thread. The port is fixed on purpose: the origin — and
  therefore every saved note — stays stable across launches.
- `window.MarkPad` is the bridge: `saveFile` (MediaStore Downloads on Android 10+, public Downloads
  with a permission prompt before that), `shareFile` (system share sheet), `setBars` (status/nav bar
  colour follows the theme), `haptic`, and `pickFolder` (the system folder picker; the activity walks
  the tree with `DocumentsContract` and hands the result back through `window.__markpadFolder`).
- A `WebChromeClient` implements `onShowFileChooser`, which is what makes `<input type=file>` work
  inside the WebView — without it the file picker silently does nothing on Android.
- The hardware back button asks the page first (`window.__markpadBack`): it closes an open sheet,
  then returns to the library, and only exits the app when the library is already showing.

## Layout

```
src/
  main.tsx, App.tsx        hash router (#/, #/doc/:id, #/settings)
  store.tsx                documents + settings, localStorage persistence, seeding, import merge
  screens/                 Library, Editor, Settings
  components/              Editor (textarea + highlight overlay), MarkdownView, Sheet, Icon
  lib/                     markdown parser, highlighters, importers, formatting, storage, bridge
  index.css                the whole design system (tokens, themes, components)
tools/                     build.mjs, serve.mjs, smoke.cjs, shot.mjs, pack.py, make-icon.py
android/                   manifest, Java shell, resources, build.ps1
```

## Data

Everything lives in `localStorage` under `markpad.docs.v1` and `markpad.settings.v1`. There is no
server and no account. Clearing app data deletes the notes, so use *Export all* for backups.

## Tests

- `npm test` — 53 assertions over the Markdown parser, highlighter, tokenizer, formatters and the
  import merging rules (compiled to CommonJS into `.smoke/`, no browser needed).
- `node tools/shot.mjs` — CDP driver that walks the whole app in headless Chrome (library, editor,
  split, reader, outline, settings in all three themes, search, drag-and-drop import), writes
  screenshots to `.shots/` and fails loudly on console errors.
