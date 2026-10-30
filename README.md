# MarkPad

[中文](#中文) · [English](#english)

一个纯本地的安卓 Markdown 笔记本 —— 写的时候是纯文本，读的时候排好版，所有内容只留在这台手机上。

A local-first Markdown notebook for Android. Write in plain Markdown, read it typeset, keep everything on the device — no account, no sync, no network.

---

## 中文

### 这是什么

MarkPad 是一个只给自己用的 Markdown 写作工具。没有账号、没有云同步、不发起任何网络请求，笔记全部存在手机本地。它同时是一个真正的安卓应用（WebView 外壳 + 内置本地资源服务器）和一份零打包器的 TypeScript/React 代码库：`tsc` 负责编译，一个手写 CSS 文件承载全部设计，`aapt2` / `d8` / `apksigner` 直接组装 APK —— 没有 Vite、没有 Tailwind、没有 Gradle。

### 功能

**写作**
- 三种视图：**编辑**（原始 Markdown，语法着色衬在输入框下面）、**分屏**（上写下看，中间那道杠可上下拖）、**预览**（只留排好版的正文），退出时记住上次用的视图
- 工具栏 13 个键：粗体、斜体、删除线、标题、引用、无序列表、有序列表、任务、行内代码、链接、图片、分隔线、表格
- 智能回车：列表自动续行、任务自动补 `[ ]`、序号自动递增，空项回车直接退出列表
- Tab 缩进、Shift+Tab 反缩进；插入图片可直接从相册选

**Markdown**
- 标题、强调、删除线、行内代码、链接、图片、围栏代码块、引用、有序 / 无序 / 任务列表、分隔线、表格
- 代码块按语言高亮，带一键复制按钮
- 任务项在阅读视图里可以直接点选，改动会写回源文档

**阅读**
- 三种主题：浅色 / 护眼 / 深色
- 正文可选无衬线或衬线，字号 13–22px，行高 1.50–2.20，页边距窄 / 标准 / 宽，全部实时生效

**整理**
- 文档库平铺列表，置顶优先，标题加正文全文搜索，命中处高亮，每篇显示相对时间（今天 / 昨天 / 日期）和字数
- 置顶、复制一份、删除（二次确认）、长文大纲面板一键跳转

**导入导出**
- 导入 `.md` / `.txt`：可多选文件，也可以选整个文件夹（递归子目录，自动跳过 `.git`、`node_modules` 等）
- 直接把文件或文件夹拖到文档库窗口也能导入，拖拽时显示「松手导入」遮罩
- 相同内容自动去重，重复导入提示「这 N 篇已经在库里了」；单次上限 400 篇、单文件 4MB
- 标题优先取文件名，`index.md` 这类泛用名则取正文第一个标题
- 单篇导出为 Markdown、整库导出为一个备份文件、分享为纯文本

**其他**
- 首次启动自带 5 篇示例笔记：欢迎使用、本周待办、深度工作读书笔记、语法速查、一些还没成形的想法
- 状态栏与导航栏颜色跟随主题，返回键行为符合安卓习惯（先关面板，再回列表，最后才退出）

### 快速开始（网页版）

```bash
npm install
npm run build     # 构建 CSS + 拷贝 React vendor + tsc 编译 + 改写模块路径 → www/
npm run static    # http://127.0.0.1:5173
```

打开 <http://127.0.0.1:5173>。把窗口拉窄，行为就和手机上一模一样。

### 安装 APK

1. 下载 [`dist/MarkPad-1.1.0.apk`](dist/MarkPad-1.1.0.apk)
2. 传到手机上点击安装，允许「安装未知来源应用」
3. 最低支持 Android 7.0（API 24），目标 API 34；覆盖安装不会丢数据

或者用数据线：`adb install -r dist/MarkPad-1.1.0.apk`

### 自行构建 APK

需要 JDK 17 和 Android SDK（`platforms;android-34`、`build-tools;34.0.0`）。SDK 由 `tools/fetch-sdk.mjs` 按需下载，放在项目旁边：

```
android-sdk/
  platforms/android-34/android.jar
  build-tools/34.0.0/{aapt2,d8,zipalign,apksigner}
```

```bash
node tools/fetch-sdk.mjs                       # 约 150MB，只需一次
sdkmanager "platforms;android-34" "build-tools;34.0.0"
npm run icons                                  # 生成启动图标（需要 Pillow）
npm run apk                                    # -> android/build/MarkPad-1.1.0.apk
```

打包是一条直白的流水线：`aapt2 compile` + `aapt2 link`（资源、清单、assets）→ `javac`（R.java 加 Java 源码）→ `d8`（生成 dex）→ 重新打包让 `resources.arsc` 保持 stored（`targetSdk 34` 的安装要求）→ `zipalign` → `apksigner` 用 `android/debug.keystore` 签名。

> 在 Windows 上直接跑 `powershell -NoProfile -ExecutionPolicy Bypass -File android/build.ps1`，加 `-SkipWeb` 可跳过前端构建。

### 外壳是怎么工作的

- `MainActivity` 里只放一个 `WebView`。页面**不从 `file://` 加载**（ES module 和 `localStorage` 都需要真实 origin），而是由 `AssetServer` 在守护线程里把 `assets/www` 提供到 `http://127.0.0.1:47413`。端口写死是有意的：origin 稳定，笔记才不会丢。
- `window.MarkPad` 是桥：`saveFile`（Android 10+ 写 MediaStore 的「下载/MarkPad」，更低版本写公共下载目录并先申请权限）、`shareFile`（系统分享面板）、`setBars`（状态栏 / 导航栏跟随主题）、`haptic`、`pickFolder`（系统文件夹选择器，由 `DocumentsContract` 遍历目录树，结果通过 `window.__markpadFolder` 回推）。
- `WebChromeClient` 实现了 `onShowFileChooser`，这是 WebView 里 `<input type=file>` 能弹出选择器的前提 —— 缺了它，安卓上的文件选择会静默失效。
- 硬件返回键先问页面（`window.__markpadBack`）：关掉打开的面板，再回文档库，只有库已经显示时才退出应用。

### 目录结构

```
src/
  main.tsx, App.tsx        hash 路由（#/, #/doc/:id, #/settings）
  store.tsx                文档与设置、localStorage 持久化、首启播种、导入合并
  screens/                 文档库、编辑器、设置
  components/              编辑器（textarea + 高亮层）、Markdown 渲染、面板、图标
  lib/                     Markdown 解析、高亮、导入、格式化、存储、原生桥
  index.css                整套设计系统（令牌、主题、组件）
tools/                     build.mjs、serve.mjs、smoke.cjs、shot.mjs、pack.py、make-icon.py
android/                   清单、Java 外壳、资源、build.ps1
```

### 数据

全部存在 `localStorage` 的 `markpad.docs.v1` 和 `markpad.settings.v1` 里。没有服务器，没有账号。清除应用数据会连笔记一起删掉，重要内容请用「导出全部」备份。

### 测试

- `npm test` —— 53 条断言，覆盖 Markdown 解析、语法高亮、代码分词、格式化函数和导入去重规则（编译成 CommonJS 跑在 `.smoke/`，不需要浏览器）
- `node tools/shot.mjs` —— CDP 驱动，在无头 Chrome 里把整个应用走一遍（文档库、编辑器、分屏、阅读、大纲、三种主题的设置页、搜索、拖拽导入），截图写到 `.shots/`，控制台报错即失败
- `node tools/check-apk.mjs` —— 直接解包 APK，确认里面打的是最新构建的前端资源
- `node tools/check-repo.mjs` —— 通过 GitHub API 核对远端仓库的提交、作者与文件数

### 已知限制

- 完整的功能与视觉验证都在浏览器里完成，**安卓真机上的系统文件选择器与文件夹选择器还没有实测过**
- 图片支持 Markdown 语法与本地选取，但图片是外部引用，不会嵌进文档
- 数据只在本机，换手机需要手动导出再导入

---

## English

### What it is

A small, offline Markdown notebook for your phone. No accounts, no sync, no network. It is a real Android app (a WebView shell plus a tiny local asset server) built from a zero-bundler TypeScript/React codebase: `tsc` compiles the app, a single hand-written CSS file carries the design, and `aapt2` / `d8` / `apksigner` assemble the APK — no Vite, no Tailwind, no Gradle.

### Features

**Writing**
- Three views: *edit* (raw Markdown with live syntax colouring layered under the textarea), *split* (write on top, live preview below, draggable divider) and *preview* (reading only). The last used view is remembered.
- A 13-key toolbar: bold, italic, strike, heading, quote, bullet, numbered list, task, inline code, link, image, divider and table.
- Smart Enter continues lists, adds `[ ]` to tasks and increments numbers; an empty item exits the list. Tab indents, Shift+Tab outdents.

**Markdown**
- Headings, emphasis, strikethrough, inline code, links, images, fenced code, block quotes, ordered / unordered / task lists, horizontal rules and tables.
- Code blocks are highlighted per language and have a one-tap copy button.
- Task items are clickable in the reading view and write the change back into the source.

**Reading comfort**
- Theme (light / sepia / dark), serif or sans body, font size 13–22px, line height 1.50–2.20 and page margins, all applied live through CSS variables.

**Organising**
- One flat list, pinned notes first, full-text search over title and body with match highlighting, relative timestamps and word counts.
- Pin, duplicate, delete (with confirmation), and an outline sheet for long notes.

**Import and export**
- Import one or more `.md` / `.txt` files, import a whole folder (walked recursively, skipping `.git`, `node_modules` and friends), or just drag files and folders onto the library list.
- Duplicate bodies are skipped, and the toast tells you how many were already there. Up to 400 notes per import, 4 MB per file.
- Note titles come from the file name when it is more specific than the first heading.
- Export one note as Markdown, the whole library as a single backup file, or share a note as plain text.

**First run** ships five sample notes so the empty state is never empty.

### Run it in the browser

```bash
npm install
npm run build     # CSS + React vendor + tsc + import rewrite -> www/
npm run static    # http://127.0.0.1:5173
```

Then open <http://127.0.0.1:5173>. On a narrow window it behaves exactly like the phone app.

### Install the APK

Download [`dist/MarkPad-1.1.0.apk`](dist/MarkPad-1.1.0.apk), copy it to the phone and open it (allow installing from unknown sources). Android 7.0 (API 24) or newer; upgrading in place keeps your notes. Or `adb install -r dist/MarkPad-1.1.0.apk`.

### Build the APK yourself

Requires JDK 17 and the Android SDK (`platforms;android-34`, `build-tools;34.0.0`). The SDK is downloaded on demand by `tools/fetch-sdk.mjs` and expected next to this folder:

```
android-sdk/
  platforms/android-34/android.jar
  build-tools/34.0.0/{aapt2,d8,zipalign,apksigner}
```

```bash
node tools/fetch-sdk.mjs                       # ~150 MB, once
sdkmanager "platforms;android-34" "build-tools;34.0.0"
npm run icons                                  # launcher icons (Pillow)
npm run apk                                    # -> android/build/MarkPad-1.1.0.apk
```

The build is a straight pipeline: `aapt2 compile` + `aapt2 link` (resources, manifest, assets) → `javac` (R.java plus the Java sources) → `d8` (dex) → repack so `resources.arsc` stays stored (required by `targetSdk 34`) → `zipalign` → `apksigner` with `android/debug.keystore`.

> On Windows run `powershell -NoProfile -ExecutionPolicy Bypass -File android/build.ps1`; add `-SkipWeb` to skip the frontend build.

### How the shell works

- `MainActivity` hosts one `WebView`. The web app is **not** loaded from `file://` (ES modules and `localStorage` need a real origin), so `AssetServer` serves `assets/www` on `http://127.0.0.1:47413` from a daemon thread. The port is fixed on purpose: the origin — and therefore every saved note — stays stable across launches.
- `window.MarkPad` is the bridge: `saveFile` (MediaStore Downloads on Android 10+, public Downloads with a permission prompt before that), `shareFile` (system share sheet), `setBars` (status/nav bar colour follows the theme), `haptic`, and `pickFolder` (the system folder picker; the activity walks the tree with `DocumentsContract` and hands the result back through `window.__markpadFolder`).
- A `WebChromeClient` implements `onShowFileChooser`, which is what makes `<input type=file>` work inside the WebView — without it the file picker silently does nothing on Android.
- The hardware back button asks the page first (`window.__markpadBack`): it closes an open sheet, then returns to the library, and only exits the app when the library is already showing.

### Layout

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

### Data

Everything lives in `localStorage` under `markpad.docs.v1` and `markpad.settings.v1`. There is no server and no account. Clearing app data deletes the notes, so use *Export all* for backups.

### Tests

- `npm test` — 53 assertions over the Markdown parser, highlighter, tokenizer, formatters and the import merging rules (compiled to CommonJS into `.smoke/`, no browser needed).
- `node tools/shot.mjs` — CDP driver that walks the whole app in headless Chrome (library, editor, split, reader, outline, settings in all three themes, search, drag-and-drop import), writes screenshots to `.shots/` and fails loudly on console errors.
- `node tools/check-apk.mjs` — unpacks the APK and proves the packaged frontend assets are the latest build.
- `node tools/check-repo.mjs` — checks the published repo's commit, author and file count through the GitHub API.

### Known limitations

- Everything was verified in the browser; the Android system file picker and folder picker have **not** been exercised on a real device yet.
- Images are external references — nothing is embedded into the document.
- Data stays on one device; moving phones means exporting and re-importing.
