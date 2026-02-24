'use strict';

(async () => {
    /* ── Auth guard ─────────────────────────────────────────────── */
    const session = await requireLogin();
    if (!session) return;

    /* ── Logout ──────────────────────────────────────────────────── */
    document.getElementById('navLogout').addEventListener('click', () => Auth.logout());

    /* ── State ───────────────────────────────────────────────────── */
    let currentPostId = null;

    /* ==============================================================
       RENDER HELPERS
       ============================================================== */
    function renderPostCard(post) {
        const lClass = post.myVote === 'like' ? 'liked' : '';
        const dClass = post.myVote === 'dislike' ? 'disliked' : '';
        const bodyPreview = post.body.length > 200 ? post.body.slice(0, 200) + '...' : post.body;

        const div = document.createElement('div');
        div.className = 'post-card';
        div.dataset.postId = post.id;
        div.innerHTML = `
      <div class="post-title">${escapeHtml(post.title)}</div>
      <div class="post-body">${escapeHtml(bodyPreview)}</div>
      <div class="post-meta d-flex justify-content-between align-items-center flex-wrap" style="gap:8px;">
        <div style="display:flex; gap:10px; align-items:center;">
          <button class="vote-btn ${lClass}" data-vote="like"    data-post="${post.id}">&#9650; <span class="like-count">${post.likes}</span></button>
          <button class="vote-btn ${dClass}" data-vote="dislike" data-post="${post.id}">&#9660; <span class="dislike-count">${post.dislikes}</span></button>
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          <span>${formatDate(post.created_at)}</span>
          <button class="btn-anon-ghost btn-anon-sm view-post-btn" data-post="${post.id}">[ read / comment ]</button>
        </div>
      </div>
    `;
        return div;
    }

    /* ==============================================================
       LOAD POSTS
       ============================================================== */
    async function loadPosts(query = '') {
        const listEl = document.getElementById('postList');
        const emptyEl = document.getElementById('emptyMsg');
        listEl.innerHTML = '<p style="color:#333; text-align:center; letter-spacing:2px; padding:30px 0;">loading...</p>';

        const posts = query ? await Posts.search(query) : await Posts.getAll();

        listEl.innerHTML = '';
        if (!posts.length) { emptyEl.style.display = 'block'; return; }
        emptyEl.style.display = 'none';
        posts.forEach(p => listEl.appendChild(renderPostCard(p)));
    }

    loadPosts();

    /* ==============================================================
       SEARCH
       ============================================================== */
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearSearch');

    async function doSearch() {
        const q = searchInput.value.trim();
        if (!q) { clearBtn.style.display = 'none'; await loadPosts(); return; }
        clearBtn.style.display = 'inline-block';
        await loadPosts(q);
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    clearBtn.addEventListener('click', async () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        await loadPosts();
    });

    /* ==============================================================
       NEW POST FORM
       ============================================================== */
    const newPostForm = document.getElementById('newPostForm');
    const alertBox = document.getElementById('postAlertBox');
    const toggleBtn = document.getElementById('togglePostForm');
    const formWrapper = document.getElementById('postFormWrapper');
    const cancelBtn = document.getElementById('cancelPost');

    function toggleForm(show) {
        formWrapper.style.display = show ? 'block' : 'none';
        toggleBtn.innerText = show ? '[ ✕ cancel ]' : '[ + new post ]';
    }

    toggleBtn.addEventListener('click', () => {
        const isHidden = formWrapper.style.display === 'none' || !formWrapper.style.display;
        toggleForm(isHidden);
    });
    cancelBtn.addEventListener('click', () => toggleForm(false));

    newPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        alertBox.style.display = 'none';

        const title = document.getElementById('postTitle').value.trim();
        const body = document.getElementById('postBody').value.trim();

        if (!title) { alertBox.innerText = 'Title is required.'; alertBox.style.display = 'block'; return; }
        if (!body) { alertBox.innerText = 'Body is required.'; alertBox.style.display = 'block'; return; }

        const submitBtn = document.getElementById('submitPost');
        submitBtn.disabled = true;
        submitBtn.innerText = '[ posting... ]';

        const result = await Posts.create(title, body);
        submitBtn.disabled = false;
        submitBtn.innerText = '[ submit ]';

        if (!result.ok) {
            alertBox.innerText = result.error || 'Failed to create post.';
            alertBox.style.display = 'block';
            return;
        }

        newPostForm.reset();
        toggleForm(false);
        await loadPosts();
    });

    /* char counter */
    document.getElementById('postBody').addEventListener('input', function () {
        document.getElementById('charCount').innerText = this.value.length;
    });

    /* ==============================================================
       VOTE + VIEW (event delegation on postList)
       ============================================================== */
    document.getElementById('postList').addEventListener('click', async (e) => {
        const voteBtn = e.target.closest('.vote-btn');
        const viewBtn = e.target.closest('.view-post-btn');

        if (voteBtn) {
            const postId = voteBtn.dataset.post;
            const type = voteBtn.dataset.vote;
            voteBtn.disabled = true;

            let result;
            try {
                result = await Votes.vote(postId, type);
            } catch (err) {
                voteBtn.disabled = false;
                return;
            }
            voteBtn.disabled = false;

            if (!result.ok) {
                // Show brief error below the post list
                const errEl = document.getElementById('voteErr');
                if (errEl) {
                    errEl.innerText = result.error || 'Vote failed. Try refreshing the page.';
                    errEl.style.display = 'block';
                    setTimeout(() => { errEl.style.display = 'none'; }, 4000);
                }
                return;
            }

            // Use closest() — the button is already inside the card!
            const card = voteBtn.closest('.post-card');
            if (card) {
                card.querySelector('.like-count').innerText = result.likes;
                card.querySelector('.dislike-count').innerText = result.dislikes;
                card.querySelectorAll('.vote-btn').forEach(b => {
                    b.classList.remove('liked', 'disliked');
                    if (result.myVote === 'like' && b.dataset.vote === 'like') b.classList.add('liked');
                    if (result.myVote === 'dislike' && b.dataset.vote === 'dislike') b.classList.add('disliked');
                });
            }
        }

        if (viewBtn) {
            await openModal(viewBtn.dataset.post);
        }
    });

    /* ==============================================================
       POST MODAL
       ============================================================== */
    const modal = document.getElementById('postModal');
    const closeModalBtn = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalMeta = document.getElementById('modalMeta');
    const commentList = document.getElementById('commentList');
    const noComments = document.getElementById('noComments');
    const commentBody = document.getElementById('commentBody');
    const commentAlert = document.getElementById('commentAlert');
    const submitComment = document.getElementById('submitComment');

    async function openModal(postId) {
        currentPostId = postId;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const post = await Posts.getById(postId);
        if (!post) { modal.style.display = 'none'; return; }

        modalTitle.innerText = post.title;
        modalBody.innerText = post.body;
        modalMeta.innerText = `Posted: ${formatDate(post.created_at)}  |  ▲ ${post.likes}  ▼ ${post.dislikes}`;

        await loadComments(postId);
    }

    async function loadComments(postId) {
        const comments = await Comments.getByPost(postId);
        commentList.innerHTML = '';

        if (!comments.length) {
            noComments.style.display = 'block';
            return;
        }
        noComments.style.display = 'none';
        comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
        <div class="comment-body">${escapeHtml(c.body)}</div>
        <div class="comment-meta">${formatDate(c.created_at)}</div>
      `;
            commentList.appendChild(div);
        });
    }

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        currentPostId = null;
        commentBody.value = '';
        commentAlert.style.display = 'none';
    });

    /* comment char counter */
    commentBody.addEventListener('input', function () {
        document.getElementById('commentCharCount').innerText = this.value.length;
    });

    /* Submit comment via button (no <form> wrapper needed) */
    submitComment.addEventListener('click', async () => {
        const body = commentBody.value.trim();
        commentAlert.style.display = 'none';
        if (!body) {
            commentAlert.className = 'anon-alert';
            commentAlert.innerText = 'Comment cannot be empty.';
            commentAlert.style.display = 'block';
            return;
        }

        submitComment.disabled = true;
        submitComment.innerText = '[ posting... ]';
        const result = await Comments.create(currentPostId, body);
        submitComment.disabled = false;
        submitComment.innerText = '[ post comment ]';

        if (!result.ok) {
            commentAlert.className = 'anon-alert';
            commentAlert.innerText = result.error || 'Failed to post comment.';
            commentAlert.style.display = 'block';
            return;
        }
        commentBody.value = '';
        document.getElementById('commentCharCount').innerText = '0';
        await loadComments(currentPostId);
    });

})();
