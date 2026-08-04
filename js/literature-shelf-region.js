function shelfPeriodTitle(author){return periods.find(p=>p.key===periodOf(author))?.title.split('：')[0]||'文学阶段'}
function shelfCachedCover(work){
  try{
    const raw=localStorage.getItem(`literatureCover:v3:${work.work[0]}|${work.author.name}`);
    if(!raw)return '';
    const data=JSON.parse(raw);
    return data.url&&data.expiresAt>Date.now()?data.url:''
  }catch{return ''}
}
function shelfCoverMarkup(work,extra=''){
  const url=shelfCachedCover(work),title=work.work[0];
  return `<span class="atlas-cover ${extra}" aria-hidden="true">${url?`<img src="${url}" alt="" loading="lazy">`:`<i>${title}</i>`}</span>`
}
function shelfOpenButton(work,classes=''){
  return `<button class="${classes}" data-open="${work.id}">${shelfCoverMarkup(work)}<span><strong>《${work.work[0]}》</strong><small>${work.author.name} · ${work.country}</small></span></button>`
}
function renderShelfRegion(region){
  const detail=$('#shelfRegionDetail');
  if(!detail)return;
  if(!region){detail.innerHTML='<div class="shelf-empty">没有可展示的数据。</div>';return}
  if(shelfView==='country')renderCountryArchive(region,detail);else renderPeriodArchive(region,detail);
  bindShelfLinks()
}
function renderCountryArchive(region,detail){
  const works=allWorks.filter(x=>x.country===region.key),done=works.filter(x=>shelf[x.id]==='done'),reading=works.filter(x=>shelf[x.id]==='reading'),want=works.filter(x=>shelf[x.id]==='want');
  const authors=region.authors.map(a=>({a,s:authorWorksStatus(region.key,a)})).sort((x,y)=>y.s.done-x.s.done||y.s.active-x.s.active);
  const entered=authors.filter(x=>x.s.active),unentered=authors.filter(x=>!x.s.active).slice(0,5);
  detail.innerHTML=`<header class="archive-head"><div><p class="eyebrow">LITERARY TERRITORY</p><h2>${region.title}文学</h2><p>${region.done?`你已经读完 ${region.done} 部作品，进入 ${region.enteredAuthors} 位作家的创作世界。`:'这片文学区域仍等待第一次进入。'}</p></div><div class="archive-orbit"><b>${Math.round(region.ratio*100)}</b><span>%</span></div></header>
  <div class="archive-counters"><span><b>${done.length}</b>已读</span><span><b>${reading.length}</b>在读</span><span><b>${want.length}</b>想读</span><span><b>${region.completedAuthors}</b>完成作家</span></div>
  ${reading.length?`<section class="archive-section"><div class="archive-title"><h3>正在这片土地上阅读</h3><span>${reading.length} 部</span></div><div class="reading-stage">${reading.slice(0,4).map(x=>shelfOpenButton(x,'reading-volume')).join('')}</div></section>`:''}
  <section class="archive-section"><div class="archive-title"><h3>作家星座</h3><span>点击进入作家详情</span></div><div class="author-constellation">${entered.map(({a,s},i)=>`<button data-open-author="${encodeURIComponent(region.key+'|'+a.name)}" class="author-star depth-${Math.min(4,Math.ceil(s.done/s.total*4))}" style="--i:${i}"><i></i><strong>${a.name}</strong><span>${s.done}/${s.total}</span></button>`).join('')}${unentered.map(({a},i)=>`<button data-open-author="${encodeURIComponent(region.key+'|'+a.name)}" class="author-star dormant" style="--i:${i+entered.length}"><i></i><strong>${a.name}</strong><span>未进入</span></button>`).join('')}</div></section>
  <section class="archive-section"><div class="archive-title"><h3>已读藏书</h3><span>${done.length} 部作品</span></div>${done.length?`<div class="mini-cover-wall">${done.slice(0,14).map(x=>shelfOpenButton(x,'mini-volume')).join('')}</div>`:'<p class="shelf-muted">尚无已读作品。</p>'}</section>`
}
function renderPeriodArchive(region,detail){
  const works=allWorks.filter(x=>periodOf(x.author.name)===region.key),done=works.filter(x=>shelf[x.id]==='done'),reading=works.filter(x=>shelf[x.id]==='reading'),want=works.filter(x=>shelf[x.id]==='want');
  const countries=[...new Set(works.filter(x=>shelf[x.id]).map(x=>x.country))];
  detail.innerHTML=`<header class="archive-head"><div><p class="eyebrow">LITERARY CURRENT</p><h2>${region.title}</h2><p>${done.length?`你的阅读在这一阶段留下了 ${done.length} 个清晰节点，跨越 ${countries.length} 个国家或文学传统。`:'这一文学阶段仍是一段尚未涉足的河流。'}</p></div><div class="archive-orbit"><b>${Math.round(region.ratio*100)}</b><span>%</span></div></header>
  <div class="archive-counters"><span><b>${done.length}</b>已读节点</span><span><b>${reading.length}</b>正在发生</span><span><b>${want.length}</b>等待进入</span><span><b>${countries.length}</b>文学传统</span></div>
  <section class="archive-section"><div class="archive-title"><h3>这一阶段的作品</h3><span>按阅读状态呈现</span></div><div class="period-node-grid">${works.filter(x=>shelf[x.id]).sort((a,b)=>({reading:0,done:1,want:2,paused:3}[shelf[a.id]]??4)-({reading:0,done:1,want:2,paused:3}[shelf[b.id]]??4)).slice(0,18).map(x=>`<button class="period-work-node ${shelf[x.id]}" data-open="${x.id}">${shelfCoverMarkup(x)}<span><strong>《${x.work[0]}》</strong><small>${x.author.name} · ${x.country}</small></span></button>`).join('')||'<p class="shelf-muted">尚未加入任何作品。</p>'}</div></section>
  <section class="archive-section"><div class="archive-title"><h3>国家回声</h3><span>${countries.length} 个坐标</span></div><div class="country-echoes">${countries.map(country=>{const list=works.filter(x=>x.country===country&&shelf[x.id]);return `<div><i style="--echo:${Math.min(1,list.length/6)}"></i><strong>${country}</strong><span>${list.filter(x=>shelf[x.id]==='done').length} 已读 · ${list.length} 已加入</span></div>`}).join('')||'<p class="shelf-muted">尚未形成国家分布。</p>'}</div></section>`
}