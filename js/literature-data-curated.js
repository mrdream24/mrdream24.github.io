(function(){
  const REMOVE=new Set([
    '曹雪芹','吴承恩','施耐庵','罗贯中','蒲松龄',
    '但丁','威廉·莎士比亚','米格尔·德·塞万提斯','弗朗索瓦·拉伯雷','莫里哀'
  ]);
  const TIER_SCORE={personal:5,core:4,major:3,extension:2};
  const A={
    '中国':[
      {name:'余华',era:'当代中国小说与历史创伤',rating:5,tier:'personal',canonicalScore:98,personalPriority:100,works:[['活着',5,'苦难、生命韧性与民间叙事'],['许三观卖血记',5,'家庭、生存与荒诞现实'],['兄弟',4,'市场化时代的欲望与断裂'],['第七天',4,'死亡视角下的社会寓言'],['文城',4,'古典叙事与现代命运']]},
      {name:'陈忠实',era:'当代现实主义与家族史诗',rating:5,tier:'personal',canonicalScore:94,personalPriority:95,works:[['白鹿原',5,'宗族、革命与20世纪中国乡土史诗'],['初夏',4,'乡村秩序与历史转型'],['陈忠实短篇小说选',4,'理解其现实主义根基']]},
      {name:'王安忆',era:'当代都市、女性与历史记忆',rating:5,tier:'core',canonicalScore:93,works:[['长恨歌',5,'上海城市记忆与女性命运'],['天香',5,'家族、工艺与明代上海'],['小鲍庄',4,'乡土伦理与现代叙事'],['启蒙时代',4,'革命记忆与知识青年']]},
      {name:'贾平凹',era:'乡土中国、地方现代性与欲望书写',rating:5,tier:'core',canonicalScore:92,works:[['秦腔',5,'乡村社会解体与语言实验'],['废都',4,'知识分子、欲望与城市文化'],['古炉',5,'历史暴力与村庄共同体'],['浮躁',4,'改革时代的地方社会']]},
      {name:'苏童',era:'先锋小说、历史寓言与女性叙事',rating:5,tier:'core',canonicalScore:91,works:[['妻妾成群',5,'家族权力、女性与空间政治'],['河岸',5,'革命记忆与父子关系'],['黄雀记',4,'罪责、欲望与城市边缘'],['米',4,'饥饿、暴力与现代性']]},
      {name:'格非',era:'先锋小说与江南叙事',rating:5,tier:'core',canonicalScore:91,works:[['江南三部曲',5,'乌托邦、革命与20世纪中国'],['迷舟',5,'先锋叙事与历史迷雾'],['望春风',4,'乡村记忆与现代性终结'],['人面桃花',5,'理想主义与历史循环']]},
      {name:'阎连科',era:'荒诞现实主义与政治寓言',rating:5,tier:'core',canonicalScore:94,works:[['丁庄梦',5,'疫病、资本与乡村伦理'],['受活',5,'荒诞、权力与残疾共同体'],['四书',5,'历史创伤与制度暴力'],['日熄',4,'梦魇叙事与乡土社会']]},
      {name:'残雪',era:'先锋文学与精神现实',rating:5,tier:'major',canonicalScore:91,works:[['五香街',5,'欲望、观看与社区寓言'],['边疆',5,'空间、梦境与精神现实'],['黄泥街',4,'先锋语言与压抑结构'],['新世纪爱情故事',4,'当代关系与荒诞感']]},
      {name:'刘震云',era:'当代社会小说与反讽叙事',rating:5,tier:'major',canonicalScore:89,works:[['一句顶一万句',5,'孤独、语言与民间社会'],['故乡天下黄花',4,'权力循环与乡村政治'],['我不是潘金莲',4,'制度、申诉与黑色幽默'],['一地鸡毛',4,'日常生活与单位社会']]},
      {name:'阿来',era:'藏地历史、族群记忆与现代性',rating:5,tier:'major',canonicalScore:88,works:[['尘埃落定',5,'土司制度、现代性与家族命运'],['云中记',4,'灾难、记忆与地方共同体'],['机村史诗',5,'边地社会的现代转型']]},
      {name:'迟子建',era:'东北书写、自然伦理与普通人生活',rating:5,tier:'major',canonicalScore:88,works:[['额尔古纳河右岸',5,'民族记忆、自然与现代性'],['白雪乌鸦',4,'瘟疫、城市与民间生活'],['伪满洲国',4,'殖民历史与东北经验']]},
      {name:'金宇澄',era:'当代上海叙事与方言小说',rating:5,tier:'major',canonicalScore:88,works:[['繁花',5,'上海记忆、方言与碎片化叙事'],['回望',4,'家族记忆与20世纪历史']]}
    ],
    '英国':[
      {name:'石黑一雄',era:'记忆、身份与不可靠叙事',rating:5,tier:'personal',canonicalScore:99,personalPriority:100,nobelYear:2017,works:[['长日将尽',5,'记忆、职业伦理与自我欺骗'],['别让我走',5,'生命伦理、克制与失去'],['无可慰藉',5,'梦境结构与现代焦虑'],['被掩埋的巨人',4,'集体记忆、遗忘与历史暴力'],['浮世画家',5,'战后责任与自我叙述'],['克拉拉与太阳',4,'人工智能、爱与替代']]},
      {name:'伊恩·麦克尤恩',era:'当代英国小说与伦理困境',rating:5,tier:'major',canonicalScore:89,works:[['赎罪',5,'叙事、罪责与历史创伤'],['星期六',4,'自由主义生活与恐怖阴影'],['儿童法案',4,'法律、信仰与私人伦理'],['阿姆斯特丹',4,'友谊、欲望与道德失败']]},
      {name:'朱利安·巴恩斯',era:'历史、记忆与元小说',rating:5,tier:'major',canonicalScore:89,works:[['终结的感觉',5,'记忆、责任与自我修正'],['福楼拜的鹦鹉',5,'传记、虚构与文学迷恋'],['英国，英国',4,'国家想象与文化复制'],['唯一的故事',4,'爱情、时间与回忆']]}
    ],
    '捷克':[
      {name:'米兰·昆德拉',era:'中欧小说、流亡与存在反思',rating:5,tier:'personal',canonicalScore:99,personalPriority:100,works:[['不能承受的生命之轻',5,'偶然、历史与存在悖论'],['玩笑',5,'政治、误读与命运'],['生活在别处',5,'诗性幻觉与革命激情'],['不朽',5,'形象、死亡与现代自我'],['笑忘录',5,'记忆、遗忘与历史'],['小说的艺术',5,'理解现代小说传统的关键文论']]}
    ],
    '加拿大':[
      {name:'爱丽丝·门罗',era:'当代短篇小说与时间结构',rating:5,tier:'personal',canonicalScore:99,personalPriority:100,nobelYear:2013,works:[['逃离',5,'女性选择、偶然与命运'],['亲爱的生活',5,'记忆、自传与晚期风格'],['恨，友谊，追求，爱情，婚姻',5,'日常生活中的命运转折'],['公开的秘密',5,'时间跳跃与人物命运'],['快乐影子之舞',4,'早期乡镇经验与短篇形式'],['木星的卫星',5,'亲密关系、衰老与道德复杂性']]},
      {name:'玛格丽特·阿特伍德',era:'女性主义、反乌托邦与加拿大文学',rating:5,tier:'core',canonicalScore:94,works:[['使女的故事',5,'父权政治、身体与反乌托邦'],['别名格蕾丝',5,'历史、阶级与不可靠叙事'],['盲刺客',5,'家族史、爱情与文本套层'],['羚羊与秧鸡',4,'生物技术与末世想象']]}
    ],
    '日本':[
      {name:'村上春树',era:'全球化时代的都市孤独与超现实',rating:5,tier:'personal',canonicalScore:96,personalPriority:96,works:[['海边的卡夫卡',5,'成长、神话与平行世界'],['世界尽头与冷酷仙境',5,'意识、系统与双线结构'],['奇鸟行状录',5,'历史暴力、记忆与潜意识'],['挪威的森林',4,'青春、死亡与失去'],['1Q84',4,'平行现实、邪教与爱情'],['没有色彩的多崎作和他的巡礼之年',4,'创伤、友谊与自我重建']]}
    ],
    '美国':[
      {name:'科马克·麦卡锡',era:'美国边疆、暴力与末世寓言',rating:5,tier:'core',canonicalScore:96,works:[['血色子午线',5,'暴力、边疆与历史神话'],['路',5,'末世、父子与伦理残余'],['老无所依',5,'现代暴力与命运'],['边境三部曲',5,'边疆终结与成长']]},
      {name:'唐·德里罗',era:'后现代美国、媒介与系统小说',rating:5,tier:'core',canonicalScore:94,works:[['白噪音',5,'消费、媒介与死亡恐惧'],['地下世界',5,'冷战、垃圾与美国总体史'],['天秤星座',4,'阴谋、历史与肯尼迪刺杀'],['大都会',4,'资本、技术与城市末日']]},
      {name:'托马斯·品钦',era:'后现代总体小说与熵的想象',rating:5,tier:'core',canonicalScore:96,works:[['万有引力之虹',5,'战争、技术与偏执结构'],['拍卖第四十九批',5,'符号、阴谋与信息迷宫'],['梅森和迪克逊',5,'历史、测量与国家边界'],['性本恶',4,'侦探小说与反文化消逝']]},
      {name:'菲利普·罗斯',era:'美国犹太经验、身份与欲望',rating:5,tier:'core',canonicalScore:94,works:[['美国牧歌',5,'理想、家庭与美国裂变'],['我嫁了一个共产党员',5,'麦卡锡主义与背叛'],['人性的污秽',5,'身份、种族与公共道德'],['波特诺伊的怨诉',4,'欲望、家庭与喜剧独白']]}
    ],
    '法国':[
      {name:'安妮·埃尔诺',era:'自传社会学、阶级与女性记忆',rating:5,tier:'core',canonicalScore:96,nobelYear:2022,works:[['悠悠岁月',5,'个人记忆与集体历史'],['一个女人的故事',5,'母亲、阶级与书写伦理'],['位置',5,'父亲、教育与阶级迁移'],['事件',5,'身体、堕胎与社会禁忌']]},
      {name:'帕特里克·莫迪亚诺',era:'记忆、失踪与巴黎地理',rating:5,tier:'major',canonicalScore:91,nobelYear:2014,works:[['暗店街',5,'身份、失忆与城市侦探'],['青春咖啡馆',4,'地点、记忆与消失'],['地平线',4,'偶遇、追踪与时间'],['缓刑',4,'童年、占领与家族秘密']]}
    ],
    '波兰':[
      {name:'奥尔加·托卡尔丘克',era:'神话、迁徙与碎片化总体小说',rating:5,tier:'core',canonicalScore:97,nobelYear:2018,works:[['云游',5,'身体、旅行与碎片结构'],['太古和其他的时间',5,'神话、地方与20世纪历史'],['雅各布之书',5,'宗教、边界与欧洲历史'],['白天的房子，夜晚的房子',4,'地方、梦境与多声部']]}
    ],
    '匈牙利':[
      {name:'拉斯洛·克拉斯纳霍尔卡伊',era:'末世感、长句与中欧精神景观',rating:5,tier:'core',canonicalScore:97,nobelYear:2025,works:[['撒旦探戈',5,'封闭共同体、欺骗与末世循环'],['反抗的忧郁',5,'秩序崩解与群体狂热'],['世界在前进',5,'漫游、艺术与文明焦虑'],['赫尔施特07769',4,'德国地方、音乐与暴力阴影']]}
    ],
    '挪威':[
      {name:'约恩·福瑟',era:'极简主义戏剧、沉默与信仰',rating:5,tier:'core',canonicalScore:96,nobelYear:2023,works:[['七部曲',5,'身份、信仰与重复结构'],['晨与夜',5,'生命、死亡与语言极简'],['有人将至',4,'欲望、孤独与舞台节奏'],['三部曲',5,'爱情、罪责与宗教寓言']]},
      {name:'卡尔·奥韦·克瑙斯高',era:'自传小说与日常生活总体化',rating:5,tier:'major',canonicalScore:90,works:[['我的奋斗',5,'自我、家庭与日常生活的总体书写'],['秋天',4,'父亲视角与世界细节'],['晨星',4,'宗教、死亡与多人物叙事']]}
    ],
    '土耳其':[
      {name:'奥尔罕·帕慕克',era:'伊斯坦布尔、现代性与东西方冲突',rating:5,tier:'core',canonicalScore:97,nobelYear:2006,works:[['我的名字叫红',5,'艺术、宗教与侦探结构'],['雪',5,'政治、信仰与现代土耳其'],['伊斯坦布尔',5,'城市记忆与忧郁'],['纯真博物馆',4,'爱情、物与收藏']]}
    ],
    '葡萄牙':[
      {name:'若泽·萨拉马戈',era:'寓言小说、历史重写与伦理政治',rating:5,tier:'core',canonicalScore:98,nobelYear:1998,works:[['失明症漫记',5,'文明崩溃与伦理考验'],['修道院纪事',5,'历史、权力与民间想象'],['耶稣基督福音',5,'宗教重写与道德质询'],['复明症漫记',4,'民主、制度与集体行动']]}
    ],
    '智利':[
      {name:'罗贝托·波拉尼奥',era:'拉丁美洲后爆炸文学与流亡',rating:5,tier:'core',canonicalScore:97,works:[['2666',5,'暴力、文学与全球化黑暗'],['荒野侦探',5,'诗人共同体、青春与流亡'],['护身符',4,'记忆、历史与拉美创伤'],['智利之夜',5,'文学、独裁与道德共谋']]}
    ],
    '罗马尼亚':[
      {name:'米尔恰·卡塔雷斯库',era:'后现代东欧、梦境与城市身体',rating:5,tier:'major',canonicalScore:91,works:[['炫目三部曲',5,'布加勒斯特、身体与宇宙想象'],['索莱诺伊德',5,'失败、教育与超现实世界'],['怀旧',4,'青春、梦境与叙事游戏']]}
    ]
  };

  const groups=window.literatureData||[];
  groups.forEach(group=>{group.authors=(group.authors||[]).filter(author=>!REMOVE.has(author.name))});
  for(const [country,authors] of Object.entries(A)){
    let group=groups.find(item=>item.country===country);
    if(!group){group={country,authors:[]};groups.push(group)}
    for(const incoming of authors){
      const index=group.authors.findIndex(author=>author.name===incoming.name);
      if(index>=0)group.authors[index]={...group.authors[index],...incoming};else group.authors.push(incoming)
    }
  }
  groups.forEach(group=>group.authors.forEach(author=>{
    author.tier=author.tier||((author.rating||0)>=5?'major':'extension');
    author.canonicalScore=author.canonicalScore||((author.rating||0)*17);
    author.curationScore=(TIER_SCORE[author.tier]||1)*100+(author.personalPriority||0)+(author.canonicalScore||0)+(author.nobelYear?18:0);
  }));
  window.literatureData=groups.filter(group=>group.authors.length);
  window.literaturePeriodOverrides={
    ...(window.literaturePeriodOverrides||{}),
    '余华':'contemporary','陈忠实':'contemporary','王安忆':'contemporary','贾平凹':'contemporary','苏童':'contemporary','格非':'contemporary','阎连科':'contemporary','残雪':'contemporary','刘震云':'contemporary','阿来':'contemporary','迟子建':'contemporary','金宇澄':'contemporary',
    '石黑一雄':'contemporary','伊恩·麦克尤恩':'contemporary','朱利安·巴恩斯':'contemporary','米兰·昆德拉':'postwar','爱丽丝·门罗':'postwar','玛格丽特·阿特伍德':'postwar','村上春树':'contemporary',
    '科马克·麦卡锡':'postwar','唐·德里罗':'postwar','托马斯·品钦':'postwar','菲利普·罗斯':'postwar','安妮·埃尔诺':'contemporary','帕特里克·莫迪亚诺':'postwar','奥尔加·托卡尔丘克':'contemporary',
    '拉斯洛·克拉斯纳霍尔卡伊':'contemporary','约恩·福瑟':'contemporary','卡尔·奥韦·克瑙斯高':'contemporary','奥尔罕·帕慕克':'contemporary','若泽·萨拉马戈':'postwar','罗贝托·波拉尼奥':'contemporary','米尔恰·卡塔雷斯库':'contemporary'
  };
})();