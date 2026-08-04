(()=>{
  const STYLE_ID='literature-cover-style';
  const CACHE_PREFIX='literatureCover:v2:';
  const FALLBACK_COLORS=['#315247','#70413d','#3e4f69','#6a5940','#5b4967'];

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
    return String(value).replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
    })[char]);
  }

  function fallbackCover(title,author){
    let hash=0;
    for(const char of title)hash=(hash*31+char.charCodeAt(0))>>>0;
    const bg=FALLBACK_COLORS[hash%FALLBACK_COLORS.length];
    const chars=[...title];
    const chunk=chars.length>10?5:chars.length>6?4:3;
    const lines=[];
    for(let i=0;i<chars.length&&lines.length<4;i+=chunk)lines.push(chars.slice(i,i+chunk).join(''));
    const tspans=lines.map((line,index)=>`<tspan x="16" dy="${index?23:0}">${escapeXml(line)}</tspan>`).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="224" height="336" viewBox="0 0 224 336"><rect width="224" height="336" rx="8" fill="${bg}"/><rect x="12" y="12" width="200" height="312" rx="4" fill="none" stroke="#f5efe4" stroke-opacity=".28"/><path d="M16 47h72" stroke="#d0aa70" stroke-width="4"/><text x="16" y="82" fill="#f8f1e5" font-family="Songti SC,STSong,serif" font-size="22" font-weight="700">${tspans}</text><text x="16" y="294" fill="#f8f1e5" fill-opacity=".78" font-family="system-ui,sans-serif" font-size="12">${escapeXml(author)}</text><text x="16" y="315" fill="#d0aa70" font-family="system-ui,sans-serif" font-size="8" letter-spacing="1.4">LITERATURE</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  async function searchOpenLibrary(title,author){
    const params=new URLSearchParams({
      title,
      author,
      fields:'cover_i,title,author_name',
      limit:'10'
    });
    let response=await fetch(`https://openlibrary.org/search.json?${params}`);
    if(!response.ok)throw new Error(`Open Library ${response.status}`);
    let payload=await response.json();
    let match=(payload.docs||[]).find(book=>book.cover_i);

    if(!match){
      const titleOnly=new URLSearchParams({title,fields:'cover_i,title,author_name',limit:'10'});
      response=await fetch(`https://openlibrary.org/search.json?${titleOnly}`);
      if(!response.ok)throw new Error(`Open Library ${response.status}`);
      payload=await response.json();
      match=(payload.docs||[]).find(book=>book.cover_i);
    }
    return match?.cover_i||null;
  }

  async function resolveCover(image,title,author,fallback){
    const cacheKey=CACHE_PREFIX+title+'|'+author;
    const cached=localStorage.getItem(cacheKey);
    if(cached){
      if(cached!=='fallback')image.src=cached;
      return;
    }

    try{
      const coverId=await searchOpenLibrary(title,author);
      if(!coverId){localStorage.setItem(cacheKey,'fallback');return;}
      const url=`https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false`;
      image.onerror=()=>{
        image.onerror=null;
        image.src=fallback;
        localStorage.setItem(cacheKey,'fallback');
      };
      image.src=url;
      localStorage.setItem(cacheKey,url);
    }catch(error){
      console.warn('书籍封面加载失败',title,error);
    }
  }

  function enhanceCards(){
    const author=document.querySelector('.author-hero h1')?.textContent.trim()||'';
    if(!author)return;
    document.querySelectorAll('.work-card:not(.has-cover)').forEach(card=>{
      const title=card.querySelector('.work-title')?.textContent.replace(/[《》]/g,'').trim();
      const number=card.querySelector('.work-no');
      if(!title||!number)return;
      const fallback=fallbackCover(title,author);
      const image=document.createElement('img');
      image.className='literature-cover';
      image.src=fallback;
      image.alt=`《${title}》封面`;
      image.loading='lazy';
      image.decoding='async';
      card.classList.add('has-cover');
      number.insertAdjacentElement('afterend',image);
      resolveCover(image,title,author,fallback);
    });
  }

  installStyle();
  const detail=document.getElementById('detailContent');
  if(!detail)return;
  const observer=new MutationObserver(enhanceCards);
  observer.observe(detail,{childList:true,subtree:true});
  enhanceCards();
})();
