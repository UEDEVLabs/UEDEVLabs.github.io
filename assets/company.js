/* ============================================================
   UEDEV company page — particle engine + storefront logic
   ============================================================ */
(function(){
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- transition-support probe (some preview iframes freeze CSS transitions) ---- */
  (function probe(){
    const p=document.createElement('div');
    p.style.cssText='position:fixed;left:-9999px;top:0;width:8px;height:8px;opacity:0;transition:opacity .25s linear';
    document.body.appendChild(p);
    requestAnimationFrame(()=>{ p.style.opacity='1'; });
    setTimeout(()=>{ if((parseFloat(getComputedStyle(p).opacity)||0)<0.5) document.documentElement.classList.add('no-anim'); p.remove(); },450);
  })();

  /* ============ PRODUCT GRID ============
     The cards are static HTML, rendered from data/products.json by tools/site/build.mjs,
     so crawlers and AI agents see every product. This only drives the filters. */
  const gridWrap=$('#prodGrid');

  /* ---- filters ---- */
  $$('.filter').forEach(f=>f.addEventListener('click',()=>{
    $$('.filter').forEach(x=>x.classList.remove('active')); f.classList.add('active');
    const cat=f.dataset.filter;
    $$('.card',gridWrap).forEach(c=>c.classList.toggle('hide', !(cat==='all'||c.dataset.cat===cat)));
  }));

  /* ============ ROTATING HEADLINE (text scramble) ============ */
  (function rotateHeadline(){
    const el=$('#rotw'); if(!el||reduce) return;
    const words=['performance.','real-time.','shipping games.','frame-rate.','scale.','60 FPS.','the engine.'];
    const chars='!<>-_\\/[]{}=+*^?#%$&01';
    let idx=0;
    function setText(next){
      return new Promise(res=>{
        const old=el.textContent, len=Math.max(old.length,next.length), q=[];
        for(let i=0;i<len;i++){
          const start=Math.floor(Math.random()*28), end=start+10+Math.floor(Math.random()*28);
          q.push({from:old[i]||'',to:next[i]||'',start,end,c:null});
        }
        let frame=0;
        (function up(){
          let out='',done=0;
          for(const it of q){
            if(frame>=it.end){ done++; out+=it.to; }
            else if(frame>=it.start){ if(!it.c||Math.random()<0.3) it.c=chars[Math.floor(Math.random()*chars.length)]; out+=it.c; }
            else out+=it.from;
          }
          el.textContent=out;
          if(done===q.length) res(); else { frame++; requestAnimationFrame(up); }
        })();
      });
    }
    (async function loop(){
      // small initial pause so the static word reads first
      await new Promise(r=>setTimeout(r,1800));
      while(true){
        idx=(idx+1)%words.length;
        await setText(words[idx]);
        await new Promise(r=>setTimeout(r,2200));
      }
    })();
  })();

  /* ============ FLOW-FIELD BACKGROUND (live simulation feel) ============ */
  (function flowfield(){
    const cv=$('#fx'); if(!cv) return;
    const ctx=cv.getContext('2d');
    let W=0,H=0,dpr=Math.min(devicePixelRatio||1,2),parts=[],t=0,raf;
    const PAL=['rgba(47,224,106,','rgba(16,201,176,','rgba(200,255,94,'];
    const BG='#050705';
    function field(x,y){
      return (Math.sin(x*0.0021+t)+Math.cos(y*0.0026-t*0.8)+Math.sin((x+y)*0.0015+t*0.55))*Math.PI;
    }
    function resize(){
      const r=cv.getBoundingClientRect(); W=r.width; H=r.height;
      cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
      const N=Math.min(900,Math.round(W*H/1400));
      parts=[];
      for(let i=0;i<N;i++) parts.push({x:Math.random()*W,y:Math.random()*H,ci:i%3,life:30+Math.random()*150});
      ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);
    }
    const mouse={x:-9999,y:-9999};
    addEventListener('mousemove',e=>{ const r=cv.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; },{passive:true});
    addEventListener('mouseleave',()=>{ mouse.x=mouse.y=-9999; });
    function step(){
      t+=0.0016;
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle='rgba(5,7,5,0.075)'; ctx.fillRect(0,0,W,H); // trails
      ctx.globalCompositeOperation='lighter'; ctx.lineWidth=1.15;
      for(const p of parts){
        const a=field(p.x,p.y);
        let vx=Math.cos(a)*1.25, vy=Math.sin(a)*1.25;
        const dx=p.x-mouse.x, dy=p.y-mouse.y, d2=dx*dx+dy*dy;
        if(d2<26000){ const f=(1-d2/26000)*2.6, inv=1/Math.sqrt(d2+1); vx+=dx*inv*f; vy+=dy*inv*f; }
        const nx=p.x+vx, ny=p.y+vy;
        ctx.strokeStyle=PAL[p.ci]+'0.5)';
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(nx,ny); ctx.stroke();
        p.x=nx; p.y=ny; p.life--;
        if(p.x<-5||p.x>W+5||p.y<-5||p.y>H+5||p.life<0){ p.x=Math.random()*W; p.y=Math.random()*H; p.life=30+Math.random()*150; }
      }
      ctx.globalCompositeOperation='source-over';
    }
    function frame(){ step(); raf=requestAnimationFrame(frame); }
    resize();
    addEventListener('resize',()=>{ cancelAnimationFrame(raf); resize(); if(!reduce) raf=requestAnimationFrame(frame); else { for(let i=0;i<160;i++) step(); } });
    if(reduce){ for(let i=0;i<200;i++) step(); } else raf=requestAnimationFrame(frame);
  })();

  /* ============ REVEAL / COUNTERS / NAV ============ */
  const reveals=$$('.reveal'), counters=$$('[data-count]');
  function inView(el,frac){ const r=el.getBoundingClientRect(); return r.top<innerHeight*(frac||.9)&&r.bottom>0; }
  function animateCount(el){
    if(el.dataset.done) return; el.dataset.done='1';
    const target=+el.dataset.count, dur=1500, start=performance.now(), suf=el.dataset.suffix||'';
    (function step(t){ const p=Math.min((t-start)/dur,1), e=1-Math.pow(1-p,3); el.textContent=Math.round(target*e)+suf; if(p<1)requestAnimationFrame(step); })(start);
  }
  function check(){
    reveals.forEach(el=>{ if(!el.classList.contains('in')&&inView(el)) el.classList.add('in'); });
    counters.forEach(el=>{ if(inView(el,.95)) animateCount(el); });
  }
  const nav=$('.nav'), progress=$('#progress'), sections=$$('section[id]'), navLinks=$$('.nav__links a');
  function onScroll(){
    const y=scrollY;
    nav.classList.toggle('scrolled',y>30);
    const h=document.documentElement.scrollHeight-innerHeight;
    progress.style.width=(h>0?y/h*100:0)+'%';
    let cur=''; sections.forEach(s=>{ if(y>=s.offsetTop-160)cur=s.id; });
    navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+cur));
    check();
  }
  addEventListener('scroll',onScroll,{passive:true});
  addEventListener('resize',check,{passive:true});
  onScroll();
  let ticks=0; (function warm(){ check(); if(ticks++<120) requestAnimationFrame(warm); })();
  setTimeout(()=>{ reveals.forEach(el=>el.classList.add('in')); counters.forEach(animateCount); },2600);

  /* mobile menu */
  const burger=$('.burger');
  burger && burger.addEventListener('click',()=>nav.classList.toggle('open'));
  $$('.nav__links a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
})();
