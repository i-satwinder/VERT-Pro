const WASM_CACHE = "vert-wasm-cache-v2";
const STATIC_CACHE = "vert-static-cache-v1";

const WASM_FILES = [
	"/pandoc.wasm",
	"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
	"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
];

const WASM_URL_PATTERNS = [
	/\/src\/lib\/workers\/.*\.js$/, // dev mode worker files
	/\/assets\/.*worker.*\.js$/, // prod worker files
	/magick.*\.wasm$/, // magick-wasm (unneeded?)
];

// App shell files to pre-cache for offline support
const APP_SHELL_FILES = [
	"./",
	"./favicon.png",
	"./lettermark.jpg",
	"./lettermark_maskable.png",
	"./banner.png",
];

function shouldCacheWasm(url) {
	const urlObj = new URL(url);

	if (WASM_FILES.includes(urlObj.pathname) || WASM_FILES.includes(url)) {
		return true;
	}

	return WASM_URL_PATTERNS.some(
		(pattern) => pattern.test(urlObj.pathname) || pattern.test(url),
	);
}

self.addEventListener("install", (event) => {
	console.log("[SW] installing service worker");

	event.waitUntil(
		Promise.all([
			// Pre-cache static app shell
			caches.open(STATIC_CACHE).then((cache) => {
				console.log("[SW] pre-caching app shell:", APP_SHELL_FILES);
				return cache.addAll(APP_SHELL_FILES).catch((err) => {
					console.warn("[SW] failed to pre-cache some app shell files:", err);
				});
			}),
			// Pre-cache WASM files
			caches.open(WASM_CACHE).then((cache) => {
				const staticFiles = WASM_FILES.filter((file) =>
					file.startsWith("/"),
				);
				if (staticFiles.length > 0) {
					console.log("[SW] pre-caching WASM files:", staticFiles);
					return cache.addAll(staticFiles).catch((err) => {
						console.warn("[SW] failed to pre-cache some WASM files:", err);
					});
				}
			}),
		]),
	);

	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (
							cacheName !== WASM_CACHE &&
							cacheName !== STATIC_CACHE &&
							(cacheName.startsWith("vert-wasm-cache") ||
								cacheName.startsWith("vert-static-cache"))
						) {
							console.log("[SW] deleting old cache:", cacheName);
							return caches.delete(cacheName);
						}
					}),
				);
			})
			.then(() => {
				return self.clients.claim();
			}),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;

	// Handle WASM and worker file requests (cache-first)
	if (shouldCacheWasm(request.url)) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				if (cachedResponse) {
					console.log("[SW] serving WASM from cache:", request.url);
					return cachedResponse;
				}

				console.log("[SW] fetching and caching WASM:", request.url);
				return fetch(request)
					.then((response) => {
						if (!response.ok) {
							return response;
						}

						const responseToCache = response.clone();
						caches.open(WASM_CACHE).then((cache) => {
							cache.put(request, responseToCache).catch((err) => {
								console.warn("[SW] failed to cache WASM:", request.url, err);
							});
						});

						return response;
					})
					.catch((err) => {
						console.error("[SW] fetch failed for WASM:", request.url, err);
						throw err;
					});
			}),
		);
		return;
	}

	// Handle navigation requests (network-first with offline fallback)
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					// Cache the navigation response for offline use
					if (response.ok) {
						const responseToCache = response.clone();
						caches.open(STATIC_CACHE).then((cache) => {
							cache.put(request, responseToCache).catch(() => {});
						});
					}
					return response;
				})
				.catch(() => {
					// Network failed — try to serve from cache
					return caches.match(request).then((cachedResponse) => {
						if (cachedResponse) {
							return cachedResponse;
						}
						// Last resort: serve the cached root page
						return caches.match("./");
					});
				}),
		);
		return;
	}

	// For static assets (images, CSS, JS), use stale-while-revalidate
	if (
		request.destination === "image" ||
		request.destination === "style" ||
		request.destination === "script" ||
		request.destination === "font"
	) {
		event.respondWith(
			caches.match(request).then((cachedResponse) => {
				const fetchPromise = fetch(request)
					.then((networkResponse) => {
						if (networkResponse.ok) {
							const responseToCache = networkResponse.clone();
							caches.open(STATIC_CACHE).then((cache) => {
								cache.put(request, responseToCache).catch(() => {});
							});
						}
						return networkResponse;
					})
					.catch(() => cachedResponse);

				// Return cached version immediately if available, otherwise wait for network
				return cachedResponse || fetchPromise;
			}),
		);
		return;
	}
});

self.addEventListener("message", (event) => {
	if (!event.data) return;
	const type = event.data.type;

	if (type === "GET_CACHE_INFO") {
		event.waitUntil(
			Promise.all([
				caches.open(WASM_CACHE),
				caches.open(STATIC_CACHE),
			]).then(async ([wasmCache, staticCache]) => {
				let totalSize = 0;
				const files = [];

				for (const cache of [wasmCache, staticCache]) {
					const keys = await cache.keys();
					for (const request of keys) {
						try {
							const response = await cache.match(request);
							if (response) {
								const blob = await response.blob();
								const size = blob.size;
								totalSize += size;

								files.push({
									url: request.url,
									size: size,
									type:
										response.headers.get("content-type") ||
										"unknown",
								});
							}
						} catch (err) {
							console.warn(
								"[SW] failed to get info for cached file:",
								request.url,
								err,
							);
						}
					}
				}

				event.ports[0].postMessage({
					totalSize,
					fileCount: files.length,
					files,
				});
			}),
		);
	}

	if (type === "CLEAR_CACHE") {
		event.waitUntil(
			Promise.all([
				caches.delete(WASM_CACHE),
				caches.delete(STATIC_CACHE),
			])
				.then(() => {
					console.log("[SW] all caches cleared");
					return Promise.all([
						caches.open(WASM_CACHE),
						caches.open(STATIC_CACHE),
					]);
				})
				.then(() => {
					event.ports[0].postMessage({ success: true });
				})
				.catch((err) => {
					console.error("[SW] failed to clear cache:", err);
					event.ports[0].postMessage({
						success: false,
						error: err.message,
					});
				}),
		);
	}
});
