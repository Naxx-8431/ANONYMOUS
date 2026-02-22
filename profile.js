'use strict';

requireLogin();

const session = Auth.session();

/* ---- Logout ---- */
document.getElementById('navLogout').addEventListener('click', () => Auth.logout());

/* ---- Populate Header ---- */
document.getElementById('profileUsername').innerText = session.username;
document.getElementById('profileJoined').innerText = 'Member since: ' + formatDate(session.joined);

/* ---- Load Stats ---- */
function updateStats() {
    const myPosts = Posts.getByUser(session.userId);
    const myComments = Comments.getByUser(session.userId);
    document.getElementById('statPosts').innerText = myPosts.length;
    document.getElementById('statComments').innerText = myComments.length;
}
updateStats();

/* ================================================================
   TABS
   ================================================================ */
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

/* ================================================================
   MY POSTS
   ================================================================ */
function renderMyPosts() {
    const posts = Posts.getByUser(session.userId);
    const list = document.getElementById('myPostList');
    const empty = document.getElementById('myPostEmpty');
    list.innerHTML = '';

    if (!posts.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    posts.forEach(post => {
        const votes = Votes.get(post.id);
        const commentCount = Comments.getByPost(post.id).length;
        const lClass = votes.mine === 'like' ? 'liked' : '';
        const dClass = votes.mine === 'dislike' ? 'disliked' : '';
        const bodyPreview = post.body.length > 160
            ? post.body.slice(0, 160) + '...'
            : post.body;

        const card = document.createElement('div');
        card.className = 'post-card';
        card.dataset.postId = post.id;
        card.innerHTML = `
      <div class="post-title">${escapeHtml(post.title)}</div>
      <div class="post-body">${escapeHtml(bodyPreview)}</div>
      <div class="d-flex align-items-center justify-content-between flex-wrap" style="gap:8px; margin-top:10px;">
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="vote-btn profile-vote ${lClass}" data-vote="like" data-post="${post.id}">
            &#9650; <span class="like-count">${votes.like}</span>
          </button>
          <button class="vote-btn profile-vote ${dClass}" data-vote="dislike" data-post="${post.id}">
            &#9660; <span class="dislike-count">${votes.dislike}</span>
          </button>
          <span style="color:#333; font-size:0.75rem; letter-spacing:1px;">
            ${commentCount} comment${commentCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="post-meta">${formatDate(post.createdAt)}</span>
          <button
            class="delete-post-btn"
            data-post="${post.id}"
            style="background:none; border:1px solid #330000; color:#550000; font-family:'Courier Prime',monospace; font-size:0.72rem; letter-spacing:1px; padding:3px 10px; cursor:pointer; text-transform:uppercase;"
            title="Delete this post"
          >[ delete ]</button>
        </div>
      </div>
    `;
        list.appendChild(card);
    });
}

renderMyPosts();

/* ---- Vote delegation ---- */
document.getElementById('myPostList').addEventListener('click', function (e) {
    const voteBtn = e.target.closest('.profile-vote');
    const deleteBtn = e.target.closest('.delete-post-btn');

    if (voteBtn) {
        const postId = voteBtn.dataset.post;
        const type = voteBtn.dataset.vote;
        Votes.vote(postId, type);

        const card = document.querySelector(`#myPostList .post-card[data-post-id="${postId}"]`);
        if (card) {
            const v = Votes.get(postId);
            card.querySelector('.like-count').innerText = v.like;
            card.querySelector('.dislike-count').innerText = v.dislike;
            card.querySelectorAll('.profile-vote').forEach(b => {
                b.classList.remove('liked', 'disliked');
                if (v.mine === 'like' && b.dataset.vote === 'like') b.classList.add('liked');
                if (v.mine === 'dislike' && b.dataset.vote === 'dislike') b.classList.add('disliked');
            });
        }
        return;
    }

    if (deleteBtn) {
        const postId = deleteBtn.dataset.post;
        if (!confirm('Delete this post? This will also remove all its comments. This cannot be undone.')) return;

        const result = Posts.delete(postId);
        if (result.ok) {
            // Remove card from DOM instantly
            const card = document.querySelector(`#myPostList .post-card[data-post-id="${postId}"]`);
            if (card) card.remove();
            updateStats();
            // Show empty message if no posts left
            if (!document.querySelector('#myPostList .post-card')) {
                document.getElementById('myPostEmpty').style.display = 'block';
            }
            // Also refresh comments tab since cascade-deleted comments may be there
            renderMyComments();
        } else {
            alert(result.error);
        }
    }
});

/* ================================================================
   MY COMMENTS
   ================================================================ */
function renderMyComments() {
    const comments = Comments.getByUser(session.userId);
    const list = document.getElementById('myCommentList');
    const empty = document.getElementById('myCommentEmpty');
    list.innerHTML = '';

    if (!comments.length) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    comments.forEach(c => {
        const post = Posts.getById(c.postId);
        const postTitle = post ? escapeHtml(post.title) : '[deleted post]';

        const div = document.createElement('div');
        div.className = 'comment-item';
        div.dataset.commentId = c.id;
        div.innerHTML = `
      <div style="color:#444; font-size:0.72rem; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">
        On post: <span style="color:#8b0000;">${postTitle}</span>
      </div>
      <div class="comment-body">${escapeHtml(c.body)}</div>
      <div class="d-flex align-items-center justify-content-between" style="margin-top:6px;">
        <div class="comment-meta">${formatDate(c.createdAt)}</div>
        <button
          class="delete-comment-btn"
          data-comment="${c.id}"
          style="background:none; border:1px solid #330000; color:#550000; font-family:'Courier Prime',monospace; font-size:0.72rem; letter-spacing:1px; padding:2px 8px; cursor:pointer; text-transform:uppercase;"
          title="Delete this comment"
        >[ delete ]</button>
      </div>
    `;
        list.appendChild(div);
    });
}

renderMyComments();

/* ---- Delete delegation for comments ---- */
document.getElementById('myCommentList').addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('.delete-comment-btn');
    if (!deleteBtn) return;

    const commentId = deleteBtn.dataset.comment;
    if (!confirm('Delete this comment? This cannot be undone.')) return;

    const result = Comments.delete(commentId);
    if (result.ok) {
        const item = document.querySelector(`#myCommentList .comment-item[data-comment-id="${commentId}"]`);
        if (item) item.remove();
        updateStats();
        if (!document.querySelector('#myCommentList .comment-item')) {
            document.getElementById('myCommentEmpty').style.display = 'block';
        }
    } else {
        alert(result.error);
    }
});
