(()=>{
  const STYLE_ID='literature-cover-style';
  const CACHE_PREFIX='literatureCover:v3:';
  const SUCCESS_TTL=90*24*60*60*1000;
  const MISS_TTL=24*60*60*1000;
  const FALLBACK_COLORS=['#315247','#70413d','#3e4f69','#6a5940','#5b4967'];
  const metadata=window.LITERATURE_COVER_METADATA||{authorAliases:{},titleAliases:{},books:{}};

  function installStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .work-card.has-cover{grid-template-columns:40px 56px minmax(0,1fr) 118px}
      .literature-cover{width:56px;height:84px;display:block;object-fit:cover;border-radius:4px;background:#ded7ca;box-shadow:0 4px 12px rgba(45,36,27,.14)}
      @media(max-width:1000px){
        .work-card.has-cover{grid-template-columns:34px 48px minmax(0,1fr)}
        .literature-cover{width:48px;height:72px}
        .work-card.has-cover .status-select{grid-column:3}
      }
    `;
    document.head.appendChild(style);
  }

  function escapeXml(value){
    return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[char]);
  }

  function fallbackCover(title,author){
    let hash=0;
    for(const char of title)hash=(hash*31+char.charCodeAt(0))>>>0;
    const bg=FALLBACK_COLORS[hash%FALLBACK_COLORS.length];
    const chars=[...title],chunk=chars.length>10?5:chars.length>6?4:3,lines=[];
    for(let i=0;i<chars.length&&lines.length<4;i+=chunk)lines.push(chars.slice(i,i+chunk).join(''));
    const tspans=lines.map((line,index)=>`<tspan x="16" dy="${index?23:0}">${escapeXml(line)}</tspan>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="224" height="336" viewBox="0 0 224 336"><rect width="224" height="336" rx="8" fill="${bg}"/><rect x="12" y="12" width="200" height="312" rx="4" fill="none" stroke="#f5efe4" stroke-opacity=".28"/><path d="M16 47h72" stroke="#d0aa70" stroke-width="4"/><text x="16" y="82" fill="#f8f1e5" font-family="Songti SC,STSong,serif" font-size="22" font-weight="700">${tspans}</text><text x="16" y="294" fill="#f8f1e5" fill-opacity=".78" font-family="system-ui,sans-serif" font-size="12">${escapeXml(author)}</text><text x="16" y="315" fill="#d0aa70" font-family="system-ui,sans-serif" font-size="8" letter-spacing="1.4">LITERATURE</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function normalize(value=''){
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[《》:：'"“”‘’.,，。·\-—_()（）\[\]【】\s]/g,'');
  }

  function unique(values){return [...new Set(values.filter(Boolean))]}

  function getBookMeta(title,author){
    const key=`${author}|${title}`;
    const fixed=metadata.books?.[key]||{};
    return {
      ...fixed,
      titles:unique([title,...(fixed.titles||[]),...(metadata.titleAliases?.[title]||[])]),
      authors:unique([author,...(fixed.authors||[]),...(metadata.authorAliases?.[author]||[])])
    };
  }

  function scoreBook(book,titles,authors){
    if(!book.cover_i)return -1;
    const bookTitle=normalize(book.title);
    const bookAuthors=(book.author_name||[]).map(normalize);
    let bestTitle=0,bestAuthor=0;
    for(const title of titles){
      const candidate=normalize(title);if(!candidate)continue;
      if(bookTitle===candidate)bestTitle=Math.max(bestTitle,100);
      else if(bookTitle.includes(candidate)||candidate.includes(bookTitle))bestTitle=Math.max(bestTitle,70);
    }
    for(const author of authors){
      const candidate=normalize(author);if(!candidate)continue;
      if(bookAuthors.some(value=>value===candidate))bestAuthor=Math.max(bestAuthor,50);
      else if(bookAuthors.some(value=>value.includes(candidate)||candidate.includes(value)))bestAuthor=Math.max(bestAuthor,30);
    }
    return bestTitle+bestAuthor;
  }

  async function requestBooks(title,author){
    const params=new URLSearchParams({title,fields:'cover_i,title,author_name,first_publish_year',limit:'20'});
    if(author)params.set('author',author);
    const response=await fetch(`https://openlibrary.org/search.json?${params}`);
    if(!response.ok)throw new Error(`Open Library ${response.status}`);
    return (await response.json()).docs||[];
  }

  async function searchOpenLibrary(meta){
    if(meta.coverId)return meta.coverId;
    if(meta.isbn)return {isbn:meta.isbn};
    const preferredTitles=meta.titles.slice(1).concat(meta.titles[0]).filter(Boolean);
    const preferredAuthors=meta.authors.slice(1).concat(meta.authors[0]).filter(Boolean);
    const attempts=[];
    for(const title of preferredTitles.slice(0,3)){
      attempts.push([title,preferredAuthors[0]||'']);
    }
    attempts.push([preferredTitles[0]||meta.titles[0],'']);

    let best=null;
    for(const [title,author] of attempts){
      const docs=await requestBooks(title,author);
      for(const book of docs){
        const score=scoreBook(book,meta.titles,meta.authors);
        if(!best||score>best.score)best={book,score};
      }
      if(best?.score>=130)break;
    }
    return best&&best.score>=70?best.book.cover_i:null;
  }

  function readCache(key){
    try{
      const entry=JSON.parse(localStorage.getItem(key)||'null');
      if(!entry||entry.expiresAt<Date.now()){localStorage.removeItem(key);return null}
      return entry;
    }catch{return null}
  }

  function writeCache(key,value,ttl){
    try{localStorage.setItem(key,JSON.stringify({...value,expiresAt:Date.now()+ttl}))}catch{}
  }

  async function resolveCover(image,title,author,fallback){
    const cacheKey=CACHE_PREFIX+title+'|'+author;
    const cached=readCache(cacheKey);
    if(cached){if(cached.url)image.src=cached.url;return}

    try{
      const meta=getBookMeta(title,author);
      const result=await searchOpenLibrary(meta);
      if(!result){writeCache(cacheKey,{miss:true},MISS_TTL);return}
      const url=typeof result==='object'
        ?`https://covers.openlibrary.org/b/isbn/${encodeURIComponent(result.isbn)}-M.jpg?default=false`
        :`https://covers.openlibrary.org/b/id/${result}-M.jpg?default=false`;
      image.onerror=()=>{
        image.onerror=null;image.src=fallback;writeCache(cacheKey,{miss:true},MISS_TTL);
      };
      image.src=url;
      writeCache(cacheKey,{url},SUCCESS_TTL);
    }catch(error){
      console.warn('书籍封面加载失败',title,error);
      writeCache(cacheKey,{miss:true},MISS_TTL);
    }
  }

  function enhanceCards(){
    const author=document.querySelector('.author-hero h1')?.textContent.trim()||'';
    if(!author)return;
    document.querySelectorAll('.work-card:not(.has-cover)').forEach(card=>{
      const title=card.querySelector('.work-title')?.textContent.replace(/[《》]/g,'').trim();
      const number=card.querySelector('.work-no');
      if(!title||!number)return;
      const fallback=fallbackCover(title,author),image=document.createElement('img');
      image.className='literature-cover';image.src=fallback;image.alt=`《${title}》封面`;image.loading='lazy';image.decoding='async';
      card.classList.add('has-cover');number.insertAdjacentElement('afterend',image);resolveCover(image,title,author,fallback);
    });
  }

  installStyle();
  const detail=document.getElementById('detailContent');
  if(!detail)return;
  new MutationObserver(enhanceCards).observe(detail,{childList:true,subtree:true});
  enhanceCards();
})();