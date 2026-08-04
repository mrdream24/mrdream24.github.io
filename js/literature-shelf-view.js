function shelfElement(selector){return document.querySelector(selector)}
function hasShelfAtlasDom(){return ['#shelfDoneCount','#shelfReadingCount','#shelfCountryCount','#shelfPeriodCount','#shelfAuthorCount','#shelfInsight','#shelfMapView','#shelfStatusView','#shelfRegionList','#shelfRegionDetail'].every(selector=>shelfElement(selector))}
window.selectShelfRegion=function(key){selectedShelfRegion=key;renderShelf()};
function statusGroup(title,key,items,description){
  if(!items.length)return '';
  return `<section class="status-zone ${key}"><div class="zone-heading"><div><p>${description}</p><h2>${title}</h2></div><span>${items.length}</span></div><div class="${key==='reading'?'reading-desk':'cover-gallery'}">${items.map((x,i)=>`<button class="shelf-volume ${key}" data-open="${x.id}" style="--index:${i}">${shelfCoverMarkup(x,key==='reading'?'large':'')}<span><strong>《${x.work[0]}》</strong><small>${x.author.name} · ${shelfPeriodTitle(x.author.name)}</small></span></button>`).join('')}</div></section>`
}
function renderStatusShelf(){
  const list=shelfElement('#shelfStatusList');if(!list)return;
  const groups={reading:[],want:[],done:[],paused:[]};
  allWorks.forEach(x=>{const status=shelf[x.id];if(groups[status])groups[status].push(x)});
  const visible=shelfFilter==='all'?['reading','want','done','paused']:[shelfFilter];
  const html={reading:statusGroup('正在阅读','reading',groups.reading,'此刻与你发生关系的书'),want:statusGroup('等待进入','want',groups.want,'下一次阅读可能从这里开始'),done:statusGroup('已读藏书','done',groups.done,'已经成为你文学经验的一部分'),paused:statusGroup('暂时搁置','paused',groups.paused,'尚未结束，只是暂时离开')};
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
  const regionList=shelfElement('#shelfRegionList');
  if(typeof window.renderShelfVisualization==='function')window.renderShelfVisualization(regionList,shelfView,rows,selectedShelfRegion);else regionList.innerHTML='<div class="shelf-empty">可视化引擎尚未加载。</div>';
  renderShelfRegion(rows.find(x=>x.key===selectedShelfRegion))
};
$$('.shelf-view-tab').forEach(b=>b.onclick=()=>{shelfView=b.dataset.shelfView;selectedShelfRegion=null;renderShelf()});
(function loadNextBookAdvisor(){
  if(!document.querySelector('link[href="./css/literature-next-book.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./css/literature-next-book.css';document.head.appendChild(link)}
  if(!document.querySelector('script[src="./js/literature-next-book.js"]')){const script=document.createElement('script');script.src='./js/literature-next-book.js';document.body.appendChild(script)}
})();