const SUPABASE_URL="https://qlumnvsjjgawisnjbvxf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_ivUKkA15AANQVXH_SwHP0Q_SVcSlvAC";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const data=window.literatureData;
const periods=[
 {key:'pre19',title:'19世纪以前：古典传统与现代性的前史'},
 {key:'c19',title:'19世纪：浪漫主义、现实主义与现代社会'},
 {key:'early20',title:'1900—1918：世纪转折与早期现代主义'},
 {key:'interwar',title:'1919—1945：现代主义成熟、革命与战争'},
 {key:'postwar',title:'1946—1979：战后文学、存在主义与后殖民世界'},
 {key:'contemporary',title:'1980至今：全球化、记忆政治与当代小说'}
];
const periodSets={
 pre19:new Set(['曹雪芹','威廉·莎士比亚','乔纳森·斯威夫特','歌德','但丁','米格尔·德·塞万提斯']),
 c19:new Set(['查尔斯·狄更斯','乔治·艾略特','托马斯·哈代','居斯塔夫·福楼拜','奥诺雷·德·巴尔扎克','夏尔·波德莱尔','陀思妥耶夫斯基','列夫·托尔斯泰','安东·契诃夫','尼古拉·果戈理','伊凡·屠格涅夫','赫尔曼·麦尔维尔','贝尼托·佩雷斯·加尔多斯']),
 early20:new Set(['W.B.叶芝','马塞尔·普鲁斯特','托马斯·曼','赫尔曼·黑塞','弗兰茨·卡夫卡','罗伯特·穆齐尔','斯蒂芬·茨威格','詹姆斯·乔伊斯','弗吉尼亚·伍尔夫','鲁迅','夏目漱石','森鸥外']),
 interwar:new Set(['T.S.艾略特','乔治·奥威尔','安德烈·纪德','路易-费迪南·塞利纳','阿尔贝·加缪','让-保罗·萨特','米哈伊尔·布尔加科夫','鲍里斯·帕斯捷尔纳克','弗拉基米尔·纳博科夫','威廉·福克纳','欧内斯特·海明威','F.斯科特·菲茨杰拉德','约翰·斯坦贝克','豪尔赫·路易斯·博尔赫斯','费德里科·加西亚·洛尔卡','川端康成','谷崎润一郎','沈从文','张爱玲','老舍','茅盾']),
 postwar:new Set(['塞缪尔·贝克特','伊塔洛·卡尔维诺','普里莫·莱维','君特·格拉斯','海因里希·伯尔','弗里德里希·迪伦马特','马克斯·弗里施','米兰·昆德拉','博胡米尔·赫拉巴尔','切斯瓦夫·米沃什','维斯瓦娃·辛波丝卡','索尔·贝娄','托妮·莫里森','弗拉基米尔·纳博科夫','胡安·鲁尔福','加西亚·马尔克斯','马里奥·巴尔加斯·略萨','胡利奥·科塔萨尔','巴勃罗·聂鲁达','大江健三郎','三岛由纪夫','安部公房','莫言','王小波']),
 contemporary:new Set()
};
function periodOf(name){for(const p of periods)if(periodSets[p.key].has(name))return p.key;return 'contemporary'}
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const oldProgress=JSON.parse(localStorage.getItem('writerPoolProgress')||'{}');
let shelf=JSON.parse(localStorage.getItem('writerPoolShelf')||'{}');
let currentUser=null,cloudReady=false,isSyncing=false;
let page='dashboard', mode='author', selectedLevel=null, selectedAuthor=null, shelfFilter='all', workSort='rating';
const allWorks=[];
data.forEach(group=>group.authors.forEach(author=>author.works.forEach((work,index)=>{
  const id=encodeURIComponent(group.country+'|'+author.name+'|'+work[0]);
  if(!shelf[id]&&oldProgress[id])shelf[id]='done';
  allWorks.push({id,country:group.country,author,work,index});
})));
saveShelf();

