function shelfElement(selector){return document.querySelector(selector)}
function hasShelfAtlasDom(){return ['#shelfDoneCount','#shelfReadingCount','#shelfCountryCount','#shelfPeriodCount','#shelfAuthorCount','#shelfInsight','#shelfMapView','#shelfStatusView','#shelfRegionList','#shelfRegionDetail'].every(selector=>shelfElement(selector))}
function atlasHash(value){let n=0;for(const char of value)n=(n*31+char.charCodeAt(0))>>>0;return n}
function renderWorldIslands(rows){
  const max=Math.max(...rows.map(x=>x.total),1);
  return `<div class="island-map">${rows.map((x,i)=>{const size=82+Math.round(x.total/max*92),hash=atlasHash(x.key),left=8+(hash%76),top=7+((hash>>7)%72),level=x.ratio>.65?'core':x.ratio>.3?'deep':x.done||x.reading.length?'entered':'unknown';return `<button class="literary-island ${level} ${selectedShelfRegion===x.key?'active':''}" data-shelf-region="${x.key}" style="--size:${size}px;--left:${left}%;--top:${top}%;--fill:${Math.round(x.ratio*100)}%;--delay:${i*35}ms"><span class="island-shape"></span><strong>${x.title}</strong><small>${x.done} 已读${x.reading.length?` · ${x.reading.length} 在读`:''}</small></button>`}).join('')}<div class="map-legend"><span><i class="unknown"></i>未进入</span><span><i class="entered"></i>已经进入</span><span><i class="core"></i>核心坐标</span></div></div>`
}
function renderTimeRiver(rows){
  return `<div class="time-river"><div class="river-line"></div>${rows.map((x,i)=>{const active=x.done||x.reading.length,scale=.82+Math.min(.55,x.total/35),phase=x.ratio>.5?'deep':active?'entered':'unknown';return `<button class="river-era ${phase} ${selectedShelfRegion===x.key?'active':''}" data-shelf-region="${x.key}" style="--index:${i};--scale:${scale}"><span class="river-node"><i></i>${x.reading.length?'<b></b>':''}</span><span class="river-copy"><em>${String(i+1).padStart(2,'0')}</em><strong>${x.title.split('：')[0]}</strong><small>${x.done} 已读 · ${x.countries.size||0} 个传统</small></span></button>`}).join('')}</div>`
}
function statusGroup(title,key,items,description){
  if(!items.length)return '';
  return `<section class="status-zone ${key}"><div class="zone-heading"><div><p>${description}</p><h2>${title}</h2></div><span>${items.length}</span></div><div class="${key==='reading'?'reading-desk':'cover-gallery'}">${items.map((x,i)=>`<button class="shelf-volume ${key}" data-open="${x.id}" style="--index:${i}">${shelfCoverMarkup(x,key==='reading'?'large':'')}<span><strong>《${x.work[0]}》</strong><small>${x.author.name} · ${shelfPeriodTitle(x.author.name)}</small></span></button>`).join('')}</div></section>`
}
function renderStatusShelf(){
  const list=shelfElement('#shelfStatusList');if(!list)return;
  const groups={reading:[],want:[],done:[],paused:[]};
  allWorks.forEach(x=>{const status=shelf[x.id];if(groups[status])groups[status].push(x)});
  const visible=shelfFilter==='all'?['reading','want','done','paused']:[shelfFilter];
  const html={reading:statusGroup('正在阅读','reading',groups.reading,'此刻与你发生关系的书'),want:statusGroup('等待进入','want',groups.want,'下一次阅读可能从这里开始'),done:statusGroup('已读藏书','done',groups.done,'已经成为你文学经验的一部分'),paused:statusGroup('暂时搁置','paused',groups.paused,'尚未结束，只是暂时离开')} ;
  list.innerHTML=visible.map(key=>html[key]).join('')||'<div class="shelf-empty">当前分类还没有作品。</div>';bindShelfLinks()
}
renderShelf=function(){
  if(!hasShelfAtlasDom())return;
  const stats=shelfStats(),countries=countryCoverage(),periodRows=periodCoverage(),strongest=[...countries].sort((a,b)=>b.done-a.done)[0],deepest=[...periodRows].sort((a,b)=>b.ratio-a.ratio)[0];
  shelfElement('#shelfDoneCount').textContent=stats.done.length;shelfElement('#shelfReadingCount').textContent=stats.reading.length;shelfElement('#shelfCountryCount').textContent=`${stats.countries.size} / ${data.length}`;shelfElement('#shelfPeriodCount').textContent=`${stats.periodKeys.size} / ${periods.length}`;shelfElement('#shelfAuthorCount').textContent=stats.completedAuthors;
  shelfElement('#shelfInsight').textContent=strongest&&strongest.done?`你的阅读重心目前位于${strongest.title}文学，文学史上最深入的是${deepest.title.split('：')[0]}。这不是完成率，而是你正在形成的个人文学坐标。`:'阅读版图尚未形成。第一本被读完的书，会让一座岛屿从轮廓中出现。';
  $$('.shelf-view-tab').forEach(b=>b.classList.toggle('active',b.dataset.shelfView===shelfView));
  shelfElement('#shelfMapView').classList.toggle('hidden',shelfView==='status');shelfElement('#shelfStatusView').classList.toggle('hidden',shelfView!=='status');
  if(shelfView==='status'){renderStatusShelf();return}
  const rows=shelfView==='country'?countries:periodRows;
  if(!selectedShelfRegion||!rows.some(x=>x.key===selectedShelfRegion))selectedShelfRegion=rows.find(x=>x.reading.length)?.key||rows.find(x=>x.done)?.key||rows[0]?.key;
  const regionList=shelfElement('#shelfRegionList');regionList.innerHTML=shelfView==='country'?renderWorldIslands(rows):renderTimeRiver(rows);
  $$('[data-shelf-region]').forEach(b=>b.onclick=()=>{selectedShelfRegion=b.dataset.shelfRegion;renderShelf()});
  renderShelfRegion(rows.find(x=>x.key===selectedShelfRegion))
};
$$('.shelf-view-tab').forEach(b=>b.onclick=()=>{shelfView=b.dataset.shelfView;selectedShelfRegion=null;renderShelf()});