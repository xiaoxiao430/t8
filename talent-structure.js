'use strict';
/* Scoped organization structure and adjustable, non-persistent demonstration references. */
(() => {
  const views=new Map(),requests=new Set(),trees=new Map();
  const defaults={mentor_min:1,backup_min:1,mentor_capacity:3,new_teacher_years:3};
  const fallbackBounds={mentor_min:[1,5],backup_min:[1,5],mentor_capacity:[1,8],new_teacher_years:[0,5]};
  const safe=v=>esc(v==null?'':String(v)),arr=v=>Array.isArray(v)?v:[];
  const number=v=>Number.isFinite(Number(v))?Number(v):0;
  const referenceLabels={mentor_min:'每教研组导师候选至少',backup_min:'每岗位后备至少',mentor_capacity:'每位导师最多带教',new_teacher_years:'新教师教龄不超过'};
  const referenceUnits={mentor_min:'人',backup_min:'人',mentor_capacity:'人',new_teacher_years:'年'};
  const chartLabels={age:'年龄分布',gender:'性别分布',education:'最终学历',university:'最终毕业院校',major:'所学专业',experience:'教龄分布',first_education:'第一学历',subject:'任教学科',awards:'获奖情况',certificates:'资格与培训证书',school:'毕业学校',position:'当前岗位'};
  const coreCharts=['age','gender','education','university','major','school','position','experience'];
  let source=null,sourceReady=false,sourceError='',activeKey='',drawer=null,drawerSerial=0,drawerFocus=null,bodyOverflow='',returnTicket=null,restoringList=false;
  const who=()=>state.actor||state.data?.actor?.id||'';
  const keyOf=scope=>[who(),scope.campus||'',scope.department||''].join('|');
  const badge=(status,label)=>`<span class="tal-badge ${safe(status||'limited')}">${safe(label||'资料有限')}</span>`;
  const percent=(a,b)=>b>0?(a/b*100).toFixed(1)+'%':'—';
  const scopeOf=scope=>({campus:scope.campus||'',department:scope.department||''});
  function getView(scope){
    const key=keyOf(scope);activeKey=key;
    if(!views.has(key))views.set(key,{key,actor:who(),main:scopeOf(scope),...scopeOf(scope),population:'teaching',education_basis:'highest',reference:{...defaults},draft:{...defaults},result:null,error:'',serial:0});
    return views.get(key);
  }
  const treeFor=v=>source?.tree||trees.get(v.actor)||(org.actor===state.actor?org.tree:null)||org.tree;
  function ensureTree(v){
    if(treeFor(v)||requests.has('tree|'+v.actor))return;
    requests.add('tree|'+v.actor);
    request('/organization/tree').then(t=>{trees.set(v.actor,t);}).catch(()=>{}).finally(()=>{requests.delete('tree|'+v.actor);if(v.actor===who())render();});
  }
  function run(v){
    ensureTree(v);const query={campus:v.campus,department:v.department,population:v.population,education_basis:v.education_basis,reference:{...v.reference}};
    const pendingKey=v.key+'|'+JSON.stringify(query);if(!source&&requests.has(pendingKey))return;const serial=++v.serial;
    if(source&&window.HouwaiTalent){
      try{v.result=window.HouwaiTalent.analyze(source,query);v.error='';}catch(e){v.result=null;v.error=e.message||'当前范围暂时无法分析。';}
      return;
    }
    if(typeof publicData!=='undefined'&&!sourceReady)return;
    if(typeof publicData!=='undefined'&&(sourceError||!source)){v.error=sourceError||'队伍分析资料尚未收录。';return;}
    requests.add(pendingKey);v.error='';
    request('/organization/talent-structure?'+new URLSearchParams({campus:v.campus,department:v.department,population:v.population,education_basis:v.education_basis,...v.reference})).then(result=>{if(v.actor===who()&&serial===v.serial){v.result=result;v.error='';}}).catch(e=>{if(v.actor===who()&&serial===v.serial){v.result=null;v.error=e.message;}}).finally(()=>{requests.delete(pendingKey);if(v.actor===who()&&serial===v.serial)render();});
  }
  function treeCampuses(v){return arr(treeFor(v)?.campuses);}
  function departments(v){return arr(treeCampuses(v).find(c=>c.name===v.campus)?.departments).map(d=>typeof d==='string'?d:d.name);}
  function filters(v){
    const t=treeFor(v),campuses=treeCampuses(v),top=t?.scope?.level==='group'?'集团汇总':'授权范围汇总';
    return `<div class="tal-filters"><label><span>校区</span><select id="talentCampus" aria-label="队伍分析校区"><option value="">${safe(top)}</option>${campuses.map(c=>`<option value="${safe(c.name)}" ${v.campus===c.name?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label><label><span>学部</span><select id="talentDepartment" aria-label="队伍分析学部" ${!v.campus?'disabled':''}><option value="">${v.campus?'本校区全部学部':'先选择校区'}</option>${departments(v).map(d=>`<option value="${safe(d)}" ${v.department===d?'selected':''}>${safe(d)}</option>`).join('')}</select></label><label><span>统计对象</span><select id="talentPopulation" aria-label="队伍分析统计对象"><option value="teaching" ${v.population==='teaching'?'selected':''}>任教人员</option><option value="all" ${v.population==='all'?'selected':''}>全部教职工</option></select></label><button type="button" data-tal-reset>${safe(top)} ↗</button></div>`;
  }
  function rules(v,result){
    const bounds=result.reference?.bounds||fallbackBounds;
    return `<details class="tal-rules" data-tal-rules data-v8-detail="talent-rules"><summary><span>演示参考目标</span><span class="tal-rule-summary">每组导师候选 ${safe(v.reference.mentor_min)} · 岗位后备 ${safe(v.reference.backup_min)} <i aria-hidden="true">⌄</i></span></summary><form id="talentReferenceForm"><p>可调整下面四项，看看当前范围的配置和梯队建议怎样变化。</p><div class="tal-rule-inputs">${Object.keys(defaults).map(key=>{const b=bounds[key]||fallbackBounds[key];return `<label><span>${referenceLabels[key]}</span><span class="tal-number-input"><input name="${key}" data-tal-ref type="number" min="${b[0]}" max="${b[1]}" step="1" value="${safe(v.draft[key])}" required aria-label="${referenceLabels[key]}${referenceUnits[key]}"><small>${referenceUnits[key]}</small></span></label>`;}).join('')}</div><div class="tal-rule-footer"><small>${safe(result.reference?.note||'仅用于本次模拟，不改变教师评价、岗位与人员资料。')}</small><div><button type="button" data-tal-defaults>恢复默认</button><button type="submit" data-tal-apply>重新研判</button></div></div></form></details>`;
  }
  function counts(result){const c=result.counts||{},label=result.population==='all'?'教职工':'任教人员';
    return `<div class="tal-counts">${[['selected',label,'人'],['mentor_candidates','导师候选','人'],['backups','岗位后备','人'],['new_teachers','新教师','人']].map(([key,name,unit])=>`<div><strong data-tal-count="${key}">${safe(c[key]??0)}<small>${unit}</small></strong><span>${name}</span></div>`).join('')}</div>`;
  }
  function gapText(gaps){
    const groups=new Map();for(const gap of arr(gaps)){const label=[gap.campus,gap.department,gap.subject].filter(Boolean).join(' · ')||'当前分析范围';groups.set(label,(groups.get(label)||0)+1);}
    return [...groups].map(([name,count])=>`${name} ${count}项`).join('；');
  }
  function checks(result){const rows=arr(result.analysis?.checks);
    return `<section class="tal-reference"><header><div><h3>配置与梯队 · 参考对照</h3><p>按当前分析范围逐项查看，不为教师计算总分。</p></div></header><table><thead><tr><th>项目</th><th>演示参考目标</th><th>当前符合</th><th>需安排 / 待了解</th><th>本次研判</th></tr></thead><tbody>${rows.map(row=>{const total=number(row.total),matched=number(row.matched),rate=total>0?Math.min(100,matched/total*100):0;return `<tr data-tal-reference-row="${safe(row.key)}"><td class="tal-ref-project"><strong>${safe(row.label)}</strong></td><td class="tal-ref-target" data-label="演示参考目标">${safe(row.target??'按本次参考')}</td><td data-label="当前符合"><b>${matched} / ${total}</b><span class="tal-progress" aria-hidden="true"><i style="width:${rate}%"></i></span></td><td data-label="需安排 / 待了解"><b class="${total-matched-number(row.missing)>0?'tal-gap-number':''}" data-tal-gap-count>${Math.max(0,total-matched-number(row.missing))}</b><small>项需安排</small><span class="tal-limited-count" data-tal-limited-count>${safe(row.missing??0)} 项待了解</span></td><td class="tal-ref-result">${badge(row.status,row.status==='met'?'符合参考':row.status==='gap'?'需要补强':'资料有限')}${arr(row.gaps).length?`<details class="tal-gaps"><summary>查看组织分布</summary><p>${safe(gapText(row.gaps))}</p></details>`:''}</td></tr>`;}).join('')||'<tr><td colspan="5">当前范围暂无可对照的项目。</td></tr>'}</tbody></table></section>`;
  }
  function chart(key,result){const rows=arr(result.charts?.[key]),max=Math.max(1,...rows.map(x=>number(x.count))),selected=number(result.counts?.selected),overlap=['awards','certificates'].includes(key);
    const bar=x=>`<button type="button" class="tal-chart-row" data-tal-facet="${safe(key)}" data-tal-value="${safe(x.key)}" data-tal-label="${safe(x.label)}" aria-label="查看${safe(x.label)}的${safe(x.count)}位人员"><span title="${safe(x.label)}">${safe(x.label)}</span><span class="tal-bar" aria-hidden="true"><i style="width:${number(x.count)/max*100}%"></i></span><b>${safe(x.count)}</b><small>${percent(number(x.count),selected)}</small></button>`;
    return `<article class="tal-chart" data-tal-chart="${safe(key)}"><header><h4>${safe(['education','university','school'].includes(key)?(result.education_basis==='first'?'第一学历':'最终学历')+({education:'',university:'院校类别',school:'毕业学校'}[key]):chartLabels[key]||key)}</h4><span>${selected} 人 · 点分类查看</span></header>${rows.length?rows.slice(0,6).map(bar).join(''):'<p class="tal-empty">本范围暂无该项资料。</p>'}${rows.length>6?`<details class="tal-chart-more"><summary>其余 ${rows.length-6} 类</summary>${rows.slice(6).map(bar).join('')}</details>`:''}${overlap?'<p class="tal-chart-note">一人可有多项，各类人数不相加。</p>':''}</article>`;
  }
  function charts(result){const more=Object.keys(chartLabels).filter(k=>!coreCharts.includes(k)&&result.charts?.[k]);
    return `<section class="tal-structure"><header><div><h3>人员结构</h3><p>年龄、性别、学历和院校仅展示分布，不作为教师优劣或岗位资格的门槛。</p></div><label class="tal-education-basis"><span>学历与院校口径</span><select id="talentEducationBasis" aria-label="学历与院校统计口径"><option value="highest" ${result.education_basis!=='first'?'selected':''}>最终学历</option><option value="first" ${result.education_basis==='first'?'selected':''}>第一学历</option></select></label></header><div class="tal-chart-grid">${coreCharts.filter(k=>result.charts?.[k]).map(k=>chart(k,result)).join('')}</div><div class="tal-education-note">${[['bachelor_plus','本科及以上',result.counts?.bachelor_plus],['university_985','985院校',result.counts?.university_985],['university_211','211院校（含985）',result.counts?.university_211]].map(([facet,label,count])=>`<button type="button" data-tal-facet="${facet}" data-tal-value="true" data-tal-label="${label}">${label} <b>${safe(count??0)}</b> 人 ↗</button>`).join('')}</div>${more.length?`<details class="tal-more-structure" data-v8-detail="talent-more-charts"><summary>任教学科、第一学历、荣誉与证书</summary><div class="tal-chart-grid">${more.map(k=>chart(k,result)).join('')}</div></details>`:''}</section>`;
  }
  function stages(result){const rows=arr(result.stages).filter(s=>number(s.counts?.selected)>0);
    return `<section class="tal-stages"><header><h3>按学段看培养重点</h3><span>小学、初中、高中分别考虑</span></header><div class="tal-stage-grid">${rows.map(s=>`<article data-tal-stage="${safe(s.key)}"><header><h4>${safe(s.label)}</h4><b>${safe(s.counts?.selected??0)}<small>人</small></b></header><p class="tal-stage-focus">${safe(s.focus)}</p>${s.analysis?.summary?`<p>${safe(s.analysis.summary)}</p>`:''}${s.analysis?.label?badge(s.analysis.status,s.analysis.label):''}</article>`).join('')||'<p class="tal-empty">当前范围暂无可按学段分析的人员。</p>'}</div></section>`;
  }
  function actions(result){const groups=[['talent','人才配置建议','◎'],['ladder','梯队培养建议','✦']];
    return `<section class="tal-actions"><header><h3>下一步怎样安排</h3><p>先明确组织层面的安排，再由校方与教师商量落实。</p></header><div class="tal-action-columns">${groups.map(([key,label,glyph])=>`<div><h4><i aria-hidden="true">${glyph}</i>${label}</h4>${arr(result.actions?.[key]).map((action,index)=>`<details data-tal-action="${key}" ${index===0?'open':''}><summary><span>${index+1}</span>${safe(action.title)}</summary><p>${safe(action.text)}</p></details>`).join('')||'<p class="tal-empty">当前暂无额外安排建议。</p>'}</div>`).join('')}</div></section>`;
  }
  function body(v,result){const analysis=result.analysis||{},scope=result.scope||{},caption=scope.label||[v.campus,v.department].filter(Boolean).join(' · ')||'授权范围汇总';
    return `${filters(v)}<div class="tal-scope" data-tal-scope><span>当前分析范围</span><strong>${safe(caption)}</strong><b>${result.population==='all'?'全部教职工':'任教人员'}</b></div>${counts(result)}<p class="tal-workforce-note">本范围 <b>${safe(result.counts?.teaching??0)}</b> 位任教人员 · <b data-tal-reserve>${safe(result.counts?.reserve??result.counts?.non_teaching??0)}</b> 位实习／储备（占教职工 ${percent(number(result.counts?.reserve??result.counts?.non_teaching),number(result.counts?.staff))}）。培养与岗位参考仅看任教人员。</p><section class="tal-analysis" data-tal-analysis><header><div><span class="tal-ai-symbol" aria-hidden="true">✦</span><h3>AI研判示例</h3><span class="tal-demo-label">规则演示</span></div>${badge(analysis.status,analysis.label)}</header><p>${safe(analysis.summary||'结合学科配置、导师和岗位后备情况，逐项讨论培养安排。')}</p><small>根据本次数据与演示参考生成，供校方讨论，不代表学校现行规定。</small>${arr(analysis.limit_notes).length?`<details class="tal-limit-notes"><summary>本次分析说明</summary>${analysis.limit_notes.map(x=>`<p>${safe(x)}</p>`).join('')}</details>`:''}</section>${rules(v,result)}${checks(result)}${stages(result)}${actions(result)}${charts(result)}`;
  }
  function html(scope={}){
    const v=getView(scope);if(!v.result&&!v.error)run(v);
    return `<section id="talentStructurePanel" class="tal-panel" data-tal-key="${safe(v.key)}" data-tal-loaded="${!!v.result}" data-tal-campus="${safe(v.campus)}" data-tal-department="${safe(v.department)}" data-tal-population="${safe(v.population)}" data-tal-education-basis="${safe(v.education_basis)}">${v.result?body(v,v.result):`${filters(v)}<div class="tal-loading" role="status"><h3>队伍结构与培养建议</h3><p>${safe(v.error||'正在整理当前范围的结构与培养资料…')}</p>${v.error?'<button type="button" data-tal-retry>重新读取</button>':''}</div>`}</section>`;
  }
  const current=target=>{const panel=target.closest('#talentStructurePanel');return panel?views.get(panel.dataset.talKey):null;};
  const refresh=v=>{v.result=null;v.error='';run(v);render();};
  function listTitle(d){const basis=d.query.education_basis==='first'?'第一学历':'最终学历',degree=['education','university','school','bachelor_plus','university_985','university_211'].includes(d.facet);return (degree?basis:(chartLabels[d.facet]||'人员分类'))+' · '+d.label;}
  function listDepartments(d){const v=views.get(d.viewKey);return arr(treeFor(v)?.campuses).find(c=>c.name===d.query.campus)?.departments||[];}
  function listFilters(d){const v=views.get(d.viewKey),campuses=treeCampuses(v),deps=listDepartments(d).map(x=>typeof x==='string'?x:x.name);return `<div class="tal-list-filters"><label><span>校区</span><select id="talentListCampus" aria-label="分类名单校区"><option value="">授权范围汇总</option>${campuses.map(c=>`<option value="${safe(c.name)}" ${d.query.campus===c.name?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label><label><span>学部</span><select id="talentListDepartment" aria-label="分类名单学部" ${d.query.campus?'':'disabled'}><option value="">全部可查看学部</option>${deps.map(name=>`<option value="${safe(name)}" ${d.query.department===name?'selected':''}>${safe(name)}</option>`).join('')}</select></label><button type="button" data-tal-list-all>查看本类全部人员</button></div>`;}
  function distribution(result){return `<div class="tal-distribution" aria-label="本分类校区与学部分布">${arr(result.distribution).map(c=>`<div><button type="button" data-tal-list-campus="${safe(c.campus)}"><span>${safe(c.campus)}</span><b>${safe(c.count)}人</b></button><div>${arr(c.departments).map(d=>`<button type="button" data-tal-list-campus="${safe(c.campus)}" data-tal-list-dept="${safe(d.department)}">${safe(d.department)} <b>${safe(d.count)}</b></button>`).join('')}</div></div>`).join('')||'<p>当前范围没有本类人员。</p>'}</div>`;}
  function degree(d){d=d||{};const tier=d.tier==='985'?'985':d.tier==='211非985'?'211':'';return `<span>${safe(d.education||'未填写')}${tier?`<b class="roster-school-badge tier-${tier}">${tier}</b>`:''}</span><small>${safe(d.university||'学校未填写')}</small>`;}
  function personRows(items){return `<table class="tal-person-table"><thead><tr>${['教师 / 岗位','入职厚外','年龄 / 性别','第一学历 / 学校','最终学历 / 学校','专业','任教学科'].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${arr(items).map(p=>`<tr data-tal-list-person="${safe(p.id)}"><td class="tal-person-cell"><button type="button" data-tal-person="${safe(p.id)}">${typeof avatar==='function'?avatar(p,'tal-list-avatar'):''}<span><strong>${safe(p.name)}</strong><small>${safe(p.position||'教职工')}</small></span></button><span class="tal-person-org">${safe(p.campus)} · ${safe(p.department||'待分学部')}</span></td><td data-label="入职厚外">${safe(p.houwai_joined_on||p.teaching_profile?.houwai_joined_on||'未填写')}<small>${p.houwai_tenure_years!=null?'在厚外 '+safe(p.houwai_tenure_years)+'年':'进入厚外的时间'}</small></td><td data-label="年龄 / 性别">${p.age==null?'未填写':safe(p.age)+'岁'} · ${safe(p.gender||'未填写')}</td><td data-label="第一学历">${degree(p.first_education)}</td><td data-label="最终学历">${degree(p.final_education||p.highest)}</td><td data-label="专业">${safe(p.major||'未填写')}</td><td data-label="任教学科">${safe(p.teaching===false?(/实习|跟岗|待岗|储备/.test(p.position||'')?'未独立任课':'保障岗位'):p.subject||'未填写')}</td></tr>`).join('')||'<tr><td colspan="7">没有符合当前条件的人员。</td></tr>'}</tbody></table>`;}
  function renderDrawer(){
    if(!drawer)return;const d=drawer,result=d.result,focusId=document.activeElement?.id;
    let host=document.getElementById('talentPeopleOverlay');
    if(!host){drawerFocus=document.activeElement;bodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';host=document.createElement('div');host.id='talentPeopleOverlay';document.body.append(host);}
    host.innerHTML=`<div class="tal-list-backdrop" data-tal-list-close></div><section class="tal-list-dialog" role="dialog" aria-modal="true" aria-labelledby="talentPeopleTitle"><header><div><span>队伍结构 · 分类名单</span><h2 id="talentPeopleTitle">${safe(listTitle(d))}</h2><p>${d.query.population==='all'?'全部教职工':'任教人员'} · ${safe(d.query.campus||'授权范围汇总')}${d.query.department?' · '+safe(d.query.department):''}</p></div><button type="button" data-tal-list-close aria-label="关闭分类名单">×</button></header><div class="tal-list-body">${listFilters(d)}${result?`<div class="tal-list-total"><strong data-tal-list-total>${safe(result.total)}</strong> 人符合条件<span>当前分类全部匹配人员，可按校区和学部筛选</span></div>${distribution(result)}${personRows(result.items)}<div class="tal-list-pagination"><span>第 ${safe(result.page)} / ${safe(result.pages)} 页 · 每页 ${safe(result.page_size)} 人</span><button type="button" data-tal-list-page="${number(result.page)-1}" ${result.page<=1?'disabled':''}>上一页</button><button type="button" data-tal-list-page="${number(result.page)+1}" ${result.page>=result.pages?'disabled':''}>下一页</button></div>`:`<p class="tal-list-loading" role="status">${safe(d.error||'正在读取本分类人员…')}</p>`}</div></section>`;
    if(focusId&&host.querySelector('#'+focusId))host.querySelector('#'+focusId).focus();else if(!result)host.querySelector('[data-tal-list-close]')?.focus();
  }
  function fetchPeople(){
    if(!drawer)return;const d=drawer,serial=++drawerSerial;d.result=null;d.error='';
    if(source&&window.HouwaiTalent?.personnel){try{d.result=window.HouwaiTalent.personnel(source,d.query);}catch(e){d.error=e.message;}renderDrawer();return;}
    renderDrawer();request('/organization/talent-structure/personnel?'+new URLSearchParams(d.query)).then(result=>{if(drawer===d&&serial===drawerSerial){d.result=result;renderDrawer();}}).catch(e=>{if(drawer===d&&serial===drawerSerial){d.error=e.message;renderDrawer();}});
  }
  function openPeople(v,facet,value,label){drawer={viewKey:v.key,facet,value,label,query:{campus:v.campus,department:v.department,population:v.population,education_basis:v.education_basis,facet,value,page:1,page_size:20},result:null,error:''};fetchPeople();}
  function closePeople(){drawerSerial++;document.getElementById('talentPeopleOverlay')?.remove();document.body.style.overflow=bodyOverflow;drawer=null;if(drawerFocus?.isConnected)drawerFocus.focus();}
  function openPerson(id){const d=drawer;if(!d)return;returnTicket={hash:location.hash,y:window.scrollY,person:id,list:{...d,query:{...d.query},result:null}};closePeople();state.profileTab='growth';state.teacher=id;org.report=false;go('profile',id);window.scrollTo({top:0,behavior:'instant'});}
  function afterRender(){if(returnTicket&&state.page==='profile'&&org.detailId){const back=document.querySelector('[data-v8-return],[data-org-back]');if(back){back.removeAttribute('data-v8-return');back.removeAttribute('data-org-back');back.dataset.talReturn='';back.textContent='‹ 返回分类名单';}}if(restoringList&&returnTicket&&location.hash===returnTicket.hash&&document.getElementById('talentStructurePanel')){const ticket=returnTicket;returnTicket=null;restoringList=false;document.querySelector('details.v8-hr-analysis')?.setAttribute('open','');requestAnimationFrame(()=>{window.scrollTo({top:ticket.y,behavior:'instant'});drawer=ticket.list;fetchPeople();});}}
  const nativeRender=render;
  render=function(){nativeRender.apply(this,arguments);afterRender();};
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-nav],[data-page],.brand')&&returnTicket){returnTicket=null;restoringList=false;}
    const button=event.target.closest('[data-tal-facet],[data-tal-list-close],[data-tal-list-page],[data-tal-list-campus],[data-tal-list-all],[data-tal-person],[data-tal-return]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.hasAttribute('data-tal-facet')){const v=current(button);if(v)openPeople(v,button.dataset.talFacet,button.dataset.talValue,button.dataset.talLabel||button.dataset.talValue);return;}
    if(button.hasAttribute('data-tal-return')&&returnTicket){restoringList=true;const hash=returnTicket.hash;if(location.hash===hash)render();else location.hash=hash;return;}
    if(button.hasAttribute('data-tal-list-close')){closePeople();return;}
    if(button.hasAttribute('data-tal-person')){openPerson(button.dataset.talPerson);return;}
    if(!drawer)return;
    if(button.hasAttribute('data-tal-list-page'))drawer.query.page=Number(button.dataset.talListPage);
    else {drawer.query.page=1;if(button.hasAttribute('data-tal-list-all')){drawer.query.campus='';drawer.query.department='';}else{drawer.query.campus=button.dataset.talListCampus;drawer.query.department=button.dataset.talListDept||'';}}
    fetchPeople();
  },true);
  document.addEventListener('change',event=>{if(!drawer||!['talentListCampus','talentListDepartment'].includes(event.target.id))return;event.stopImmediatePropagation();if(event.target.id==='talentListCampus'){drawer.query.campus=event.target.value;drawer.query.department='';}else drawer.query.department=event.target.value;drawer.query.page=1;fetchPeople();},true);
  document.addEventListener('keydown',event=>{
    const host=document.getElementById('talentPeopleOverlay');if(!host)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closePeople();return;}
    if(event.key==='Tab'){const nodes=[...host.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  },true);
  window.addEventListener('hashchange',()=>{if(returnTicket&&location.hash===returnTicket.hash){restoringList=true;render();}else if(returnTicket&&!location.hash.startsWith('#profile/')){returnTicket=null;restoringList=false;}if(drawer&&!location.hash.startsWith('#profile/'))closePeople();});
  document.addEventListener('change',event=>{
    if(!['talentCampus','talentDepartment','talentPopulation','talentEducationBasis'].includes(event.target.id))return;
    const v=current(event.target);if(!v)return;event.stopImmediatePropagation();
    if(event.target.id==='talentCampus'){v.campus=event.target.value;v.department='';}
    if(event.target.id==='talentDepartment')v.department=event.target.value;
    if(event.target.id==='talentPopulation')v.population=event.target.value;
    if(event.target.id==='talentEducationBasis')v.education_basis=event.target.value;
    refresh(v);
  },true);
  document.addEventListener('input',event=>{if(!event.target.matches('[data-tal-ref]'))return;const v=current(event.target);if(v)v.draft[event.target.name]=event.target.value;},true);
  document.addEventListener('submit',event=>{
    if(event.target.id!=='talentReferenceForm')return;event.preventDefault();event.stopImmediatePropagation();const v=current(event.target);if(!v||!event.target.reportValidity())return;
    const values={};for(const key of Object.keys(defaults))values[key]=Number(event.target.elements[key].value);v.reference=values;v.draft={...values};refresh(v);
  },true);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-tal-reset],[data-tal-defaults],[data-tal-retry]');if(!button)return;const v=current(button);if(!v)return;event.preventDefault();event.stopImmediatePropagation();
    if(button.hasAttribute('data-tal-reset')){v.campus='';v.department='';}
    if(button.hasAttribute('data-tal-defaults')){v.reference={...defaults};v.draft={...defaults};}
    refresh(v);
  },true);
  window.HouwaiTalentView={html,afterRender,get current(){return views.get(activeKey);},views};
  if(typeof publicData!=='undefined')Promise.resolve(publicData).then(data=>{source=data.talent_structure_source||null;sourceReady=true;if(!source)sourceError='当前演示未收录队伍结构资料。';for(const v of views.values()){v.result=null;v.error='';run(v);}if(state.data)render();}).catch(e=>{sourceReady=true;sourceError=e.message;if(state.data)render();});
  if(state.data)render();
})();