function saveShelf(){localStorage.setItem('writerPoolShelf',JSON.stringify(shelf))}
function setSyncBanner(message,type=''){const el=$('#syncBanner');el.textContent=message;el.className='sync-banner'+(type?' '+type:'')}
function workMetaById(id){return allWorks.find(x=>x.id===id)}
async function loadCloudRecords(){
  if(!currentUser)return;
  setSyncBanner('正在从云端读取阅读状态……');
  const {data,error}=await supabaseClient.from('reading_records').select('work_id,status,updated_at');
  if(error)throw error;
  const cloud={};(data||[]).forEach(r=>cloud[r.work_id]=r.status);
  const local={...shelf};
  const missing=Object.entries(local).filter(([id,status])=>status&&!cloud[id]).map(([id,status])=>{
    const x=workMetaById(id);return x?{user_id:currentUser.id,work_id:id,country:x.country,author_name:x.author.name,work_title:x.work[0],status,updated_at:new Date().toISOString()}:null
  }).filter(Boolean);
  if(missing.length){
    const {error:upErr}=await supabaseClient.from('reading_records').upsert(missing,{onConflict:'user_id,work_id'});
    if(upErr)throw upErr;
  }
  shelf={...local,...cloud};saveShelf();cloudReady=true;
  setSyncBanner(`已登录 ${currentUser.email}，阅读状态已同步。`,'ok');
}
async function persistStatus(id,status){
  if(status)shelf[id]=status;else delete shelf[id];saveShelf();
  if(!currentUser)return;
  const x=workMetaById(id);if(!x)return;
  if(!status){
    const {error}=await supabaseClient.from('reading_records').delete().eq('work_id',id);
    if(error)throw error;
  }else{
    const {error}=await supabaseClient.from('reading_records').upsert({
      user_id:currentUser.id,work_id:id,country:x.country,author_name:x.author.name,work_title:x.work[0],status,updated_at:new Date().toISOString()
    },{onConflict:'user_id,work_id'});
    if(error)throw error;
  }
}
async function initializeAuth(){
  supabaseClient.auth.onAuthStateChange((event,session)=>{
    setTimeout(async()=>{
      currentUser=session?.user||null;updateAccountUI();
      if(currentUser&&(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='TOKEN_REFRESHED')){
        try{await loadCloudRecords();renderDashboard();renderExplorer();renderShelf()}
        catch(err){console.error(err);setSyncBanner('云端同步失败：'+err.message+'。请确认 reading_records 表和 RLS 已配置。','error')}
      }
      if(event==='SIGNED_OUT'){cloudReady=false;shelf=JSON.parse(localStorage.getItem('writerPoolShelf')||'{}');setSyncBanner('访客模式：阅读状态保存在当前浏览器。登录后可同步到云端。');renderDashboard();renderExplorer();renderShelf()}
    },0)
  })
}
function updateAccountUI(){
  $('#loginButton').classList.toggle('hidden',!!currentUser);
  $('#userPanel').classList.toggle('hidden',!currentUser);
  $('#userEmail').textContent=currentUser?.email||'';
}
function stars(n){return '★'.repeat(n)+'☆'.repeat(5-n)}
function statusLabel(v){return ({want:'想读',reading:'在读',done:'已读',paused:'暂停'})[v]||'未加入'}
function getGroup(country){return data.find(g=>g.country===country)}
function authorWorksStatus(country,author){
  const items=author.works.map(w=>shelf[encodeURIComponent(country+'|'+author.name+'|'+w[0])]||'');
  return {done:items.filter(x=>x==='done').length,active:items.filter(Boolean).length,total:items.length}
}
function setPage(next){
  page=next; $$('.primary-tab').forEach(b=>b.classList.toggle('active',b.dataset.page===next));
  $('#dashboardPage').classList.toggle('hidden',next!=='dashboard');
  $('#explorerPage').classList.toggle('hidden',!['author','time'].includes(next));
  $('#shelfPage').classList.toggle('hidden',next!=='shelf');
  if(next==='author'||next==='time'){mode=next; selectedLevel=null;selectedAuthor=null;renderExplorer()}
  if(next==='dashboard')renderDashboard(); if(next==='shelf')renderShelf();
  scrollTo({top:0,behavior:'smooth'})
}
function renderDashboard(){
  const readings=allWorks.filter(x=>shelf[x.id]==='reading');
  const done=allWorks.filter(x=>shelf[x.id]==='done');
  const entered=new Set(allWorks.filter(x=>shelf[x.id]).map(x=>x.country));
  $('#statTotal').textContent=allWorks.length;$('#statReading').textContent=readings.length;$('#statDone').textContent=done.length;$('#statCountries').textContent=entered.size;
  $('#currentReading').innerHTML=readings.length?readings.slice(0,5).map(x=>`<div class="current-item" data-open="${x.id}"><div><div class="item-title">《${x.work[0]}》</div><div class="item-meta">${x.author.name} · ${x.country}</div></div><span class="status-chip">在读</span></div>`).join(''):'<div class="item-meta" style="padding:28px 0">还没有标记“在读”的作品。进入阅读池，为下一部书设置状态。</div>';
  $$('[data-open]').forEach(el=>el.onclick=()=>openWork(el.dataset.open))
}
function renderExplorer(){
  $('#levelTitle').textContent=mode==='author'?'国家与传统':'文学史阶段';
  $('#levelSubtitle').textContent=mode==='author'?'选择国家，再进入作家':'选择时代，横向观察各国作家';
  const q=$('#globalSearch').value.trim().toLowerCase();
  let levels=mode==='author'?data.map(g=>({key:g.country,title:g.country,desc:`${g.authors.length} 位作家 · ${g.authors.reduce((n,a)=>n+a.works.length,0)} 部作品`})):
    periods.map(p=>({key:p.key,title:p.title.split('：')[0],desc:p.title.split('：')[1]}));
  if(q){
    const matching=allWorks.filter(x=>(x.country+x.author.name+x.author.era+x.work.join(' ')).toLowerCase().includes(q));
    const keys=new Set(matching.map(x=>mode==='author'?x.country:periodOf(x.author.name)));
    levels=levels.filter(x=>keys.has(x.key));
  }
  $('#levelList').innerHTML=levels.map(x=>`<button class="nav-item ${selectedLevel===x.key?'active':''}" data-level="${x.key}"><strong>${x.title}</strong><span>${x.desc}</span></button>`).join('');
  $$('[data-level]').forEach(b=>b.onclick=()=>{selectedLevel=b.dataset.level;selectedAuthor=null;renderExplorer();showMobile('author')});
  renderAuthors(q); renderDetail()
}
function currentAuthors(q=''){
  let rows=[];
  if(!selectedLevel)return rows;
  if(mode==='author'){const g=getGroup(selectedLevel);rows=g?g.authors.map(a=>({country:g.country,author:a})):[]}
  else data.forEach(g=>g.authors.filter(a=>periodOf(a.name)===selectedLevel).forEach(a=>rows.push({country:g.country,author:a})));
  if(q)rows=rows.filter(x=>(x.country+x.author.name+x.author.era+x.author.works.flat().join(' ')).toLowerCase().includes(q));
  return rows.sort((a,b)=>b.author.rating-a.author.rating||a.author.name.localeCompare(b.author.name,'zh-CN'))
}
function renderAuthors(q=''){
  const rows=currentAuthors(q);
  const title=mode==='author'?(selectedLevel||'作家'):(periods.find(p=>p.key===selectedLevel)?.title.split('：')[0]||'作家');
  $('#authorListTitle').textContent=title;$('#authorListSubtitle').textContent=rows.length?`${rows.length} 位作家 · 按推荐度排列`:'请先选择左侧入口';
  $('#authorList').innerHTML=rows.map(({country,author})=>{
    const s=authorWorksStatus(country,author),pct=s.total?s.done/s.total*100:0;
    return `<button class="author-item ${selectedAuthor===country+'|'+author.name?'active':''}" data-author="${encodeURIComponent(country+'|'+author.name)}"><div class="author-top"><span class="author-name">${author.name}</span><span class="stars">${stars(author.rating)}</span></div><div class="author-era">${mode==='time'?country+' · ':''}${author.era}</div><div class="author-progress"><span>${s.done}/${s.total} 已读</span><span class="mini-bar"><i style="width:${pct}%"></i></span></div></button>`
  }).join('')||'<div class="item-meta" style="padding:24px 12px">没有匹配的作家。</div>';
  $$('[data-author]').forEach(b=>b.onclick=()=>{selectedAuthor=decodeURIComponent(b.dataset.author);renderExplorer();showMobile('detail')})
}
function renderDetail(){
  if(!selectedAuthor){$('#detailContent').innerHTML='<div class="empty-detail"><div><b>选择一位作家</b><span>作品、推荐度和阅读状态将在这里展开。</span></div></div>';return}
  const [country,name]=selectedAuthor.split('|'),g=getGroup(country),a=g?.authors.find(x=>x.name===name);if(!a)return;
  let works=a.works.map((w,i)=>({w,i,id:encodeURIComponent(country+'|'+a.name+'|'+w[0])}));
  works.sort(workSort==='rating'?(x,y)=>y.w[1]-x.w[1]||x.i-y.i:(x,y)=>x.i-y.i);
  $('#detailContent').innerHTML=`<div class="breadcrumb"><button class="mobile-back" data-back="author">← 作家列表</button><span>${mode==='author'?country:(periods.find(p=>p.key===periodOf(a.name))?.title.split('：')[0])}</span><span>/</span><span>${a.name}</span></div>
  <header class="author-hero"><div class="author-kicker">${country} · ${a.era}</div><h1>${a.name}</h1><p>${a.era}。建议将其作为一个完整的创作世界进入，而不是只读一部孤立的“名著”。以下作品按照推荐度排列，也可切换为原始建议顺序。</p><div class="author-score"><span>作家推荐度</span><span class="stars">${stars(a.rating)}</span><span>${a.works.length} 部代表作</span></div></header>
  <div class="work-toolbar"><h2>代表作品</h2><div class="sort-toggle"><button class="sort-btn ${workSort==='rating'?'active':''}" data-sort="rating">推荐度</button><button class="sort-btn ${workSort==='order'?'active':''}" data-sort="order">建议顺序</button></div></div>
  <div class="work-list">${works.map(({w,i,id},n)=>`<section class="work-card"><div class="work-no">${String(n+1).padStart(2,'0')}</div><div><div class="work-title">《${w[0]}》</div><div class="work-note">${w[2]}</div><div class="work-rating stars">${stars(w[1])}</div></div><select class="status-select" data-status="${id}"><option value="">未加入</option><option value="want" ${shelf[id]==='want'?'selected':''}>想读</option><option value="reading" ${shelf[id]==='reading'?'selected':''}>在读</option><option value="done" ${shelf[id]==='done'?'selected':''}>已读</option><option value="paused" ${shelf[id]==='paused'?'selected':''}>暂停</option></select></section>`).join('')}</div>`;
  $$('[data-sort]').forEach(b=>b.onclick=()=>{workSort=b.dataset.sort;renderDetail()});
  $$('[data-status]').forEach(s=>s.onchange=async()=>{const previous=shelf[s.dataset.status]||'';s.disabled=true;try{await persistStatus(s.dataset.status,s.value);renderDetail();renderAuthors($('#globalSearch').value.trim().toLowerCase());renderDashboard()}catch(err){console.error(err);s.value=previous;setSyncBanner('保存失败：'+err.message,'error')}finally{s.disabled=false}});
  $$('[data-back="author"]').forEach(b=>b.onclick=()=>showMobile('author'))
}
function renderShelf(){
  const items=allWorks.filter(x=>shelf[x.id]&&(shelfFilter==='all'||shelf[x.id]===shelfFilter));
  $('#shelfGrid').innerHTML=items.length?items.map(x=>`<article class="shelf-card" data-open="${x.id}"><span class="status-chip">${statusLabel(shelf[x.id])}</span><h3>《${x.work[0]}》</h3><div class="item-meta">${x.author.name} · ${x.country}</div><div class="work-note">${x.work[2]}</div></article>`).join(''):'<div class="item-meta">当前分类还没有作品。</div>';
  $$('[data-open]').forEach(el=>el.onclick=()=>openWork(el.dataset.open))
}
function openWork(id){
  const x=allWorks.find(w=>w.id===id);if(!x)return;mode='author';page='author';selectedLevel=x.country;selectedAuthor=x.country+'|'+x.author.name;setPage('author');selectedLevel=x.country;selectedAuthor=x.country+'|'+x.author.name;renderExplorer();showMobile('detail')
}
function showMobile(level){
  if(innerWidth>1000)return;$('#levelColumn').classList.toggle('mobile-active',level==='level');$('#authorColumn').classList.toggle('mobile-active',level==='author');$('#detailColumn').classList.toggle('mobile-active',level==='detail')
}
$$('.primary-tab').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$$('[data-open-page]').forEach(b=>b.onclick=()=>setPage(b.dataset.openPage));
$$('.shelf-filter').forEach(b=>b.onclick=()=>{$$('.shelf-filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');shelfFilter=b.dataset.shelf;renderShelf()});
$('#globalSearch').addEventListener('input',()=>{if(page==='dashboard'&&$('#globalSearch').value.trim())setPage('author');else if(['author','time'].includes(page))renderExplorer()});
$$('[data-action]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.action;
  if(a==='top'){setPage('author')}
  if(a==='nineteenth'){setPage('time');selectedLevel='c19';renderExplorer();showMobile('author')}
  if(a==='calvino'){setPage('author');selectedLevel='意大利';selectedAuthor='意大利|伊塔洛·卡尔维诺';renderExplorer();showMobile('detail')}
  if(a==='random'){const pool=allWorks.filter(x=>shelf[x.id]!=='done');const x=pool[Math.floor(Math.random()*pool.length)];if(x)openWork(x.id)}
});

$('#loginButton').onclick=()=>$('#loginDialog').showModal();
$('#closeLoginDialog').onclick=()=>$('#loginDialog').close();
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();const email=$('#loginEmail').value.trim();$('#loginMessage').textContent='正在发送……';
  const redirect=window.location.origin+window.location.pathname;
  const {error}=await supabaseClient.auth.signInWithOtp({email,options:{emailRedirectTo:redirect}});
  $('#loginMessage').textContent=error?'发送失败：'+error.message:'登录链接已发送，请检查邮箱。';
};
$('#logoutButton').onclick=async()=>{const {error}=await supabaseClient.auth.signOut();if(error)setSyncBanner('退出失败：'+error.message,'error')};
initializeAuth();

renderDashboard();