import { util } from './util.js';
import { storage } from './storage.js';
import { dto } from '../connection/dto.js';
import { request, HTTP_POST, HTTP_GET, HTTP_STATUS_OK } from '../connection/request.js';

export const session = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let ses = null;

    /**
     * @returns {string|null}
     */
    const getToken = () => ses.get('token');

    /**
     * @param {string} token
     * @returns {void}
     */
    const setToken = (token) => ses.set('token', token);

    /**
     * @param {object} body
     * @returns {Promise<boolean>}
     */
    const login = (body) => {
        util.notify('Chức năng đăng nhập cần sử dụng Supabase Authentication SDK.').info();
        console.warn("Login function requires Supabase Authentication SDK.");
        return Promise.resolve(false); // Tạm thời trả về false
        // return request(HTTP_POST, '/api/session') // API này không có trong Supabase PostgREST
        //     .body(body)
        //     .send(dto.tokenResponse)
        //     .then((res) => {
        //         if (res.code === HTTP_STATUS_OK) {
        //             setToken(res.data.token);
        //         }
        //         return res.code === HTTP_STATUS_OK;
        //     });
    };

    /**
     * @returns {void}
     */
    const logout = () => ses.unset('token');
    /**
     * @returns {boolean}
     */
    const isAdmin = () => {
        // Để kiểm tra vai trò admin thực sự, cần tích hợp Supabase Auth SDK
        // và truy vấn bảng 'profiles' để lấy 'role' của người dùng.
        // Hiện tại, chỉ kiểm tra xem token có phải là JWT hợp lệ không.
        return String(getToken() ?? '.').split('.').length === 3;
    };

    /**
     * @param {string} token
     * @returns {Promise<object>}
     */
    const guest = (token) => {
        // Supabase: GET /configs?select=*
        return request(HTTP_GET, '/configs?select=*')
            .withCache(1000 * 60 * 30)
            .withForceCache()
            .token(token)
            .send() // Supabase trả về mảng các đối tượng config
            .then(({ data: configsData }) => {
                if (!configsData || configsData.length === 0) {
                    throw new Error('Không thể lấy cấu hình hoặc không có cấu hình nào.');
                }

                const configStorage = storage('config');
                // Supabase trả về mảng, cần chuyển đổi thành object { key: value }
                const configObject = configsData.reduce((acc, item) => {
                    acc[item.key] = item.value;
                    return acc;
                }, {});

                for (const [k, v] of Object.entries(configObject)) {
                    configStorage.set(k, v);
                }

                setToken(token); // Lưu token (anon key)
                return { data: configObject }; // Trả về định dạng tương tự như cũ
            });
    };

    /**
     * @returns {object|null}
     */
    const decode = () => {
        if (!isAdmin()) {
            return null;
        }

        try {
            return JSON.parse(util.base64Decode(getToken().split('.')[1]));
        } catch {
            return null;
        }
    };

    /**
     * @returns {string|null}
     */
    const getUserId = () => {
        const decodedToken = decode();
        // Trong JWT, user ID thường nằm trong trường 'sub' (subject)
        // hoặc 'id' tùy thuộc vào cách Supabase cấu hình.
        // Với Supabase Auth, nó thường là 'sub'.
        return decodedToken?.sub || decodedToken?.id || null;
    };

    /**
     * @returns {boolean}
     */
    const isValid = () => {
        if (!isAdmin()) {
            return false;
        }

        return (decode()?.exp ?? 0) > (Date.now() / 1000);
    };

    /**
     * @returns {void}
     */
    const init = () => {
        ses = storage('session');
    };

    return {
        init,
        guest,
        isValid,
        login,
        logout,
        decode,
        isAdmin,
        setToken,
        getToken,
        getUserId,
    };
})();