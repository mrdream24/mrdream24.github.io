(()=>{
  const list=window.detectiveAuthors||(window.detectiveAuthors=[]);
  const additions=[
    {
      country:'当代国际',
      name:'阿比盖尔·迪恩',
      tradition:'心理犯罪',
      works:[{title:'我们的死亡（The Death of Us）',tags:['心理犯罪','2026 CWA金匕首奖','中文暂译']}]
    },
    {
      country:'当代国际',
      name:'劳拉·麦克拉斯基',
      tradition:'民俗悬疑',
      works:[{title:'狼树（The Wolf Tree）',tags:['民俗悬疑','2026 CWA首作奖','中文暂译']}]
    },
    {
      country:'当代国际',
      name:'S.A.科斯比',
      tradition:'南方黑色犯罪',
      works:[{title:'灰烬之王（King of Ashes）',tags:['黑色犯罪','2026 CWA钢匕首奖','中文暂译']}]
    }
  ];
  additions.forEach(author=>{
    const existing=list.find(item=>item.name===author.name);
    if(!existing){list.push(author);return;}
    author.works.forEach(work=>{
      if(!existing.works.some(item=>item.title===work.title))existing.works.push(work);
    });
  });
})();
