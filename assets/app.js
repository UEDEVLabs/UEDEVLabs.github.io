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

  /* ---- fullscreen menu ---- */
  const burger=$('#burger'), menu=$('#menu'), menuX=$('#menuX');
  function setMenu(open){
    if(!menu) return;
    menu.classList.toggle('open',open);
    document.body.classList.toggle('noscroll',open);
    if(burger) burger.setAttribute('aria-expanded',open?'true':'false');
  }
  burger && burger.addEventListener('click',()=>setMenu(!menu.classList.contains('open')));
  menuX && menuX.addEventListener('click',()=>setMenu(false));
  $$('.menu__body a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  addEventListener('keydown',e=>{ if(e.key==='Escape') setMenu(false); });

  /* ---- hero background film ----
     Default: a cinematic crossfade of local game stills (no third-party
     embeds, so it can never be blocked). To use a real showreel instead,
     drop the file in assets/ and set data-src="assets/showreel.mp4" on
     #heroVid in portfolio.html — a local file always wins. */
  (function heroFilm(){
    const v=$('#heroVid'), bg=$('#heroBg');
    const src=v?(v.dataset.src||'').trim():'';
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(src&&!reduced){
      v.addEventListener('loadeddata',()=>{ v.classList.add('on'); const p=v.play(); if(p&&p.catch) p.catch(()=>{}); },{once:true});
      v.addEventListener('error',()=>{ v.remove(); },{once:true});
      v.src=src; v.load();
      return;
    }
    v&&v.remove();
    if(!bg||reduced) return;
    const shots=['portfolio-1.jpg','portfolio-8.jpg','portfolio-2.jpg','portfolio-5.jpg','portfolio-4.jpg','portfolio-6.jpg'];
    bg.classList.add('slides');
    const layers=shots.map((s,i)=>{
      const d=document.createElement('div');
      d.className='hero__slide';
      d.style.backgroundImage="url('assets/img/"+s+"')";
      if(i===0) d.classList.add('on');
      bg.appendChild(d);
      return d;
    });
    let i=0;
    setInterval(()=>{
      layers[i].classList.remove('on');
      i=(i+1)%layers.length;
      layers[i].classList.add('on');
    },5200);
  })();

  /* hero intro animations run once the boot overlay lifts; hard safety net */
  setTimeout(()=>document.body.classList.add('ready'),3000);

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

  /* ---- contact form ----
     Sends for real when the form's data-endpoint is filled in. Accepts either a
     Web3Forms access key (free, no signup: web3forms.com) or a full form URL
     from Formspree / Getform / Basin. Empty = demo mode, validates only. */
  const form=$('#contactForm');
  if(form){
    const okBox=$('.form__ok',form), errBox=$('#contactErr'), sendBtn=$('#contactSend');
    const sendLabel=sendBtn?sendBtn.textContent:'';
    function flash(el,msg){
      if(!el) return;
      if(msg) el.textContent=msg;
      el.classList.add('show');
      clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),6000);
    }
    function validate(){
      let ok=true;
      $$('.field',form).forEach(fl=>{
        const inp=$('input,textarea',fl); if(!inp||!inp.hasAttribute('required')) return;
        let bad=!inp.value.trim();
        if(inp.type==='email' && inp.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inp.value)) bad=true;
        fl.classList.toggle('err',bad); if(bad) ok=false;
      });
      return ok;
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      errBox&&errBox.classList.remove('show');
      if(!validate()) return;
      if(form.botcheck && form.botcheck.value) return; // honeypot: silently drop bots

      const cfg=(form.dataset.endpoint||'').trim();
      const data={
        name:form.name.value.trim(),
        email:form.email.value.trim(),
        subject:form.subject.value.trim()||'New enquiry from your portfolio',
        message:form.message.value.trim(),
        from_name:'Portfolio contact form'
      };

      // no endpoint configured yet -> keep the old demo behaviour
      if(!cfg){ form.reset(); flash(okBox); return; }

      const isUrl=/^https?:\/\//i.test(cfg);
      const url=isUrl?cfg:'https://api.web3forms.com/submit';
      if(!isUrl) data.access_key=cfg;

      sendBtn&&(sendBtn.disabled=true,sendBtn.textContent='Sending…');
      try{
        const res=await fetch(url,{
          method:'POST',
          headers:{'Content-Type':'application/json',Accept:'application/json'},
          body:JSON.stringify(data)
        });
        let body={}; try{ body=await res.json(); }catch(err){}
        if(res.ok && body.success!==false && !body.error){
          form.reset(); flash(okBox);
        }else{
          flash(errBox, (body && (body.message||body.error)) || 'Could not send right now — please email charith945@gmail.com.');
        }
      }catch(err){
        flash(errBox,'Network error — please email charith945@gmail.com.');
      }finally{
        sendBtn&&(sendBtn.disabled=false,sendBtn.textContent=sendLabel);
      }
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
  // Cube solver (in the iframe) asks to go back to the portfolio.
  addEventListener('message',e=>{ if(e.data && e.data.type==='lab-back') closeLab(); });

  /* ---- to top ---- */
  $$('.totop').forEach(b=>b.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'})));
})();
