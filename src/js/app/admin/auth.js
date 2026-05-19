import { util } from '../../common/util.js';
import { bs } from '../../libs/bootstrap.js';
import { dto } from '../../connection/dto.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js'; // Giữ nguyên import session
import { request, HTTP_GET, HTTP_STATUS_OK } from '../../connection/request.js';
import { pool, cacheRequest } from '../../connection/cache-manager.js'; // Import pool và cacheRequest từ tệp quản lý mới

export const auth = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let user = null;

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const login = (button) => {
        const btn = util.disableButton(button);
        const formEmail = document.getElementById('loginEmail');
        const formPassword = document.getElementById('loginPassword');
        formEmail.disabled = true;
        formPassword.disabled = true;

        util.notify('Chức năng đăng nhập cần sử dụng Supabase Authentication SDK.').info();
        console.warn("Login function requires Supabase Authentication SDK.");

        // session.login(dto.postSessionRequest(formEmail.value, formPassword.value)).then((res) => {
        //     if (res) {
        //         formEmail.value = null;
        //         formPassword.value = null;
        //         bs.modal('mainModal').hide();
        //     }
        // }).finally(() => {
        //     // ... (logic cũ)
        // });

        // Restore buttons immediately as login is disabled
        // This part will be removed once Supabase Auth is fully integrated
        // and the .finally() block of session.login is active.
        // For now, it prevents the UI from being stuck.
        formEmail.disabled = false;
        formPassword.disabled = false;
        btn.restore();

        // Placeholder for actual Supabase Auth login
        // Example:
        // supabase.auth.signInWithPassword({
        //     email: formEmail.value,
        //     password: formPassword.value,
        // }).then(({ data, error }) => {
        //     if (error) {
        //         util.notify(error.message).error();
        //     } else {
        //         session.setToken(data.session.access_token);
        //         formEmail.value = null;
        //         formPassword.value = null;
        //         bs.modal('mainModal').hide();
        //     }
        // }).finally(() => {
        //     btn.restore();
        //     formEmail.disabled = false;
        //     formPassword.disabled = false;
        // });
    };

    /**
     * @returns {Promise<void>}
     */
    const clearSession = async () => {
        await pool.restart(cacheRequest);

        user.clear();
        session.logout();
        bs.modal('mainModal').show();
    };

    /**
     * @returns {Promise<object>}
     */
    const getDetailUser = () => {
        // Supabase: GET /profiles?id=eq.{user_id}
        // Cần có Supabase Auth để lấy user_id và JWT hợp lệ.
        return request(HTTP_GET, `/profiles?id=eq.${session.getUserId()}`).token(session.getToken()).send().then((res) => {
            if (!res.data || res.data.length === 0) { // Supabase trả về mảng các đối tượng
                throw new Error('Không thể lấy thông tin người dùng hoặc người dùng không tồn tại.');
            }
            const profileData = res.data[0]; // Lấy đối tượng profile đầu tiên
            Object.entries(profileData).forEach(([k, v]) => user.set(k, v));

            return { data: profileData }; // Trả về định dạng tương tự như cũ
        }).catch((err) => { // Supabase PostgREST sẽ trả về lỗi 404 nếu không tìm thấy
            clearSession();
            return err;
        });
    };

    /**
     * @returns {ReturnType<typeof storage>|null}
     */
    const getUserStorage = () => user;

    /**
     * @returns {void}
     */
    const init = () => {
        user = storage('user');
    };

    return {
        init,
        login,
        clearSession,
        getDetailUser,
        getUserStorage,
    };
})();