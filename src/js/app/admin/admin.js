import { auth } from './auth.js';
import { navbar } from './navbar.js';
import { util } from '../../common/util.js';
import { dto } from '../../connection/dto.js';
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { offline } from '../../common/offline.js';
import { comment } from '../components/comment.js';
import { pool, request, HTTP_GET, HTTP_PATCH, HTTP_PUT } from '../../connection/request.js';

export const admin = (() => {

    /**
     * @returns {Promise<void>}
     */
    const getUserStats = () => auth.getDetailUser().then((res) => {

        util.safeInnerHTML(document.getElementById('dashboard-name'), `${util.escapeHtml(res.data.name)}<i class="fa-solid fa-hands text-warning ms-2"></i>`);
        document.getElementById('dashboard-email').textContent = res.data.email;
        document.getElementById('dashboard-accesskey').value = res.data.access_key;
        document.getElementById('button-copy-accesskey').setAttribute('data-copy', res.data.access_key);

        document.getElementById('form-name').value = util.escapeHtml(res.data.name);
        document.getElementById('form-timezone').value = res.data.tz;
        document.getElementById('filterBadWord').checked = Boolean(res.data.is_filter);
        document.getElementById('confettiAnimation').checked = Boolean(res.data.is_confetti_animation);
        document.getElementById('replyComment').checked = Boolean(res.data.can_reply);
        document.getElementById('editComment').checked = Boolean(res.data.can_edit);
        document.getElementById('deleteComment').checked = Boolean(res.data.can_delete);
        document.getElementById('dashboard-tenorkey').value = res.data.tenor_key;

        storage('config').set('tenor_key', res.data.tenor_key);
        document.dispatchEvent(new Event('undangan.session'));

        // Thay thế /api/stats bằng các truy vấn Supabase trực tiếp
        Promise.all([
            request(HTTP_GET, '/comments?count=exact').token(session.getToken()).withCache(1000 * 30).withForceCache().send(),
            request(HTTP_GET, '/comments?is_presence=eq.true&count=exact').token(session.getToken()).withCache(1000 * 30).withForceCache().send(),
            request(HTTP_GET, '/comments?is_presence=eq.false&count=exact').token(session.getToken()).withCache(1000 * 30).withForceCache().send(),
            request(HTTP_GET, '/likes?count=exact').token(session.getToken()).withCache(1000 * 30).withForceCache().send(),
        ]).then(([commentsRes, presentRes, absentRes, likesRes]) => {
            const getCountFromHeaders = (headers) => {
                const contentRange = headers.get('Content-Range');
                return contentRange ? parseInt(contentRange.split('/')[1], 10) : 0;
            };

            const commentCount = getCountFromHeaders(commentsRes.headers);
            const presentCount = getCountFromHeaders(presentRes.headers);
            const absentCount = getCountFromHeaders(absentRes.headers);
            const likeCount = getCountFromHeaders(likesRes.headers);

            document.getElementById('count-comment').textContent = String(commentCount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-present').textContent = String(presentCount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-absent').textContent = String(absentCount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-like').textContent = String(likeCount).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }).catch(error => {
            console.error("Error fetching stats from Supabase:", error);
            util.notify('Không thể tải số liệu thống kê.').error();
        });
        comment.show();
    });

    /**
     * @param {HTMLElement} checkbox
     * @param {string} type
     * @returns {void}
     */
    const changeCheckboxValue = (checkbox, type) => {
        const label = util.disableCheckbox(checkbox);

        // Supabase: PATCH /profiles?id=eq.{user_id}
        // Cần có Supabase Auth để lấy user_id và JWT hợp lệ.
        request(HTTP_PATCH, `/profiles?id=eq.${session.getUserId()}`) // Giả định session.getUserId() trả về UUID của người dùng
            .token(session.getToken())
            .body({ [type]: checkbox.checked })
            .send()
            .finally(() => label.restore());
    };
    
    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const tenor = (button) => {
        const btn = util.disableButton(button);

        const form = document.getElementById('dashboard-tenorkey');
        form.disabled = true;

        // Supabase: PATCH /profiles?id=eq.{user_id}
        // Cần có Supabase Auth để lấy user_id và JWT hợp lệ.
        request(HTTP_PATCH, `/profiles?id=eq.${session.getUserId()}`) // Giả định session.getUserId() trả về UUID của người dùng
            .token(session.getToken())
            .body({ tenor_key: form.value.length ? form.value : null })
            .send() // Supabase PATCH trả về mảng rỗng nếu thành công
            .then(() => util.notify(`thành công ${form.value.length ? 'thêm' : 'xóa'} khóa tenor`).success())
            .finally(() => {
                form.disabled = false;
                btn.restore();
            });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const regenerate = (button) => {
        if (!util.ask('Are you sure?')) {
            return; // Chức năng này cần một Supabase Edge Function hoặc một backend tùy chỉnh.
        }

        util.notify('Chức năng tạo lại khóa truy cập không được hỗ trợ trực tiếp bởi Supabase PostgREST.').info();
        console.warn("Regenerate access key function requires a custom Supabase Edge Function or a separate backend service.");

        // const btn = util.disableButton(button);
        // request(HTTP_PUT, '/api/key') // API này không có trong Supabase PostgREST
        //     .token(session.getToken())
        //     .send(dto.statusResponse)
        //     .then((res) => {
        //         if (!res.data.status) {
        //             return;
        //         }
        //         getUserStats();
        //     })
        //     .finally(() => btn.restore());
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changePassword = (button) => {
        const old = document.getElementById('old_password');
        const newest = document.getElementById('new_password');

        if (old.value.length === 0 || newest.value.length === 0) {
            util.notify('Mật khẩu không được để trống').warning();
            return;
        }

        old.disabled = true;
        newest.disabled = true;

        util.notify('Chức năng đổi mật khẩu cần sử dụng Supabase Authentication SDK.').info();
        console.warn("Change password function requires Supabase Authentication SDK.");

        // const btn = util.disableButton(button);
        // request(HTTP_PATCH, '/api/user') // API này không có trong Supabase PostgREST
        //     .token(session.getToken())
        //     .body({
        //         old_password: old.value,
        //         new_password: newest.value,
        //     })
        //     .send(dto.statusResponse)
        //     .then((res) => {
        //         if (!res.data.status) {
        //             return;
        //         }
        //         old.value = null;
        //         newest.value = null;
        //         util.notify('Đổi mật khẩu thành công').success();
        //     })
        //     .finally(() => {
        //         btn.restore(true);
        //         old.disabled = false;
        //         newest.disabled = false;
        //     });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeName = (button) => {
        const name = document.getElementById('form-name');

        if (name.value.length === 0) {
            util.notify('Tên không được để trống').warning();
            return;
        }

        name.disabled = true;
        const btn = util.disableButton(button);

        // Supabase: PATCH /profiles?id=eq.{user_id}
        // Cần có Supabase Auth để lấy user_id và JWT hợp lệ.
        request(HTTP_PATCH, `/profiles?id=eq.${session.getUserId()}`) // Giả định session.getUserId() trả về UUID của người dùng
            .token(session.getToken())
            .body({ name: name.value })
            .send() // Supabase PATCH trả về mảng rỗng nếu thành công
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.safeInnerHTML(document.getElementById('dashboard-name'), `${util.escapeHtml(name.value)}<i class="fa-solid fa-hands text-warning ms-2"></i>`);
                util.notify('Đổi tên thành công').success();
            })
            .finally(() => {
                name.disabled = false;
                btn.restore(true);
            });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const download = (button) => {
        // Chức năng download yêu cầu một Supabase Edge Function hoặc một backend tùy chỉnh.
        // Hiện tại, nó sẽ bị vô hiệu hóa.
        util.notify('Chức năng tải xuống hiện không được hỗ trợ trực tiếp bởi Supabase PostgREST.').info();
        console.warn("Download function requires a custom Supabase Edge Function or a separate backend service.");
        // const btn = util.disableButton(button);
        // // ... (logic cũ)
        // btn.restore();
    }; // Vô hiệu hóa chức năng download

    /**
     * @returns {void}
     */
    const enableButtonName = () => {
        const btn = document.getElementById('button-change-name');
        if (btn.disabled) {
            btn.disabled = false;
        }
    };

    /**
     * @returns {void}
     */
    const enableButtonPassword = () => {
        const btn = document.getElementById('button-change-password');
        const old = document.getElementById('old_password');

        if (btn.disabled && old.value.length !== 0) {
            btn.disabled = false;
        }
    };

    /**
     * @param {HTMLFormElement} form 
     * @param {string|null} [query=null] 
     * @returns {void}
     */
    const openLists = (form, query = null) => {
        let timezones = Intl.supportedValuesOf('timeZone');
        const dropdown = document.getElementById('dropdown-tz-list');

        if (form.value && form.value.trim().length > 0) {
            timezones = timezones.filter((tz) => tz.toLowerCase().includes(form.value.trim().toLowerCase()));
        }

        if (query === null) {
            document.addEventListener('click', (e) => {
                if (!form.contains(e.currentTarget) && !dropdown.contains(e.currentTarget)) {
                    if (form.value.trim().length <= 0) {
                        form.setCustomValidity('Timezone cannot be empty.');
                        form.reportValidity();
                        return;
                    }

                    form.setCustomValidity('');
                    dropdown.classList.add('d-none');
                }
            }, { once: true, capture: true });
        }

        dropdown.replaceChildren();
        dropdown.classList.remove('d-none');

        timezones.slice(0, 20).forEach((tz) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action py-1 small';
            item.textContent = `${tz} (${util.getGMTOffset(tz)})`;
            item.onclick = () => {
                form.value = tz;
                dropdown.classList.add('d-none');
                document.getElementById('button-timezone').disabled = false;
            };
            dropdown.appendChild(item);
        });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeTz = (button) => {
        const tz = document.getElementById('form-timezone');

        if (tz.value.length === 0) {
            util.notify('Múi giờ không được để trống').warning();
            return;
        }

        if (!Intl.supportedValuesOf('timeZone').includes(tz.value)) {
            util.notify('Múi giờ không được hỗ trợ').warning();
            return;
        }

        tz.disabled = true;
        const btn = util.disableButton(button);

        // Supabase: PATCH /profiles?id=eq.{user_id}
        // Cần có Supabase Auth để lấy user_id và JWT hợp lệ.
        request(HTTP_PATCH, `/profiles?id=eq.${session.getUserId()}`) // Giả định session.getUserId() trả về UUID của người dùng
            .token(session.getToken())
            .body({ tz: tz.value })
            .send() // Supabase PATCH trả về mảng rỗng nếu thành công
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.notify('Đổi múi giờ thành công').success();
            })
            .finally(() => {
                tz.disabled = false;
                btn.restore(true);
            });
    };

    /**
     * @returns {void}
     */
    const logout = () => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        auth.clearSession();
    };

    /**
     * @returns {void}
     */
    const pageLoaded = () => {
        lang.init();
        lang.setDefault('en');

        comment.init();
        offline.init();
        theme.spyTop();

        document.addEventListener('hidden.bs.modal', getUserStats);

        const raw = window.location.hash.slice(1);
        if (raw.length > 0) {
            session.setToken(raw);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        session.isValid() ? getUserStats() : auth.clearSession();
    };

    /**
     * @returns {object}
     */
    const init = () => {
        auth.init();
        theme.init();
        session.init();

        if (!session.isAdmin()) {
            storage('owns').clear();
            storage('likes').clear();
            storage('config').clear();
            storage('comment').clear();
            storage('session').clear();
            storage('information').clear();
        }

        window.addEventListener('load', () => pool.init(pageLoaded, ['gif']));

        return {
            util,
            theme,
            comment,
            admin: {
                auth,
                navbar,
                logout,
                tenor,
                download,
                regenerate,
                changeName,
                changePassword,
                changeCheckboxValue,
                enableButtonName,
                enableButtonPassword,
                openLists,
                changeTz,
            },
        };
    };

    return {
        init,
    };
})();