/* ============================================================
   Charitha Portfolio — game-flavored interactions
   boot loader · reticle cursor · hero parallax · card tilt ·
   magnetic buttons · Konami easter egg
   ============================================================ */
(function(){
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  const lerp=(a,b,n)=>a+(b-a)*n;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  /* ---------------- BOOT / LOADING ---------------- */
  (function boot(){
    const boot=$('#boot'); if(!boot) return;
    const fill=$('#bootFill'), txt=$('#bootTxt');
    function finish(){
      if(boot.classList.contains('done')) return;
      boot.classList.add('done');
      document.body.classList.add('ready');
      try{ sessionStorage.setItem('cm_booted','1'); }catch(e){}
      setTimeout(()=>{ boot.style.display='none'; }, 650);
    }
    let skipped=false;
    const skip=$('#bootSkip');
    skip && skip.addEventListener('click',()=>{ skipped=true; finish(); });
    // already booted this session, or reduced motion → skip the show
    let booted=false; try{ booted=sessionStorage.getItem('cm_booted'); }catch(e){}
    if(booted || reduce){ boot.style.transition='none'; finish(); return; }
    // JS-driven progress (resilient to frozen CSS transitions)
    const msgs=['Initializing engine','Loading assets','Compiling shaders','Spawning world','Ready'];
    const start=performance.now(), dur=1500;
    function step(now){
      if(skipped) return;
      const p=clamp((now-start)/dur,0,1);
      if(fill) fill.style.width=(p*100).toFixed(1)+'%';
      const mi=Math.min(msgs.length-1,Math.floor(p*msgs.length));
      if(txt) txt.firstChild ? txt.childNodes[0].nodeValue=msgs[mi] : txt.textContent=msgs[mi];
      if(p<1) requestAnimationFrame(step); else setTimeout(finish,180);
    }
    requestAnimationFrame(step);
    setTimeout(finish,2600); // hard safety
  })();

  /* ---------------- RETICLE CURSOR ---------------- */
  if(fine && !reduce){
    document.body.classList.add('cursor-on');
    const ring=$('.cursor'), dot=$('.cursor-dot');
    let mx=innerWidth/2, my=innerHeight/2, rx=mx, ry=my, active=false;
    addEventListener('mousemove',e=>{
      mx=e.clientX; my=e.clientY;
      if(!active){ active=true; document.body.classList.add('ready'); }
      dot.style.transform='translate('+mx+'px,'+my+'px)';
    },{passive:true});
    addEventListener('mouseleave',()=>document.body.classList.remove('ready'));
    addEventListener('mouseenter',()=>document.body.classList.add('ready'));
    (function loop(){
      rx=lerp(rx,mx,0.2); ry=lerp(ry,my,0.2);
      ring.style.transform='translate('+rx+'px,'+ry+'px)';
      requestAnimationFrame(loop);
    })();
    const hot='a,button,.card,.devcard,.filter,input,textarea,[data-vid],.cline,.social,.chip,.engine,.edu';
    document.addEventListener('mouseover',e=>{ if(e.target.closest(hot)) document.body.classList.add('hovering'); });
    document.addEventListener('mouseout',e=>{ if(e.target.closest(hot) && !e.relatedTarget?.closest?.(hot)) document.body.classList.remove('hovering'); });
  }

  /* ---------------- HERO PARALLAX ---------------- */
  if(fine && !reduce){
    const hero=$('.hero'), bg=$('.hero__bg'), emb=$('.embers'), h1=$('.hero h1'), eye=$('.eyebrow');
    if(hero){
      let tx=0,ty=0,cx=0,cy=0,inside=false;
      hero.addEventListener('mousemove',e=>{
        const r=hero.getBoundingClientRect();
        tx=((e.clientX-r.left)/r.width-0.5);
        ty=((e.clientY-r.top)/r.height-0.5);
        inside=true;
      },{passive:true});
      hero.addEventListener('mouseleave',()=>{ tx=0; ty=0; });
      (function loop(){
        cx=lerp(cx,tx,0.06); cy=lerp(cy,ty,0.06);
        if(bg) bg.style.transform='translate('+(cx*-26)+'px,'+(cy*-18)+'px) scale(1.06)';
        if(emb) emb.style.transform='translate('+(cx*16)+'px,'+(cy*12)+'px)';
        if(h1) h1.style.transform='translate('+(cx*10)+'px,'+(cy*7)+'px)';
        if(eye) eye.style.transform='translate('+(cx*16)+'px,'+(cy*10)+'px)';
        requestAnimationFrame(loop);
      })();
    }
  }

  /* ---------------- 3D CARD TILT ---------------- */
  if(fine && !reduce){
    function tilt(el,max){
      let raf=null;
      el.addEventListener('mousemove',e=>{
        const r=el.getBoundingClientRect();
        const px=(e.clientX-r.left)/r.width-0.5;
        const py=(e.clientY-r.top)/r.height-0.5;
        if(raf) cancelAnimationFrame(raf);
        raf=requestAnimationFrame(()=>{
          el.style.transition='transform .05s linear';
          el.style.transform='perspective(800px) rotateY('+(px*max)+'deg) rotateX('+(-py*max)+'deg) translateZ(0)'+(el.dataset.lift||'');
        });
      });
      el.addEventListener('mouseenter',()=>{ if(el.classList.contains('devcard')) el.dataset.lift=' translateY(-5px)'; });
      el.addEventListener('mouseleave',()=>{
        el.style.transition='transform .5s var(--ease)';
        el.style.transform='';
      });
    }
    // only enable above the mobile breakpoint
    if(innerWidth>960){
      $$('.card').forEach(c=>tilt(c,7));
      $$('.devcard').forEach(c=>tilt(c,5));
    }
  }

  /* ---------------- MAGNETIC BUTTONS ---------------- */
  if(fine && !reduce && innerWidth>960){
    $$('.btn, .nav__cta').forEach(btn=>{
      btn.addEventListener('mousemove',e=>{
        const r=btn.getBoundingClientRect();
        const x=(e.clientX-r.left-r.width/2);
        const y=(e.clientY-r.top-r.height/2);
        btn.style.transform='translate('+(x*0.28)+'px,'+(y*0.4)+'px)';
      });
      btn.addEventListener('mouseleave',()=>{ btn.style.transform=''; });
    });
  }

  /* ---------------- EMBER SHOWER (easter-egg fx) ---------------- */
  function emberShower(){
    const layer=document.createElement('div');
    layer.style.cssText='position:fixed;inset:0;z-index:380;pointer-events:none;overflow:hidden';
    document.body.appendChild(layer);
    const acc=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#ff8a3d';
    for(let i=0;i<46;i++){
      const e=document.createElement('span');
      const s=3+Math.random()*5, x=Math.random()*100, dur=2.2+Math.random()*2.6, delay=Math.random()*1.4;
      e.style.cssText='position:absolute;top:-20px;left:'+x+'%;width:'+s+'px;height:'+s+'px;border-radius:50%;background:'+acc+';box-shadow:0 0 10px 2px '+acc+';opacity:.9';
      e.animate([{transform:'translateY(-20px)',opacity:1},{transform:'translateY('+(innerHeight+60)+'px)',opacity:0}],{duration:dur*1000,delay:delay*1000,easing:'cubic-bezier(.3,.1,.5,1)'});
      layer.appendChild(e);
    }
    setTimeout(()=>layer.remove(),5200);
  }

  /* ---------------- KONAMI CODE ---------------- */
  (function konami(){
    const seq=['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
    let i=0;
    function showToast(title){
      const t=$('#toast'), tt=$('#toastT'); if(!t) return;
      if(tt) tt.textContent=title;
      t.classList.add('show');
      clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),4200);
    }
    addEventListener('keydown',e=>{
      const k=(e.key||'').toLowerCase();
      if(k===seq[i]){ i++; if(i===seq.length){ i=0; emberShower(); showToast('Konami Master'); } }
      else { i=(k===seq[0])?1:0; }
    });
    // expose for the logo easter egg too
    window.__cmToast=showToast; window.__cmShower=emberShower;
  })();

  /* ---------------- LOGO CLICK EASTER EGG ---------------- */
  (function logoEgg(){
    const logo=$('.nav .logo'); if(!logo) return;
    let n=0, last=0;
    logo.addEventListener('click',()=>{
      const now=Date.now(); if(now-last>800) n=0; last=now; n++;
      if(n>=5){ n=0; window.__cmShower && window.__cmShower(); window.__cmToast && window.__cmToast('Easter Egg Hunter'); }
    });
  })();
})();
