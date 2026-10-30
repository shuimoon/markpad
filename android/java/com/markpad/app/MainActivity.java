package com.markpad.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;

public class MainActivity extends Activity {
	private static final int REQ_STORAGE = 41;
	private static final int REQ_FILE = 42;
	private static final int REQ_FOLDER = 43;

	/** Keep imports bounded so a huge folder cannot freeze the app. */
	private static final int MAX_IMPORT_FILES = 400;
	private static final int MAX_IMPORT_CHARS = 2_000_000;

	private WebView web;
	private AssetServer server;
	private String pendingName;
	private String pendingContent;
	private ValueCallback<Uri[]> filePathCallback;

	@SuppressLint("SetJavaScriptEnabled")
	@Override
	protected void onCreate(Bundle state) {
		super.onCreate(state);

		try {
			server = new AssetServer(getAssets(), AssetServer.DEFAULT_PORT);
			server.start();
		} catch (IOException e) {
			server = null;
		}

		FrameLayout root = new FrameLayout(this);
		root.setBackgroundColor(Color.parseColor("#F5F6F3"));
		web = new WebView(this);
		root.addView(web, new FrameLayout.LayoutParams(-1, -1));
		setContentView(root);

		WebSettings s = web.getSettings();
		s.setJavaScriptEnabled(true);
		s.setDomStorageEnabled(true);
		s.setDatabaseEnabled(true);
		s.setSupportZoom(false);
		s.setBuiltInZoomControls(false);
		s.setTextZoom(100);
		s.setMediaPlaybackRequiresUserGesture(false);
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
			s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
		}

