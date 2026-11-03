'use strict';
/* One scoped source for desktop tables, mobile reading cards and personal summaries. */
(() => {
  const original={dashboard:orgDashboard,profile:orgProfile,render,roster:orgRosterHTML};
  const cache=new Map(),pending=new Set(),errors=new Map(),settings=new Map(),openDetails=new Map(),seenScenes=new Set();
  const views=[['roster','教师总表'],['appraisal','评价考核'],['development','培养晋升'],['teams','团队岗位'],['structure','队伍结构']];
  const safe=v=>esc(v==null?'':String(v)),list=v=>Array.isArray(v)?v:[];
  const actor=()=>state.data?.actor||{},restricted=()=>['mentor','information_officer','independent_reviewer','teaching_leader','grade_leader','teacher'].includes(actor().role);
  const scopeKey=()=>[state.actor,org.campus||'',org.department||''].join('|');
  const getSettings=()=>{const key=scopeKey();if(!settings.has(key))settings.set(key,{view:'roster',q:org.q||'',category:org.category||'',page:org.page||1,team:'',type:''});return settings.get(key);};
  let returnState=null,restoreScroll=null,profileId='',resizeTimer,referencePeople=null,detailContext='';
  const path=()=>'/organization/management?'+new URLSearchParams({campus:org.campus||'',department:org.department||'',period:'2026-fall'});
  const personalPath=id=>'/management/'+encodeURIComponent(id);
  function load(key,url){
    if(cache.has(key)||pending.has(key)||errors.has(key))return;
    pending.add(key);const who=state.actor;
    request(url).then(v=>{if(who===state.actor)cache.set(key,v);}).catch(e=>{if(who===state.actor)errors.set(key,e.message);}).finally(()=>{pending.delete(key);if(who===state.actor)render();});
  }
  const payload=()=>cache.get(scopeKey());
  const pct=(a,b)=>Number(b)>0?(Number(a)/Number(b)*100).toFixed(1)+'%':'—';
  const period=v=>v==='2026-spring'?'2026春':v==='2026-fall'?'2026秋':String(v||'');
  const managementTrack=v=>v==='management'||String(v||'').includes('管理');
  const tagIcon=v=>({clock:'◷',file:'▤',hand:'♥',target:'◎',up:'↗',star:'★',seed:'✦'}[v]||'●');
  const careerStatus=v=>({active:'进行中',achieved:'已完成',adjusting:'已调整',planned:'准备中',completed:'已完成'}[v]||v||'进行中');
  const day=v=>v?String(v).slice(0,10).replaceAll('-','.'):'另行约定';
  const tagTone=v=>({positive:'green',support:'blue',attention:'amber',growth:'purple',neutral:'slate'}[v]||'blue');
  const tone=v=>({excellent:'green',good:'blue',support:'amber',pending:'slate',not_applicable:'slate'}[v]||String(v||'blue').replace(/[^a-z]/g,''));
  function tags(t){return list(t.focus_tags).slice(0,2).map(v=>`<span class="v8-tag ${tagTone(v.tone)}" data-v8-tag><i aria-hidden="true">${safe(tagIcon(v.icon))}</i>${safe(v.label)}</span>`).join('');}
  function name(t){return `<button class="v8-person" data-v8-open="${safe(t.id||t.teacher_id)}" aria-label="查看${safe(t.name)}档案">${avatar(t,'v8-avatar')}<span><strong data-v8-name>${safe(t.name)}</strong><small>${safe(t.teaching===false?'非任教岗位':t.subject)} · ${safe(t.position)}</small></span></button>`;}
  function education(d){
    d=d||{};const tier=d.tier==='985'?'985':d.tier==='211非985'?'211':'';
    return `<span>${safe(d.education||'—')} ${tier?`<b class="roster-school-badge tier-${tier}">${tier}</b>`:''}</span>${/^https:\/\//.test(d.school_url||'')?`<a class="v8-school" target="_blank" rel="noopener noreferrer" href="${safe(d.school_url)}">${safe(d.university)}</a>`:`<small class="v8-school">${safe(d.university||'—')}</small>`}`;
  }
  function evaluation(t){return t.teaching===false?'不适用':t.teaching_profile?.evaluation?.label||t.category_label||'暂未评价';}
  function satisfaction(t){const s=t.parent_satisfaction||t.teaching_profile?.parent_satisfaction||{};return t.teaching===false?'不适用':s.sufficient&&typeof s.rate==='number'?Number(s.rate).toFixed(Number.isInteger(s.rate)?0:1)+'%':'资料待补齐';}
  function loadButton(t){const n=t.workload?.weekly_load??t.teaching_profile?.weekly_load;return t.teaching===false?'<span>不适用</span>':Number.isInteger(n)?`<button class="v8-load" data-roster-schedule="${safe(t.id)}" data-weekly-load="${n}" aria-label="查看${safe(t.name)}每周${n}节课的课表"><b>${n}</b><small>节／周 ↗</small></button>`:'—';}
  function action(t,full=false){const a=t.primary_action;if(!a)return '<div class="v8-action-empty">保持日常交流，按期回看成长。</div>';return `<div class="v8-action ${a.status==='completed'?'is-completed':''}" data-v8-action="${safe(a.id)}" data-v8-source="${safe(a.source_id)}"><span class="v8-action-icon" aria-hidden="true">${a.status==='completed'?'✓':'→'}</span><div><strong title="${safe(a.text||a.label)}">${safe(full?a.text||a.label:a.label||a.text)}</strong><small><span data-v8-owner>${safe(a.owner_name)}</span><span class="v8-action-separator"> · </span><time data-v8-due>${a.due_date?'':'复评 '}${day(a.due_date||a.review_date)}</time>${a.status==='completed'?' · 已完成':''}</small></div></div>`;}
  function metrics(t){const p=t.teaching_profile||{},sp=t.parent_satisfaction||p.parent_satisfaction||{};return `<div class="v8-card-metrics"><div><span>教学评价</span><strong class="v81-evaluation ${safe(p.evaluation?.status||'pending')}" data-v8-metric="evaluation">${safe(evaluation(t))}</strong><small>${safe(period(p.evaluation?.period||t.evaluation_period))}</small></div><div><span>家长满意度</span><strong data-v8-metric="satisfaction">${safe(satisfaction(t))}</strong><small>${safe(period(sp.period||p.evaluation?.period||t.evaluation_period))}</small></div><div><span>每周课量</span><strong data-v8-metric="load">${loadButton(t)}</strong><small>${t.teaching===false?'非任教岗位':safe(t.workload?.class_count??'—')+'班 · 带教'+safe(t.workload?.mentee_count??0)+'人'}</small></div></div>`;}
  function card(t,view='roster'){
    const c=t.career||{};let detail='';
    if(view==='appraisal')detail=`<div class="v8-card-detail"><span>本期堂堂清 <b>${safe(pct(t.mastery?.achieved,t.mastery?.determined))}</b></span><span>考试目标 <b>${safe(examText(t.exam))}</b></span></div>`;
    if(view==='development')detail=`<div class="v8-card-detail v8-career-preview"><span>${safe(managementTrack(c.track)?'管理方向':'专业方向')} · <b>${safe(c.target_role||c.aspiration||'持续专业成长')}</b></span><span>${safe(careerStatus(c.status||c.readiness))} · 导师 ${safe(c.mentor_name||'学部共备团队')}</span></div>`;
    return `<article class="v8-teacher-card is-${tone(t.category)}" data-v8-card="${safe(t.id)}"><header>${name(t)}<span class="v8-state ${tone(t.category)}" data-v8-state title="${safe(period(t.evaluation_period))}正式评价">${safe(t.category_label||'成长档案')}<small class="v8-formal-period"> · ${safe(period(t.evaluation_period))}</small></span></header><div class="v8-card-reading"><p title="${safe(t.judgment)}">${safe(t.judgment||'围绕本职任务，持续记录成长。')}</p><div class="v8-card-tags">${tags(t)}</div></div>${metrics(t)}${detail}${action(t)}</article>`;
  }
  function examText(x){if(!x||x.status==='not_applicable')return '本期无考试';return x.status==='achieved'||x.status==='met'?'达到目标':x.status==='gap'||x.status==='improve'||x.status==='not_achieved'?'需跟进':x.label||'查看目标';}
  function desktopTable(rows,view){
    let headers,body;
    if(view==='appraisal'){
      headers=['教师','综合短评','堂堂清 · 本期','考试目标 · 本期','家长满意度','改进重点','评价期间'];
      body=rows.map(t=>`<tr data-v8-row="${safe(t.id)}"><td>${name(t)}</td><td class="v8-cell-reading">${safe(t.judgment)}</td><td>${safe(pct(t.mastery?.achieved,t.mastery?.determined))}<small>${safe(t.mastery?.achieved??'—')} / ${safe(t.mastery?.determined??'—')} 已判定 · 应评 ${safe(t.mastery?.expected??'—')}</small></td><td>${safe(examText(t.exam))}${t.exam?.target!=null?`<small>目标 ${safe(t.exam.target)} / 实际 ${safe(t.exam.actual)}</small>`:''}</td><td>${safe(satisfaction(t))}<small>${safe(period((t.parent_satisfaction||{}).period||t.evaluation_period))}</small></td><td>${tags(t)}</td><td>${safe(period(t.evaluation_period))}<small>正式学期评价</small></td></tr>`).join('');
    }else if(view==='development'){
      headers=['教师','发展意愿','目标方向 / 岗位','准备情况','培养目标','导师 / 负责人','学校支持','下次复评'];
      body=rows.map(t=>{const c=t.career||{};return `<tr data-v8-row="${safe(t.id)}"><td>${name(t)}</td><td>${safe(c.aspiration||'立足当前岗位')}</td><td><span class="v8-track">${managementTrack(c.track)?'管理方向':'专业方向'}</span>${safe(c.target_role||'持续专业成长')}</td><td>${safe(c.readiness||careerStatus(c.status))}</td><td class="v8-cell-reading">${safe(c.goal||'结合本期任务回看变化')}</td><td>${safe(c.mentor_name||t.primary_action?.owner_name||'学部团队')}</td><td class="v8-cell-reading">${safe(c.school_support||'共同备课与同伴交流')}</td><td>${day(c.review_date||t.primary_action?.review_date)}</td></tr>`;}).join('');
    }else{
      headers=['教师','入职厚外','第一学历','最终学历','专业','任教学科','周课量','教学评价','家长满意度'];
      body=rows.map(t=>{const p=t.teaching_profile||{};return `<tr data-v8-row="${safe(t.id)}"><td>${name(t)}</td><td>${safe(p.houwai_joined_on||'未填写')}<small>${Number.isInteger(p.tenure_months)?'在厚外'+Math.floor(p.tenure_months/12)+'年'+p.tenure_months%12+'个月':''}</small></td><td>${education(p.first_education)}</td><td>${education(p.final_education)}</td><td>${safe(p.major||'—')}</td><td>${safe(t.teaching===false?'不适用':t.subject)}</td><td>${loadButton(t)}</td><td><span class="roster-evaluation ${safe(p.evaluation?.status)}">${safe(evaluation(t))}</span><small>${safe(period(p.evaluation?.period||t.evaluation_period))}</small></td><td><b>${safe(satisfaction(t))}</b><small>${safe(period((t.parent_satisfaction||{}).period||t.evaluation_period))}</small></td></tr>`;}).join('');
    }
    return `<div class="v8-desktop-table table-scroll"><table id="v8TeacherTable" aria-label="${safe(views.find(v=>v[0]===view)?.[1]||'教师总表')}"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${headers.length}">没有符合条件的人员</td></tr>`}</tbody></table></div>`;
  }
  function facetSet(){
    if(!org.facet)return null;
    if(referencePeople){const f=org.facet==='subject'&&org.value==='true'?'teaching':org.facet;return new Set(referencePeople.filter(t=>{const d=t[org.basis==='undergraduate'?'undergraduate':'highest']||{};if(f==='teaching')return t.teaching!==false;if(f==='bachelor_plus')return ['本科','硕士','博士'].includes(d.education);if(f==='university_985')return d.tier==='985';if(f==='university_211')return ['985','211非985'].includes(d.tier);return list(t.facets?.[org.basis||'highest']?.[f]).includes(org.value);}).map(t=>t.id));}
    const key=scopeKey()+'|facet|'+[org.basis,org.facet,org.value].join('|');
    if(cache.has(key))return cache.get(key);
    if(!pending.has(key)&&!errors.has(key)){
      pending.add(key);const who=state.actor,query={campus:org.campus||'',department:org.department||'',education_basis:org.basis,facet:org.facet,value:org.value,page_size:100};
      const get=page=>request('/organization/personnel?'+new URLSearchParams({...query,page}));
      get(1).then(async first=>{const rest=await Promise.all(Array.from({length:Math.max(0,(first.pages||1)-1)},(_,i)=>get(i+2)));if(who===state.actor)cache.set(key,new Set([first,...rest].flatMap(x=>list(x.items)).map(x=>x.id)));}).catch(e=>{if(who===state.actor)errors.set(key,e.message);}).finally(()=>{pending.delete(key);if(who===state.actor)render();});
    }
    return new Set();
  }
  function filtered(d,s){const ids=facetSet();let rows=list(d.teachers).filter(t=>(!ids||ids.has(t.id))&&(!s.q||[t.name,t.subject,t.position,t.career?.target_role].some(v=>String(v||'').includes(s.q)))&&(!s.category||t.category===s.category));if(s.team){const team=list(d.teams).find(x=>x.id===s.team);rows=rows.filter(t=>list(team?.member_ids).includes(t.id));}return rows;}
  function controls(s){return `<div class="v8-controls"><form id="v8Search"><label class="sr-only" for="v8Query">搜索教师姓名、学科或岗位</label><input id="v8Query" value="${safe(s.q)}" placeholder="姓名、学科或岗位"><button class="v8-search-button" type="submit" aria-label="搜索教师"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.3 15.3 5 5"></path></svg></button></form><label><span class="sr-only">教师正式评价</span><select id="v8Category" aria-label="按正式评价筛选"><option value="">全部评价</option>${Object.entries({excellent:'优秀',good:'良好',support:'重点支持',pending:'资料待补齐',not_applicable:'非任教岗位'}).map(([k,v])=>`<option value="${k}" ${s.category===k?'selected':''}>${v}</option>`).join('')}</select></label></div>`;}
  function tabs(s){return `<nav class="v8-tabs" aria-label="教师管理专题">${views.map(([k,label])=>`<button data-v8-view="${k}" aria-pressed="${s.view===k}" class="${s.view===k?'active':''}">${label}</button>`).join('')}</nav>`;}
  function teamView(d,s){
    const rows=list(d.teams).filter(t=>(!s.type||t.type===s.type)&&(!s.q||[t.name,t.leader_name,t.gap].some(v=>String(v||'').includes(s.q))));
    const members=t=>`<button class="v8-members" data-v8-team="${safe(t.id)}" aria-label="查看${safe(t.name)}的${safe(t.members_count)}位成员">${safe(t.members_count)} 人 ↗</button>`;
    const backup=t=>list(t.backups).map(v=>safe(v.name)).join('、')||'持续培养';
    return `<div class="v8-team-types" role="group" aria-label="团队类型">${['','教研组','备课组','年级组'].map(v=>`<button data-v8-type="${v}" class="${s.type===v?'active':''}">${v||'全部团队'}</button>`).join('')}</div><div class="v8-desktop-table table-scroll"><table id="v8TeamTable"><thead><tr>${['团队 / 类型','负责人','成员','岗位后备','能力缺口','周课量分布','安排建议'].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(t=>`<tr><td><b>${safe(t.name)}</b><small>${safe(t.type)}</small></td><td>${safe(t.leader_name)}</td><td>${members(t)}</td><td>${backup(t)}</td><td>${safe(t.gap||'保持团队互补')}</td><td>${safe(t.workload?.min??'—')}—${safe(t.workload?.max??'—')} 节<small>带教 ${safe(t.mentee_count??0)} 人</small></td><td class="v8-cell-reading">${safe(t.recommendation)}</td></tr>`).join('')}</tbody></table></div><div class="v8-mobile-cards v8-team-cards">${rows.map(t=>`<article class="v8-team-card"><header><span class="v8-track">${safe(t.type)}</span><h3>${safe(t.name)}</h3></header><dl><div><dt>负责人</dt><dd>${safe(t.leader_name)}</dd></div><div><dt>岗位后备</dt><dd>${backup(t)}</dd></div><div><dt>当前重点</dt><dd>${safe(t.gap||'保持团队互补')}</dd></div><div><dt>任务负担</dt><dd>周课量 ${safe(t.workload?.min??'—')}—${safe(t.workload?.max??'—')}节 · 带教 ${safe(t.mentee_count??0)}人</dd></div></dl><p>${safe(t.recommendation)}</p>${members(t)}</article>`).join('')||'<p class="v8-empty">本范围暂无该类团队。</p>'}</div><p class="v8-note">成员可同时属于教研组、备课组和年级组，各组人数不相加为教师总人数。</p>`;
  }
  function rosterView(d,s){
    const all=filtered(d,s),pages=Math.max(1,Math.ceil(all.length/20));s.page=Math.min(Math.max(1,s.page),pages);org.q=s.q;org.category=s.category;org.page=s.page;
    const rows=all.slice((s.page-1)*20,s.page*20),team=list(d.teams).find(t=>t.id===s.team);
    return `${controls(s)}${org.facet?`<div class="v8-filter-chip">${safe(orgChartNames[org.facet]||org.facet)}：${safe(org.value||'全部')}<button data-v8-clear-facet aria-label="取消人员结构筛选">×</button></div>`:''}${team?`<div class="v8-filter-chip">${safe(team.name)} · ${all.length}人<button data-v8-clear-team aria-label="取消团队筛选">×</button></div>`:''}<div class="v8-result-count">${all.length} 人<span>${safe(views.find(v=>v[0]===s.view)?.[1])} · ${safe(period(d.period))}</span></div>${desktopTable(rows,s.view)}<div class="v8-mobile-cards">${rows.map(t=>card(t,s.view)).join('')||'<p class="v8-empty">没有符合条件的人员。</p>'}</div><div class="v8-pagination"><span>第 ${s.page} / ${pages} 页</span><button data-v8-page="${s.page-1}" ${s.page<=1?'disabled':''}>上一页</button><button data-v8-page="${s.page+1}" ${s.page>=pages?'disabled':''}>下一页</button></div>`;
  }
  function summary(d,department){const x=d.summary||{},c=x.counts||{},p=x.parent_satisfaction||{};
    return `<section class="v8-summary ${department?'is-department':''}"><header><div><span class="v8-eyebrow">${department?'学部管理':'队伍与培养'}</span><h2>${safe(org.department||org.campus||'教师队伍与培养')}</h2></div><small>${safe(d.period_label||'2026年秋季')}</small></header><p class="v8-summary-judgment">${safe(x.judgment||'关注教师表现、培养安排和团队支持。')}</p>${!department?`<div class="v8-summary-reading"><p><b>主要优势</b>${safe(x.strengths)}</p><p><b>当前重点</b>${safe(x.difficulties)}</p></div>`:''}<div class="v8-summary-numbers"><div><strong>${safe(c.teaching??0)}<small>人</small></strong><span>任教人员</span></div><div><strong>${safe(c.excellent??0)}${department?'/'+safe(c.good??0):''}<small>人</small></strong><span>${department?'优秀 / 良好':'优秀'} · 春季</span></div><div><strong>${safe(department?c.support??0:c.development??0)}<small>人</small></strong><span>${department?'重点支持 · 春季':'培养进行中'}</span></div><div><strong>${department?safe(c.development??0)+'/':''}${safe(c.backups??0)}<small>人</small></strong><span>${department?'培养 / 后备':'岗位后备'}</span></div></div>${department?'':`<div class="v8-summary-foot"><span>堂堂清 ${safe(pct(x.mastery?.achieved,x.mastery?.determined))} · 本期</span><span>支持落实 ${safe(c.support_completed??0)} / ${safe(c.support_total??0)} 项</span><span>重点支持 ${safe(c.support??0)} 人 · 春季</span></div>`}</section>`;
  }
  function comparisons(d){const rows=list(d.summary?.organizations),groups=new Map();
    for(const x of rows){const key=org.campus?x.department:x.campus;if(!key)continue;if(!groups.has(key))groups.set(key,{name:key,campus:x.campus,department:org.campus?x.department:'',staff:0,teaching:0,development:0,backups:0,support_total:0,support_completed:0});const g=groups.get(key);for(const k of ['staff','teaching','development','backups','support_total','support_completed'])g[k]+=Number(x[k])||0;}
    if(!groups.size){for(const t of list(d.teachers)){const key=org.campus?t.department:t.campus;if(!groups.has(key))groups.set(key,{name:key,campus:t.campus,department:org.campus?t.department:'',staff:0,teaching:0,development:0,backups:0,support_total:0,support_completed:0});const g=groups.get(key);g.staff++;g.teaching+=t.teaching?1:0;g.development+=t.career?.status==='active'?1:0;}}
    const go=x=>`data-v8-campus="${safe(x.campus)}" data-v8-department="${safe(x.department)}"`;
    if(!org.campus){
      const campuses=[['兴国路','xingguolu'],['香江路','xiangjianglu'],['九里峰山','jiulifengshan']].map(([name,key])=>({...groups.get(name),photoKey:key})).filter(x=>x.campus);
      return `<section class="v8-comparisons v81-campus-comparison"><header><h2>三个校区情况</h2><span>选择校区，查看学部与教师 →</span></header><div class="v81-campus-grid">${campuses.map(x=>`<button class="v81-campus-card campus-${x.photoKey}" ${go(x)} aria-label="进入${safe(x.name)}校区，${x.staff}位教职工，${x.teaching}位任教人员"><span class="v81-campus-image" aria-hidden="true"></span><span class="v81-campus-photo-space"><span class="v81-campus-hint">走进校区 <i aria-hidden="true">↗</i></span></span><span class="v81-campus-info"><span class="v81-campus-heading"><strong>${safe(x.name)}</strong><span>校区</span></span><span class="v81-campus-people"><b>${x.staff}</b> 位教职工 <i aria-hidden="true">·</i> <b>${x.teaching}</b> 位任教人员</span><span class="v81-campus-metrics"><span><small>培养进行中</small><b>${x.development}<em>人</em></b></span><span><small>岗位后备</small><b>${x.backups}<em>人</em></b></span><span><small>支持落实</small><b class="v81-campus-support">${x.support_completed}/${x.support_total}<em>项</em></b></span></span></span></button>`).join('')}</div></section>`;
    }
    return `<section class="v8-comparisons"><header><h2>${org.campus?'各学部情况':'三个校区情况'}</h2><span>逐层查看 →</span></header><div class="v8-desktop-table table-scroll"><table><thead><tr>${[org.campus?'学部':'校区','教职工','任教人员','培养进行中','岗位后备','支持落实',''].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${[...groups.values()].map(x=>`<tr><td><b>${safe(x.name)}</b></td><td>${x.staff}</td><td>${x.teaching}</td><td>${x.development}</td><td>${x.backups}</td><td>${x.support_completed} / ${x.support_total}</td><td><button class="v8-enter" ${go(x)}>进入${org.campus?'学部':'校区'} ↗</button></td></tr>`).join('')}</tbody></table></div><div class="v8-mobile-cards v8-org-cards">${[...groups.values()].map(x=>`<button class="v8-org-card" ${go(x)}><header><strong>${safe(x.name)}</strong><span>${x.teaching} 位任教人员 ›</span></header><div><span>培养 <b>${x.development}</b> 人</span><span>后备 <b>${x.backups}</b> 人</span><span>支持 <b>${x.support_completed}/${x.support_total}</b></span></div></button>`).join('')}</div></section>`;
  }
  orgDashboard=function(){
    if(restricted())return original.dashboard.apply(this,arguments);
    const key=scopeKey(),d=payload();if(!d){load(key,path());return `<section id="v8Management" class="v8-loading" data-v8-loaded="false" role="status"><h2>${safe(org.department||org.campus||'集团总体分析')}</h2><p>${safe(errors.get(key)||'正在整理教师、培养与团队情况…')}</p>${errors.has(key)?'<button data-v8-retry>重新读取</button>':''}</section>`;}
    const s=getSettings(),isDepartment=!!org.department;
    const talent=()=>window.HouwaiTalentView?window.HouwaiTalentView.html({campus:org.campus||'',department:org.department||''}):'<section class="tal-panel" role="status">正在准备队伍结构分析…</section>';
    return `<div id="v8Management" data-v8-loaded="true" data-v8-scope="${safe(key)}">${summary(d,isDepartment)}${isDepartment?`<section id="v8Department">${tabs(s)}${s.view==='structure'?talent():s.view==='teams'?controls(s)+teamView(d,s):rosterView(d,s)}</section>`:comparisons(d)+`<details class="v8-details v8-hr-analysis" data-v8-detail="hr-analysis"><summary>队伍结构与培养建议</summary>${talent()}</details>`}</div>`;
  };
  function personal(t){
    const c=t.career||{},comparables=list(t.trend).filter(x=>x.comparable===true),trend=comparables.length>=2?`<div class="v8-mini-trend"><span>同口径变化</span>${comparables.map(x=>`<span>${safe(x.label)} <b>${safe(x.rate)}%</b></span>`).join('<i>→</i>')}</div>`:'';
    return `<section id="v8ProfileSummary" class="v8-profile-summary" data-v8-teacher="${safe(t.id)}"><header><span>当前关注 · ${safe(period('2026-fall'))}</span><span class="v8-state ${tone(t.category)}" data-v8-state>${safe(t.category_label||'成长档案')}<small> · ${safe(period(t.evaluation_period))}</small></span></header><h2>${safe(t.judgment||'持续关注本职工作与个人成长。')}</h2><div class="v8-card-tags">${tags(t)}</div>${metrics(t)}${trend}${action(t,true)}${c.target_role?`<details class="v8-career-detail" data-v8-detail="career"><summary>培养方向：${safe(c.target_role)}</summary><dl><div><dt>本人意愿</dt><dd>${safe(c.aspiration)}</dd></div><div><dt>培养目标</dt><dd>${safe(c.goal)}</dd></div><div><dt>导师</dt><dd>${safe(c.mentor_name)}</dd></div><div><dt>学校支持</dt><dd>${safe(c.school_support)}</dd></div><div><dt>下次复评</dt><dd>${day(c.review_date)}</dd></div></dl></details>`:''}</section>`;
  }
  orgProfile=function(){
    const result=original.profile.apply(this,arguments),box=document.createElement('div');box.innerHTML=result;
    if(state.profileTab==='growth'){
      const body=box.querySelector('.org-profile-body');if(body){const content=body.innerHTML;body.innerHTML=`<details class="v8-details v8-growth-records" data-v8-detail="growth-records"><summary>课堂表现、成长记录与阶段报告</summary>${content}</details>`;}
    }
    return box.innerHTML;
  };
  function decorate(){
    document.body.classList.add('v8-app','v81-app');
    const scene=state.actor+'|'+location.hash+'|'+JSON.stringify(settings.get(scopeKey())||{}),sceneReady=document.querySelector('#v8Management[data-v8-loaded="true"],#v8ProfileSummary');
    if(sceneReady&&!seenScenes.has(scene)){seenScenes.add(scene);if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){const visible=[...document.querySelectorAll('.v8-summary,.v8-teacher-card,.v8-org-card,.v81-campus-card,#v8ProfileSummary')].filter(el=>el.getClientRects().length).slice(0,5);visible.forEach((el,i)=>{el.classList.add('v81-enter');el.style.setProperty('--v81-delay',Math.min(i*28,112)+'ms');});}}
    if(document.getElementById('v8Management'))document.getElementById('humanOrganizationPanel')?.remove();
    if(state.page!=='profile'||!org.detailId||['mentor','information_officer','independent_reviewer','teaching_leader','grade_leader'].includes(actor().role))return;
    const id=org.detailId,box=document.querySelector('.org-profile-body'),hero=document.querySelector('.profile-hero');if(!box||!hero)return;
    if(profileId!==id){profileId=id;document.querySelector('#v8ProfileSummary')?.remove();}
    const row=org.detail?.person?.id===id&&org.detail.management_v8||cache.get(state.actor+'|person|'+id);
    if(!row){load(state.actor+'|person|'+id,personalPath(id));return;}
    if(state.profileTab==='growth'&&!document.getElementById('v8ProfileSummary'))hero.insertAdjacentHTML('afterend',personal(row));
    // Preserve categories and always show self-entered tags and work references.
    hero.querySelector('.v8-identity-brief')?.remove();
    const folded=hero.querySelector('.v8-identity-details');
    if(folded){const identity=folded.querySelector('[data-hu-identity]');if(identity)folded.before(identity);folded.remove();}
    const work=hero.querySelector('[data-v81-mbti-reference]')||document.querySelector('[data-v81-mbti-reference]');
    const summary=document.getElementById('v8ProfileSummary');
    if(work&&summary)summary.after(work);
    window.HouwaiProfileReference?.place();
    if(!hero.querySelector('[data-vnext-employment]')&&row.teaching_profile?.houwai_joined_on){
      const employment=row.teaching_profile,months=employment.tenure_months;
      const tenure=Number.isInteger(months)?'在厚外'+Math.floor(months/12)+'年'+months%12+'个月':'';
      hero.querySelector('.profile-name')?.insertAdjacentHTML('beforeend',`<p class="vnext-employment" data-vnext-employment><span>入职厚外 <time datetime="${safe(employment.houwai_joined_on)}">${safe(day(employment.houwai_joined_on))}</time></span><b>${safe(tenure)}</b></p>`);
    }

    const back=document.querySelector('[data-org-back]');if(back){back.removeAttribute('data-org-back');back.setAttribute('data-v8-return','');back.textContent='‹ 返回教师名单';}
    if(restoreScroll!=null){const top=restoreScroll;restoreScroll=null;requestAnimationFrame(()=>window.scrollTo({top,behavior:'instant'}));}
  }
  render=function(){const y=window.scrollY;if(detailContext)document.querySelectorAll('details[data-v8-detail]').forEach(el=>openDetails.set(detailContext+'|'+el.dataset.v8Detail,el.open));original.render.apply(this,arguments);decorate();detailContext=state.actor+'|'+location.hash;document.querySelectorAll('details[data-v8-detail]').forEach(el=>{if(openDetails.has(detailContext+'|'+el.dataset.v8Detail))el.open=openDetails.get(detailContext+'|'+el.dataset.v8Detail);});if(returnState&&location.hash===returnState.hash&&document.getElementById('v8Department')){const top=restoreScroll??returnState.y;restoreScroll=null;requestAnimationFrame(()=>window.scrollTo({top,behavior:'instant'}));returnState=null;}else if(y>0&&state.page==='profile'&&org.detailId&&profileId===org.detailId)window.scrollTo({top:y,behavior:'instant'});};
  function rerender(){render();}
  function openTeacher(id){const s=getSettings();returnState={hash:location.hash,settings:{...s},scope:scopeKey(),q:org.q,category:org.category,page:org.page,facet:org.facet,value:org.value,y:window.scrollY};state.profileTab='growth';org.report=false;go('profile',id);window.scrollTo({top:0,behavior:'instant'});}
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-v8-view],[data-v8-page],[data-v8-open],[data-v8-team],[data-v8-type],[data-v8-clear-team],[data-v8-clear-facet],[data-v8-campus],[data-v8-return],[data-v8-retry]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();
    const s=getSettings();
    if(el.hasAttribute('data-v8-open')){openTeacher(el.dataset.v8Open);return;}
    if(el.hasAttribute('data-v8-return')){
      if(returnState){settings.set(returnState.scope,{...returnState.settings});Object.assign(org,{q:returnState.q,category:returnState.category,page:returnState.page,facet:returnState.facet,value:returnState.value});const hash=returnState.hash;restoreScroll=returnState.y;if(location.hash===hash){readRoute();render();orgEnsure();}else location.hash=hash;}
      else if(window.HouwaiOrgFlow)window.HouwaiOrgFlow.navigate(org.campus,org.department,'roster');else{org.detailId='';go('profile');}return;
    }
    if(el.hasAttribute('data-v8-campus')){settings.delete(scopeKey());if(window.HouwaiOrgFlow)window.HouwaiOrgFlow.navigate(el.dataset.v8Campus,el.dataset.v8Department||'',state.page==='profile'?'roster':state.page);else{org.campus=el.dataset.v8Campus;org.department=el.dataset.v8Department||'';org.summary=null;orgRoster();render();}window.scrollTo({top:0,behavior:'instant'});return;}
    if(el.hasAttribute('data-v8-retry')){errors.delete(scopeKey());cache.delete(scopeKey());rerender();return;}
    if(el.hasAttribute('data-v8-view')){s.view=el.dataset.v8View;s.page=1;}
    if(el.hasAttribute('data-v8-page')){s.page=Number(el.dataset.v8Page);}
    if(el.hasAttribute('data-v8-team')){s.team=el.dataset.v8Team;s.view='roster';s.page=1;s.q='';s.category='';}
    if(el.hasAttribute('data-v8-type'))s.type=el.dataset.v8Type;
    if(el.hasAttribute('data-v8-clear-team'))s.team='';
    if(el.hasAttribute('data-v8-clear-facet')){org.facet='';org.value='';s.page=1;}
    rerender();
  },true);
  document.addEventListener('submit',e=>{if(e.target.id!=='v8Search')return;e.preventDefault();e.stopImmediatePropagation();const s=getSettings();s.q=document.getElementById('v8Query').value.trim();s.page=1;rerender();},true);
  document.addEventListener('change',e=>{if(e.target.id==='v8Category'){e.preventDefault();e.stopImmediatePropagation();const s=getSettings();s.category=e.target.value;s.page=1;rerender();}},true);
  document.addEventListener('change',e=>{if(e.target.id==='actorSelect'){returnState=null;restoreScroll=null;profileId='';}});
  if(typeof publicData!=='undefined')Promise.resolve(publicData).then(d=>{referencePeople=list(d.people);});
  document.addEventListener('toggle',e=>{const el=e.target;if(el.matches?.('details[data-v8-detail]')&&el.isConnected&&detailContext)openDetails.set(detailContext+'|'+el.dataset.v8Detail,el.open);},true);
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(decorate,100);});
  window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#profile/')&&org.detailId!==profileId)window.scrollTo({top:0,behavior:'instant'});});
  window.HouwaiV8={get payload(){return payload();},get profile(){return org.detail?.management_v8;},settings,cache,setView(view){if(views.some(x=>x[0]===view)){getSettings().view=view;getSettings().page=1;render();}}};
  if(state.data)render();
})();
