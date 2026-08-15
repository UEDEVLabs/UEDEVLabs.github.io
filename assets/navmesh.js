/* ============================================================
   UEDEV — hero "live 3D navigation" visualization
   Voxel grid + A* solve + agent traversal, drawn in isometric 3D.
   Doubles as a demo of the 3D Navigation plugin.
   ============================================================ */
(function(){
  'use strict';
  const cv=document.getElementById('navfx'); if(!cv) return;
  const ctx=cv.getContext('2d');
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

  const CY='47,224,106', VI='16,201,176', MA='200,255,94';
  let W=0,H=0,dpr=Math.min(devicePixelRatio||1,2);
  let COLS=26,ROWS=18,tw=44,th=22,ox=0,oy=0;
  let blocked=[],path=[],agent=0,solveT=0,goal=null,start=null,raf=null;
  const mouse={x:0,y:0,tx:0,ty:0};

  const idx=(x,y)=>y*COLS+x;
  const inGrid=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;

  function project(x,y,z){
    return { x: ox+(x-y)*tw/2, y: oy+(x+y)*th/2 - (z||0)*14 };
  }

  function buildGrid(){
    blocked=new Array(COLS*ROWS).fill(0);
    // scatter voxel "obstacle" clusters, keeping the field mostly traversable
    const clusters=Math.round(COLS*ROWS/34);
    for(let c=0;c<clusters;c++){
      const cx=1+Math.floor(Math.random()*(COLS-2)), cy=1+Math.floor(Math.random()*(ROWS-2));
      const n=1+Math.floor(Math.random()*3);
      for(let k=0;k<n;k++){
        const bx=cx+Math.floor(Math.random()*2), by=cy+Math.floor(Math.random()*2);
        if(inGrid(bx,by)) blocked[idx(bx,by)]=1+Math.floor(Math.random()*2);
      }
    }
  }

  function freeCell(){
    for(let i=0;i<200;i++){
      const x=Math.floor(Math.random()*COLS), y=Math.floor(Math.random()*ROWS);
      if(!blocked[idx(x,y)]) return {x,y};
    }
    return {x:0,y:0};
  }

  /* ---- A* over the voxel field (8-way, diagonal-safe) ---- */
  function solve(a,b){
    const N=COLS*ROWS, open=[idx(a.x,a.y)];
    const g=new Float64Array(N).fill(Infinity), f=new Float64Array(N).fill(Infinity);
    const from=new Int32Array(N).fill(-1), closed=new Uint8Array(N);
    const hx=(x,y)=>Math.hypot(x-b.x,y-b.y);
    g[idx(a.x,a.y)]=0; f[idx(a.x,a.y)]=hx(a.x,a.y);
    while(open.length){
      let bi=0; for(let i=1;i<open.length;i++) if(f[open[i]]<f[open[bi]]) bi=i;
      const cur=open.splice(bi,1)[0];
      const cx=cur%COLS, cy=(cur-cx)/COLS;
      if(cx===b.x&&cy===b.y){
        const out=[]; let n=cur;
        while(n!==-1){ out.push({x:n%COLS,y:(n-n%COLS)/COLS}); n=from[n]; }
        return out.reverse();
      }
      closed[cur]=1;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy) continue;
        const nx=cx+dx, ny=cy+dy;
        if(!inGrid(nx,ny)) continue;
        const ni=idx(nx,ny);
        if(closed[ni]||blocked[ni]) continue;
        if(dx&&dy&&(blocked[idx(cx+dx,cy)]||blocked[idx(cx,cy+dy)])) continue; // no corner cutting
        const ng=g[cur]+((dx&&dy)?1.414:1);
        if(ng<g[ni]){
          g[ni]=ng; f[ni]=ng+hx(nx,ny); from[ni]=cur;
          if(open.indexOf(ni)===-1) open.push(ni);
        }
      }
    }
    return [];
  }

  function newRoute(){
    start=goal?goal:freeCell();
    let tries=0;
    do { goal=freeCell(); tries++; }
    while(tries<12 && Math.hypot(goal.x-start.x,goal.y-start.y)<Math.min(COLS,ROWS)*0.55);
    path=solve(start,goal);
    if(!path.length){ buildGrid(); path=solve(start,goal); }
    agent=0; solveT=0;
  }

  function resize(){
    const r=cv.getBoundingClientRect(); W=r.width; H=r.height;
    cv.width=Math.max(1,W*dpr); cv.height=Math.max(1,H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    COLS=Math.max(14,Math.min(34,Math.round(W/54)));
    ROWS=Math.max(10,Math.min(24,Math.round(H/40)));
    tw=(W*1.5)/COLS; th=tw*0.5;
    ox=W/2; oy=H/2-(COLS+ROWS)*th/4;
    buildGrid(); goal=null; newRoute();
  }

  function tile(x,y,fill,stroke,lw){
    const a=project(x,y),b=project(x+1,y),c=project(x+1,y+1),d=project(x,y+1);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath();
    if(fill){ ctx.fillStyle=fill; ctx.fill(); }
    if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=lw||1; ctx.stroke(); }
  }

  function block(x,y,hgt){
    const top=[project(x,y,hgt),project(x+1,y,hgt),project(x+1,y+1,hgt),project(x,y+1,hgt)];
    const bl=project(x,y+1,0), br=project(x+1,y+1,0), rr=project(x+1,y,0);
    ctx.beginPath(); ctx.moveTo(top[3].x,top[3].y); ctx.lineTo(top[2].x,top[2].y); ctx.lineTo(br.x,br.y); ctx.lineTo(bl.x,bl.y); ctx.closePath();
    ctx.fillStyle='rgba(10,26,17,0.92)'; ctx.fill();
    ctx.strokeStyle='rgba('+VI+',0.34)'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(top[1].x,top[1].y); ctx.lineTo(top[2].x,top[2].y); ctx.lineTo(br.x,br.y); ctx.lineTo(rr.x,rr.y); ctx.closePath();
    ctx.fillStyle='rgba(7,20,13,0.95)'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(top[0].x,top[0].y); ctx.lineTo(top[1].x,top[1].y); ctx.lineTo(top[2].x,top[2].y); ctx.lineTo(top[3].x,top[3].y); ctx.closePath();
    ctx.fillStyle='rgba(20,52,34,0.95)'; ctx.fill();
    ctx.strokeStyle='rgba('+VI+',0.6)'; ctx.stroke();
  }

  function marker(p,z,col,r){
    const s=project(p.x+0.5,p.y+0.5,z);
    const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,r*4);
    g.addColorStop(0,'rgba('+col+',0.85)'); g.addColorStop(1,'rgba('+col+',0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(s.x,s.y,r*4,0,7); ctx.fill();
    ctx.fillStyle='rgba('+col+',1)'; ctx.beginPath(); ctx.arc(s.x,s.y,r,0,7); ctx.fill();
    return s;
  }

  let t=0;
  function draw(){
    t+=0.016;
    mouse.x+=(mouse.tx-mouse.x)*0.05; mouse.y+=(mouse.ty-mouse.y)*0.05;
    ctx.clearRect(0,0,W,H);
    ctx.save();
    ctx.translate(mouse.x*26,mouse.y*16);

    // ground grid
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      if(blocked[idx(x,y)]) continue;
      const wave=0.05+0.05*Math.sin((x+y)*0.35-t*1.1);
      tile(x,y,null,'rgba('+CY+','+wave.toFixed(3)+')',1);
    }
    // obstacles (painter's order: far to near)
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
      const b=blocked[idx(x,y)]; if(b) block(x,y,b);
    }

    // solved path — progressively revealed
    if(path.length>1){
      solveT=Math.min(solveT+0.022,1);
      const shown=Math.max(2,Math.floor(path.length*solveT));
      ctx.lineJoin='round'; ctx.lineCap='round';
      const pts=path.slice(0,shown).map(p=>project(p.x+0.5,p.y+0.5,0.18));
      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.strokeStyle='rgba('+CY+',0.16)'; ctx.lineWidth=11; ctx.stroke();
      const grd=ctx.createLinearGradient(pts[0].x,pts[0].y,pts[pts.length-1].x,pts[pts.length-1].y);
      grd.addColorStop(0,'rgba('+CY+',0.95)'); grd.addColorStop(1,'rgba('+VI+',0.95)');
      ctx.strokeStyle=grd; ctx.lineWidth=2.4; ctx.stroke();

      // waypoint nodes
      for(let i=0;i<pts.length;i+=2){
        ctx.fillStyle='rgba('+CY+',0.5)';
        ctx.beginPath(); ctx.arc(pts[i].x,pts[i].y,1.8,0,7); ctx.fill();
      }

      marker(path[0],0.18,CY,3.4);
      marker(path[path.length-1],0.18,MA,3.4);

      // agent traverses once the route is solved
      if(solveT>=1){
        agent+=0.02;
        if(agent>=path.length-1){ newRoute(); }
        else {
          const i=Math.floor(agent), fr=agent-i;
          const a=path[i], b=path[Math.min(i+1,path.length-1)];
          const pos={x:a.x+(b.x-a.x)*fr, y:a.y+(b.y-a.y)*fr};
          const s=marker(pos,0.5,'255,255,255',3.2);
          const g2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,26);
          g2.addColorStop(0,'rgba('+CY+',0.5)'); g2.addColorStop(1,'rgba('+CY+',0)');
          ctx.fillStyle=g2; ctx.beginPath(); ctx.arc(s.x,s.y,26,0,7); ctx.fill();
          // drop line to the floor (shows volumetric height)
          const f=project(pos.x+0.5,pos.y+0.5,0);
          ctx.strokeStyle='rgba('+CY+',0.35)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(f.x,f.y); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function loop(){ draw(); raf=requestAnimationFrame(loop); }

  addEventListener('mousemove',e=>{
    mouse.tx=(e.clientX/innerWidth-0.5); mouse.ty=(e.clientY/innerHeight-0.5);
  },{passive:true});
  addEventListener('resize',()=>{ cancelAnimationFrame(raf); resize(); if(reduce){ solveT=1; draw(); } else raf=requestAnimationFrame(loop); });

  resize();
  if(reduce){ solveT=1; draw(); } else raf=requestAnimationFrame(loop);
})();