		web.setBackgroundColor(Color.parseColor("#F5F6F3"));
		web.setWebChromeClient(new WebChromeClient() {
			@Override
			public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
				// Without this the page's <input type="file"> does nothing inside a WebView.
				if (filePathCallback != null) {
					filePathCallback.onReceiveValue(null);
					filePathCallback = null;
				}
				filePathCallback = callback;
				Intent intent;
				try {
					intent = params.createIntent();
					intent.addCategory(Intent.CATEGORY_OPENABLE);
				} catch (Exception e) {
					intent = broadFileIntent();
				}
				try {
					startActivityForResult(intent, REQ_FILE);
				} catch (Exception e) {
					try {
						startActivityForResult(broadFileIntent(), REQ_FILE);
					} catch (Exception again) {
						filePathCallback = null;
						return false;
					}
				}
				return true;
			}
		});
		web.setWebViewClient(new WebViewClient() {
			@Override
			public boolean shouldOverrideUrlLoading(WebView view, String url) {
				return false;
			}

			@Override
			public void onReceivedError(WebView view, int code, String description, String failingUrl) {
				if (failingUrl != null && failingUrl.contains("/index.html")) {
					view.loadData(
							"<div style='font-family:sans-serif;padding:28px;line-height:1.7;color:#123'>"
									+ "<h3 style='margin:0 0 8px'>页面没能加载</h3>"
									+ "<p style='color:#556;font-size:14px'>" + description + "</p>"
									+ "<p style='color:#556;font-size:14px'>退出后重新打开 MarkPad 试试。</p></div>",
							"text/html", "utf-8");
				}
			}
		});
		web.addJavascriptInterface(new Bridge(), "MarkPad");

		if (server != null) {
			web.loadUrl(server.baseUrl() + "/index.html");
		} else {
			web.loadData("<h3 style='font-family:sans-serif;padding:24px'>MarkPad 启动失败</h3>", "text/html", "utf-8");
		}
	}

	@Override
	public void onBackPressed() {
		web.evaluateJavascript(
				"(function(){try{return window.__markpadBack ? String(window.__markpadBack()) : 'false'}catch(e){return 'false'}})()",
				new ValueCallback<String>() {
					@Override
					public void onReceiveValue(String value) {
						boolean handled = value != null && value.contains("true");
						if (handled) return;
						if (web.canGoBack()) web.goBack();
						else finish();
					}
				});
	}

	private Intent broadFileIntent() {
		Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
		intent.setType("*/*");
		intent.addCategory(Intent.CATEGORY_OPENABLE);
		intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
		return intent;
	}

	private void applyBars(boolean darkTheme, String colorHex) {
		Window w = getWindow();
		int color = Color.parseColor(colorHex);
		w.setStatusBarColor(color);
		w.setNavigationBarColor(color);
		View decor = w.getDecorView();
		int flags = decor.getSystemUiVisibility();
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
			if (darkTheme) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
			else flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
		}
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
			if (darkTheme) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
			else flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
		}
		decor.setSystemUiVisibility(flags);
	}

	private boolean hasStoragePermission() {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return true;
		return checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
	}

	private String writeFile(String name, String content) {
		try {
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
				ContentValues values = new ContentValues();
				values.put(MediaStore.Downloads.DISPLAY_NAME, name);
				values.put(MediaStore.Downloads.MIME_TYPE, "text/markdown");
				values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MarkPad");
				Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
				if (uri == null) return "";
				OutputStream out = getContentResolver().openOutputStream(uri);
				if (out == null) return "";
				out.write(content.getBytes("UTF-8"));
				out.close();
				return "下载/MarkPad/" + name;
			}
			File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "MarkPad");
			if (!dir.exists() && !dir.mkdirs()) return "";
			File file = new File(dir, name);
			FileOutputStream out = new FileOutputStream(file);
			out.write(content.getBytes("UTF-8"));
			out.close();
			return "Download/MarkPad/" + name;
		} catch (Exception e) {
			return "";
		}
	}

	/* ---------- folder import (SAF) ---------- */

	private void startFolderPicker() {
		Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
		intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
		intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
		try {
			startActivityForResult(intent, REQ_FOLDER);
		} catch (Exception e) {
			deliverFolder(null);
		}
	}

	private void deliverFolder(final String json) {
		runOnUiThread(new Runnable() {
			@Override
			public void run() {
				if (json == null) {
					web.evaluateJavascript("window.__markpadFolder && window.__markpadFolder(null)", null);
					return;
				}
				String safe = json.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
				web.evaluateJavascript("window.__markpadFolder && window.__markpadFolder(" + safe + ")", null);
			}
		});
	}

	private void handleFolder(final Intent data) {
		if (data == null || data.getData() == null) {
			deliverFolder(null);
			return;
		}
		final Uri tree = data.getData();
		try {
			getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
		} catch (Exception ignored) {
			// Not fatal: the picker grant is still valid for this session.
		}
		new Thread(new Runnable() {
			@Override
			public void run() {
				JSONObject payload = new JSONObject();
				JSONArray files = new JSONArray();
				boolean truncated = false;
				try {
					String rootId = DocumentsContract.getTreeDocumentId(tree);
					truncated = walkFolder(tree, rootId, "", files);
				} catch (Exception ignored) {
					// Leave whatever was collected so far.
				}
				try {
					payload.put("files", files);
					payload.put("truncated", truncated);
				} catch (Exception ignored) {
					deliverFolder(null);
					return;
				}
				deliverFolder(payload.toString());
			}
		}).start();
	}

	@SuppressWarnings("deprecation")
	private boolean walkFolder(Uri tree, String documentId, String prefix, JSONArray out) {
		if (out.length() >= MAX_IMPORT_FILES) return true;
		Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, documentId);
		Cursor cursor = null;
		boolean truncated = false;
		try {
			cursor = getContentResolver().query(
					children,
					new String[] {
							DocumentsContract.Document.COLUMN_DOCUMENT_ID,
							DocumentsContract.Document.COLUMN_DISPLAY_NAME,
							DocumentsContract.Document.COLUMN_MIME_TYPE,
					},
					null, null, null);
			if (cursor == null) return false;
			while (cursor.moveToNext()) {
				if (out.length() >= MAX_IMPORT_FILES) {
					truncated = true;
					break;
				}
				String id = cursor.getString(0);
				String name = cursor.getString(1);
				String mime = cursor.getString(2);
				if (id == null || name == null || name.startsWith(".")) continue;
				String path = prefix.isEmpty() ? name : prefix + "/" + name;
				if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
					if (name.equals("node_modules") || name.equals(".git") || name.equals("__MACOSX")) continue;
					if (walkFolder(tree, id, path, out)) truncated = true;
					continue;
				}
				if (!isImportableName(name)) continue;
				String content = readText(DocumentsContract.buildDocumentUriUsingTree(tree, id));
				if (content == null || content.trim().length() == 0) continue;
				JSONObject item = new JSONObject();
				try {
					item.put("name", name);
					item.put("path", path);
					item.put("content", content);
				} catch (Exception ignored) {
					continue;
				}
				out.put(item);
			}
		} catch (Exception ignored) {
			// Unreadable subtree: keep going with what we have.
		} finally {
			if (cursor != null) cursor.close();
		}
		return truncated;
	}

	private boolean isImportableName(String name) {
		String lower = name.toLowerCase();
		return lower.endsWith(".md")
				|| lower.endsWith(".markdown")
				|| lower.endsWith(".mdx")
				|| lower.endsWith(".mdown")
				|| lower.endsWith(".mkd")
				|| lower.endsWith(".txt");
	}

	private String readText(Uri uri) {
		InputStream input = null;
		try {
			input = getContentResolver().openInputStream(uri);
			if (input == null) return null;
			BufferedReader reader = new BufferedReader(new InputStreamReader(input, "UTF-8"));
			StringBuilder text = new StringBuilder();
			char[] buffer = new char[8192];
			int read;
			while ((read = reader.read(buffer)) > 0) {
				text.append(buffer, 0, read);
				if (text.length() > MAX_IMPORT_CHARS) break;
			}
			return text.toString();
		} catch (Exception e) {
			return null;
		} finally {
			if (input != null) {
				try {
					input.close();
				} catch (IOException ignored) {
					// Nothing useful to do here.
				}
			}
		}
	}

	public class Bridge {
		@JavascriptInterface
		public String saveFile(String name, String content) {
			if (!hasStoragePermission()) {
				pendingName = name;
				pendingContent = content;
				runOnUiThread(new Runnable() {
					@Override
					public void run() {
						requestPermissions(new String[] { android.Manifest.permission.WRITE_EXTERNAL_STORAGE }, REQ_STORAGE);
					}
				});
				return "";
			}
			return writeFile(name, content);
		}

		@JavascriptInterface
		public void shareFile(String name, String content) {
			final String fileName = name;
			final String text = content;
			runOnUiThread(new Runnable() {
				@Override
				public void run() {
					Intent intent = new Intent(Intent.ACTION_SEND);
					intent.setType("text/plain");
					intent.putExtra(Intent.EXTRA_SUBJECT, fileName);
					intent.putExtra(Intent.EXTRA_TEXT, text);
					startActivity(Intent.createChooser(intent, "分享 Markdown"));
				}
			});
		}

		@JavascriptInterface
		public void setBars(String dark, String color) {
			final boolean isDark = "1".equals(dark);
			final String hex = color;
			runOnUiThread(new Runnable() {
				@Override
				public void run() {
					applyBars(isDark, hex);
				}
			});
		}

		@JavascriptInterface
		public void haptic() {
			runOnUiThread(new Runnable() {
				@Override
				public void run() {
					web.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP);
				}
			});
		}

		/** Opens the system folder picker; the result is pushed to window.__markpadFolder. */
		@JavascriptInterface
		public void pickFolder() {
			runOnUiThread(new Runnable() {
				@Override
				public void run() {
					startFolderPicker();
				}
			});
		}
	}

	@Override
	protected void onActivityResult(int requestCode, int resultCode, Intent data) {
		if (requestCode == REQ_FOLDER) {
			if (resultCode == RESULT_OK) handleFolder(data);
			else deliverFolder(null);
			return;
		}
		if (requestCode == REQ_FILE) {
			if (filePathCallback == null) return;
			Uri[] uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
			filePathCallback.onReceiveValue(uris);
			filePathCallback = null;
			return;
		}
		super.onActivityResult(requestCode, resultCode, data);
	}

	@Override
	public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
		super.onRequestPermissionsResult(code, permissions, results);
		if (code == REQ_STORAGE && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
			if (pendingName != null) writeFile(pendingName, pendingContent);
		}
		pendingName = null;
		pendingContent = null;
	}
}
