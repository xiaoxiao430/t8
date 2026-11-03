'use strict';
/* Four-level reading flow. Only rearranges the existing public, synthetic evidence. */
(() => {
  let data = null, routeError = '', reading = false;
  const detailsOpen=new Set();
  const detailKey=()=>[pageName(),org.campus,org.department].join('|');
  const native = {readRoute,go,orgEnsure,orgDashboard,overview,group,profile,orgRoster,render,orgReportTeachers,orgReports,loadReport};
  const encode = encodeURIComponent;
  const currentScope = () => ({campus:org.campus || '',department:org.department || ''});
  const scopeLabel = (s=currentScope()) => [s.campus,s.department].filter(Boolean).join(' · ') || '集团全部校区';
  const pageName = () => state.page==='profile' ? 'roster' : ['group','overview'].includes(state.page) ? state.page : 'group';
  const hashFor = (c,d,p) => '#'+(p==='profile'?'roster':p)+[c,d].filter(Boolean).map(x=>'/'+encode(x)).join('');
  const tree = () => data?.tree || org.tree;
  function validScope(c,d) {
    if(!tree())return true;
    const campus=(tree().campuses||[]).find(x=>x.name===c);
    return (!c&&!d) || (!!campus&&(!d||(campus.departments||[]).some(x=>x.name===d)||(d==='待分学部'&&campus.additional_count>0)));
  }
  function applyScope(c,d) {
    if(org.campus===c&&org.department===d)return;
    org.campus=c;org.department=d;if(state.data)org.seq++;org.summary=null;org.roster=null;org.detail=null;org.detailId='';org.page=1;org.q='';org.category='';org.facet='';org.value='';org.report=false;org.reportTeacher='';state.report=null;state.reportKey='';state.reportLoading=false;org.pending={};org.loading=new Set();org.errors={};
  }
  function navigate(c='',d='',p=pageName()) {
    const target=hashFor(c,d,p);
    if(location.hash===target){readRoute();render();orgEnsure();}
    else location.hash=target;
  }
  window.HouwaiOrgFlow={navigate,currentScope,scopeLabel};
  readRoute=function(){
    if(reading)return;reading=true;
    try {
      const parts=location.hash.replace(/^#\/?/,'').split('/').map(x=>{try{return decodeURIComponent(x);}catch{return x;}});
      let [page,c='',d='']=parts;
      if(['group','overview','roster'].includes(page)||page==='profile'&&!c){
        const roster=page==='roster'||page==='profile',campus=c,department=d;
        routeError=parts.length>3||!validScope(campus,department)?'该组织范围不存在或不在当前授权范围，请从集团重新选择校区与学部。':'';
        if(!routeError&&page==='overview'&&(state.data?.actor.role==='group'||typeof publicData!=='undefined')){page='group';history.replaceState(null,'',hashFor(campus,department,'group'));}
        applyScope(campus,department);
        const previous=state.page;state.page=roster?'profile':page;
        if(state.page==='group'&&state.data?.actor.role!=='group')state.page='overview';
        org.detailId='';
        if(previous!==state.page){org.summary=null;delete org.errors.summary;}
        if(page==='profile')history.replaceState(null,'',hashFor(campus,department,'roster'));
      } else {routeError='';native.readRoute();}
    } finally {reading=false;}
  };
  go=function(page,id){
    if(page==='overview'&&(state.data?.actor.role==='group'||typeof publicData!=='undefined')){navigate(org.campus,org.department,'group');return;}
    if(page==='group'&&!id){navigate('','','group');return;}
    if(['group','overview','roster'].includes(page)||page==='profile'&&!id){navigate(org.campus,org.department,page);return;}
    return native.go(page,id);
  };
  orgRoster=async function(){if(routeError||!org.department){org.roster=null;return;}return native.orgRoster();};
  orgEnsure=function(){
    if(!state.data||routeError)return;
    if(!validScope(org.campus,org.department)){routeError='该组织范围不存在或不在当前授权范围，请从集团重新选择校区与学部。';render();return;}
    if(state.page==='profile'&&!org.detailId&&state.data.actor.role!=='mentor'){
      if(!org.tree&&!org.errors.tree)orgLoad('tree','/organization/tree');
      if(!org.summary&&!org.errors.summary)orgSummary();
      if(org.department&&!org.roster&&!org.errors.roster)orgRoster();
      return;
    }
    native.orgEnsure();
    if(['overview','group'].includes(state.page)&&org.department&&!org.roster&&!org.errors.roster)orgRoster();
  };
  const button=(label,c='',d='',p=pageName(),cls='text-link')=>`<button class="${cls}" data-flow-campus="${esc(c)}" data-flow-department="${esc(d)}" data-flow-page="${esc(p)}">${esc(label)}</button>`;
  function breadcrumb(person) {
    const c=person?.campus||org.campus,d=person?.department||org.department;
    return `<nav class="flow-breadcrumb" aria-label="组织层级">${button('集团','','')}<span aria-hidden="true">›</span>${c?button(c,c):'<span>选择校区</span>'}${c?'<span aria-hidden="true">›</span>':''}${d?button(d,c,d):c?'<span>选择学部</span>':''}${person?`<span aria-hidden="true">›</span><strong aria-current="page">${esc(person.name)}</strong>`:d?'<span class="flow-level">教师名册</span>':''}</nav>`;
  }
  const pct=(a,b)=>b>0?(a/b*100).toFixed(1)+'%':'待核';
  const rows=s=>(data?.management||[]).filter(x=>(!s.campus||x.campus===s.campus)&&(!s.department||(x.department||'待分学部')===s.department));
  const model=s=>window.HouwaiInsights?.build(data?.management||[],data?.management_cases||[],s);
  function facts(s) {
    const list=rows(s),sum=k=>list.reduce((n,r)=>n+(Number(r.mastery?.[k])||0),0);
    const people=(data?.people||[]).filter(x=>(!s.campus||x.campus===s.campus)&&(!s.department||(x.department||'待分学部')===s.department));
    const summary=data?.summaries?.[[s.campus,s.department,org.basis].join('|')];
    return {expected:sum('expected'),determined:sum('determined'),achieved:sum('achieved'),staff:summary?.counts?.staff??people.length,teaching:summary?.counts?.teaching??people.filter(x=>x.teaching).length,model:model(s)};
  }
  function children() {
    if(!org.campus)return (tree()?.campuses||[]).map(x=>({label:x.name,campus:x.name,department:''}));
    const c=(tree()?.campuses||[]).find(x=>x.name===org.campus);
    const ds=(c?.departments||[]).map(x=>x.name);
    if(c?.additional_count&&!ds.includes('待分学部'))ds.push('待分学部');
    return ds.map(d=>({label:d,campus:org.campus,department:d}));
  }
  const responsibility=s=>s.department?`${s.campus}${s.department}校长`:`${s.campus}校长统筹，学部校长落实`;
  function comparisons() {
    if(org.department)return '';
    const cs=children();
    return `<section class="flow-comparison" aria-label="${org.campus?'学部':'校区'}对比"><div class="flow-section-heading"><div><h2>${org.campus?'学部对比':'三个校区 · 对比与管理重点'}</h2><p>先看组织概况，再逐层进入教师；当前人数与课堂原始分子分母按本范围汇总。</p></div><span>${cs.length} 个${org.campus?'学部':'校区'}</span></div><div class="flow-child-grid ${org.campus?'flow-departments':''}">${cs.map(s=>{
      const f=facts(s),g=f.model?.groups||[],support=g.find(x=>x.key==='support')?.count||0,missing=rows(s).filter(x=>x.scenario==='missing').length;
      return `<article class="flow-child panel" data-flow-child="${esc(s.label)}"><header><span class="flow-kicker">${org.campus?'学部':'校区'}概况</span><h3>${esc(s.label)}</h3><p><b>${f.staff}</b> 教职工 <span>· ${f.teaching} 任教人员</span></p></header><dl class="flow-ratios"><div><dt>首次堂堂清实现率</dt><dd>${pct(f.achieved,f.determined)}</dd><small>${f.achieved} / ${f.determined} 已判定课次达标</small></div><div><dt>课堂记录覆盖</dt><dd>${pct(f.determined,f.expected)}</dd><small>${f.determined} / ${f.expected} 应评课次已判定</small></div></dl><div class="flow-ai-counts">${g.map(x=>`<span>${esc(x.label)} <b>${x.count}</b></span>`).join('')}</div><div class="flow-focus"><b>管理重点</b><p>${support?`落实 ${support} 人的优先支持与资源安排`: '保持有效做法，组织共同备课与复评'}${missing?`；补齐 ${missing} 人的课堂记录`:'；核对近期课堂的持续表现'}。</p><small>责任岗位：${esc(responsibility(s))}</small></div>${button(org.campus?'进入学部 →':'进入校区 →',s.campus,s.department,pageName(),'button flow-enter')}</article>`;
    }).join('')}</div></section>`;
  }
  function organizationalActions(panel) {
    if(!panel||org.department)return;
    const priorities=panel.querySelector('.ins-priorities');
    if(!priorities)return;
    const defs=[['support','先落实学校支持','由各学部核对资源、共备时段与落实期限，再安排复评。'],['follow_up','核对持续教学信号','按同一班科连续课次核查，校长协调导师支持。'],['praise','组织具体实践分享','核对近期课堂中的进步，安排学部共备交流。']];
    priorities.innerHTML=defs.map(([key,title,action],i)=>`<li class="flow-org-action"><span class="ins-order">${i+1}</span><div><strong title="${esc(action)}">${title}</strong><p class="flow-action-counts">${children().map(s=>`${esc(s.label)} <b>${facts(s).model?.groups.find(g=>g.key===key)?.count||0}</b> 人`).join(' · ')}</p></div></li>`).join('');
    priorities.setAttribute('aria-label','组织优先行动');
  }
  orgReportTeachers=function(){
    const source=data?.people||native.orgReportTeachers();
    return source.filter(t=>t.teaching!==false&&(!org.campus||t.campus===org.campus)&&(!org.department||(t.department||'待分学部')===org.department));
  };
  orgReports=function(){
    if(state.page!=='profile'||org.detailId)return native.orgReports();
    const previous=state.page;state.page='overview';
    try{return native.orgReports();}finally{state.page=previous;}
  };
  loadReport=async function(){
    if(state.page!=='profile'||org.detailId)return native.loadReport();
    const teachers=orgReportTeachers(),t=teachers.find(t=>t.id===org.reportTeacher)||teachers[0];if(!t)return;
    org.reportTeacher=t.id;const key=`${state.actor}/${t.id}/${state.period}`,seq=org.seq;
    state.reportKey=key;state.reportLoading=true;state.report=null;org.reportError='';render();
    try{const r=await request(`/reports/${encodeURIComponent(t.id)}?period=${state.period}`);if(state.reportKey===key&&org.seq===seq)state.report=r;}
    catch(e){if(state.reportKey===key&&org.seq===seq)org.reportError=e.message;}
    finally{if(state.reportKey===key&&org.seq===seq){state.reportLoading=false;render();}}
  };
  function reportSection(){
    if(!org.report)return '';
    if(org.department)return orgReports();
    return `<section class="panel flow-report-guide" role="status"><h2>先选择校区与学部，再查看教师报告</h2><p>阶段报告按教师查看。请从${org.campus?'下方学部对比选择学部':'下方三个校区进入校区，再选择学部'}，进入学部后展开「教学与队伍指标」，在「支持与跟进」打开阶段报告。</p><button class="text-link" data-flow-choose-report>查看${org.campus?'学部':'校区'}对比 ↓</button></section>`;
  }
  function distributionLabels(box){
    box.querySelectorAll('[aria-label]').forEach(el=>el.setAttribute('aria-label',el.getAttribute('aria-label').replace(/查看全部名单|查看名单|查看对应人员/g,'查看组织分布')));
    box.querySelectorAll('[data-org-category],[data-org-facet]').forEach(el=>{const label=el.getAttribute('aria-label')||el.textContent.trim();if(!label.includes('组织分布'))el.setAttribute('aria-label',label+'，查看组织分布');});
    box.querySelectorAll('.ins-category-link,.demo-card-link,.org-stat>small,.org-chart .org-panel-title small').forEach(el=>{el.textContent=el.textContent.replace(/查看全部名单|查看名单|点击查看对应人员|点击筛选名册/g,'查看组织分布');});
  }
  function judgment() {
    const f=facts(currentScope());
    return `<section class="flow-judgment"><span class="flow-kicker">${org.department?'学部 → 教师':org.campus?'校区 → 学部':'集团 → 校区'}</span><h2>${esc(scopeLabel())}</h2><p>${f.staff} 位教职工，${f.teaching} 位任教人员。首次堂堂清按已判定课次汇总为 <b>${pct(f.achieved,f.determined)}</b>，依据覆盖 <b>${pct(f.determined,f.expected)}</b>；先落实学校支持，再核对持续教学信号与进步。</p><small>首次达标 ${f.achieved} / 已判定 ${f.determined} / 应评 ${f.expected} 课次 · 未判定保留待核，复测单列；不生成综合评分。</small></section>`;
  }
  orgDashboard=function(){
    if(state.data.actor.role==='mentor')return native.orgDashboard();
    if(!data||!org.summary)return orgWait('summary','组织概况');
    const box=document.createElement('div');box.innerHTML=native.orgDashboard();
    const ai=box.querySelector('#managementInsights');
    organizationalActions(ai);if(!org.department){distributionLabels(box);if(ai)distributionLabels(ai);}if(ai)ai.remove();
    if(!org.department)box.querySelectorAll('.demo-scenario-names').forEach(n=>n.remove());
    return judgment()+(ai?.outerHTML||'')+reportSection()+comparisons()+(org.department?`<section class="flow-roster-heading"><h2>${esc(org.department)} · 教师与教职工名册</h2><p>当前仅显示 ${esc(scopeLabel())}，选择教师后进入第四级档案。</p></section>${orgRosterHTML()}`:'')+`<details class="flow-details" data-flow-key="${esc(detailKey())}" ${detailsOpen.has(detailKey())?'open':''}><summary>展开教学与队伍指标 <span>教学六情境、历史分层、人员结构与支持待办</span></summary><div>${box.innerHTML}</div></details>`;
  };
  function invalid() {return `<section class="panel flow-error" role="alert"><h2>组织范围无效</h2><p>${esc(routeError)}</p>${button('返回集团重新选择','','','group','button')}</section>`;}
  function page(title,sub){
    return heading(title,sub,'','ORGANIZATION · FOUR LEVELS')+breadcrumb()+orgNotice()+(routeError?invalid():`<div class="flow-main">${orgDashboard()}</div>`);
  }
  overview=function(){if(state.data.actor.role==='mentor')return native.overview();return page('校长工作台','集团 → 校区 → 学部 → 教师，逐层明确培养重点。');};
  group=function(){return page('集团总体分析','先比较校区，再进入学部与教师。');};
  profile=function(){
    if(state.data.actor.role==='mentor')return native.profile();
    if(!org.detailId)return page('教师档案','按集团、校区、学部逐层找到教师。');
    const person=org.detail?.person?.id===org.detailId?org.detail.person:null;
    if(person&&(person.campus!==org.campus||(person.department||'待分学部')!==org.department)){
      org.campus=person.campus;org.department=person.department||'待分学部';org.seq++;org.pending={};org.loading=new Set();delete org.errors.summary;delete org.errors.roster;org.summary=null;org.roster=null;org.reportTeacher='';state.report=null;state.reportKey='';state.reportLoading=false;org.page=1;org.q='';org.category='';org.facet='';org.value='';
    }
    return breadcrumb(person)+native.profile();
  };
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-flow-choose-report]')){e.preventDefault();e.stopImmediatePropagation();document.querySelector('.flow-comparison')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    const el=e.target.closest('[data-flow-campus],[data-org-scope],[data-org-back]');if(!el)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(el.hasAttribute('data-org-back'))navigate(org.detail?.person?.campus||org.campus,org.detail?.person?.department||org.department,'roster');
    else if(el.hasAttribute('data-org-scope'))navigate(el.dataset.orgScope||'',el.dataset.orgDept||'');
    else navigate(el.dataset.flowCampus||'',el.dataset.flowDepartment||'',el.dataset.flowPage||pageName());
  },true);
  document.addEventListener('change',e=>{
    if(!['orgCampus','orgDepartment'].includes(e.target.id))return;
    e.stopImmediatePropagation();navigate(e.target.id==='orgCampus'?e.target.value:org.campus,e.target.id==='orgDepartment'?e.target.value:'');
  },true);
  // Initial refresh begins before this deferred module: finish hierarchy loads after it renders.
  document.addEventListener('toggle',e=>{const el=e.target;if(el.matches?.('.flow-details')&&el.isConnected){if(el.open)detailsOpen.add(el.dataset.flowKey);else detailsOpen.delete(el.dataset.flowKey);}},true);
  render=function(){const visible=document.querySelector('.flow-details');if(visible){if(visible.open)detailsOpen.add(visible.dataset.flowKey);else detailsOpen.delete(visible.dataset.flowKey);}native.render();if(state.data&&!routeError&&(['group','overview'].includes(state.page)||state.page==='profile'&&!org.detailId))queueMicrotask(()=>orgEnsure());};
  const source=typeof publicDataPromise!=='undefined'?publicDataPromise:publicData;
  source.then(value=>{data=value;readRoute();if(state.data){render();orgEnsure();}}).catch(()=>{});
  readRoute();if(state.data){render();orgEnsure();}
})();
