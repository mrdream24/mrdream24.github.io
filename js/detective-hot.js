(()=>{
  const grid=document.querySelector('.hot-grid');
  if(!grid)return;
  const section=grid.closest('.section');
  const title=section?.querySelector('.section-head h2');
  const intro=section?.querySelector('.section-head>p');
  if(title)title.textContent='2026 获奖新作观察';
  if(intro)intro.textContent='选取本年度重要犯罪文学奖项得主，用中文说明它们为何值得关注；尚无正式中译名的作品均标注为暂译。';

  const picks=[
    {
      author:'阿比盖尔·迪恩',
      title:'我们的死亡（The Death of Us）',
      award:'2026 CWA 金匕首奖',
      type:'心理犯罪',
      reason:'从亲密关系与记忆裂缝进入犯罪，关注受害者、叙述可靠性与创伤如何彼此缠绕。'
    },
    {
      author:'劳拉·麦克拉斯基',
      title:'狼树（The Wolf Tree）',
      award:'2026 CWA 首作匕首奖',
      type:'民俗悬疑',
      reason:'把孤岛社区、迷信与民俗恐怖结合，观察封闭共同体如何制造秘密与暴力。'
    },
    {
      author:'S.A.科斯比',
      title:'灰烬之王（King of Ashes）',
      award:'2026 CWA 钢匕首奖',
      type:'南方黑色犯罪',
      reason:'延续美国南方黑色犯罪传统，把家族、种族、阶级与暴力放在同一张权力地图中。'
    }
  ];

  const workId=(author,title)=>{
    const item=(window.detectiveAuthors||[]).find(entry=>entry.name===author);
    return item?encodeURIComponent(`${item.country}|${author}|${title}`):'';
  };

  grid.innerHTML=picks.map((pick,index)=>{
    const id=workId(pick.author,pick.title);
    return `<article class="hot-case" data-record="${id}" tabindex="0" role="button" aria-label="记录《${pick.title}》的阅读状态">
      <div class="hot-case-head"><small>${pick.award}</small><span>CASE ${String(index+1).padStart(2,'0')}</span></div>
      <p class="hot-case-type">${pick.type} · 中文暂译</p>
      <h3>《${pick.title}》</h3>
      <p class="hot-case-author">${pick.author}</p>
      <p class="hot-case-reason">${pick.reason}</p>
      <button type="button" class="record-btn hot-record-btn" data-record="${id}">＋ 加入案卷</button>
    </article>`;
  }).join('');

  grid.addEventListener('keydown',event=>{
    const card=event.target.closest('.hot-case');
    if(!card||!['Enter',' '].includes(event.key))return;
    event.preventDefault();
    card.click();
  });

  const style=document.createElement('style');
  style.textContent=`
    .hot-case{min-height:310px;display:flex;flex-direction:column;padding:23px;border:1px solid var(--line);background:var(--panel);position:relative;cursor:pointer;transition:transform .2s,border-color .2s,background .2s}
    .hot-case:hover,.hot-case:focus-visible{transform:translateY(-4px);border-color:rgba(201,211,91,.48);outline:none;background:var(--panel2)}
    .hot-case-head{display:flex;justify-content:space-between;gap:12px;color:var(--acid);font:9px var(--mono);letter-spacing:.08em}
    .hot-case-head span{color:var(--muted)}
    .hot-case-type{margin:28px 0 0;color:var(--red);font:9px var(--mono);letter-spacing:.1em}
    .hot-case h3{margin:10px 0 7px;font:500 25px/1.35 var(--serif)}
    .hot-case-author{margin:0;color:var(--ink);font-size:11px}
    .hot-case-reason{margin:20px 0 56px!important;color:var(--muted);font-size:11px;line-height:1.8}
    .hot-record-btn{left:23px;right:auto;bottom:22px;position:absolute}
    html[data-theme="light"] .hot-case{background:rgba(248,244,235,.88);box-shadow:0 12px 30px rgba(64,53,39,.035)}
    html[data-theme="light"] .hot-case:hover,html[data-theme="light"] .hot-case:focus-visible{background:#fbf7ef;border-color:rgba(125,134,31,.45)}
    @media(max-width:700px){.hot-case{min-height:280px}}
  `;
  document.head.appendChild(style);
})();
