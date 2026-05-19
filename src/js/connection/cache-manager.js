export const cacheRequest = 'request';

export const pool = (() => {
    /**
     * @type {Map<string, Cache>|null}
     */
    let cachePool = null;

    return {
        /**
         * @param {string} name
         * @returns {Cache}
         */
        getInstance: (name) => {
            if (!cachePool || !cachePool.has(name)) {
                throw new Error(`vui lòng khởi tạo cache trước: ${name}`);
            }

            return cachePool.get(name);
        },
        /**
         * @param {string} name 
         * @returns {Promise<void>}
         */
        restart: async (name) => {
            cachePool.set(name, null);
            cachePool.delete(name);
            await window.caches.delete(name);
            await window.caches.open(name).then((c) => cachePool.set(name, c));
        },
        /**
         * @param {function} callback
         * @param {string[]} lists 
         * @returns {void}
         */
        init: (callback, lists = []) => {
            if (!window.isSecureContext) {
                throw new Error('ứng dụng này yêu cầu kết nối bảo mật (HTTPS)');
            }

            cachePool = new Map();
            Promise.all(lists.concat([cacheRequest]).map((v) => window.caches.open(v).then((c) => cachePool.set(v, c)))).then(() => callback());
        },
    };
})();

/**
 * @param {string} cacheName 
 */
export const cacheWrapper = (cacheName) => {
    const cacheObject = pool.getInstance(cacheName);

    /**
     * @param {string|URL} input 
     * @param {Response} res 
     * @param {boolean} forceCache
     * @param {number} ttl
     * @returns {Promise<Response>}
     */
    const set = (input, res, forceCache, ttl) => res.clone().arrayBuffer().then((ab) => {
        if (!res.ok) {
            return res;
        }

        const now = new Date();
        const headers = new Headers(res.headers);

        if (!headers.has('Date')) {
            headers.set('Date', now.toUTCString());
        }

        if (forceCache || !headers.has('Cache-Control')) {
            if (!forceCache && headers.has('Expires')) {
                const expTime = new Date(headers.get('Expires'));
                ttl = Math.max(0, expTime.getTime() - now.getTime());
            }

            if (ttl === 0) {
                throw new Error('Thời gian lưu trữ cache tối đa không thể bằng 0');
            }

            headers.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
        }

        if (!headers.has('Content-Length')) {
            headers.set('Content-Length', String(ab.byteLength));
        }

        return cacheObject.put(input, new Response(ab, { headers })).then(() => res);
    });

    /**
     * @param {string|URL} input 
     * @returns {Promise<Response|null>}
     */
    const has = (input) => cacheObject.match(input).then((res) => {
        if (!res) {
            return null;
        }

        const maxAge = res.headers.get('Cache-Control').match(/max-age=(\d+)/)[1];
        const expTime = Date.parse(res.headers.get('Date')) + (parseInt(maxAge) * 1000);

        return Date.now() > expTime ? null : res;
    });

    /**
     * @param {string|URL} input 
     * @returns {Promise<boolean>}
     */
    const del = (input) => cacheObject.delete(input);

    return {
        set,
        has,
        del,
    };
};