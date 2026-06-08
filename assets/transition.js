/* Shared page transition between portfolio <-> company pages.
   Covers the screen with a themed loader on navigate, reveals on arrival.
   Only triggers for internal .html links so refreshes/first-visits are untouched. */
(function(){
  'use strict';
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ov=document.getElementById('xition');
  if(!ov) return;
  const txt=document.getElementById('xitionTxt');
  const KEY='xition_nav';

  /* arrival reveal (only if we navigated here via a transition) */
  let arriving=false; try{ arriving=sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); }catch(e){}
  document.documentElement.classList.remove('xnav');
  if(arriving){
    ov.classList.add('show');
    if(reduce) ov.classList.remove('show');
    else setTimeout(()=>ov.classList.remove('show'), 580);
  }

  /* leaving: cover then navigate */
  const phrases=['Loading','Streaming assets','Compiling shaders','Initializing'];
  let navigating=false;
  document.addEventListener('click',function(e){
    if(navigating) return;
    const a=e.target.closest('a[href]'); if(!a) return;
    if(a.target==='_blank'||a.hasAttribute('data-nox')) return;
    const href=a.getAttribute('href')||'';
    if(!href||href.charAt(0)==='#'||/^(https?:|mailto:|tel:)/i.test(href)) return;
    if(!/\.html(\?|#|$)/i.test(href)) return;
    e.preventDefault(); navigating=true;
    try{ sessionStorage.setItem(KEY,'1'); }catch(err){}
    if(txt) txt.textContent=phrases[Math.floor(Math.random()*phrases.length)];
    ov.classList.add('show');
    if(reduce){ location.href=href; return; }
    setTimeout(()=>{ location.href=href; }, 600);
  });

  /* restore from bfcache without a stuck overlay */
  addEventListener('pageshow',function(e){ if(e.persisted){ ov.classList.remove('show'); navigating=false; } });
})();
