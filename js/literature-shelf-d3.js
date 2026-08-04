(()=>{
  let resizeObserver=null;

  function ensureD3(){return window.d3&&window.d3.select&&window.d3.pack}
  function levelOf(row){return row.ratio>.65?'core':row.ratio>.3?'deep':row.done||row.reading.length?'entered':'unknown'}
  function clear(container){container.replaceChildren()}
  function dimensions(container){
    const rect=container.getBoundingClientRect();
    return {width:Math.max(540,Math.round(rect.width||760)),height:Math.max(430,Math.round(rect.height||520))}
  }
  function installResize(container,render){
    resizeObserver?.disconnect();
    resizeObserver=new ResizeObserver(()=>{
      clearTimeout(installResize.timer);
      installResize.timer=setTimeout(render,120);
    });
    resizeObserver.observe(container);
  }
  function selectRegion(key){if(typeof window.selectShelfRegion==='function')window.selectShelfRegion(key)}
  function tooltip(container){
    let node=container.querySelector('.d3-atlas-tooltip');
    if(!node){node=document.createElement('div');node.className='d3-atlas-tooltip';container.appendChild(node)}
    return node
  }
  function showTooltip(node,event,html){
    node.innerHTML=html;node.classList.add('visible');
    const rect=node.parentElement.getBoundingClientRect();
    node.style.left=`${Math.min(rect.width-node.offsetWidth-12,Math.max(12,event.clientX-rect.left+14))}px`;
    node.style.top=`${Math.min(rect.height-node.offsetHeight-12,Math.max(12,event.clientY-rect.top+14))}px`;
  }
  function hideTooltip(node){node.classList.remove('visible')}

  function renderIslands(container,rows,selected){
    clear(container);
    const {width,height}=dimensions(container),tip=tooltip(container);
    const svg=d3.select(container).append('svg').attr('class','d3-atlas-svg d3-islands').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','个人文学世界地图');
    const defs=svg.append('defs');
    const glow=defs.append('filter').attr('id','atlas-glow').attr('x','-40%').attr('y','-40%').attr('width','180%').attr('height','180%');
    glow.append('feGaussianBlur').attr('stdDeviation',7).attr('result','blur');
    const merge=glow.append('feMerge');merge.append('feMergeNode').attr('in','blur');merge.append('feMergeNode').attr('in','SourceGraphic');
    const root=d3.hierarchy({children:rows}).sum(d=>Math.max(5,d.total)).sort((a,b)=>b.value-a.value);
    d3.pack().size([width-36,height-36]).padding(13)(root);
    const nodes=root.leaves();
    const g=svg.append('g').attr('transform','translate(18,18)');
    g.append('path').attr('class','atlas-current-line').attr('d',d3.line().curve(d3.curveCatmullRom.alpha(.65))(nodes.slice(0,8).map((n,i)=>[n.x+(i%2?8:-8),n.y+(i%3?6:-6)])));
    const island=g.selectAll('g.island-node').data(nodes,d=>d.data.key).join(enter=>{
      const group=enter.append('g').attr('class','island-node').attr('tabindex',0).attr('role','button').attr('aria-label',d=>`${d.data.title}文学，已读${d.data.done}部`).attr('transform',d=>`translate(${d.x},${d.y}) scale(0)`);
      group.append('circle').attr('class','island-halo');
      group.append('circle').attr('class','island-body');
      group.append('circle').attr('class','island-fill');
      group.append('text').attr('class','island-title').attr('text-anchor','middle');
      group.append('text').attr('class','island-meta').attr('text-anchor','middle');
      return group
    });
    island.attr('class',d=>`island-node ${levelOf(d.data)} ${selected===d.data.key?'active':''}`)
      .on('click',(_,d)=>selectRegion(d.data.key))
      .on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRegion(d.data.key)}})
      .on('pointermove',(event,d)=>showTooltip(tip,event,`<strong>${d.data.title}文学</strong><span>${d.data.done} / ${d.data.total} 已读${d.data.reading.length?` · ${d.data.reading.length} 在读`:''}</span>`))
      .on('pointerleave',()=>hideTooltip(tip));
    island.select('.island-halo').attr('r',d=>d.r+10).classed('reading',d=>d.data.reading.length>0);
    island.select('.island-body').attr('r',d=>d.r);
    island.select('.island-fill').attr('r',d=>Math.max(0,d.r*Math.sqrt(Math.max(.02,d.data.ratio))));
    island.select('.island-title').attr('y',d=>d.r>58?-5:0).style('font-size',d=>`${Math.max(11,Math.min(19,d.r/4.8))}px`).text(d=>d.data.title);
    island.select('.island-meta').attr('y',d=>d.r>58?18:0).style('display',d=>d.r>48?'block':'none').text(d=>`${d.data.done} 已读`);
    island.transition().duration(780).delay((_,i)=>i*32).ease(d3.easeCubicOut).attr('transform',d=>`translate(${d.x},${d.y}) scale(1)`);
    svg.call(d3.zoom().scaleExtent([.9,2.4]).filter(event=>event.type!=='dblclick').on('zoom',event=>g.attr('transform',`translate(${18+event.transform.x},${18+event.transform.y}) scale(${event.transform.k})`)));
    installResize(container,()=>renderIslands(container,rows,selected));
  }

  function renderRiver(container,rows,selected){
    clear(container);
    const {width,height}=dimensions(container),tip=tooltip(container),margin={left:64,right:64};
    const svg=d3.select(container).append('svg').attr('class','d3-atlas-svg d3-river').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','个人文学时间长河');
    const x=d3.scalePoint().domain(rows.map(d=>d.key)).range([margin.left,width-margin.right]).padding(.55);
    const yBase=height*.48;
    const points=rows.map((d,i)=>[x(d.key),yBase+Math.sin(i*.95)*32]);
    const river=d3.line().curve(d3.curveCatmullRom.alpha(.7));
    svg.append('path').attr('class','river-shadow').attr('d',river(points));
    svg.append('path').attr('class','river-main').attr('d',river(points)).attr('stroke-dasharray',function(){return this.getTotalLength()}).attr('stroke-dashoffset',function(){return this.getTotalLength()}).transition().duration(1200).ease(d3.easeCubicInOut).attr('stroke-dashoffset',0);
    const eras=svg.selectAll('g.era-node').data(rows,d=>d.key).join('g').attr('class',d=>`era-node ${levelOf(d)} ${selected===d.key?'active':''}`).attr('tabindex',0).attr('role','button').attr('transform',(d,i)=>`translate(${x(d.key)},${points[i][1]})`)
      .on('click',(_,d)=>selectRegion(d.key))
      .on('keydown',(event,d)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectRegion(d.key)}})
      .on('pointermove',(event,d)=>showTooltip(tip,event,`<strong>${d.title}</strong><span>${d.done} / ${d.total} 已读 · ${d.countries?.size||0} 个传统</span>`))
      .on('pointerleave',()=>hideTooltip(tip));
    eras.append('circle').attr('class','era-pulse').attr('r',d=>d.reading.length?24:0);
    eras.append('circle').attr('class','era-ring').attr('r',d=>14+Math.min(16,d.total/4));
    eras.append('circle').attr('class','era-core').attr('r',d=>7+Math.min(10,d.done/2));
    eras.append('text').attr('class','era-index').attr('text-anchor','middle').attr('y',-38).text((_,i)=>String(i+1).padStart(2,'0'));
    eras.append('text').attr('class','era-title').attr('text-anchor','middle').attr('y',48).text(d=>d.title.split('：')[0]);
    eras.append('text').attr('class','era-meta').attr('text-anchor','middle').attr('y',68).text(d=>`${d.done} 已读 · ${d.countries?.size||0} 个传统`);
    eras.attr('opacity',0).attr('transform',(d,i)=>`translate(${x(d.key)},${points[i][1]+18})`).transition().duration(650).delay((_,i)=>260+i*75).attr('opacity',1).attr('transform',(d,i)=>`translate(${x(d.key)},${points[i][1]})`);
    svg.append('g').attr('class','river-axis').selectAll('text').data(rows).join('text').attr('x',d=>x(d.key)).attr('y',height-24).attr('text-anchor','middle').text((_,i)=>i===0?'起点':i===rows.length-1?'当代':'');
    installResize(container,()=>renderRiver(container,rows,selected));
  }

  window.renderShelfVisualization=function(container,mode,rows,selected){
    if(!container)return;
    if(!ensureD3()){
      container.innerHTML='<div class="shelf-empty">可视化引擎加载失败，请刷新页面重试。</div>';
      return;
    }
    container.classList.add('d3-atlas-host');
    if(mode==='country')renderIslands(container,rows,selected);else renderRiver(container,rows,selected);
  };
})();