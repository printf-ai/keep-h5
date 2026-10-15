const STORE = 'lianlian-h5-v1';
const categories = ['力量训练', '有氧燃脂', 'HIIT 间歇', '瑜伽普拉提', '拉伸恢复', '功能性训练', '舞蹈训练', '拳击格斗', '其他'];
const categoryRules = [
  ['力量训练', /力量|增肌|哑铃|杠铃|深蹲|卧推|引体|臀|胸|背|肩|腿|核心/],
  ['有氧燃脂', /跑步|有氧|燃脂|骑行|跳绳|cardio/], ['HIIT 间歇', /hiit|tabata|间歇|波比/],
  ['瑜伽普拉提', /瑜伽|yoga|普拉提|pilates/], ['拉伸恢复', /拉伸|放松|恢复|stretch/],
  ['功能性训练', /功能|体能|敏捷|平衡/], ['舞蹈训练', /舞蹈|尊巴|zumba|律动/], ['拳击格斗', /拳击|boxing|格斗/]
];
const fallbackAvatars = { wang: '王', zhao: '赵' };
let state = loadState();
let activeView = 'home';
let recordDraft = null;
let trainState = { video: null, startedAt: null, elapsed: 0, timer: null, paused: false };

function defaultState() {
  return { activeUser: 'wang', users: [
    { id: 'wang', name: '王梦兰', avatar: '', accent: '#e1edce' },
    { id: 'zhao', name: '赵祥义', avatar: '', accent: '#ffd7b9' }
  ], videos: [], records: [] };
}
function loadState() { try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return defaultState(); } }
function saveState() { localStorage.setItem(STORE, JSON.stringify(state)); }
function user(id = state.activeUser) { return state.users.find(item => item.id === id); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]); }
function avatarStyle(person) { return person.avatar ? `style="background-image:url('${person.avatar}')"` : `style="background:${person.accent}"`; }
function avatar(person) { return `<span class="avatar" ${avatarStyle(person)}>${person.avatar ? '' : fallbackAvatars[person.id]}</span>`; }
function today() { return new Date().toISOString().slice(0, 10); }
function detectCategory(text) { const matched = categoryRules.find(([, rule]) => rule.test(text)); return matched ? matched[0] : '其他'; }
function formatSeconds(value) { const mins = Math.floor(value / 60).toString().padStart(2, '0'); const secs = Math.floor(value % 60).toString().padStart(2, '0'); return `${mins}:${secs}`; }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }); }
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200); }

