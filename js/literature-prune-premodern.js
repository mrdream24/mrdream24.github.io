(function(){
  const PREMODERN=new Set([
    '曹雪芹','吴承恩','施耐庵','罗贯中','蒲松龄','汤显祖','关汉卿','王实甫','屈原','陶渊明','李白','杜甫','苏轼',
    '荷马','索福克勒斯','埃斯库罗斯','欧里庇得斯','阿里斯托芬','维吉尔','奥维德',
    '但丁','薄伽丘','彼特拉克','杰弗里·乔叟','乔叟','威廉·莎士比亚','米格尔·德·塞万提斯',
    '弗朗索瓦·拉伯雷','莫里哀','皮埃尔·高乃依','让·拉辛','约翰·弥尔顿','弥尔顿'
  ]);
  const groups=window.literatureData||[];
  groups.forEach(group=>{group.authors=(group.authors||[]).filter(author=>!PREMODERN.has(author.name))});
  window.literatureData=groups.filter(group=>group.authors.length);
})();