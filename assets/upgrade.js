/* ============================================================
   UEDEV — v2 interactions
   scroll marquee · char-reveal text · sticky card stack · magnet
   ============================================================ */
(function(){
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  /* ---- product previews, self-hosted in assets/store (tools/media/store-images.mjs) ---- */
  const SHOTS=[
    ['energy-beam-v2','Energy Beams'],
    ['explosion','Explosions'],
    ['scan-screen','Scan FX'],
    ['laser-beam-v3','Laser Weapon'],
    ['action','Action VFX'],
    ['character-v2','Character VFX'],
    ['muzzle-flash','Muzzle Flash'],
    ['environmental-v2','Environment'],
    ['environmental','Essential Env'],
    ['tornado','Tornado'],
    ['portal','Portals'],
    ['slash-trail','Slash Trails'],
    ['projectiles','Projectiles'],
    ['shield-v2','Shields V2'],
    ['shield-pack','Shield Pack'],
    ['essential-pack','Impact Pack'],
    ['essential-vol1','Essential Vol 1'],
    ['essential-vol2','Essential Vol 2'],
    ['anydetour','Detour Plugin'],
    ['energy-beam-v2','Beam Pack V2']
  ];
  const shotUrl=(s)=>'/assets/store/'+s[0]+'.webp';

  /* ---- scroll marquee: two rows drifting opposite ways ---- */
  (function marquee(){
    const sec=$('#mrq'); if(!sec) return;
    const r1=$('#mrqA'), r2=$('#mrqB');
    const a=SHOTS.slice(0,10), b=SHOTS.slice(10);
    const tile=(s)=>'<div class="mrq__tile"><img src="'+shotUrl(s)+'" alt="'+s[1]+' — Unreal Engine asset by UEDEV" width="639" height="349" loading="lazy" decoding="async" /><span>'+s[1]+'</span></div>';
    r1.innerHTML=[...a,...a,...a].map(tile).join('');
    r2.innerHTML=[...b,...b,...b].map(tile).join('');
    if(reduce) return;
    let ticking=false;
    function upd(){
      // rect-based so the band can be nested inside a positioned parent
      const off=(innerHeight-sec.getBoundingClientRect().top)*0.28;
      r1.style.transform='translateX('+(off-460)+'px)';
      r2.style.transform='translateX('+(-(off-460))+'px)';
      ticking=false;
    }
    addEventListener('scroll',()=>{ if(!ticking){ ticking=true; requestAnimationFrame(upd); } },{passive:true});
    addEventListener('resize',upd,{passive:true});
    upd();
  })();

  /* ---- character-by-character scroll reveal ---- */
  (function chars(){
    const els=$$('[data-chars]'); if(!els.length) return;
    els.forEach(el=>{
      const txt=el.textContent;
      el.textContent='';
      el.classList.add('chars');
      for(const ch of txt){
        const s=document.createElement('span');
        s.textContent=ch;
        el.appendChild(s);
      }
    });
    function upd(){
      for(const el of els){
        const spans=el.children, n=spans.length;
        const r=el.getBoundingClientRect();
        // progress: 0 when the block's top hits 80% of viewport, 1 near the top
        const p=clamp((innerHeight*0.85-r.top)/(r.height+innerHeight*0.45),0,1);
        const lit=p*n;
        for(let i=0;i<n;i++) spans[i].style.opacity = i<lit ? 1 : 0.2;
      }
    }
    let t=false;
    addEventListener('scroll',()=>{ if(!t){ t=true; requestAnimationFrame(()=>{ upd(); t=false; }); } },{passive:true});
    addEventListener('resize',upd,{passive:true});
    upd();
    setTimeout(upd,400);
  })();

  /* ---- sticky card stack: each card scales down as the next covers it ---- */
  (function stack(){
    const items=$$('.stack__item'); if(!items.length||reduce) return;
    if(innerWidth<=960) return;
    const total=items.length;
    function upd(){
      items.forEach((item,i)=>{
        const card=item.querySelector('.stackcard'); if(!card) return;
        const target=1-(total-1-i)*0.04;
        const r=item.getBoundingClientRect();
        // how far this card has been scrolled past its sticky point
        const p=clamp((-r.top+96)/(innerHeight*0.9),0,1);
        const scale=1-(1-target)*p;
        card.style.transform='scale('+scale.toFixed(4)+')';
        card.style.opacity=(1-p*0.25).toFixed(3);
      });
    }
    let t=false;
    addEventListener('scroll',()=>{ if(!t){ t=true; requestAnimationFrame(()=>{ upd(); t=false; }); } },{passive:true});
    addEventListener('resize',upd,{passive:true});
    upd();
  })();

  /* ---- LCM Nav3D reel: autoplay muted while on screen, sound on demand ---- */
  (function reel(){
    const v=$('#nav3dReel'); if(!v) return;
    const btn=$('#nav3dSound');
    v.muted=true;
    let started=false;
    function vis(){
      const r=v.getBoundingClientRect();
      const on=r.top<innerHeight*0.9&&r.bottom>innerHeight*0.1;
      if(on){ if(!started){ started=true; } const p=v.play(); if(p&&p.catch) p.catch(()=>{}); }
      else if(started&&!v.paused) v.pause();
    }
    let t=false;
    addEventListener('scroll',()=>{ if(!t){ t=true; requestAnimationFrame(()=>{ vis(); t=false; }); } },{passive:true});
    addEventListener('resize',vis,{passive:true});
    vis(); setTimeout(vis,600);
    btn&&btn.addEventListener('click',()=>{
      v.muted=!v.muted;
      btn.textContent=v.muted?'\uD83D\uDD07 Unmute':'\uD83D\uDD0A Mute';
      if(!v.muted){ const p=v.play(); if(p&&p.catch) p.catch(()=>{}); }
    });
  })();

  /* ---- magnetic buttons ---- */
  if(fine&&!reduce&&innerWidth>960){
    $$('[data-magnet]').forEach(el=>{
      const strength=3;
      el.addEventListener('mousemove',e=>{
        const r=el.getBoundingClientRect();
        const x=(e.clientX-r.left-r.width/2)/strength;
        const y=(e.clientY-r.top-r.height/2)/strength;
        el.style.transition='transform .3s ease-out';
        el.style.transform='translate3d('+x+'px,'+y+'px,0)';
      });
      el.addEventListener('mouseleave',()=>{
        el.style.transition='transform .6s ease-in-out';
        el.style.transform='translate3d(0,0,0)';
      });
    });
  }
})();
