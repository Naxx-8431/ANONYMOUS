'use strict';

(async () => {
    /* ── Auth guard ─────────────────────────────────────────────── */
    const session = await requireLogin();
    if (!session) return;

    /* ── Logout ──────────────────────────────────────────────────── */
    document.getElementById('navLogout').addEventListener('click', () => Auth.logout());

    /* ── Populate Header ─────────────────────────────────────────── */
    document.getElementById('profileUsername').innerText = session.username;
    document.getElementById('profileJoined').innerText = 'Member since: ' + formatDate(session.joined);

    /* ── Load Stats ──────────────────────────────────────────────── */
    async function updateStats() {
        const [myPosts, myComments] = await Promise.all([
            Posts.getMyPosts(),
            Comments.getMyComments(),
        ]);
        document.getElementById('statPosts').innerText = myPosts.length;
        document.getElementById('statComments').innerText = myComments.length;
    }

    /* ==============================================================
       TABS
       ============================================================== */
    const tabBtns = document.querySelectorAll('#profileTabs button');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const tab = this.dataset.tab;
            document.getElementById('tabPosts').style.display = tab === 'posts' ? 'block' : 'none';
            document.getElementById('tabComments').style.display = tab === 'comments' ? 'block' : 'none';
        });
    });

    /* ==============================================================
       MY POSTS
       ============================================================== */
    async function renderMyPosts() {
        const posts = await Posts.getMyPosts();
        const list = document.getElementById('myPostList');
        const empty = document.getElementById('myPostEmpty');
        list.innerHTML = '';

        if (!posts.length) { empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        posts.forEach(post => {
            const lClass = post.myVote === 'like' ? 'liked' : '';
            const dClass = post.myVote === 'dislike' ? 'disliked' : '';
            const commentCount = post.commentCount || 0;
            const bodyPreview = post.body.length > 160 ? post.body.slice(0, 160) + '...' : post.body;

            const card = document.createElement('div');
            card.className = 'post-card';
            card.dataset.postId = post.id;
            card.innerHTML = `
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-body">${escapeHtml(bodyPreview)}</div>
        <div class="d-flex align-items-center justify-content-between flex-wrap" style="gap:8px; margin-top:10px;">
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="vote-btn profile-vote ${lClass}" data-vote="like"    data-post="${post.id}">&#9650; <span class="like-count">${post.likes}</span></button>
            <button class="vote-btn profile-vote ${dClass}" data-vote="dislike" data-post="${post.id}">&#9660; <span class="dislike-count">${post.dislikes}</span></button>
            <span style="color:#333; font-size:0.75rem; letter-spacing:1px;">
              ${commentCount} comment${commentCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span class="post-meta">${formatDate(post.created_at)}</span>
            <button class="delete-post-btn"
              data-post="${post.id}"
              style="background:none; border:1px solid #330000; color:#550000; font-family:'Courier Prime',monospace; font-size:0.72rem; letter-spacing:1px; padding:3px 10px; cursor:pointer; text-transform:uppercase;"
            >[ delete ]</button>
          </div>
        </div>
      `;
            list.appendChild(card);
        });
    }

    /* ── Vote + Delete delegation (posts) ───────────────────────── */
    document.getElementById('myPostList').addEventListener('click', async (e) => {
        const voteBtn = e.target.closest('.profile-vote');
        const deleteBtn = e.target.closest('.delete-post-btn');

        if (voteBtn) {
            const postId = voteBtn.dataset.post;
            const type = voteBtn.dataset.vote;
            voteBtn.disabled = true;
            const result = await Votes.vote(postId, type);
            voteBtn.disabled = false;
            if (!result.ok) return;

            const card = document.querySelector(`#myPostList .post-card[data-post-id="${postId}"]`);
            if (card) {
                card.querySelector('.like-count').innerText = result.likes;
                card.querySelector('.dislike-count').innerText = result.dislikes;
                card.querySelectorAll('.profile-vote').forEach(b => {
                    b.classList.remove('liked', 'disliked');
                    if (result.myVote === 'like' && b.dataset.vote === 'like') b.classList.add('liked');
                    if (result.myVote === 'dislike' && b.dataset.vote === 'dislike') b.classList.add('disliked');
                });
            }
        }

        if (deleteBtn) {
            if (!confirm('Delete this post? This also removes all its comments. Cannot be undone.')) return;

            const postId = deleteBtn.dataset.post;
            const result = await Posts.delete(postId);
            if (result.ok) {
                const card = document.querySelector(`#myPostList .post-card[data-post-id="${postId}"]`);
                if (card) card.remove();
                await updateStats();
                if (!document.querySelector('#myPostList .post-card'))
                    document.getElementById('myPostEmpty').style.display = 'block';
                await renderMyComments(); // refresh comments (cascade may have deleted some)
            } else {
                alert(result.error);
            }
        }
    });

    /* ==============================================================
       MY COMMENTS
       ============================================================== */
    async function renderMyComments() {
        const comments = await Comments.getMyComments();
        const list = document.getElementById('myCommentList');
        const empty = document.getElementById('myCommentEmpty');
        list.innerHTML = '';

        if (!comments.length) { empty.style.display = 'block'; return; }
        empty.style.display = 'none';

        comments.forEach(c => {
            const postTitle = c.post_title ? escapeHtml(c.post_title) : '[deleted post]';
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.dataset.commentId = c.id;
            div.innerHTML = `
        <div style="color:#444; font-size:0.72rem; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">
          On: <span style="color:#8b0000;">${postTitle}</span>
        </div>
        <div class="comment-body">${escapeHtml(c.body)}</div>
        <div class="d-flex align-items-center justify-content-between" style="margin-top:6px;">
          <div class="comment-meta">${formatDate(c.created_at)}</div>
          <button class="delete-comment-btn"
            data-comment="${c.id}"
            style="background:none; border:1px solid #330000; color:#550000; font-family:'Courier Prime',monospace; font-size:0.72rem; letter-spacing:1px; padding:2px 8px; cursor:pointer; text-transform:uppercase;"
          >[ delete ]</button>
        </div>
      `;
            list.appendChild(div);
        });
    }

    /* ── Delete delegation (comments) ───────────────────────────── */
    document.getElementById('myCommentList').addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-comment-btn');
        if (!deleteBtn) return;

        if (!confirm('Delete this comment? Cannot be undone.')) return;
        const commentId = deleteBtn.dataset.comment;
        const result = await Comments.delete(commentId);

        if (result.ok) {
            const item = document.querySelector(`#myCommentList .comment-item[data-comment-id="${commentId}"]`);
            if (item) item.remove();
            await updateStats();
            if (!document.querySelector('#myCommentList .comment-item'))
                document.getElementById('myCommentEmpty').style.display = 'block';
        } else {
            alert(result.error);
        }
    });

    /* ── Initial Render ──────────────────────────────────────────── */
    await Promise.all([updateStats(), renderMyPosts(), renderMyComments()]);

})();
