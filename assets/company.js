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

  /* ============ PRODUCT DATA (live from fab.com/sellers/UEDEV) ============ */
  const MB='https://media.fab.com/image_previews/gallery_images/';
  const LB='https://www.fab.com/listings/';
  const P=[
    {n:'Niagara Energy Beam Pack V2',c:'Weapons',p:'15.99',r:'5.0',rv:6,u:'33f2e177-cd9a-4b4b-b1b2-be231db95296',i:['a63dd0e4-7db8-44eb-9ddb-55e4914ff39d','46de4277-a8f1-4ebf-95ad-b79ca6364644']},
    {n:'Ultimate Explosion VFX',c:'Combat',p:'14.99',r:'5.0',rv:4,u:'2a0dc7ae-23d6-4839-82fd-b9948f486770',i:['065fb827-0f4e-49ae-8a48-71f80ca6c629','94284eb4-d059-4db3-a3e2-e0ef0734be17']},
    {n:'Ultimate Scan & Screen Effects',c:'Combat',p:'12.99',r:'4.8',rv:4,u:'446dea06-546a-4ffc-8252-b709a623c1f5',i:['dc1a29a9-58bd-44e2-a42f-b368b8d6cad9','877787de-287a-4b54-a0de-02e9f1720c99']},
    {n:'Niagara Laser Beam Weapon V3',c:'Weapons',p:'18.99',r:'5.0',rv:2,u:'b776d3d2-5d87-4f8b-8466-d7bbb17ab2a4',i:['bca7e537-40a8-4591-8bff-fd976bed2039','1d50e793-32ed-4727-9af9-c88675714f0b']},
    {n:'Ultimate Action Niagara VFX',c:'Combat',p:'9.99',r:null,rv:0,u:'849e3115-2efd-4f23-99ca-29415e319587',i:['eec4e391-aa5b-4ea7-8a77-e535c740a355','f22a3da7-1e9b-4787-a395-1a3f170f95d1']},
    {n:'Ultimate Character VFX V2',c:'Character',p:'9.99',r:null,rv:0,u:'63810c36-b2f9-4401-8554-c0db33e0db18',i:['46aa1a83-45f9-439d-9545-91e78059cf87','9509b688-e145-4ae8-bcdb-040f5a0f2057']},
    {n:'Ultimate Character VFX',c:'Character',p:'9.99',r:'4.4',rv:5,u:'0c1216fb-ddca-4351-9571-a199b158b420',i:['ad8c95d6-f087-4500-85e3-a7161e0ac6d3','cb1a9c6a-fd03-4bfd-97de-8dccf20d79dd']},
    {n:'Niagara Weapon Muzzle Flash',c:'Weapons',p:'9.99',r:null,rv:0,u:'314ebc33-5fdf-4420-824a-bc6f4f6a0595',i:['efffac1d-6d2e-4b95-8218-b29e918f9eb8','76638dc0-94c6-46bc-83c4-e0a4468c2290']},
    {n:'Ultimate Niagara Environmental VFX V2',c:'Environment',p:'19.99',r:'4.0',rv:3,u:'6db5d306-e208-41c4-9221-f074cf7b2d3b',i:['bf43d093-acad-4b29-a2a1-7af368d7d7e8','f02909d1-0112-447d-b1ec-d173bfaae5fc']},
    {n:'Essential Niagara Environmental VFX',c:'Environment',p:'17.99',r:'4.2',rv:5,u:'e25c0150-ec47-4e9f-a818-8aa9f501c481',i:['eebfcfd0-52dc-4ba1-8389-7e96230d0151','32c23c2e-0cdf-4eaf-839e-06c4d229501f']},
    {n:'Niagara Tornado VFX',c:'Environment',p:'8.99',r:'5.0',rv:1,u:'5df56d5e-cccd-4c1c-b907-0e7007d227f8',i:['0bd0788c-e2fc-41bd-ae82-8ec194464ae5','bdae30b7-db5c-4e1d-b5ac-58a695900a42']},
    {n:'Portal Pack — Niagara VFX',c:'Environment',p:'9.99',r:'4.5',rv:2,u:'089ec99b-9fbb-406c-8442-7912a39553fc',i:['305c9a54-9bdb-4eae-8912-be5a24e0d55f','a7165871-db7b-42ee-b7a5-52c083570fdf']},
    {n:'Advanced Niagara Slash & Trail VFX',c:'Combat',p:'9.99',r:'5.0',rv:1,u:'c1bdd925-e4a6-4eae-a6a7-a39abec1ecbb',i:['c29c56c3-f437-433c-a2a3-f418a528e19f','c969871e-56ad-4f83-895c-907beee75b40']},
    {n:'Advanced Niagara Projectiles VFX',c:'Combat',p:'9.99',r:'3.0',rv:1,u:'6fa94df2-a5df-44a4-89a6-714189c67a38',i:['a85602f9-4f6d-4194-b267-66b373b7a3ea','396f9780-34bc-440a-898b-61701cabde90']},
    {n:'Advanced Shield VFX V2',c:'Combat',p:'9.99',r:'4.0',rv:3,u:'38d01588-777f-4074-b915-4badc5276e76',i:['4310d565-339c-410b-b62e-ccd9247e08f9','675c1382-0f32-4bcf-8628-a1047d55f566']},
    {n:'Shield Pack — Niagara VFX',c:'Combat',p:'9.99',r:null,rv:0,u:'0a07e5c6-1cde-429b-987e-bd79d2d68d76',i:['ae5d6b91-f30f-4d5b-a105-95fe61a9217d','a01dcb83-b8ae-4569-8a2b-c2dc353ca581']},
    {n:'Fire · Impact · Smoke · Spark · Explosion Pack',c:'Packs',p:'15.99',r:'3.8',rv:5,u:'843f3b56-092f-444c-a200-599cf0692c9d',i:['058d3a81-6df4-4a0e-ab18-83f354cc3072','cd78644a-358c-4430-ab8e-8c657a9b8330']},
    {n:'Advanced Niagara Essential VFX Vol:01',c:'Packs',p:'9.99',r:null,rv:0,u:'9fed3f1c-27b1-4371-8ca4-77df38f2b978',i:['1a9c9282-92c5-43ac-bb8b-491e31dc6203','3f40a2cf-7d2c-417c-acde-7e4568bb3edf']},
    {n:'Niagara Essential VFX Vol:02',c:'Packs',p:'9.99',r:'4.0',rv:1,u:'bef35a22-b411-45d6-aad8-360c6d422d51',i:['3a375c22-c45e-4428-9003-b0ee99f74137','675610d9-e9dd-4d46-bda8-8fa160bd33ae']},
    {n:'AnyDetourComponent Plugin',c:'Plugins',p:'4.99',r:null,rv:0,u:'ba4574f2-4549-41a5-99ff-79cb28a8d1cb',i:['792b3e6f-ca0b-4b01-ad13-d614e512fafb','36433c29-8184-423e-9d94-ba957fcc2038']}
  ];
  const CATGRAD={
    Combat:'linear-gradient(135deg,#ff6a3d,#ff3d8b)',
    Weapons:'linear-gradient(135deg,#22e3ff,#9a6bff)',
    Environment:'linear-gradient(135deg,#19d36b,#22e3ff)',
    Character:'linear-gradient(135deg,#9a6bff,#ff3d8b)',
    Packs:'linear-gradient(135deg,#ffcf4d,#ff6a3d)',
    Plugins:'linear-gradient(135deg,#6478ff,#22e3ff)'
  };
  const img=(p)=>MB+p.i[0]+'/'+p.i[1]+'.jpg';
  const url=(p)=>LB+p.u;
  function stars(r){ if(!r) return ''; const n=Math.round(parseFloat(r)); return '<span class="stars">'+'★'.repeat(n)+'☆'.repeat(5-n)+'</span>'; }
  function ratingHtml(p){ return p.r ? '<span class="rating">'+stars(p.r)+p.r+' <span style="color:var(--faint)">('+p.rv+')</span></span>' : '<span class="rating" style="color:var(--faint)">New</span>'; }
  function mediaHtml(p,cls){
    return '<div class="'+cls+'" style="background:'+CATGRAD[p.c]+'">'+
      '<img src="'+img(p)+'" alt="" onerror="this.style.display=\'none\'" />';
  }

  /* ---- render featured (top 3) ---- */
  const featWrap=$('#featured');
  if(featWrap){
    featWrap.innerHTML=P.slice(0,3).map((p,idx)=>(
      '<a class="feat reveal" data-d="'+idx+'" href="'+url(p)+'" target="_blank" rel="noopener">'+
        mediaHtml(p,'feat__media')+
          '<div class="feat__tagrow"><span class="badge best">'+(idx===0?'★ Best Seller':'Top Rated')+'</span><span class="badge">'+p.c+'</span></div>'+
        '</div>'+
        '<div class="feat__body">'+
          '<h3 class="feat__title">'+p.n+'</h3>'+
          '<div class="feat__meta"><span class="price">$'+p.p+'</span>'+ratingHtml(p)+'</div>'+
          '<span class="feat__cta">View on Fab →</span>'+
        '</div>'+
      '</a>'
    )).join('');
  }

  /* ---- render product grid ---- */
  const gridWrap=$('#prodGrid');
  function cardHtml(p){
    return '<a class="card" data-cat="'+p.c+'" href="'+url(p)+'" target="_blank" rel="noopener">'+
      mediaHtml(p,'card__media')+
        '<span class="card__cat">'+p.c+'</span>'+
        '<div class="card__view"><span>View on Fab ↗</span></div>'+
      '</div>'+
      '<div class="card__body">'+
        '<div class="card__title">'+p.n+'</div>'+
        '<div class="card__meta"><span class="price">$'+p.p+'</span>'+ratingHtml(p)+'</div>'+
      '</div>'+
    '</a>';
  }
  if(gridWrap){ gridWrap.innerHTML=P.map(cardHtml).join(''); }

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
    const PAL=['rgba(34,227,255,','rgba(154,107,255,','rgba(255,61,139,'];
    const BG='#05060b';
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
      ctx.fillStyle='rgba(5,6,11,0.075)'; ctx.fillRect(0,0,W,H); // trails
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
