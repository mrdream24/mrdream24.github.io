(()=>{
  const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const starText=rating=>rating?`${'★'.repeat(Math.round(rating))}${'☆'.repeat(5-Math.round(rating))}`:'';

  renderShelf=function(){
    const rows=works.filter(work=>records[work.id]?.status&&(shelfFilter==='all'||records[work.id].status===shelfFilter));
    const doneCount=Object.values(records).filter(record=>record.status==='done').length;
    const grouped=new Map();

    rows.forEach(work=>{
      if(!grouped.has(work.author))grouped.set(work.author,[]);
      grouped.get(work.author).push(work);
    });

    const authorGroups=[...grouped.entries()].sort((a,b)=>{
      const aDone=a[1].filter(work=>records[work.id]?.status==='done').length;
      const bDone=b[1].filter(work=>records[work.id]?.status==='done').length;
      return bDone-aDone||b[1].length-a[1].length||a[0].localeCompare(b[0],'zh-CN');
    });

    $('#shelfInsight').textContent=`共记录 ${Object.keys(records).length} 部作品，涉及 ${authorGroups.length} 位作者，其中已读 ${doneCount} 部。`;
    const list=$('#shelfList');
    list.classList.add('author-grouped');

    if(!authorGroups.length){
      list.innerHTML='<div class="empty">当前分类还没有阅读记录。</div>';
      return;
    }

    list.innerHTML=authorGroups.map(([authorName,authorWorks])=>{
      const first=authorWorks[0];
      const done=authorWorks.filter(work=>records[work.id]?.status==='done').length;
      const rated=authorWorks.filter(work=>records[work.id]?.rating).length;
      return `<section class="shelf-author-group">
        <header class="shelf-author-head">
          <div class="shelf-author-identity">
            <small>${escapeHtml(first.country)} / ${escapeHtml(first.tradition)}</small>
            <h2>${escapeHtml(authorName)}</h2>
            <p>当前筛选下收录 ${authorWorks.length} 部作品</p>
          </div>
          <div class="shelf-author-stats">
            <span><b>${authorWorks.length}</b> 部记录</span>
            <span><b>${done}</b> 部已读</span>
            <span><b>${rated}</b> 部评分</span>
          </div>
        </header>
        <div class="shelf-author-works">
          ${authorWorks.map(work=>{
            const record=records[work.id];
            return `<article class="shelf-work-row" data-record="${work.id}" tabindex="0" role="button" aria-label="编辑《${escapeHtml(work.title)}》的阅读记录">
              <div class="meta">
                <span class="shelf-status">${statusText[record.status]}</span>
                ${record.rating?`<span class="shelf-rating" aria-label="${record.rating} 星">${starText(record.rating)}</span>`:''}
              </div>
              <h3>《${escapeHtml(work.title)}》</h3>
              <p>${escapeHtml(work.tradition)}</p>
            </article>`;
          }).join('')}
        </div>
      </section>`;
    }).join('');
  };

  document.addEventListener('keydown',event=>{
    const card=event.target.closest?.('.shelf-work-row[data-record]');
    if(card&&(event.key==='Enter'||event.key===' ')){
      event.preventDefault();
      card.click();
    }
  });

  renderShelf();
})();