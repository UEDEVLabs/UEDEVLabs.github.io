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

  /* ---- product images shared with company.js data ---- */
  const MB='https://media.fab.com/image_previews/gallery_images/';
  const SHOTS=[
    ['a63dd0e4-7db8-44eb-9ddb-55e4914ff39d','46de4277-a8f1-4ebf-95ad-b79ca6364644','Energy Beams'],
    ['065fb827-0f4e-49ae-8a48-71f80ca6c629','94284eb4-d059-4db3-a3e2-e0ef0734be17','Explosions'],
    ['dc1a29a9-58bd-44e2-a42f-b368b8d6cad9','877787de-287a-4b54-a0de-02e9f1720c99','Scan FX'],
    ['bca7e537-40a8-4591-8bff-fd976bed2039','1d50e793-32ed-4727-9af9-c88675714f0b','Laser Weapon'],
    ['eec4e391-aa5b-4ea7-8a77-e535c740a355','f22a3da7-1e9b-4787-a395-1a3f170f95d1','Action VFX'],
    ['46aa1a83-45f9-439d-9545-91e78059cf87','9509b688-e145-4ae8-bcdb-040f5a0f2057','Character VFX'],
    ['efffac1d-6d2e-4b95-8218-b29e918f9eb8','76638dc0-94c6-46bc-83c4-e0a4468c2290','Muzzle Flash'],
    ['bf43d093-acad-4b29-a2a1-7af368d7d7e8','f02909d1-0112-447d-b1ec-d173bfaae5fc','Environment'],
    ['eebfcfd0-52dc-4ba1-8389-7e96230d0151','32c23c2e-0cdf-4eaf-839e-06c4d229501f','Essential Env'],
    ['0bd0788c-e2fc-41bd-ae82-8ec194464ae5','bdae30b7-db5c-4e1d-b5ac-58a695900a42','Tornado'],
    ['305c9a54-9bdb-4eae-8912-be5a24e0d55f','a7165871-db7b-42ee-b7a5-52c083570fdf','Portals'],
    ['c29c56c3-f437-433c-a2a3-f418a528e19f','c969871e-56ad-4f83-895c-907beee75b40','Slash Trails'],
    ['a85602f9-4f6d-4194-b267-66b373b7a3ea','396f9780-34bc-440a-898b-61701cabde90','Projectiles'],
    ['4310d565-339c-410b-b62e-ccd9247e08f9','675c1382-0f32-4bcf-8628-a1047d55f566','Shields V2'],
    ['ae5d6b91-f30f-4d5b-a105-95fe61a9217d','a01dcb83-b8ae-4569-8a2b-c2dc353ca581','Shield Pack'],
    ['058d3a81-6df4-4a0e-ab18-83f354cc3072','cd78644a-358c-4430-ab8e-8c657a9b8330','Impact Pack'],
    ['1a9c9282-92c5-43ac-bb8b-491e31dc6203','3f40a2cf-7d2c-417c-acde-7e4568bb3edf','Essential Vol 1'],
    ['3a375c22-c45e-4428-9003-b0ee99f74137','675610d9-e9dd-4d46-bda8-8fa160bd33ae','Essential Vol 2'],
    ['792b3e6f-ca0b-4b01-ad13-d614e512fafb','36433c29-8184-423e-9d94-ba957fcc2038','Detour Plugin'],
    ['a63dd0e4-7db8-44eb-9ddb-55e4914ff39d','46de4277-a8f1-4ebf-95ad-b79ca6364644','Beam Pack V2']
  ];
  const shotUrl=(s)=>MB+s[0]+'/'+s[1]+'.jpg';

  /* ---- scroll marquee: two rows drifting opposite ways ---- */
  (function marquee(){
    const sec=$('#mrq'); if(!sec) return;
    const r1=$('#mrqA'), r2=$('#mrqB');
    const a=SHOTS.slice(0,10), b=SHOTS.slice(10);
    const tile=(s)=>'<div class="mrq__tile"><img src="'+shotUrl(s)+'" alt="'+s[2]+' — Unreal Engine asset by UEDEV" /><span>'+s[2]+'</span></div>';
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