function render() {
  renderUsers(); renderHome(); renderLibrary(); renderRecords(); renderPeople();
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === activeView));
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${activeView}`));
  document.querySelector('#profileTrigger').innerHTML = avatar(user());
}
function renderUsers() {
  document.querySelector('#userPicker').innerHTML = state.users.map(person => `<button type="button" class="user-chip ${person.id === state.activeUser ? 'active' : ''}" data-user="${person.id}">${avatar(person)}${person.name}</button>`).join('');
  document.querySelectorAll('[data-user]').forEach(el => el.onclick = () => { state.activeUser = el.dataset.user; saveState(); render(); });
  document.querySelector('#profileTrigger').onclick = openAvatarDialog;
}
function renderHome() {
  const mine = state.records.filter(r => r.userId === state.activeUser); const seconds = mine.reduce((sum, r) => sum + r.duration, 0);
  const recent = mine.slice(0, 3);
  document.querySelector('#view-home').innerHTML = `
    <div class="hero"><p class="eyebrow">${today().replaceAll('-', ' / ')}</p><h1>嗨，${user().name}<br>今天想练点什么？</h1><p>上传自己的训练视频，或保存 B 站链接。练完后，留下属于你的每一次进步。</p></div>
    <div class="stats"><div class="stat"><strong>${mine.length}</strong><small>累计训练</small></div><div class="stat"><strong>${Math.round(seconds / 60)}</strong><small>训练分钟</small></div><div class="stat"><strong>${new Set(mine.map(r => r.date)).size}</strong><small>训练天数</small></div></div>
    <div class="quick-grid"><button class="quick upload" id="homeUpload">↑<strong>上传视频</strong><small>本地训练视频</small></button><button class="quick link" id="homeLink">↗<strong>添加链接</strong><small>B 站训练视频</small></button></div>
    <div class="section-head"><h2>最近训练</h2><button id="showRecords">全部记录</button></div>${recent.length ? `<div class="card-list">${recent.map(recordCard).join('')}</div>` : '<div class="empty">还没有训练记录。<br>从上传第一个训练视频开始吧。</div>'}`;
  document.querySelector('#homeUpload').onclick = () => openVideoDialog('upload'); document.querySelector('#homeLink').onclick = () => openVideoDialog('link'); document.querySelector('#showRecords').onclick = () => switchView('records');
}
function recordCard(item) { const video = state.videos.find(v => v.id === item.videoId); return `<article class="record-card"><div class="record-icon">${item.intensity === '高' ? '⚡' : '✓'}</div><div><h3>${escapeHtml(video?.title || item.title || '训练')}</h3><p>${formatDate(item.date)} · ${Math.max(1, Math.round(item.duration / 60))} 分钟 · ${item.category} · 强度${item.intensity}</p>${item.feeling ? `<p>${escapeHtml(item.feeling)}</p>` : ''}</div></article>`; }
function videoCard(video) { return `<article class="video-card"><div class="video-cover">${video.source === 'bilibili' ? 'B' : '▶'}</div><div class="video-info"><h3>${escapeHtml(video.title)}</h3><p>${video.source === 'bilibili' ? 'B 站链接' : '本地视频'} · ${video.createdAt}</p><span class="badge">${video.category}</span></div><button class="play-button" type="button" data-play="${video.id}" aria-label="开始训练">▶</button></article>`; }
function renderLibrary() {
  const mine = state.videos.filter(v => v.userId === state.activeUser);
  document.querySelector('#view-library').innerHTML = `<div class="section-head"><h2>我的训练视频</h2><button id="addVideo">添加视频</button></div><p class="dialog-intro">系统会根据标题和链接自动归类；不确定时可手动选择。</p><div class="filter-row"><button class="filter active" data-category="all">全部</button>${categories.map(c => `<button class="filter" data-category="${c}">${c}</button>`).join('')}</div><div id="videoList" class="card-list"></div>`;
  const fill = category => { const items = mine.filter(v => category === 'all' || v.category === category); document.querySelector('#videoList').innerHTML = items.length ? items.map(videoCard).join('') : '<div class="empty">这里还没有视频<br>添加一个视频就能开始训练。</div>'; document.querySelectorAll('[data-play]').forEach(btn => btn.onclick = () => openTrainDialog(btn.dataset.play)); };
  fill('all'); document.querySelector('#addVideo').onclick = () => openVideoDialog(); document.querySelectorAll('[data-category]').forEach(btn => btn.onclick = () => { document.querySelectorAll('[data-category]').forEach(x => x.classList.remove('active')); btn.classList.add('active'); fill(btn.dataset.category); });
}
function renderRecords() { const mine = state.records.filter(r => r.userId === state.activeUser); document.querySelector('#view-records').innerHTML = `<div class="section-head"><h2>${user().name}的记录</h2></div>${mine.length ? `<div class="card-list">${mine.map(recordCard).join('')}</div>` : '<div class="empty">完成一次训练后，记录会在这里出现。</div>'}`; }
function renderPeople() { document.querySelector('#view-people').innerHTML = `<div class="section-head"><h2>训练伙伴</h2></div><p class="dialog-intro">可以查看彼此公开的训练记录，共同坚持。</p><div class="card-list">${state.users.map(person => { const list = state.records.filter(r => r.userId === person.id); const min = Math.round(list.reduce((s, r) => s + r.duration, 0) / 60); return `<article class="person-card">${avatar(person)}<div><h3>${person.name}${person.id === state.activeUser ? ' · 我' : ''}</h3><p>${list.length} 次训练 · ${min} 分钟累计训练</p>${list.slice(0, 2).map(recordCard).join('')}</div></article>`; }).join('')}</div>`; }
function switchView(view) { activeView = view; render(); }

function openVideoDialog(mode = '') {
  const d = document.querySelector('#videoDialog'); d.innerHTML = `<form method="dialog" class="dialog-inner" id="videoForm"><h2>添加训练视频</h2><p class="dialog-intro">支持上传本地视频，或保存 B 站公开视频链接。</p><div class="form-grid"><label class="field">来源<select name="source" id="source"><option value="upload" ${mode === 'link' ? '' : 'selected'}>上传本地视频</option><option value="bilibili" ${mode === 'link' ? 'selected' : ''}>B 站链接</option></select></label><label class="field">训练名称<input required name="title" id="videoTitle" placeholder="例如：20 分钟全身燃脂" /></label><label class="field source-upload">视频文件<input required name="file" type="file" accept="video/*" /></label><label class="field source-link" hidden>视频链接<input name="link" type="url" placeholder="https://www.bilibili.com/video/BV..." /></label><label class="field">训练分类<select name="category" id="category"><option value="auto">自动识别</option>${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select></label></div><div class="form-actions"><button class="button secondary" value="cancel">取消</button><button class="button lime" id="saveVideo" value="default">保存视频</button></div></form>`; d.showModal();
  const source = d.querySelector('#source'); const updateMode = () => { const isUpload = source.value === 'upload'; d.querySelector('.source-upload').hidden = !isUpload; d.querySelector('.source-link').hidden = isUpload; d.querySelector('[name=file]').required = isUpload; d.querySelector('[name=link]').required = !isUpload; }; source.onchange = updateMode; updateMode();
  d.querySelector('#videoTitle').oninput = e => { if (d.querySelector('#category').value === 'auto') d.querySelector('#category').dataset.detected = detectCategory(e.target.value); };
  d.querySelector('#videoForm').onsubmit = event => { event.preventDefault(); const form = new FormData(event.currentTarget); const video = { id: crypto.randomUUID(), userId: state.activeUser, title: form.get('title').trim(), source: form.get('source'), link: form.get('link').trim(), createdAt: today(), category: form.get('category') === 'auto' ? detectCategory(`${form.get('title')} ${form.get('link')}`) : form.get('category'), localUrl: '' }; const file = form.get('file'); if (video.source === 'upload') { video.localUrl = URL.createObjectURL(file); video.fileName = file.name; } state.videos.unshift(video); saveState(); d.close(); render(); toast(`已保存为「${video.category}」`); };
}
function openTrainDialog(videoId) {
  const video = state.videos.find(v => v.id === videoId); if (!video) return; const d = document.querySelector('#trainDialog'); const player = video.source === 'upload' ? (video.localUrl ? `<video controls src="${video.localUrl}"></video>` : '<div class="empty">本地视频在刷新页面后需要重新添加。<br>训练计时与记录仍可正常使用。</div>') : `<iframe allowfullscreen src="${biliEmbed(video.link)}"></iframe>`;
  d.innerHTML = `<div class="dialog-inner"><div class="player-wrap">${player}</div><p class="badge">${video.category}</p><h2 class="training-title">${escapeHtml(video.title)}</h2><div class="timer" id="timer">00:00</div><div class="training-actions"><button class="button lime" id="startTrain">开始训练</button><button class="button secondary" id="pauseTrain" disabled>暂停</button><button class="button finish" id="finishTrain" disabled>结束并记录</button></div></div>`; d.showModal();
  trainState = { video, startedAt: null, elapsed: 0, timer: null, paused: false }; d.querySelector('#startTrain').onclick = () => startTimer(d); d.querySelector('#pauseTrain').onclick = () => pauseTimer(d); d.querySelector('#finishTrain').onclick = () => finishTraining(d);
  d.addEventListener('close', () => clearInterval(trainState.timer), { once: true });
}
function biliEmbed(url) { const bv = url.match(/BV[\w]+/i)?.[0]; return bv ? `https://player.bilibili.com/player.html?bvid=${bv}&high_quality=1&danmaku=0` : 'about:blank'; }
function startTimer(dialog) { if (!trainState.startedAt) trainState.startedAt = Date.now() - trainState.elapsed * 1000; trainState.paused = false; dialog.querySelector('#startTrain').disabled = true; dialog.querySelector('#pauseTrain').disabled = false; dialog.querySelector('#finishTrain').disabled = false; clearInterval(trainState.timer); trainState.timer = setInterval(() => { trainState.elapsed = Math.floor((Date.now() - trainState.startedAt) / 1000); dialog.querySelector('#timer').textContent = formatSeconds(trainState.elapsed); }, 500); }
function pauseTimer(dialog) { clearInterval(trainState.timer); trainState.paused = true; dialog.querySelector('#startTrain').disabled = false; dialog.querySelector('#startTrain').textContent = '继续训练'; dialog.querySelector('#pauseTrain').disabled = true; }
function finishTraining(dialog) { if (!trainState.elapsed) { toast('先开始训练后再结束哦'); return; } clearInterval(trainState.timer); recordDraft = { videoId: trainState.video.id, title: trainState.video.title, userId: state.activeUser, category: trainState.video.category, duration: trainState.elapsed, date: today(), intensity: '中', feeling: '' }; dialog.close(); openRecordDialog(); }
function openRecordDialog() { const d = document.querySelector('#recordDialog'); d.innerHTML = `<form class="dialog-inner" id="recordForm"><h2>完成得很棒！</h2><p class="dialog-intro">本次训练 ${formatSeconds(recordDraft.duration)}，记录一下今天的感受吧。</p><div class="form-grid"><label class="field">训练日期<input type="date" name="date" value="${recordDraft.date}" required /></label><label class="field">训练强度<div class="intensity" id="intensity">${['低','中','高'].map(v => `<button type="button" class="${v === '中' ? 'selected' : ''}" data-intensity="${v}">${v}</button>`).join('')}</div></label><label class="field">训练体验<textarea name="feeling" placeholder="例如：状态不错，后半段有点累。"></textarea></label></div><div class="form-actions"><button type="button" class="button secondary" id="cancelRecord">取消</button><button class="button lime">保存记录</button></div></form>`; d.showModal(); d.querySelectorAll('[data-intensity]').forEach(btn => btn.onclick = () => { recordDraft.intensity = btn.dataset.intensity; d.querySelectorAll('[data-intensity]').forEach(x => x.classList.toggle('selected', x === btn)); }); d.querySelector('#cancelRecord').onclick = () => d.close(); d.querySelector('#recordForm').onsubmit = e => { e.preventDefault(); const data = new FormData(e.currentTarget); recordDraft.date = data.get('date'); recordDraft.feeling = data.get('feeling').trim(); state.records.unshift({ ...recordDraft, id: crypto.randomUUID() }); saveState(); d.close(); render(); toast('训练记录已保存'); };
}
function openAvatarDialog() { const person = user(); const d = document.querySelector('#avatarDialog'); d.innerHTML = `<form class="dialog-inner" id="avatarForm"><h2>修改头像</h2><div class="avatar-preview" id="avatarPreview" ${avatarStyle(person)}></div><label class="field">选择图片<input name="avatar" type="file" accept="image/*" /></label><p class="dialog-intro">头像保存在当前浏览器内。正式上线后可接入云存储，跨设备同步。</p><div class="form-actions"><button type="button" class="button secondary" id="clearAvatar">恢复默认</button><button class="button lime">保存头像</button></div></form>`; d.showModal(); d.querySelector('[name=avatar]').onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { person.avatar = reader.result; d.querySelector('#avatarPreview').style.backgroundImage = `url('${person.avatar}')`; }; reader.readAsDataURL(file); }; d.querySelector('#clearAvatar').onclick = () => { person.avatar = ''; d.querySelector('#avatarPreview').style.backgroundImage = ''; }; d.querySelector('#avatarForm').onsubmit = e => { e.preventDefault(); saveState(); d.close(); render(); toast('头像已更新'); };
}
document.querySelectorAll('.tab').forEach(el => el.onclick = () => switchView(el.dataset.view));
render();
