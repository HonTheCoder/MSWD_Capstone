/**
 * Service Worker for Relief Allocation App
 * Provides offline functionality, caching strategies, and background sync
 * 
 * @version 1.0.0
 */

const CACHE_NAME = 'relief-allocation-v1';
const STATIC_CACHE = 'static-resources-v1';
const DYNAMIC_CACHE = 'dynamic-content-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
    '/',
    '/main.html',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/firebase.js',
    '/chart.js',
    '/js/error-handler.js',
    '/js/resource-loader.js',
    '/js/priority-calculator.js',
    '/js/security-utils.js',
    '/js/performance-monitor.js',
    // Add other critical assets
    'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
    static: 'cache-first',
    api: 'network-first',
    images: 'cache-first',
    documents: 'stale-while-revalidate'
};

// Install event - Cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            }),
            self.skipWaiting()
        ])
    );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        Promise.all([
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            self.clients.claim()
        ])
    );
});

// Fetch event - Handle requests with caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const { url, method } = request;
    
    // Only handle GET requests
    if (method !== 'GET') {
        return;
    }
    
    // Handle Firebase requests differently
    if (url.includes('firestore.googleapis.com') || url.includes('firebase')) {
        event.respondWith(handleFirebaseRequest(request));
        return;
    }
    
    // Handle static assets
    if (STATIC_ASSETS.some(asset => url.includes(asset.replace('/', '')))) {
        event.respondWith(handleStaticRequest(request));
        return;
    }
    
    // Handle other requests
    event.respondWith(handleDynamicRequest(request));
});

/**
 * Handle Firebase/Firestore requests with network-first strategy
 */
async function handleFirebaseRequest(request) {
    try {
        // Always try network first for real-time data
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Firebase request failed, trying cache:', error);
        
        // Fall back to cache if network fails
        const cacheResponse = await caches.match(request);
        if (cacheResponse) {
            // Add offline indicator to cached responses
            const headers = new Headers(cacheResponse.headers);
            headers.set('X-Served-By', 'ServiceWorker-Cache');
            
            return new Response(cacheResponse.body, {
                status: cacheResponse.status,
                statusText: cacheResponse.statusText,
                headers
            });
        }
        
        // Return offline page for critical failures
        return await caches.match('/offline.html') || 
               new Response('Offline - Please check your connection', { 
                   status: 503, 
                   statusText: 'Service Unavailable' 
               });
    }
}

/**
 * Handle static assets with cache-first strategy
 */
async function handleStaticRequest(request) {
    const cacheResponse = await caches.match(request);
    
    if (cacheResponse) {
        return cacheResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Static request failed:', error);
        return new Response('Resource unavailable offline', { 
            status: 503, 
            statusText: 'Service Unavailable' 
        });
    }
}

/**
 * Handle dynamic requests with stale-while-revalidate strategy
 */
async function handleDynamicRequest(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cacheResponse = await cache.match(request);
    
    // Start fetching from network
    const networkResponsePromise = fetch(request).then(async (networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch((error) => {
        console.log('Dynamic request failed:', error);
        return null;
    });
    
    // Return cached version immediately if available
    if (cacheResponse) {
        // Update cache in background
        networkResponsePromise.catch(() => {});
        return cacheResponse;
    }
    
    // Wait for network if no cache
    return await networkResponsePromise || 
           new Response('Content unavailable offline', { 
               status: 503, 
               statusText: 'Service Unavailable' 
           });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    if (event.tag === 'offline-actions') {
        event.waitUntil(syncOfflineActions());
    }
});

/**
 * Sync offline actions when connection is restored
 */
async function syncOfflineActions() {
    try {
        // Get offline actions from IndexedDB or localStorage
        const offlineActions = await getOfflineActions();
        
        for (const action of offlineActions) {
            try {
                // Retry the action
                const response = await fetch(action.url, action.options);
                
                if (response.ok) {
                    // Remove successful action from offline queue
                    await removeOfflineAction(action.id);
                    
                    // Notify clients of successful sync
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'SYNC_SUCCESS',
                                action: action
                            });
                        });
                    });
                }
            } catch (error) {
                console.log('Failed to sync action:', action.id, error);
            }
        }
    } catch (error) {
        console.log('Background sync failed:', error);
    }
}

/**
 * Get offline actions from storage
 */
async function getOfflineActions() {
    // This would typically use IndexedDB
    // For simplicity, using a placeholder
    return [];
}

/**
 * Remove synced action from storage
 */
async function removeOfflineAction(actionId) {
    // This would typically remove from IndexedDB
    // For simplicity, using a placeholder
    console.log('Removing offline action:', actionId);
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({ version: CACHE_NAME });
            break;
            
        case 'CLEAR_CACHE':
            clearCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
            
        case 'CACHE_URLS':
            cacheUrls(payload.urls).then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
    }
});

/**
 * Clear all caches
 */
async function clearCaches() {
    const cacheNames = await caches.keys();
    return Promise.all(cacheNames.map(name => caches.delete(name)));
}

/**
 * Cache specific URLs
 */
async function cacheUrls(urls) {
    const cache = await caches.open(DYNAMIC_CACHE);
    return Promise.all(urls.map(url => {
        return fetch(url).then(response => {
            if (response.ok) {
                return cache.put(url, response);
            }
        }).catch(error => {
            console.log('Failed to cache URL:', url, error);
        });
    }));
}

// Offline page template
const OFFLINE_PAGE = `
<!DOCTYPE html>
<html>
<head>
    <title>Relief Allocation - Offline</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f5f5f5; 
        }
        .offline-container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .icon { font-size: 48px; margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 10px; }
        p { color: #666; line-height: 1.5; }
        .retry-btn {
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="icon">📡</div>
        <h1>You're Offline</h1>
        <p>It looks like you've lost your internet connection. Some features may not be available until you reconnect.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
    </div>
</body>
</html>
`;

console.log('Service Worker loaded successfully');

export {}; // Make this a module