/* ============================================================
   Charitha Portfolio — interactions
   ============================================================ */
(function(){
  'use strict';
  const $ = (s,c=document)=>c.querySelector(s);
  const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- detect whether CSS transitions actually run here; if not (some
     capture/preview iframes freeze them), force content to its visible
     end-state so nothing stays hidden ---- */
  (function probe(){
    const p=document.createElement('div');
    p.style.cssText='position:fixed;left:-9999px;top:0;width:8px;height:8px;opacity:0;transition:opacity .25s linear;pointer-events:none';
    document.body.appendChild(p);
    requestAnimationFrame(()=>{ p.style.opacity='1'; });
    setTimeout(()=>{
      const v=parseFloat(getComputedStyle(p).opacity)||0;
      if(v<0.5) document.documentElement.classList.add('no-anim');
      p.remove();
    },450);
  })();

  /* ---- embers ---- */
  (function embers(){
    const host = $('.embers'); if(!host||reduce) return;
    const n = 28;
    for(let i=0;i<n;i++){
      const e=document.createElement('span');
      e.className='ember';
      const s=2+Math.random()*3;
      e.style.left=(Math.random()*100)+'%';
      e.style.width=s+'px';e.style.height=s+'px';
      e.style.animationDuration=(5+Math.random()*7)+'s';
      e.style.animationDelay=(-Math.random()*12)+'s';
      e.style.opacity=(.3+Math.random()*.6);
      host.appendChild(e);
    }
  })();

  /* ---- reveal / counters / bars via scroll (no IntersectionObserver:
     it does not fire reliably inside sandboxed preview iframes) ---- */
  function animateCount(el){
    if(el.dataset.done) return; el.dataset.done='1';
    const target=+el.dataset.count, dur=1400, start=performance.now(), suffix=el.dataset.suffix||'';
    function step(t){
      const p=Math.min((t-start)/dur,1), eased=1-Math.pow(1-p,3);
      el.textContent=Math.round(target*eased)+suffix;
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  const reveals=$$('.reveal'), counters=$$('[data-count]'), bars=$$('.bar__fill');
  function inView(el, frac){
    const r=el.getBoundingClientRect();
    return r.top < innerHeight*(frac||0.88) && r.bottom > 0;
  }
  function checkAnims(){
    reveals.forEach(el=>{ if(!el.classList.contains('in') && inView(el)) el.classList.add('in'); });
    counters.forEach(el=>{ if(inView(el,0.95)) animateCount(el); });
    bars.forEach(el=>{ if(!el.dataset.fired && inView(el,0.92)){ el.dataset.fired='1'; el.style.width=el.dataset.val+'%'; } });
  }

  /* ---- nav scroll + progress + active link ---- */
  const nav=$('.nav'), progress=$('#progress'), backBtn=$('.backbtn');
  const sections=$$('section[id]');
  const navLinks=$$('.nav__links a');
  function onScroll(){
    const y=scrollY;
    nav.classList.toggle('scrolled', y>40);
    if(backBtn) backBtn.classList.toggle('show', y>260);
    const h=document.documentElement.scrollHeight-innerHeight;
    progress.style.width=(h>0?(y/h*100):0)+'%';
    let cur='';
    sections.forEach(s=>{ if(y>=s.offsetTop-160) cur=s.id; });
    navLinks.forEach(a=>a.classList.toggle('active', a.getAttribute('href')==='#'+cur));
    checkAnims();
  }
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',checkAnims,{passive:true});
  onScroll();
  // rAF safety loop for the first moments in case scroll/layout settles late
  let ticks=0;
  (function warm(){ checkAnims(); if(ticks++<120) requestAnimationFrame(warm); })();
  // ultimate fallback: never leave content permanently hidden if the
  // environment doesn't deliver scroll/resize events (e.g. tall preview iframes)
  setTimeout(function(){
    reveals.forEach(el=>el.classList.add('in'));
    counters.forEach(animateCount);
    bars.forEach(el=>{ if(!el.dataset.fired){ el.dataset.fired='1'; el.style.width=el.dataset.val+'%'; } });
  }, 2600);

  /* ---- mobile menu ---- */
  const burger=$('.burger');
  if(burger){
    burger.addEventListener('click',()=>nav.classList.toggle('open'));
    $$('.nav__links a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
  }

  /* ---- project filter ---- */
  const filters=$$('.filter'), cards=$$('.card[data-cat]');
  filters.forEach(f=>f.addEventListener('click',()=>{
    filters.forEach(x=>x.classList.remove('active')); f.classList.add('active');
    const cat=f.dataset.filter;
    cards.forEach(c=>{
      const show = cat==='all' || c.dataset.cat.includes(cat);
      c.classList.toggle('hide',!show);
    });
  }));

  /* ---- video modal ---- */
  const modal=$('.modal'), frame=$('.modal__frame'), closeBtn=$('.modal__close');
  function openVid(id){
    if(!id) return;
    frame.innerHTML='<iframe src="https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    modal.classList.add('open'); document.body.classList.add('noscroll');
  }
  function closeVid(){ modal.classList.remove('open'); frame.innerHTML=''; document.body.classList.remove('noscroll'); }
  $$('[data-vid]').forEach(el=>el.addEventListener('click',()=>openVid(el.dataset.vid)));
  closeBtn.addEventListener('click',closeVid);
  modal.addEventListener('click',e=>{ if(e.target===modal) closeVid(); });
  addEventListener('keydown',e=>{ if(e.key==='Escape') closeVid(); });

  /* ---- contact form ---- */
  const form=$('#contactForm');
  if(form){
    form.addEventListener('submit',e=>{
      e.preventDefault();
      let ok=true;
      $$('.field',form).forEach(fl=>{
        const inp=$('input,textarea',fl); if(!inp||!inp.hasAttribute('required')) return;
        let bad=!inp.value.trim();
        if(inp.type==='email' && inp.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value)) bad=true;
        fl.classList.toggle('err',bad); if(bad) ok=false;
      });
      if(ok){ form.reset(); $('.form__ok').classList.add('show'); setTimeout(()=>$('.form__ok').classList.remove('show'),5000); }
    });
    $$('.field input,.field textarea',form).forEach(i=>i.addEventListener('input',()=>i.closest('.field').classList.remove('err')));
  }

  /* ---- lab / project player (inline iframe, keeps preview auth) ---- */
  const labModal=$('#labModal'), labFrame=$('#labFrame'), labClose=$('#labClose');
  function openLab(url){
    if(!labModal||!labFrame) return;
    labFrame.innerHTML='<div class="lab-modal__loading" id="labLoading">Loading engine…</div>';
    const ifr=document.createElement('iframe');
    ifr.setAttribute('allow','camera; fullscreen; autoplay');
    ifr.setAttribute('allowfullscreen','');
    ifr.addEventListener('load',()=>{ const l=document.getElementById('labLoading'); if(l) l.remove(); });
    ifr.src=url;
    labFrame.appendChild(ifr);
    labModal.classList.add('open'); document.body.classList.add('noscroll','lab-open');
  }
  function closeLab(){
    if(!labModal) return;
    labModal.classList.remove('open'); labFrame.innerHTML='';
    document.body.classList.remove('noscroll','lab-open');
  }
  $$('[data-lab]').forEach(el=>el.addEventListener('click',e=>{
    e.preventDefault(); openLab(el.getAttribute('href')||'lab/Rubiks%20Cube%20Solver.html');
  }));
  labClose && labClose.addEventListener('click',closeLab);
  addEventListener('keydown',e=>{ if(e.key==='Escape') closeLab(); });

  /* ---- to top ---- */
  $$('.totop').forEach(b=>b.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'})));
})();
