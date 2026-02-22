'use strict';

// Must be logged in
requireLogin();

/* ---- Logout ---- */
document.getElementById('navLogout').addEventListener('click', () => Auth.logout());

/* ---- State ---- */
let currentPostId = null;
let isSearching = false;

/* ================================================================
   POST RENDERING
   ================================================================ */
function buildPostCard(post) {
    const votes = Votes.get(post.id);
    const commentCount = Comments.getByPost(post.id).length;
    const session = Auth.session();

    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;

    const title = escapeHtml(post.title);
    const bodyPreview = escapeHtml(post.body.length > 180 ? post.body.slice(0, 180) + '...' : post.body);
    const dateStr = formatDate(post.createdAt);
    const lClass = votes.mine === 'like' ? 'liked' : '';
    const dClass = votes.mine === 'dislike' ? 'disliked' : '';

    card.innerHTML = `
    <div class="post-title">${title}</div>
    <div class="post-body">${bodyPreview}</div>
    <div class="d-flex align-items-center justify-content-between flex-wrap" style="gap:8px; margin-top:8px;">
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="vote-btn ${lClass}" data-vote="like" data-post="${post.id}" title="Like">
          &#9650; <span class="like-count">${votes.like}</span>
        </button>
        <button class="vote-btn ${dClass}" data-vote="dislike" data-post="${post.id}" title="Dislike">
          &#9660; <span class="dislike-count">${votes.dislike}</span>
        </button>
        <button class="btn-anon-ghost btn-anon-sm open-post" data-post="${post.id}">
          [ read + ${commentCount} comment${commentCount !== 1 ? 's' : ''} ]
        </button>
      </div>
      <div class="post-meta">
        <span>${dateStr}</span>
      </div>
    </div>
  `;
    return card;
}

function renderPosts(posts) {
    const list = document.getElementById('postList');
    const empty = document.getElementById('emptyMsg');
    list.innerHTML = '';

    if (!posts || posts.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';
    posts.forEach(p => list.appendChild(buildPostCard(p)));
}

/* ================================================================
   POST LIST LOAD
   ================================================================ */
function loadPosts() {
    const posts = isSearching
        ? Posts.search(document.getElementById('searchInput').value)
        : Posts.getAll();
    renderPosts(posts);
}

loadPosts();

/* ================================================================
   SEARCH
   ================================================================ */
document.getElementById('searchBtn').addEventListener('click', doSearch);
document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
});

function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    const status = document.getElementById('searchStatus');
    const clearBtn = document.getElementById('clearSearch');
    const heading = document.getElementById('postsHeading');

    if (!q) {
        isSearching = false;
        status.innerText = '';
        clearBtn.style.display = 'none';
        heading.innerText = 'LATEST POSTS';
        loadPosts();
        return;
    }

    isSearching = true;
    clearBtn.style.display = 'inline-block';

    const results = Posts.search(q);
    heading.innerText = `SEARCH RESULTS`;
    status.innerText = `${results.length} result(s) for "${escapeHtml(q)}"`;
    renderPosts(results);
}

document.getElementById('clearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    isSearching = false;
    document.getElementById('searchStatus').innerText = '';
    document.getElementById('clearSearch').style.display = 'none';
    document.getElementById('postsHeading').innerText = 'LATEST POSTS';
    loadPosts();
});

/* ================================================================
   NEW POST FORM
   ================================================================ */
document.getElementById('togglePostForm').addEventListener('click', () => {
    const wrapper = document.getElementById('postFormWrapper');
    const isHidden = wrapper.style.display === 'none';
    wrapper.style.display = isHidden ? 'block' : 'none';
    document.getElementById('togglePostForm').innerText = isHidden ? '[ - close ]' : '[ + new post ]';
});

document.getElementById('cancelPost').addEventListener('click', () => {
    document.getElementById('postFormWrapper').style.display = 'none';
    document.getElementById('togglePostForm').innerText = '[ + new post ]';
    document.getElementById('newPostForm').reset();
    document.getElementById('charCount').innerText = '0';
});

document.getElementById('postBody').addEventListener('input', function () {
    document.getElementById('charCount').innerText = this.value.length;
});

document.getElementById('newPostForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const title = document.getElementById('postTitle').value;
    const body = document.getElementById('postBody').value;
    const alertBox = document.getElementById('postAlertBox');

    // Clear errors
    ['postTitle', 'postBody'].forEach(id => document.getElementById(id).classList.remove('is-invalid'));
    alertBox.style.display = 'none';

    let hasError = false;
    if (!title.trim()) {
        document.getElementById('postTitle').classList.add('is-invalid');
        document.getElementById('postTitleErr').innerText = 'Title is required.';
        hasError = true;
    }
    if (!body.trim()) {
        document.getElementById('postBody').classList.add('is-invalid');
        document.getElementById('postBodyErr').innerText = 'Content is required.';
        hasError = true;
    }
    if (hasError) return;

    const btn = document.getElementById('submitPost');
    btn.disabled = true;
    btn.innerText = '[ posting... ]';

    setTimeout(() => {
        const result = Posts.create(title, body);
        if (result.ok) {
            document.getElementById('newPostForm').reset();
            document.getElementById('charCount').innerText = '0';
            document.getElementById('postFormWrapper').style.display = 'none';
            document.getElementById('togglePostForm').innerText = '[ + new post ]';
            isSearching = false;
            document.getElementById('postsHeading').innerText = 'LATEST POSTS';
            document.getElementById('searchStatus').innerText = '';
            loadPosts();
        } else {
            alertBox.className = 'anon-alert';
            alertBox.innerText = result.error;
            alertBox.style.display = 'block';
        }
        btn.disabled = false;
        btn.innerText = '[ submit ]';
    }, 300);
});

