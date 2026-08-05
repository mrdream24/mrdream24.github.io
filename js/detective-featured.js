(()=>{
  const authors=window.detectiveAuthors||[];
  const masterNames=[
    '埃德加·爱伦·坡','阿瑟·柯南·道尔','G.K.切斯特顿','阿加莎·克里斯蒂','多萝西·L·塞耶斯','约瑟芬·铁伊','约翰·狄克森·卡尔','P.D.詹姆斯','鲁丝·伦德尔','伊恩·兰金',
    '达希尔·哈米特','雷蒙德·钱德勒','罗斯·麦唐诺','帕特里夏·海史密斯','埃勒里·奎因','詹姆斯·艾尔罗伊','迈克尔·康奈利','丹尼斯·勒翰',
    '加斯东·勒鲁','莫里斯·勒布朗','乔治·西默农',
    '江户川乱步','横沟正史','高木彬光','松本清张','岛田庄司','绫辻行人','法月纶太郎','有栖川有栖','京极夏彦','麻耶雄嵩','东野圭吾','宫部美雪',
    '马伊·舍瓦尔 / 佩尔·瓦勒','亨宁·曼凯尔','尤·奈斯博','翁贝托·埃科','博尔赫斯 / 比奥伊·卡萨雷斯','程小青'
  ];
  const portraits={
    '埃德加·爱伦·坡':['推理小说的原点','他把不可思议的犯罪转化为可以由观察、分析与语言重新建立的秩序。'],
    '阿瑟·柯南·道尔':['名侦探神话的奠基者','福尔摩斯使侦探成为现代都市中理性、观察力与个人魅力的化身。'],
    '阿加莎·克里斯蒂':['黄金时代的谜题女王','她以封闭空间、有限嫌疑人与叙事误导，把犯罪小说变成精密的阅读游戏。'],
    '约翰·狄克森·卡尔':['不可能犯罪的大师','密室在他笔下不是机关展示，而是对读者常识与空间判断的系统挑战。'],
    '雷蒙德·钱德勒':['硬汉小说的文学化者','他把侦探从书房带回腐败都市，让风格、孤独与道德困境成为案件的一部分。'],
    '帕特里夏·海史密斯':['犯罪心理的幽暗解剖者','她不急于恢复秩序，而是让读者长时间停留在欲望、身份与罪责的不稳定地带。'],
    '乔治·西默农':['人的秘密比案件更深','梅格雷系列把破案转化为对环境、阶级、欲望与日常生活压力的耐心观察。'],
    '江户川乱步':['日本推理与变格想象的源头','他把逻辑谜题、都市怪奇、情色与视觉幻觉共同带入日本现代推理。'],
    '横沟正史':['乡土本格的建构者','封闭村落、家族历史与战后阴影，使他的谜案同时具有民俗仪式与社会创伤。'],
    '松本清张':['社会派推理的决定性人物','犯罪不只是个人异常，而是制度、贫困、欲望与社会关系长期挤压后的结果。'],
    '岛田庄司':['新本格复兴的发动者','他以宏大的不可能犯罪重新证明，诡计仍能成为现代小说的思想装置。'],
    '绫辻行人':['馆系列与新本格秩序','他以建筑、叙事结构和读者预期共同制造谜题，让古典规则获得现代形式。'],
    '京极夏彦':['妖怪不是答案，而是认知的症状','京极堂的工作不是降妖，而是拆除人们为不可理解之事制造的解释结构。'],
    '麻耶雄嵩':['反推理与规则破坏者','他熟悉本格传统，却不断让侦探、真相和公平游戏本身变得可疑。'],
    '东野圭吾':['本格机制与大众叙事的结合者','他在诡计、情感与社会议题之间建立高效结构，使推理进入更广泛的阅读现场。'],
    '宫部美雪':['社会肌理中的犯罪叙事','她让案件深入家庭、消费社会与普通人的生活裂缝，兼具规模感与同情心。'],
    '亨宁·曼凯尔':['北欧犯罪小说的世界坐标','沃兰德的疲惫与案件中的社会失序，共同构成福利社会阴影下的道德调查。'],
    '翁贝托·埃科':['知识迷宫中的历史推理','侦查、符号学、神学与权力在他的小说里交织，真相始终伴随着解释的危险。'],
    '博尔赫斯 / 比奥伊·卡萨雷斯':['推理作为智性迷宫','他们把侦探小说压缩成悖论、语言游戏和形而上陷阱，重新定义了谜题的边界。']
  };
  const pool=masterNames.map(name=>authors.find(author=>author.name===name)).filter(author=>author&&author.works.length>=2);
  if(!pool.length)return;
  const featured=pool[Math.floor(Math.random()*pool.length)];
  const container=document.querySelector('#kyogokuFeature');
  if(!container)return;
  const section=container.closest('.section');
  const title=section?.querySelector('.section-head h2');
  const intro=section?.querySelector('.section-head > p');
  const eyebrow=section?.querySelector('.eyebrow');
  const [label,description]=portraits[featured.name]||[featured.tradition,`${featured.name}以${featured.tradition}传统中的代表作品，展示侦探小说如何在不同历史与文化语境中重建真相。`];
  if(eyebrow)eyebrow.textContent='RANDOM MASTER DOSSIER';
  if(title)title.textContent=`${featured.name} · ${label}`;
  if(intro)intro.textContent=description;

  function recordFor(work){
    const id=encodeURIComponent(`${featured.country}|${featured.name}|${work.title}`);
    let records={};
    try{records=JSON.parse(localStorage.getItem('detectiveReadingRecords')||'{}')}catch(_){records={}}
    return {id,record:records[id]||{}};
  }
  const statusText={want:'想读',reading:'在读',done:'已读',paused:'暂停'};
  let rendering=false;
  function render(){
    if(rendering)return;
    rendering=true;
    container.innerHTML=featured.works.slice(0,6).map((work,index)=>{
      const {id,record}=recordFor(work);
      const status=record.status?statusText[record.status]:'未加入案卷';
      return `<article class="feature"><small>${featured.country.toUpperCase()} / ${featured.tradition.toUpperCase()} / ${String(index+1).padStart(2,'0')}</small><h3>《${work.title}》</h3><p>${featured.name} · ${status}</p><button class="record-btn ${record.status?'has':''}" data-record="${id}">${record.status?'编辑':'＋ 案卷'}</button></article>`;
    }).join('');
    rendering=false;
  }
  render();
  const observer=new MutationObserver(()=>{
    const firstTitle=container.querySelector('h3')?.textContent||'';
    const expected=featured.works[0]?`《${featured.works[0].title}》`:'';
    if(firstTitle!==expected)render();
  });
  observer.observe(container,{childList:true,subtree:true});
})();
