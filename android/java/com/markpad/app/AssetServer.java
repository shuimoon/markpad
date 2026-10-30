package com.markpad.app;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Serves the bundled web app over http://127.0.0.1:<port> so that ES modules,
 * the import map and localStorage all behave exactly like they do on the web.
 * A fixed port keeps the storage origin (and therefore the user's notes) stable.
 */
public class AssetServer {
	public static final int DEFAULT_PORT = 47413;

	private final AssetManager assets;
	private final int preferredPort;
	private ServerSocket socket;
	private int port = -1;
	private Thread worker;

	public AssetServer(AssetManager assets, int preferredPort) {
		this.assets = assets;
		this.preferredPort = preferredPort;
	}

	public void start() throws IOException {
		socket = bind(preferredPort);
		if (socket == null) socket = bind(0);
		if (socket == null) throw new IOException("no port");
		port = socket.getLocalPort();
		worker = new Thread(new Runnable() {
			@Override
			public void run() {
				loop();
			}
		}, "markpad-assets");
		worker.setDaemon(true);
		worker.start();
	}

	public String baseUrl() {
		return "http://127.0.0.1:" + port;
	}

	private ServerSocket bind(int candidate) {
		try {
			return new ServerSocket(candidate, 16, InetAddress.getByName("127.0.0.1"));
		} catch (IOException e) {
			return null;
		}
	}

	private void loop() {
		while (true) {
			try {
				Socket client = socket.accept();
				serve(client);
			} catch (IOException e) {
				// listen socket closed: stop
				return;
			}
		}
	}

	private void serve(Socket client) {
		try {
			InputStream in = client.getInputStream();
			String requestLine = readLine(in);
			if (requestLine == null) {
				client.close();
				return;
			}
			// drain headers
			String line;
			do {
				line = readLine(in);
			} while (line != null && line.length() > 0);

			String path = "/index.html";
			int sp1 = requestLine.indexOf(' ');
			if (sp1 > 0) {
				String rest = requestLine.substring(sp1 + 1).trim();
				int sp2 = rest.indexOf(' ');
				path = sp2 > 0 ? rest.substring(0, sp2) : rest;
			}
			int q = path.indexOf('?');
			if (q >= 0) path = path.substring(0, q);
			if (path.equals("/") || path.isEmpty()) path = "/index.html";
			if (path.contains("..")) path = "/index.html";

			byte[] body = readAsset("www" + path);
			OutputStream out = client.getOutputStream();
			if (body == null) {
				String notFound = "not found";
				out.write(("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: "
						+ notFound.length() + "\r\nConnection: close\r\n\r\n" + notFound).getBytes("UTF-8"));
			} else {
				String head = "HTTP/1.1 200 OK\r\nContent-Type: " + mimeOf(path)
						+ "\r\nContent-Length: " + body.length
						+ "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
				out.write(head.getBytes("UTF-8"));
				out.write(body);
			}
			out.flush();
			client.close();
		} catch (IOException e) {
			try {
				client.close();
			} catch (IOException ignored) {
				// nothing to do
			}
		}
	}

	private byte[] readAsset(String name) {
		InputStream in = null;
		try {
			in = assets.open(name);
			ByteArrayOutputStream buffer = new ByteArrayOutputStream(16384);
			byte[] chunk = new byte[16384];
			int read;
			while ((read = in.read(chunk)) > 0) buffer.write(chunk, 0, read);
			in.close();
			return buffer.toByteArray();
		} catch (IOException e) {
			if (in != null) {
				try {
					in.close();
				} catch (IOException ignored) {
					// nothing to do
				}
			}
			return null;
		}
	}

	private static String readLine(InputStream in) throws IOException {
		StringBuilder sb = new StringBuilder();
		int c;
		while ((c = in.read()) != -1) {
			if (c == '\n') break;
			if (c != '\r') sb.append((char) c);
			if (sb.length() > 4096) break;
		}
		return sb.length() == 0 && c == -1 ? null : sb.toString();
	}

	private static String mimeOf(String path) {
		if (path.endsWith(".html")) return "text/html; charset=utf-8";
		if (path.endsWith(".css")) return "text/css; charset=utf-8";
		if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript; charset=utf-8";
		if (path.endsWith(".json")) return "application/json; charset=utf-8";
		if (path.endsWith(".svg")) return "image/svg+xml";
		if (path.endsWith(".png")) return "image/png";
		if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
		if (path.endsWith(".webp")) return "image/webp";
		if (path.endsWith(".woff2")) return "font/woff2";
		return "application/octet-stream";
	}
}
