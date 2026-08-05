(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #recordDialog{max-width:470px}
    .compact-record-card{padding:30px}
    .compact-record-card .record-title{padding-bottom:22px;border-bottom:1px solid var(--line)}
    .compact-record-card .record-title small{color:var(--acid);font:9px var(--mono);letter-spacing:.18em}
    .compact-record-card .record-title h2{margin:10px 0 7px}
    .compact-record-card .record-title p{margin:0}
    .record-field{margin:24px 0 0;padding:0;border:0}
    .record-field legend{margin-bottom:12px;color:#bdb8ae;font-size:11px}
    .status-options{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .status-options label{margin:0;cursor:pointer}
    .status-options input{position:absolute;opacity:0;pointer-events:none}
    .status-options span{display:block;padding:11px 7px;border:1px solid var(--line);text-align:center;color:var(--muted);font-size:11px;transition:border-color .2s,background .2s,color .2s}
    .status-options label:hover span{border-color:rgba(201,211,91,.45);color:var(--ink)}
    .status-options input:checked+span{border-color:var(--acid);background:rgba(201,211,91,.09);color:var(--acid)}
    .status-options input:focus-visible+span{outline:2px solid var(--acid);outline-offset:3px}
    .star-rating{display:flex;align-items:center;gap:5px;min-height:42px}
    .star-rating button{padding:0;border:0;background:none;color:#414642;font-size:30px;line-height:1;cursor:pointer;transition:color .16s,transform .16s}
    .star-rating button:hover,.star-rating button:focus-visible{transform:translateY(-2px);outline:none}
    .star-rating button.active{color:var(--acid);text-shadow:0 0 15px rgba(201,211,91,.18)}
    .star-rating span{margin-left:9px;color:var(--muted);font:10px var(--mono)}
    .record-compat-field{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;opacity:0!important;pointer-events:none!important}
    .compact-record-card .dialog-actions{margin-top:30px;padding-top:20px;border-top:1px solid var(--line)}
    @media(max-width:520px){.compact-record-card{padding:23px}.status-options{grid-template-columns:repeat(2,1fr)}.star-rating button{font-size:28px}}
  `;
  document.head.appendChild(style);

  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const dialog=$('#recordDialog');
  const statusSelect=$('#recordStatus');
  const ratingInput=$('#recordRating');
  const ratingText=$('#ratingText');
  const starButtons=$$('#starRating [data-rating]');
  const statusRadios=$$('input[name="recordStatusChoice"]');

  function currentRating(){
    const value=Number(ratingInput?.value||0);
    return Number.isFinite(value)?Math.max(0,Math.min(5,value)):0;
  }

  function paintStars(value=currentRating()){
    starButtons.forEach(button=>{
      const rating=Number(button.dataset.rating);
      const selected=rating<=value;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-checked',rating===Math.round(value)?'true':'false');
    });
    if(ratingText)ratingText.textContent=value?`${value} 星`:'未评分';
  }

  function syncStatusFromSelect(){
    const value=statusSelect?.value||'';
    statusRadios.forEach(radio=>radio.checked=radio.value===value);
  }

  statusRadios.forEach(radio=>radio.addEventListener('change',()=>{
    if(statusSelect)statusSelect.value=radio.value;
  }));

  starButtons.forEach(button=>{
    button.addEventListener('mouseenter',()=>paintStars(Number(button.dataset.rating)));
    button.addEventListener('focus',()=>paintStars(Number(button.dataset.rating)));
    button.addEventListener('click',()=>{
      const selected=Number(button.dataset.rating);
      const next=currentRating()===selected?0:selected;
      if(ratingInput)ratingInput.value=next||'';
      paintStars(next);
    });
  });

  $('#starRating')?.addEventListener('mouseleave',()=>paintStars());
  $('#starRating')?.addEventListener('focusout',event=>{
    if(!event.currentTarget.contains(event.relatedTarget))paintStars();
  });

  dialog?.addEventListener('toggle',()=>{
    if(dialog.open){
      syncStatusFromSelect();
      paintStars();
    }
  });

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-record]')){
      queueMicrotask(()=>{
        syncStatusFromSelect();
        paintStars();
      });
    }
  });

  $('#recordForm')?.addEventListener('reset',()=>queueMicrotask(()=>{
    syncStatusFromSelect();
    paintStars(0);
  }));
})();
