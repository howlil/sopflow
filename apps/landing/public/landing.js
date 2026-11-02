/* Presentation-only interaction; SOP persistence belongs to the host app. */
(()=>{
  const pane=document.getElementById('canvasPane');
  const page=document.getElementById('pageZoom');
  const inspector=document.getElementById('inspector');
  const wb=document.getElementById('workbench');
  const fitControl=document.getElementById('zoomFit');
  let manualZoom=null;
  let inspectorOpen=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit(){
    const free=Math.max(250,pane.clientWidth-32);
    const scale=Math.min(1,Math.max(.25,free/1122.52));
    page.style.setProperty('--page-zoom',String(manualZoom??scale));
    fitControl.textContent=manualZoom===null?'Fit':Math.round(manualZoom*100)+'%';
  }
  function changeTab(view){
    document.querySelectorAll('.wb-tab').forEach(tab=>{
      const isActive=tab.dataset.tab===view;
      tab.dataset.active=String(isActive);
      tab.setAttribute('aria-pressed',String(isActive));
    });
    document.querySelectorAll('[data-surface]').forEach(el=>{
      el.hidden=el.dataset.surface!==view;
      if(!el.hidden&&!reduced&&el.animate)el.animate(
        [{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:230,easing:'cubic-bezier(.22,1,.36,1)'}
      );
    });
    const routes=document.getElementById('routesToggle');
    routes.disabled=view==='steps';
    routes.style.opacity=view==='steps'?'.35':'1';
    fit();
  }
  document.querySelectorAll('.wb-tab').forEach(tab=>tab.addEventListener('click',()=>changeTab(tab.dataset.tab)));
  fitControl.addEventListener('click',()=>{manualZoom=null;fit()});
  function zoom(delta){
    const current=manualZoom??Number(page.style.getPropertyValue('--page-zoom')||'.75');
    manualZoom=Math.min(2,Math.max(.25,Number((current+delta).toFixed(2))));fit();
  }
  document.getElementById('zoomMinus').addEventListener('click',()=>zoom(-.1));
  document.getElementById('zoomPlus').addEventListener('click',()=>zoom(.1));
  document.getElementById('inspectorToggle').addEventListener('click',event=>{
    inspectorOpen=!inspectorOpen;
    inspector.style.display=inspectorOpen?'':'none';
    event.currentTarget.dataset.active=String(inspectorOpen);
    event.currentTarget.setAttribute('aria-pressed',String(inspectorOpen));
    requestAnimationFrame(fit);
  });
  document.getElementById('routesToggle').addEventListener('click',event=>{
    const next=event.currentTarget.dataset.active!=='true';
    event.currentTarget.dataset.active=String(next);
    event.currentTarget.setAttribute('aria-pressed',String(next));
  });
  document.getElementById('problemsToggle').addEventListener('click',event=>{
    const next=wb.dataset.problems!=='true';
    wb.dataset.problems=String(next);
    event.currentTarget.setAttribute('aria-expanded',String(next));
    requestAnimationFrame(fit);
  });
  const magnify=document.getElementById('detailZoom');
  if(magnify)magnify.addEventListener('click',()=>{
    const next=magnify.getAttribute('aria-pressed')!=='true';
    magnify.setAttribute('aria-pressed',String(next));
    magnify.innerHTML=next?'Fit document':'Magnify document';
    if(next){
      manualZoom=.53;fit();
      pane.scrollLeft=Math.max(0,Math.round((1122.52*.53-pane.clientWidth)/2));
    }else{manualZoom=null;pane.scrollLeft=0;fit()}
  });
  const snippet=`import { SopUnifiedWorkspace } from '@sopflow/react';\nimport '@sopflow/react/styles.css';\n\n// Your application owns persistence.\n<SopUnifiedWorkspace\n  value={document}\n  onChange={setDocument}\n  header={header}\n  onHeaderChange={setHeader}\n/>`;
  document.getElementById('copyCode').addEventListener('click',async e=>{
    let success=false;
    try{await navigator.clipboard.writeText(snippet.replaceAll('\\n','\n'));success=true;}catch{
      try{const t=document.createElement('textarea');t.value=snippet.replaceAll('\\n','\n');t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();success=document.execCommand('copy');t.remove();}catch{}
    }
    const button=e.currentTarget;
    button.textContent=success?'Copied':'Copy unavailable';
    setTimeout(()=>button.textContent='Copy',1600);
  });
  let framePending=false;
  const progress=document.querySelector('.scroll-indicator');
  function updateProgress(){if(progress){const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform='scaleX('+(max>0?Math.min(1,scrollY/max):0)+')'}framePending=false;}
  addEventListener('scroll',()=>{if(!framePending){framePending=true;requestAnimationFrame(updateProgress)}},{passive:true});
  const targets=document.querySelectorAll('.features-head,.feature-item,.developer-layout,.preview-intro');
  if(!reduced&&'IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px 0px'});
    targets.forEach(el=>{el.classList.add('reveal-target');io.observe(el)});
  }else targets.forEach(el=>el.classList.add('is-visible'));
  addEventListener('resize',()=>{if(manualZoom===null)fit()});
  requestAnimationFrame(()=>{fit();updateProgress()});
})();