/* ================================================================
   VOTE HANDLER (event delegation)
   ================================================================ */
document.getElementById('postList').addEventListener('click', function (e) {
    const voteBtn = e.target.closest('[data-vote]');
    const openBtn = e.target.closest('.open-post');

    if (voteBtn) {
        const postId = voteBtn.dataset.post;
        const type = voteBtn.dataset.vote;
        Votes.vote(postId, type);
        // Update counts in-place
        const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (card) {
            const v = Votes.get(postId);
            card.querySelector('.like-count').innerText = v.like;
            card.querySelector('.dislike-count').innerText = v.dislike;
            card.querySelectorAll('.vote-btn').forEach(b => {
                b.classList.remove('liked', 'disliked');
                if (v.mine === 'like' && b.dataset.vote === 'like') b.classList.add('liked');
                if (v.mine === 'dislike' && b.dataset.vote === 'dislike') b.classList.add('disliked');
            });
        }
        return;
    }

    if (openBtn) {
        openPostModal(openBtn.dataset.post);
    }
});

/* ================================================================
   POST DETAIL MODAL
   ================================================================ */
function openPostModal(postId) {
    currentPostId = postId;
    const post = Posts.getById(postId);
    if (!post) return;

    const modal = document.getElementById('postModal');
    const content = document.getElementById('modalContent');
    const votes = Votes.get(postId);
    const lClass = votes.mine === 'like' ? 'liked' : '';
    const dClass = votes.mine === 'dislike' ? 'disliked' : '';

    content.innerHTML = `
    <div class="site-box">
      <div class="post-title" style="font-size:1.15rem; margin-bottom:10px;">${escapeHtml(post.title)}</div>
      <div class="post-body" style="font-size:0.9rem; margin-bottom:14px;">${escapeHtml(post.body)}</div>
      <div class="d-flex align-items-center" style="gap:10px;">
        <button class="vote-btn modal-vote ${lClass}" data-vote="like" data-post="${postId}">
          &#9650; <span id="modalLike">${votes.like}</span>
        </button>
        <button class="vote-btn modal-vote ${dClass}" data-vote="dislike" data-post="${postId}">
          &#9660; <span id="modalDislike">${votes.dislike}</span>
        </button>
        <span class="post-meta">${formatDate(post.createdAt)}</span>
      </div>
    </div>
  `;

    renderComments(postId);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('postModal').style.display = 'none';
    document.body.style.overflow = '';
    currentPostId = null;
    document.getElementById('commentBody').value = '';
    document.getElementById('commentCharCount').innerText = '0';
    document.getElementById('commentAlert').style.display = 'none';
    // Refresh list to update comment counts
    loadPosts();
});

// Vote inside modal
document.getElementById('postModal').addEventListener('click', function (e) {
    const voteBtn = e.target.closest('.modal-vote');
    if (!voteBtn) return;
    const postId = voteBtn.dataset.post;
    const type = voteBtn.dataset.vote;
    Votes.vote(postId, type);
    const v = Votes.get(postId);
    document.getElementById('modalLike').innerText = v.like;
    document.getElementById('modalDislike').innerText = v.dislike;
    document.querySelectorAll('.modal-vote').forEach(b => {
        b.classList.remove('liked', 'disliked');
        if (v.mine === 'like' && b.dataset.vote === 'like') b.classList.add('liked');
        if (v.mine === 'dislike' && b.dataset.vote === 'dislike') b.classList.add('disliked');
    });
});

/* ================================================================
   COMMENTS
   ================================================================ */
function renderComments(postId) {
    const comments = Comments.getByPost(postId);
    const list = document.getElementById('commentList');
    const noMsg = document.getElementById('noComments');
    list.innerHTML = '';

    if (!comments.length) {
        noMsg.style.display = 'block';
        return;
    }
    noMsg.style.display = 'none';
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment-item';
        div.innerHTML = `
      <div class="comment-body">${escapeHtml(c.body)}</div>
      <div class="comment-meta">${formatDate(c.createdAt)}</div>
    `;
        list.appendChild(div);
    });
}

document.getElementById('commentBody').addEventListener('input', function () {
    document.getElementById('commentCharCount').innerText = this.value.length;
});

document.getElementById('submitComment').addEventListener('click', () => {
    if (!currentPostId) return;
    const body = document.getElementById('commentBody').value;
    const alertEl = document.getElementById('commentAlert');
    alertEl.style.display = 'none';

    const result = Comments.create(currentPostId, body);
    if (result.ok) {
        document.getElementById('commentBody').value = '';
        document.getElementById('commentCharCount').innerText = '0';
        renderComments(currentPostId);
    } else {
        alertEl.className = 'anon-alert';
        alertEl.innerText = result.error;
        alertEl.style.display = 'block';
    }
});

// Close modal on backdrop click (not on content)
document.getElementById('postModal').addEventListener('click', function (e) {
    if (e.target === this) {
        document.getElementById('closeModal').click();
    }
});
