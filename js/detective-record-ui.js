(()=>{
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
      button.setAttribute('aria-checked',rating===value?'true':'false');
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
