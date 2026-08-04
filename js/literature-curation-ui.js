(function(){
  const originalCurrentAuthors=typeof currentAuthors==='function'?currentAuthors:null;
  if(!originalCurrentAuthors)return;

  currentAuthors=function(q=''){
    const rows=originalCurrentAuthors(q);
    return rows.sort((a,b)=>{
      const ap=a.author,bp=b.author;
      return (bp.tier==='core'?1:0)-(ap.tier==='core'?1:0)
        ||(bp.canonicalScore||0)-(ap.canonicalScore||0)
        ||(bp.nobelYear?1:0)-(ap.nobelYear?1:0)
        ||(bp.rating||0)-(ap.rating||0)
        ||ap.name.localeCompare(bp.name,'zh-CN');
    });
  };

  renderAuthors=function(q=''){
    const rows=currentAuthors(q);
    const title=mode==='author'?(selectedLevel||'作家'):(periods.find(p=>p.key===selectedLevel)?.title.split('：')[0]||'作家');
    $('#authorListTitle').textContent=title;
    $('#authorListSubtitle').textContent=rows.length?`${rows.length} 位作家 · 按文学史地位排列`:'请先选择左侧入口';
    $('#authorList').innerHTML=rows.map(({country,author})=>{
      const s=authorWorksStatus(country,author),pct=s.total?s.done/s.total*100:0;
      const core=author.tier==='core'?'<span class="author-tier">文学史核心</span>':'';
      const nobel=author.nobelYear?`<span class="author-honor">诺贝尔文学奖 ${author.nobelYear}</span>`:'';
      const curation=core||nobel?`<div class="author-curation">${core}${nobel}</div>`:'';
      return `<button class="author-item ${author.tier==='core'?'tier-core':''} ${selectedAuthor===country+'|'+author.name?'active':''}" data-author="${encodeURIComponent(country+'|'+author.name)}">
        <div class="author-top"><span class="author-name">${author.name}</span><span class="stars">${stars(author.rating)}</span></div>
        ${curation}
        <div class="author-era">${mode==='time'?country+' · ':''}${author.era}</div>
        <div class="author-progress"><span>${s.done}/${s.total} 已读</span><span class="mini-bar"><i style="width:${pct}%"></i></span></div>
      </button>`;
    }).join('')||'<div class="item-meta" style="padding:24px 12px">没有匹配的作家。</div>';
    $$('[data-author]').forEach(b=>b.onclick=()=>{selectedAuthor=decodeURIComponent(b.dataset.author);renderExplorer();showMobile('detail')});
  };
})();