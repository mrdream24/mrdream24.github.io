(()=>{
  const states=new WeakMap();
  let resizeTimer=null;
  let resizeBound=false;

  const WORLD_GROUPS=[
    {key:'europe',title:'欧洲文学',match:/英国|法国|德国|德语|俄国|俄罗斯|爱尔兰|意大利|西班牙|葡萄牙|奥地利|瑞士|波兰|捷克|匈牙利|希腊|北欧|挪威|瑞典|丹麦|芬兰|冰岛|荷兰|比利时/},
    {key:'east-asia',title:'东亚文学',match:/中国|日本|韩国|朝鲜|东亚/},
    {key:'latin-america',title:'拉丁美洲',match:/拉丁美洲|阿根廷|哥伦比亚|墨西哥|秘鲁|智利|巴西|古巴|乌拉圭/},
    {key:'north-america',title:'北美文学',match:/美国|加拿大|北美/},
    {key:'other',title:'世界其他传统',match:/.*/}
  ];

  function ensureD3(){return window.d3&&d3.select&&d3.pack&&d3.interpolateZoom}
  function dimensions(container){const r=container.getBoundingClientRect();return{width:Math.max(560,Math.round(r.width||820)),height:Math.max(500,Math.round(r.height||560))}}
  function groupFor(country){return WORLD_GROUPS.find(group=>group.match.test(country))||WORLD_GROUPS.at(-1)}
  function statusOf(id){return window.shelf?.[id]||''}
  function statusWeight(status){return status==='reading'?4:status==='done'?3:status==='want'?2:status==='paused'?1:0}
  function signature(mode,rows){return `${mode}|${rows.map(row=>`${row.key}:${row.done}:${row.reading?.length||0}:${row.total}`).join('|')}|${Object.keys(window.shelf||{}).length}`}
  function levelOf(row){return row.ratio>.65?'core':row.ratio>.3?'deep':row.done||row.reading?.length?'entered':'unknown'}
  function safeText(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}

  function ensureChrome(container,title,subtitle){
    let chrome=container.querySelector('.atlas-chrome');
    if(!chrome){
      chrome=document.createElement('div');chrome.className='atlas-chrome';
      chrome.innerHTML='<div class="atlas-path"><span></span><strong></strong></div><div class="atlas-actions"><button type="button" data-atlas-home>总览</button><span>滚轮缩放 · 拖动浏览</span></div>';
      container.appendChild(chrome)
    }
    chrome.querySelector('.atlas-path span').textContent=title;
    chrome.querySelector('.atlas-path strong').textContent=subtitle||'';
    return chrome
  }
  function tooltip(container){let node=container.querySelector('.d3-atlas-tooltip');if(!node){node=document.createElement('div');node.className='d3-atlas-tooltip';container.appendChild(node)}return node}
  function showTooltip(node,event,html){node.innerHTML=html;node.classList.add('visible');const rect=node.parentElement.getBoundingClientRect();node.style.left=`${Math.min(rect.width-node.offsetWidth-14,Math.max(14,event.clientX-rect.left+16))}px`;node.style.top=`${Math.min(rect.height-node.offsetHeight-14,Math.max(14,event.clientY-rect.top+16))}px`}
  function hideTooltip(node){node.classList.remove('visible')}
  function selectRegion(key){if(typeof window.selectShelfRegion==='function')window.selectShelfRegion(key)}

  function countryHierarchy(rows){
    const rowMap=new Map(rows.map(row=>[row.key,row]));
    const grouped=new Map(WORLD_GROUPS.map(group=>[group.key,{name:group.title,key:group.key,type:'tradition',children:[]}]))
    for(const countryData of window.data||[]){
      const country=countryData.country,row=rowMap.get(country);
      if(!row)continue;
      const authors=(countryData.authors||[]).map(author=>{
        const works=(window.allWorks||[]).filter(work=>work.country===country&&work.author.name===author.name).map(work=>({
          name:work.work[0],key:work.id,type:'work',status:statusOf(work.id),value:1,country,author:author.name
        }));
        return{name:author.name,key:`${country}|${author.name}`,type:'author',country,children:works.length?works:[{name:'尚未收录',key:`empty-${country}-${author.name}`,type:'empty',value:.35,country,author:author.name}]}
      });
      const group=groupFor(country);
      grouped.get(group.key).children.push({name:country,key:country,type:'country',country,row,children:authors})
    }
    return{name:'世界文学',key:'root',type:'root',children:[...grouped.values()].filter(group=>group.children.length)}
  }

  function renderWorld(container,rows,selected,options={}){
    const size=dimensions(container),hash=signature('country',rows),previous=states.get(container);
    if(previous?.mode==='country'&&previous.hash===hash&&previous.width===size.width&&previous.height===size.height){
      previous.selected=selected;
      previous.nodes.attr('class',node=>worldNodeClass(node,selected));
      return
    }
    d3.select(container).selectAll('svg').interrupt().remove();
    container.querySelectorAll('.atlas-chrome,.d3-atlas-tooltip').forEach(node=>node.remove());
    const chrome=ensureChrome(container,'世界文学宇宙','点击文学传统进入，点击空白返回上一级');
    const tip=tooltip(container);
    const svg=d3.select(container).append('svg').attr('class','d3-atlas-svg literary-universe').attr('viewBox',`0 0 ${size.width} ${size.height}`).attr('role','img').attr('aria-label','可缩放的个人文学宇宙');
    const defs=svg.append('defs');
    const glow=defs.append('filter').attr('id','literary-glow').attr('x','-50%').attr('y','-50%').attr('width','200%').attr('height','200%');
    glow.append('feGaussianBlur').attr('stdDeviation',6).attr('result','blur');const merge=glow.append('feMerge');merge.append('feMergeNode').attr('in','blur');merge.append('feMergeNode').attr('in','SourceGraphic');
    const root=d3.hierarchy(countryHierarchy(rows)).sum(node=>node.value||1).sort((a,b)=>b.value-a.value);
    d3.pack().size([size.width-40,size.height-40]).padding(node=>node.depth===1?18:node.depth===2?8:3)(root);
    const scene=svg.append('g').attr('transform','translate(20,20)');
    scene.append('circle').attr('class','universe-aura').attr('cx',root.x).attr('cy',root.y).attr('r',Math.min(size.width,size.height)*.42);
    const nodes=scene.selectAll('g.universe-node').data(root.descendants().slice(1),node=>node.data.key).join('g')
      .attr('class',node=>worldNodeClass(node,selected)).attr('tabindex',node=>node.depth<=3?0:null).attr('role',node=>node.depth<=3?'button':null)
      .attr('transform',node=>`translate(${node.x},${node.y})`);
    nodes.append('circle').attr('class','universe-orbit').attr('r',node=>node.r);
    nodes.append('circle').attr('class','universe-progress').attr('r',node=>{
      if(node.data.type==='country')return node.r*Math.sqrt(Math.max(.035,node.data.row?.ratio||0));
      if(node.data.type==='author'){const works=node.leaves().filter(leaf=>leaf.data.type==='work'),done=works.filter(leaf=>leaf.data.status==='done').length;return node.r*Math.sqrt(Math.max(.025,works.length?done/works.length:0))}
      return node.data.type==='work'?Math.max(2,node.r*.72):0
    });
    nodes.filter(node=>node.data.type==='work'&&node.data.status==='reading').append('circle').attr('class','reading-beacon').attr('r',node=>node.r+5);
    nodes.append('text').attr('class','universe-label').attr('text-anchor','middle').attr('dy',node=>node.depth===1?'.15em':node.depth===2?'-.1em':'.32em').style('font-size',node=>`${Math.max(8,Math.min(node.depth===1?22:15,node.r/(node.depth===1?4.5:3.8)))}px`).text(node=>node.data.type==='work'?'':node.data.name);
    nodes.filter(node=>node.data.type==='country').append('text').attr('class','universe-count').attr('text-anchor','middle').attr('dy','1.45em').text(node=>`${node.data.row?.done||0} 已读`);
    let focus=root,view=[root.x,root.y,root.r*2];
    const byKey=new Map(root.descendants().map(node=>[node.data.key,node]));
    if(previous?.focusKey&&byKey.has(previous.focusKey))focus=byKey.get(previous.focusKey);

    function visibleFor(node){if(focus===root)return node.depth<=2;if(node===focus)return true;return node.parent===focus||node.ancestors().includes(focus)&&node.depth<=focus.depth+2}
    function zoomTo(target,animate=true){
      focus=target||root;const targetView=[focus.x,focus.y,Math.max(36,focus.r*2.18)];
      const transition=animate?svg.transition().duration(850).ease(d3.easeCubicInOut):svg.transition().duration(0);
      transition.tween('zoom',()=>{const interpolate=d3.interpolateZoom(view,targetView);return t=>applyView(interpolate(t))});
      nodes.transition(transition).style('opacity',node=>visibleFor(node)?1:0).style('pointer-events',node=>visibleFor(node)?'auto':'none');
      chrome.querySelector('.atlas-path strong').textContent=focus===root?'':focus.ancestors().reverse().slice(1).map(node=>node.data.name).join(' / ');
      const state=states.get(container);if(state)state.focusKey=focus.data.key
    }
    function applyView(next){view=next;const k=Math.min(size.width,size.height)/next[2];nodes.attr('transform',node=>`translate(${(node.x-next[0])*k+size.width/2-20},${(node.y-next[1])*k+size.height/2-20})`).selectAll('circle.universe-orbit,circle.universe-progress,circle.reading-beacon').attr('transform',`scale(${k})`);nodes.selectAll('text').attr('transform',`scale(${Math.min(1.2,Math.max(.62,k))})`)}

    nodes.on('click',(event,node)=>{
      event.stopPropagation();
      if(node.data.type==='work'){if(typeof window.openWork==='function')window.openWork(node.data.key);return}
      if(node.data.type==='country')selectRegion(node.data.key);
      zoomTo(node)
    }).on('keydown',(event,node)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.currentTarget.dispatchEvent(new MouseEvent('click',{bubbles:true}))}})
      .on('pointermove',(event,node)=>showTooltip(tip,event,worldTooltip(node))).on('pointerleave',()=>hideTooltip(tip));
    svg.on('click',()=>zoomTo(focus.parent||root));
    chrome.querySelector('[data-atlas-home]').onclick=()=>zoomTo(root);
    const zoom=d3.zoom().scaleExtent([.8,3.2]).filter(event=>event.type!=='dblclick'&&event.target===svg.node()).on('zoom',event=>scene.attr('transform',`translate(${20+event.transform.x},${20+event.transform.y}) scale(${event.transform.k})`));svg.call(zoom);
    applyView(view);nodes.style('opacity',node=>visibleFor(node)?1:0).style('pointer-events',node=>visibleFor(node)?'auto':'none');
    if(options.animate!==false)nodes.attr('opacity',0).transition().duration(700).delay((_,index)=>Math.min(index*7,280)).attr('opacity',1);
    states.set(container,{mode:'country',hash,width:size.width,height:size.height,selected,nodes,focusKey:focus.data.key,render:()=>renderWorld(container,rows,selected,{animate:false})});
  }

  function worldNodeClass(node,selected){
    const type=node.data.type,status=node.data.status||'',row=node.data.row;
    return `universe-node depth-${node.depth} type-${type} ${status?`status-${status}`:''} ${row?levelOf(row):''} ${node.data.key===selected?'selected':''}`
  }
  function worldTooltip(node){
    if(node.data.type==='tradition')return `<strong>${safeText(node.data.name)}</strong><span>${node.children?.length||0} 个文学坐标 · 点击进入</span>`;
    if(node.data.type==='country')return `<strong>${safeText(node.data.name)}文学</strong><span>${node.data.row?.done||0} / ${node.data.row?.total||0} 已读 · ${node.data.row?.reading?.length||0} 在读</span>`;
    if(node.data.type==='author'){const works=node.leaves().filter(leaf=>leaf.data.type==='work');return `<strong>${safeText(node.data.name)}</strong><span>${works.filter(leaf=>leaf.data.status==='done').length} / ${works.length} 已读</span>`}
    return `<strong>《${safeText(node.data.name)}》</strong><span>${safeText(node.data.author)} · ${safeText(node.data.status||'未加入')}</span>`
  }

  function streamData(rows){
    const periodIndex=new Map(rows.map((row,index)=>[row.key,index]));
    const groups=WORLD_GROUPS.map(group=>({key:group.key,title:group.title,values:rows.map(()=>({total:0,done:0,reading:0})),works:[]}));
    const groupMap=new Map(groups.map(group=>[group.key,group]));
    for(const work of window.allWorks||[]){
      const period=window.periodOf?.(work.author.name),index=periodIndex.get(period);if(index==null)continue;
      const group=groupMap.get(groupFor(work.country).key),status=statusOf(work.id);group.values[index].total++;if(status==='done')group.values[index].done++;if(status==='reading')group.values[index].reading++;
      if(status)group.works.push({...work,period,index,status})
    }
    return groups.filter(group=>group.values.some(value=>value.total))
  }

  function renderRiver(container,rows,selected,options={}){
    const size=dimensions(container),hash=signature('time',rows),previous=states.get(container);
    if(previous?.mode==='time'&&previous.hash===hash&&previous.width===size.width&&previous.height===size.height){previous.selected=selected;previous.periodBands.classed('selected',row=>row.key===selected);return}
    d3.select(container).selectAll('svg').interrupt().remove();container.querySelectorAll('.atlas-chrome,.d3-atlas-tooltip').forEach(node=>node.remove());
    const chrome=ensureChrome(container,'文学史多支流','不同传统在同一时代并行、交汇与转向');const tip=tooltip(container);
    const svg=d3.select(container).append('svg').attr('class','d3-atlas-svg literary-river-system').attr('viewBox',`0 0 ${size.width} ${size.height}`).attr('role','img').attr('aria-label','个人阅读的多支流文学史');
    const margin={top:74,right:52,bottom:72,left:112},innerW=size.width-margin.left-margin.right,innerH=size.height-margin.top-margin.bottom;
    const plot=svg.append('g').attr('transform',`translate(${margin.left},${margin.top})`),groups=streamData(rows);
    const x=d3.scalePoint().domain(rows.map(row=>row.key)).range([0,innerW]).padding(.35),y=d3.scalePoint().domain(groups.map(group=>group.key)).range([24,innerH-24]).padding(.45);
    const widthScale=d3.scaleSqrt().domain([0,d3.max(groups.flatMap(group=>group.values),value=>value.total)||1]).range([5,30]);
    const periodBands=plot.selectAll('g.period-band').data(rows,row=>row.key).join('g').attr('class',row=>`period-band ${row.key===selected?'selected':''}`).attr('transform',row=>`translate(${x(row.key)},0)`).on('click',(_,row)=>selectRegion(row.key));
    periodBands.append('line').attr('y1',0).attr('y2',innerH);periodBands.append('text').attr('y',innerH+34).attr('text-anchor','middle').text(row=>row.title.split('：')[0]);
    const area=d3.area().curve(d3.curveCatmullRom.alpha(.65)).x((value,index)=>x(rows[index].key)).y0((value,index)=>-widthScale(value.total)/2).y1((value,index)=>widthScale(value.total)/2);
    const lines=plot.selectAll('g.stream').data(groups,group=>group.key).join('g').attr('class','stream').attr('transform',group=>`translate(0,${y(group.key)})`);
    lines.append('path').attr('class','stream-shadow').attr('d',group=>area(group.values));
    lines.append('path').attr('class','stream-body').attr('d',group=>area(group.values)).style('opacity',group=>.28+.58*(d3.sum(group.values,value=>value.done)/Math.max(1,d3.sum(group.values,value=>value.total))));
    lines.append('path').attr('class','stream-spine').attr('d',group=>d3.line().curve(d3.curveCatmullRom.alpha(.65))(group.values.map((_,index)=>[x(rows[index].key),0])));
    plot.selectAll('text.stream-label').data(groups).join('text').attr('class','stream-label').attr('x',-18).attr('y',group=>y(group.key)+4).attr('text-anchor','end').text(group=>group.title);
    const symbol=d3.symbol();
    const workNodes=plot.selectAll('path.work-node').data(groups.flatMap(group=>group.works.map((work,index)=>({...work,group,index}))),work=>work.id).join('path')
      .attr('class',work=>`work-node status-${work.status}`).attr('d',work=>symbol.type(work.status==='done'?d3.symbolCircle:work.status==='reading'?d3.symbolStar:work.status==='paused'?d3.symbolDiamond:d3.symbolTriangle).size(work.status==='reading'?115:70)())
      .attr('transform',work=>`translate(${x(work.period)+(work.index%3-1)*9},${y(work.group.key)+((work.index%5)-2)*6})`)
      .on('pointermove',(event,work)=>showTooltip(tip,event,`<strong>《${safeText(work.work[0])}》</strong><span>${safeText(work.author.name)} · ${safeText(work.country)} · ${safeText(work.status)}</span>`)).on('pointerleave',()=>hideTooltip(tip)).on('click',(event,work)=>{event.stopPropagation();if(typeof window.openWork==='function')window.openWork(work.id)});
    lines.filter(group=>group.values.some(value=>value.reading)).append('circle').attr('class','stream-reading-pulse').attr('cx',group=>{const index=group.values.findIndex(value=>value.reading);return x(rows[Math.max(0,index)].key)}).attr('r',18);
    const zoomLayer=plot;
    svg.call(d3.zoom().scaleExtent([1,3.8]).translateExtent([[margin.left,0],[size.width-margin.right,size.height]]).filter(event=>event.type!=='dblclick').on('zoom',event=>zoomLayer.attr('transform',`translate(${margin.left+event.transform.x},${margin.top}) scale(${event.transform.k},1)`)));
    chrome.querySelector('[data-atlas-home]').onclick=()=>svg.transition().duration(600).call(d3.zoom().transform,d3.zoomIdentity);
    if(options.animate!==false){lines.attr('opacity',0).attr('transform',group=>`translate(0,${y(group.key)+16})`).transition().duration(760).delay((_,index)=>index*85).attr('opacity',1).attr('transform',group=>`translate(0,${y(group.key)})`);workNodes.attr('opacity',0).transition().delay((_,index)=>400+Math.min(index*8,500)).duration(420).attr('opacity',1)}
    states.set(container,{mode:'time',hash,width:size.width,height:size.height,selected,periodBands,render:()=>renderRiver(container,rows,selected,{animate:false})});
  }

  function bindResize(){if(resizeBound)return;resizeBound=true;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{document.querySelectorAll('.d3-atlas-host').forEach(container=>{const state=states.get(container);if(!state)return;const next=dimensions(container);if(Math.abs(next.width-state.width)>10||Math.abs(next.height-state.height)>10)state.render()})},180)},{passive:true})}

  window.renderShelfVisualization=function(container,mode,rows,selected,options={}){
    if(!container)return;if(!ensureD3()){container.innerHTML='<div class="shelf-empty">可视化引擎加载失败，请刷新页面重试。</div>';return}
    container.classList.add('d3-atlas-host');
    if(mode==='country')renderWorld(container,rows,selected,options);else renderRiver(container,rows,selected,options);
    bindResize()
  }
})();