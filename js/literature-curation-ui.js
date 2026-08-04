(function(){
  const LABELS={personal:'个人核心',core:'世界文学核心',major:'重要作家',extension:'延伸阅读'};
  const WEIGHTS={personal:4,core:3,major:2,extension:1};
  const originalCurrentAuthors=typeof currentAuthors==='function'?currentAuthors:null;
  if(!originalCurrentAuthors)return;

  currentAuthors=function(q=''){
    const rows=originalCurrentAuthors(q);
    return rows.sort((a,b)=>{
      const ap=a.author,bp=b.author;
      return (WEIGHTS[bp.tier]||0)-(WEIGHTS[ap.tier]||0)
        ||(bp.personalPriority||0)-(ap.personalPriority||0)
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
    $('#authorListSubtitle').textContent=rows.length?`${rows.length} 位作家 · 按个人关联与文学史地位排列`:'请先选择左侧入口';
    $('#authorList').innerHTML=rows.map(({country,author})=>{
      const s=authorWorksStatus(country,author),pct=s.total?s.done/s.total*100:0;
      const tier=author.tier||'extension',label=LABELS[tier]||LABELS.extension;
      const nobel=author.nobelYear?`<span class="author-honor">诺贝尔文学奖 ${author.nobelYear}</span>`:'';
      return `<button class="author-item tier-${tier} ${selectedAuthor===country+'|'+author.name?'active':''}" data-author="${encodeURIComponent(country+'|'+author.name)}">
        <div class="author-top"><span class="author-name">${author.name}</span><span class="stars">${stars(author.rating)}</span></div>
        <div class="author-curation"><span class="author-tier">${label}</span>${nobel}</div>
        <div class="author-era">${mode==='time'?country+' · ':''}${author.era}</div>
        <div class="author-progress"><span>${s.done}/${s.total} 已读</span><span class="mini-bar"><i style="width:${pct}%"></i></span></div>
      </button>`;
    }).join('')||'<div class="item-meta" style="padding:24px 12px">没有匹配的作家。</div>';
    $$('[data-author]').forEach(b=>b.onclick=()=>{selectedAuthor=decodeURIComponent(b.dataset.author);renderExplorer();showMobile('detail')});
  };
})();