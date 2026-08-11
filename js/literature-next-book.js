(function(){
  const PERIOD_LABELS=()=>new Map((periods||[]).map(p=>[p.key,p.title]));
  const statusItems=status=>(allWorks||[]).filter(x=>shelf?.[x.id]===status);
  const countBy=(items,keyFn)=>[...items.reduce((map,item)=>{const key=keyFn(item);map.set(key,(map.get(key)||0)+1);return map},new Map())].sort((a,b)=>b[1]-a[1]);
  const list=(rows,limit=8)=>rows.slice(0,limit).map(([name,count])=>`${name}（${count}部）`).join('、')||'暂无';
  const bookList=(items,limit=80)=>items.slice(0,limit).map(x=>`《${x.work[0]}》—${x.author.name}（${x.country}，${PERIOD_LABELS().get(periodOf(x.author.name))?.split('：')[0]||'时期未标注'}）`).join('\n');

  /*
   * “核心作者”不等于“该作者所有作品都是文学史核心作品”。
   * 下一本书提示词只抽取核心作者中评分最高的代表作，并按国家/传统轮转，
   * 避免 allWorks 的原始国家顺序让某一个传统占满样本。
   */
  function buildGlobalCanonSample(limit=36){
    const unread=(allWorks||[]).filter(x=>x.author.tier==='core'&&!shelf?.[x.id]);
    const byAuthor=new Map();
    unread.forEach(x=>{
      const key=`${x.country}|${x.author.name}`;
      if(!byAuthor.has(key))byAuthor.set(key,[]);
      byAuthor.get(key).push(x);
    });

    const representative=[];
    byAuthor.forEach(items=>{
      items.sort((a,b)=>(b.work[1]||0)-(a.work[1]||0)||a.index-b.index);
      const fiveStar=items.filter(x=>(x.work[1]||0)>=5);
      const source=fiveStar.length?fiveStar:items;
      representative.push(...source.slice(0,2));
    });

    representative.sort((a,b)=>(b.work[1]||0)-(a.work[1]||0)||(b.author.canonicalScore||0)-(a.author.canonicalScore||0)||a.index-b.index);
    const byCountry=new Map();
    representative.forEach(x=>{
      if(!byCountry.has(x.country))byCountry.set(x.country,[]);
      byCountry.get(x.country).push(x);
    });

    const countries=[...byCountry.keys()].sort((a,b)=>{
      const aBest=byCountry.get(a)[0],bBest=byCountry.get(b)[0];
      return ((bBest?.author?.canonicalScore||0)-(aBest?.author?.canonicalScore||0))||a.localeCompare(b,'zh-CN');
    });
    const result=[];
    let round=0;
    while(result.length<limit){
      let added=false;
      for(const country of countries){
        const item=byCountry.get(country)?.[round];
        if(item){result.push(item);added=true;if(result.length>=limit)break}
      }
      if(!added)break;
      round++;
    }
    return result;
  }

  function buildPrompt(){
    const done=statusItems('done'),reading=statusItems('reading'),want=statusItems('want'),paused=statusItems('paused');
    const authors=countBy(done,x=>x.author.name),countries=countBy(done,x=>x.country),periodMap=PERIOD_LABELS();
    const periodCounts=countBy(done,x=>periodMap.get(periodOf(x.author.name))?.split('：')[0]||'未归类');
    const enteredAuthors=new Set([...done,...reading].map(x=>x.author.name));
    const coreUnread=buildGlobalCanonSample(36);
    const unreadWant=want.filter(x=>!done.some(d=>d.id===x.id));
    return `你是一位严谨的世界文学阅读顾问。请根据我的真实阅读记录，为我推荐下一本最值得读的书，并给出三个明确、彼此有区分度的选择。不要只根据名气推荐，也不要把我的已读书再次列为候选。\n\n【我的阅读概况】\n已读：${done.length} 部；在读：${reading.length} 部；想读：${want.length} 部；暂停：${paused.length} 部。\n阅读最多的作家：${list(authors)}。\n阅读最多的国家与传统：${list(countries)}。\n文学史时期分布：${list(periodCounts,10)}。\n已进入的作家数量：${enteredAuthors.size}。\n\n【已读书目】\n${bookList(done)||'暂无已读记录'}\n\n【正在阅读】\n${bookList(reading,20)||'暂无'}\n\n【我已标记为想读的候选】\n${bookList(unreadWant,30)||'暂无'}\n\n【书库中尚未阅读的世界文学核心代表作样本】\n${bookList(coreUnread,36)||'暂无'}\n\n关于上面的“核心代表作样本”，请注意：它不是按书库原始顺序截取，而是从文学史核心作者中优先选择高评级代表作，并按国家与传统轮转抽样；同一作家最多只取少量代表作。“核心作者”不意味着其全部作品都自动属于文学史核心作品，中国作家与外国作家必须使用同一套严格标准判断。这个样本只是辅助候选，不是完整世界文学经典目录。\n\n请同时从“作家维度”和“时间维度”分析我的阅读结构：\n1. 作家维度：判断我是在继续深入已读作家、转向相邻作家，还是需要进入新的文学传统。\n2. 时间维度：判断我当前在哪些文学时期阅读密集，哪些关键时期明显缺失或断裂。\n3. 阅读节奏：考虑我目前正在阅读的书，避免推荐三本气质、体量和难度完全相同的作品。\n4. 候选范围：可以优先从想读列表和书库未读作品中选择；若书库外有明显更合适的作品，也可以推荐，但必须说明为什么值得越过现有候选。\n5. 核心作品判断：不要把“作者属于核心作家”直接推导为“其每一部作品都是文学史核心作品”；应判断具体作品本身的文学史地位、代表性与影响。\n6. 世界文学视野：不要因数据排列顺序偏向任何单一国家。尤其当核心样本几乎只来自一个国家时，应主动识别为数据偏差，而不是据此得出阅读建议。\n7. 不要为了地域均衡而机械推荐，也不要因为作者获过诺贝尔奖就自动优先。文学史位置、与既有阅读的连接、审美拓展价值和此刻可读性应共同决定。\n\n请只给出三个最终选择，并严格使用以下结构：\n\n第一选择：《书名》—作者\n- 为什么它现在最适合我\n- 它与我已读作品的具体连接\n- 它补足了哪个作家维度或文学史维度\n- 阅读难度与预计投入\n\n第二选择：《书名》—作者\n（同样四项）\n\n第三选择：《书名》—作者\n（同样四项）\n\n最后增加一段“最终判断”，明确告诉我：如果今天只能开始一本，应选哪一本，以及为什么另外两本应该排在后面。不要使用空泛的赞美，不要剧透关键情节。`;
  }

  function ensureUI(){
    const page=document.querySelector('#dashboardPage');if(!page||document.querySelector('#nextBookPromptCard'))return;
    const hero=page.querySelector('.dashboard-hero');
    const card=document.createElement('section');card.id='nextBookPromptCard';card.className='next-book-prompt-card';
    card.innerHTML='<div><p class="eyebrow">AI READING ADVISOR</p><h2>下一本读什么</h2><p>根据你的已读书目、作家覆盖和文学史分布，生成一段可直接交给 ChatGPT 的推荐提示词。</p></div><button type="button" id="generateNextBookPrompt">生成推荐提示词</button>';
    hero?.insertAdjacentElement('afterend',card);
    const dialog=document.createElement('dialog');dialog.id='nextBookPromptDialog';dialog.className='next-book-prompt-dialog';
    dialog.innerHTML='<div class="next-book-prompt-panel"><header><div><p class="eyebrow">COPY TO CHATGPT</p><h2>下一本书推荐提示词</h2></div><button type="button" data-close-next-book aria-label="关闭">×</button></header><p class="prompt-note">提示词会使用你当前浏览器或云端同步后的最新阅读状态，不会向任何外部服务自动发送数据。</p><textarea id="nextBookPromptText" spellcheck="false"></textarea><footer><button type="button" class="subtle" data-close-next-book>取消</button><button type="button" id="copyNextBookPrompt">复制提示词</button></footer><div id="nextBookCopyStatus" aria-live="polite"></div></div>';
    document.body.appendChild(dialog);
    document.querySelector('#generateNextBookPrompt').onclick=()=>{document.querySelector('#nextBookPromptText').value=buildPrompt();dialog.showModal()};
    dialog.querySelectorAll('[data-close-next-book]').forEach(btn=>btn.onclick=()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
    document.querySelector('#copyNextBookPrompt').onclick=async()=>{
      const textarea=document.querySelector('#nextBookPromptText'),status=document.querySelector('#nextBookCopyStatus');
      try{await navigator.clipboard.writeText(textarea.value);status.textContent='已复制，可以直接粘贴到 ChatGPT。'}
      catch(_){textarea.select();document.execCommand('copy');status.textContent='已复制，可以直接粘贴到 ChatGPT。'}
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUI);else ensureUI();
  window.buildNextBookRecommendationPrompt=buildPrompt;
})();
