import { util } from '../common/util.js';
import { session } from '../common/session.js';

export const HTTP_GET = 'GET';
export const HTTP_POST = 'POST';
export const HTTP_PUT = 'PUT'; // Supabase PostgREST thường dùng PATCH cho cập nhật, nhưng PUT cũng được hỗ trợ cho thay thế hoàn toàn.
export const HTTP_PATCH = 'PATCH';
export const HTTP_STATUS_PARTIAL_CONTENT = 206;
export const HTTP_STATUS_OK = 200;
export const ERROR_ABORT = 'AbortError';
export const HTTP_DELETE = 'DELETE';
export const HTTP_STATUS_CREATED = 201;

const API_URL = document.body.getAttribute('data-supabase-url'); // Lấy từ data-supabase-url
const API_KEY = document.body.getAttribute('data-key'); // Lấy từ data-key

class RequestBuilder {
    constructor(method, path) {
        this.method = method;
        this.path = path;
        this.headers = new Headers({
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'apikey': API_KEY,
            'Authorization': `Bearer ${API_KEY}` // Sử dụng API_KEY cho Authorization header
        });
        this.bodyData = null;
        this.tokenValue = null; // Giữ lại cho các trường hợp JWT Auth trong tương lai
        this.cacheDuration = 0;
        this.forceCache = false;
        this.retryCount = 0;
        this.downloadFilename = null;
        this.downloadExtension = null;
    }

    token(token) {
        // Nếu có JWT token (ví dụ từ Supabase Auth), nó sẽ ghi đè API_KEY trong Authorization
        if (token && token !== API_KEY) { // Tránh ghi đè nếu token là chính API_KEY
            this.headers.set('Authorization', `Bearer ${token}`);
        }
        this.tokenValue = token;
        return this;
    }

    body(data) {
        this.bodyData = data;
        return this;
    }

    withCache(duration) {
        this.cacheDuration = duration;
        return this;
    }

    withForceCache() {
        this.forceCache = true;
        return this;
    }

    withRetry(count = 3) {
        this.retryCount = count;
        return this;
    }

    withDownload(filename, extension) {
        this.downloadFilename = filename;
        this.downloadExtension = extension;
        return this;
    }

    async send(dtoConverter = (res) => res) {
        const url = `${API_URL}${this.path}`;
        const ac = new AbortController();
        const reqOptions = {
            signal: ac.signal,
            headers: this.headers,
            method: this.method,
        };

        if (this.bodyData) {
            reqOptions.body = JSON.stringify(this.bodyData);
        }

        let response;
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                response = await fetch(url, reqOptions);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
                }
                break;
            } catch (error) {
                if (i === this.retryCount) {
                    throw error;
                }
                console.warn(`Request failed, retrying (${i + 1}/${this.retryCount}):`, error);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Tăng thời gian chờ
            }
        }

        if (this.downloadFilename) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${this.downloadFilename}.${this.downloadExtension}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
            return { data: { status: true }, headers: response.headers }; // Giả lập thành công cho download
        }

        const jsonResponse = await response.json();
        return { data: dtoConverter(jsonResponse), headers: response.headers };
    }

    default() {
        return this;
    }
}

export const request = (method, path) => new RequestBuilder(method, path);