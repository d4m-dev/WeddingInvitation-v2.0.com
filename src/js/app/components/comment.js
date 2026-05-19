import { gif } from './gif.js';
import { card } from './card.js';
import { like } from './like.js';
import { util } from '../../common/util.js';
import { pagination } from './pagination.js';
import { dto } from '../../connection/dto.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { request, HTTP_GET, HTTP_POST, HTTP_DELETE, HTTP_PUT, HTTP_STATUS_CREATED } from '../../connection/request.js';

export const comment = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let owns = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let showHide = null;

    /**
     * @type {HTMLElement|null}
     */
    let comments = null;

    /**
     * @type {string[]}
     */
    const lastRender = [];

    /**
     * @returns {string}
     */
    const onNullComment = () => {
        const desc = lang
            .on('id', '📢 Hãy chia sẻ thiệp mời này để có thêm nhiều bình luận nhé! 🎉')
            .on('en', '📢 Let\'s share this invitation to get more comments! 🎉')
            .get();

        return `<div class="text-center p-4 mx-0 mt-0 mb-3 bg-theme-auto rounded-4 shadow"><p class="fw-bold p-0 m-0" style="font-size: 0.95rem;">${desc}</p></div>`;
    };

    /**
     * @param {string} id 
     * @param {boolean} disabled 
     * @returns {void}
     */
    const changeActionButton = (id, disabled) => {
        const actionButton = document.querySelector(`[data-button-action="${id}"]`);
        if (actionButton) {
            actionButton.childNodes.forEach((e) => e.disabled = disabled);
        }
    };
    /**
     * @param {string} id
     * @returns {void}
     */
    const removeInnerForm = (id) => {
        changeActionButton(id, false);
        document.getElementById(`inner-${id}`).remove();
        // Sau khi xóa form, cần đảm bảo nút "Reply" được kích hoạt lại nếu có
        const replyButton = document.querySelector(`[data-button-action="${id}"] .btn-reply`);
        if (replyButton) replyButton.disabled = false;
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {void}
     */
    const showOrHide = (button) => {
        // Chức năng này liên quan đến bình luận lồng nhau, không được hỗ trợ bởi schema hiện tại.
        // Có thể vô hiệu hóa hoặc xóa nếu không có parent_id trong bảng comments.
        // Để giữ cho code không lỗi, tạm thời không làm gì.
        console.warn("showOrHide function is not fully supported with current Supabase schema (no nested comments).");
    };

    /**
     * @param {HTMLAnchorElement} anchor 
     * @param {string} uuid 
     * @returns {void}
     */
    const showMore = (anchor, uuid) => {
        // Chức năng này vẫn hoạt động tốt với nội dung bình luận dài.
        const content = document.getElementById(`content-${uuid}`);
        const original = util.base64Decode(content.getAttribute('data-comment'));
        const isCollapsed = anchor.getAttribute('data-show') === 'false';

        util.safeInnerHTML(content, util.convertMarkdownToHTML(util.escapeHtml(isCollapsed ? original : original.slice(0, card.maxCommentLength) + '...')));
        anchor.innerText = isCollapsed ? 'Sebagian' : 'Selengkapnya';
        anchor.setAttribute('data-show', isCollapsed ? 'true' : 'false');
    };

    /**
     * @param {ReturnType<typeof dto.getCommentResponse>} c
     * @returns {Promise<void>}
     */
    const fetchTracker = async (c) => {
        if (c.comments) { // Nếu có trường comments (cho bình luận lồng nhau), thì xử lý đệ quy
            await Promise.all(c.comments.map((v) => fetchTracker(v)));
        }

        if (!c.ip || !c.user_agent || c.is_admin) {
            return;
        }

        /**
         * @param {string} result 
         * @returns {void}
         */
        const setResult = (result) => {
            const commentIp = document.getElementById(`ip-${util.escapeHtml(c.uuid)}`);
            util.safeInnerHTML(commentIp, `<i class="fa-solid fa-location-dot me-1"></i>${util.escapeHtml(c.ip)} <strong>${util.escapeHtml(result)}</strong>`);
        };

        // Free for commercial and non-commercial use.
        await request(HTTP_GET, `https://apip.cc/api-json/${c.ip}`)
            .withCache()
            .withRetry()
            .default()
            .then((res) => res.json())
            .then((res) => {
                let result = 'localhost';

                if (res.status === 'success') {
                    if (res.City.length !== 0 && res.RegionName.length !== 0) {
                        result = res.City + ' - ' + res.RegionName;
                    } else if (res.Capital.length !== 0 && res.CountryName.length !== 0) {
                        result = res.Capital + ' - ' + res.CountryName;
                    }
                }

                setResult(result);
            })
            .catch((err) => setResult(err.message));
    };

    /**
     * @param {ReturnType<typeof dto.getCommentsResponse>} items 
     * @param {ReturnType<typeof dto.commentShowMore>[]} hide 
     * @returns {ReturnType<typeof dto.commentShowMore>[]}
     */ // Chức năng này liên quan đến bình luận lồng nhau, sẽ không được sử dụng.
    // const traverse = (items, hide = []) => {
    //     const dataShow = showHide.get('show');

    //     const buildHide = (lists) => lists.forEach((item) => {
    //         if (hide.find((i) => i.uuid === item.uuid)) {
    //             buildHide(item.comments);
    //             return;
    //         }

    //         hide.push(dto.commentShowMore(item.uuid));
    //         buildHide(item.comments);
    //     });

    //     const setVisible = (lists) => lists.forEach((item) => {
    //         if (!dataShow.includes(item.uuid)) {
    //             setVisible(item.comments);
    //             return;
    //         }

    //         item.comments.forEach((c) => {
    //             const i = hide.findIndex((h) => h.uuid === c.uuid);
    //             if (i !== -1) {
    //                 hide[i].show = true;
    //             }
    //         });

    //         setVisible(item.comments);
    //     });

    //     buildHide(items);
    //     setVisible(items);

    //     return hide;
    // };

    /**
     * @returns {Promise<ReturnType<typeof dto.getCommentsResponse>>}
     */
    const show = () => {

        // remove all event listener.
        lastRender.forEach((u) => {
            like.removeListener(u);
        });

        if (comments.getAttribute('data-loading') === 'false') {
            comments.setAttribute('data-loading', 'true');
            comments.innerHTML = card.renderLoading().repeat(pagination.getPer());
        }

        // Supabase: Lấy comments và đếm likes
        return request(HTTP_GET, `/comments?select=*,likes(id)&order=created_at.desc&limit=${pagination.getPer()}&offset=${pagination.getNext()}`)
            .token(session.getToken())
            .withCache(1000 * 30)
            .withForceCache()
            .send() // Không cần DTO converter ở đây, xử lý trực tiếp response
            .then(async ({ data: commentsData, headers }) => {
                comments.setAttribute('data-loading', 'false');

                for (const u of lastRender) {
                    await gif.remove(u);
                }

                if (commentsData.length === 0) {
                    comments.innerHTML = onNullComment();
                    return { data: { lists: [], count: 0 } }; // Trả về cấu trúc tương tự DTO cũ
                }

                // Chuyển đổi dữ liệu Supabase sang định dạng mong muốn của frontend
                const processedComments = commentsData.map(c => ({
                    uuid: c.id,
                    name: c.name,
                    is_presence: c.is_presence,
                    content: c.content,
                    gif_id: c.gif_id,
                    created_at: c.created_at,
                    likes: c.likes ? c.likes.length : 0, // Đếm số lượng likes
                    is_admin: session.isAdmin(), // Giả định admin có thể xem tất cả
                    is_parent: true, // Tất cả đều là bình luận cấp cao nhất
                    // Không có trường 'own' từ Supabase, RLS sẽ xử lý quyền
                }));

                lastRender.splice(0, lastRender.length, ...processedComments.map(c => c.uuid));
                // showHide.set('hidden', traverse(processedComments, showHide.get('hidden'))); // Vô hiệu hóa traverse

                let data = await card.renderContentMany(processedComments);
                if (processedComments.length < pagination.getPer()) {
                    data += onNullComment();
                }

                util.safeInnerHTML(comments, data);

                lastRender.forEach((u) => {
                    like.addListener(u);
                });
                
                // Lấy tổng số lượng từ header Content-Range của Supabase
                const contentRange = headers.get('Content-Range');
                const totalCount = contentRange ? parseInt(contentRange.split('/')[1], 10) : commentsData.length;

                return { data: { lists: processedComments, count: totalCount } };
            })
            .then(async (result) => {
                comments.dispatchEvent(new Event('undangan.comment.result'));

                // fetchTracker chỉ cần cho bình luận cấp cao nhất
                // if (result.data.lists && session.isAdmin()) {
                //     await Promise.all(result.data.lists.map((v) => fetchTracker(v)));
                // }

                pagination.setTotal(res.data.count);
                comments.dispatchEvent(new Event('undangan.comment.done'));
                return res;
            });
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {Promise<void>}
     */
    const remove = async (button) => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        const id = button.getAttribute('data-uuid');

        // Với RLS của Supabase, 'own' không còn cần thiết theo cách này.
        // Chúng ta chỉ cần ID của bình luận để xóa.
        owns.set(id, id); // Lưu ID của bình luận vào owns để sử dụng cho DELETE/PATCH

        changeActionButton(id, true);
        const btn = util.disableButton(button);
        const likes = like.getButtonLike(id); // Lấy nút like
        likes.disabled = true;

        // Supabase: DELETE /comments?id=eq.{id}
        const { data: statusResponse } = await request(HTTP_DELETE, `/comments?id=eq.${owns.get(id)}`)
            .token(session.getToken())
            .send();

        if (!statusResponse || statusResponse.data.status === false) { // Supabase trả về mảng rỗng nếu thành công
            btn.restore();
            likes.disabled = false;
            changeActionButton(id, false);
            return;
        }

        // Logic liên quan đến bình luận lồng nhau (showOrHide) sẽ bị loại bỏ
        // document.querySelectorAll('a[onclick="undangan.comment.showOrHide(this)"]').forEach((n) => {
        //     const oldUuids = n.getAttribute('data-uuids').split(',');
        //     if (oldUuids.includes(id)) {
        //         const uuids = oldUuids.filter((i) => i !== id).join(',');
        //         uuids.length === 0 ? n.remove() : n.setAttribute('data-uuids', uuids);
        //     }
        // });

        owns.unset(id);
        document.getElementById(id).remove();

        if (comments.children.length === 0) {
            comments.innerHTML = onNullComment();
        }
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {Promise<void>}
     */
    const update = async (button) => {
        const id = button.getAttribute('data-uuid');

        let isPresent = false;
        const presence = document.getElementById(`form-inner-presence-${id}`);
        if (presence) {
            presence.disabled = true;
            isPresent = presence.value === '1';
        }

        const badge = document.getElementById(`badge-${id}`);
        const isChecklist = !!badge && badge.getAttribute('data-is-presence') === 'true';

        const gifIsOpen = gif.isOpen(id);
        const gifId = gif.getResultId(id);
        const gifCancel = gif.buttonCancel(id);

        if (gifIsOpen && gifId) {
            gifCancel.hide();
        }

        const form = document.getElementById(`form-inner-${id}`);

        if (id && !gifIsOpen && util.base64Encode(form.value) === form.getAttribute('data-original') && isChecklist === isPresent) {
            removeInnerForm(id);
            return;
        }

        if (!gifIsOpen && form.value?.trim().length === 0) {
            util.notify('Bình luận không được để trống.').warning();
            return;
        }

        if (form) {
            form.disabled = true;
        }

        const cancel = document.querySelector(`[onclick="undangan.comment.cancel(this, '${id}')"]`);
        if (cancel) {
            cancel.disabled = true;
        }

        const btn = util.disableButton(button);

        // Supabase: PATCH /comments?id=eq.{id}
        const { data: statusResponse } = await request(HTTP_PATCH, `/comments?id=eq.${owns.get(id)}`)
            .token(session.getToken())
            .body(dto.updateCommentRequest(presence ? isPresent : null, gifIsOpen ? null : form.value, gifId))
            .send();

        if (form) {
            form.disabled = false;
        }

        if (cancel) {
            cancel.disabled = false;
        }

        if (presence) {
            presence.disabled = false;
        }

        btn.restore();

        if (gifIsOpen && gifId) {
            gifCancel.show();
        }

        if (!statusResponse || statusResponse.data.status === false) { // Supabase trả về mảng rỗng nếu thành công
            return;
        }

        if (gifIsOpen && gifId) {
            document.getElementById(`img-gif-${id}`).src = document.getElementById(`gif-result-${id}`)?.querySelector('img').src;
            gifCancel.click();
        }

        removeInnerForm(id);

        if (!gifIsOpen) {
            const showButton = document.querySelector(`[onclick="undangan.comment.showMore(this, '${id}')"]`);

            const content = document.getElementById(`content-${id}`);
            content.setAttribute('data-comment', util.base64Encode(form.value));

            const original = util.convertMarkdownToHTML(util.escapeHtml(form.value));
            if (form.value.length > card.maxCommentLength) {
                util.safeInnerHTML(content, showButton?.getAttribute('data-show') === 'false' ? original.slice(0, card.maxCommentLength) + '...' : original);
                showButton?.classList.replace('d-none', 'd-block');
            } else {
                util.safeInnerHTML(content, original);
                showButton?.classList.replace('d-block', 'd-none');
            }
        }

        if (presence) {
            document.getElementById('form-presence').value = isPresent ? '1' : '2';
            storage('information').set('presence', isPresent);
        }

        if (!presence || !badge) {
            return;
        }

        badge.classList.toggle('fa-circle-xmark', !isPresent);
        badge.classList.toggle('text-danger', !isPresent);

        badge.classList.toggle('fa-circle-check', isPresent);
        badge.classList.toggle('text-success', isPresent);
    };

    /**
     * @param {HTMLButtonElement} button 
     * @returns {Promise<void>}
     */
    const send = async (button) => {
        const id = button.getAttribute('data-uuid');

        const name = document.getElementById('form-name');
        const nameValue = name.value;

        if (nameValue.length === 0) {
            util.notify('Tên không được để trống.').warning();

            if (id) {
                // scroll to form.
                name.scrollIntoView({ block: 'center' });
            }
            return;
        }

        const presence = document.getElementById('form-presence');
        if (!id && presence && presence.value === '0') {
            util.notify('Vui lòng chọn trạng thái tham dự của bạn.').warning();
            return;
        }

        const gifIsOpen = gif.isOpen(id ? id : gif.default);
        const gifId = gif.getResultId(id ? id : gif.default);
        const gifCancel = gif.buttonCancel(id);

        if (gifIsOpen && !gifId) {
            util.notify('Gif không được để trống.').warning();
            return;
        }

        if (gifIsOpen && gifId) {
            gifCancel.hide();
        }

        const form = document.getElementById(`form-${id ? `inner-${id}` : 'comment'}`);
        if (!gifIsOpen && form.value?.trim().length === 0) {
            util.notify('Bình luận không được để trống.').warning();
            return;
        }

        if (!id && name && !session.isAdmin()) {
            name.disabled = true;
        }

        if (!session.isAdmin() && presence && presence.value !== '0') {
            presence.disabled = true;
        }

        if (form) {
            form.disabled = true;
        }

        const cancel = document.querySelector(`[onclick="undangan.comment.cancel(this, '${id}')"]`);
        if (cancel) {
            cancel.disabled = true;
        }

        const btn = util.disableButton(button);
        const isPresence = presence ? presence.value === '1' : true;

        if (!session.isAdmin()) {
            const info = storage('information');
            info.set('name', nameValue);

            if (!id) {
                info.set('presence', isPresence);
            }
        }

        const response = await request(HTTP_POST, `/api/comment?lang=${lang.getLanguage()}`)
            .token(session.getToken())
            .body(dto.postCommentRequest(id, nameValue, isPresence, gifIsOpen ? null : form.value, gifId))
            .send(dto.getCommentResponse);

        if (name) {
            name.disabled = false;
        }

        if (form) {
            form.disabled = false;
        }

        if (cancel) {
            cancel.disabled = false;
        }

        if (presence) {
            presence.disabled = false;
        }

        if (gifIsOpen && gifId) {
            gifCancel.show();
        }

        btn.restore();

        if (!responseData || responseData.length === 0) { // Supabase POST trả về mảng các đối tượng đã tạo, nếu rỗng là lỗi
            return;
        }
        const newComment = responseData[0]; // Lấy đối tượng bình luận đầu tiên

        if (form) {
            form.value = null;
        }

        if (gifIsOpen && gifId) {
            gifCancel.click();
        }

        owns.set(newComment.id, newComment.id); // Lưu ID của bình luận
        if (!id) {
            if (pagination.reset()) {
                await show();
                comments.scrollIntoView();
                return;
            }

            pagination.setTotal(pagination.geTotal() + 1);
            if (comments.children.length === pagination.getPer()) {
                comments.lastElementChild.remove();
            }

            // Chuyển đổi định dạng cho frontend
            const processedNewComment = {
                uuid: newComment.id,
                name: newComment.name,
                is_presence: newComment.is_presence,
                content: newComment.content,
                gif_id: newComment.gif_id,
                created_at: newComment.created_at,
                likes: 0, // Bình luận mới chưa có likes
                is_admin: session.isAdmin(),
                is_parent: true, // Luôn là bình luận cấp cao nhất
            };

            comments.insertAdjacentHTML('afterbegin', await card.renderContentMany([processedNewComment]));
            comments.scrollIntoView();
        }

        // Logic cho bình luận lồng nhau (reply) bị loại bỏ do schema Supabase không hỗ trợ
        // if (id) {
        //     removeInnerForm(id);
        //     // ... (logic cũ cho reply)
        // }

        like.addListener(newComment.id);
        lastRender.push(newComment.id);
    };

    /**
     * @param {string} uuid 
     * @returns {void}
     */
    const reply = (uuid) => {
        // Chức năng reply bị vô hiệu hóa do schema Supabase không hỗ trợ bình luận lồng nhau.
        util.notify('Chức năng trả lời bình luận hiện không được hỗ trợ.').info();
        console.warn(`Reply function for comment ${uuid} is disabled as nested comments are not supported by the current Supabase schema.`);
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {string} id
     * @returns {Promise<void>}
     */
    const cancel = async (button, id) => {
        const presence = document.getElementById(`form-inner-presence-${id}`);
        const isPresent = presence ? presence.value === '1' : false;

        const badge = document.getElementById(`badge-${id}`);
        const isChecklist = badge && owns.has(id) && presence ? badge.getAttribute('data-is-presence') === 'true' : false;

        const btn = util.disableButton(button);

        if (gif.isOpen(id) && ((!gif.getResultId(id) && isChecklist === isPresent) || util.ask('Are you sure?'))) {
            await gif.remove(id);
            removeInnerForm(id);
            return;
        }

        const form = document.getElementById(`form-inner-${id}`);
        if (form.value.length === 0 || (util.base64Encode(form.value) === form.getAttribute('data-original') && isChecklist === isPresent) || util.ask('Are you sure?')) {
            removeInnerForm(id);
            return;
        }

        btn.restore();
    };

    /**
     * @param {HTMLButtonElement} button 
     * @param {boolean} is_parent
     * @returns {Promise<void>}
     */
    const edit = async (button, is_parent) => {
        const id = button.getAttribute('data-uuid');
        changeActionButton(id, true);

        // Với RLS của Supabase, 'own' không còn cần thiết theo cách này.
        if (!owns.has(id)) { // Nếu chưa có trong owns, lưu ID của bình luận
            owns.set(id, id);
        }

        const badge = document.getElementById(`badge-${id}`);
        const isChecklist = !!badge && badge.getAttribute('data-is-presence') === 'true';

        const gifImage = document.getElementById(`img-gif-${id}`);
        if (gifImage) {
            await gif.remove(id);
        }

        const isParent = is_parent; // is_parent sẽ luôn là true vì không có bình luận lồng nhau
        document.getElementById(`button-${id}`).insertAdjacentElement('afterend', card.renderSửa(id, isChecklist, isParent, !!gifImage));

        if (gifImage) {
            gif.onOpen(id, () => {
                gif.removeGifSearch(id);
                gif.removeButtonBack(id);
            });

            await gif.open(id);
            return;
        }

        const formInner = document.getElementById(`form-inner-${id}`);
        const original = util.base64Decode(document.getElementById(`content-${id}`)?.getAttribute('data-comment'));

        formInner.value = original;
        formInner.setAttribute('data-original', util.base64Encode(original));
    };

    /**
     * @returns {void}
     */
    const init = () => {
        gif.init();
        like.init();
        card.init();
        pagination.init();

        comments = document.getElementById('comments');
        comments.addEventListener('undangan.comment.show', show);

        owns = storage('owns');
        showHide = storage('comment');

        if (!showHide.has('hidden')) {
            showHide.set('hidden', []); // Vẫn giữ để tránh lỗi, nhưng sẽ không được sử dụng
        }

        if (!showHide.has('show')) {
            showHide.set('show', []);
        }
    };

    return {
        gif,
        like,
        pagination,
        init,
        send,
        edit,
        reply,
        remove,
        update,
        cancel,
        show,
        showMore,
        showOrHide,
    };
})();