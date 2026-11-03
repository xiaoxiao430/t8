'use strict';
/* Human appraisal is independent of machine signals and historical quantitative facts. */
(function(){
  const cache=new Map(),pending=new Set(),errors=new Map();
  const hu={teacher:'',periodType:'month',period:'2026-10',modal:null,returnFocus:null,drill:null,goalType:'semester'};
  const statusLabels={draft:'待初评',reviewing:'专业初评中',ready:'待校长确认',confirmed:'已确认',archived:'已归档'};
  const usageLabels={usable:'可用于评价',reference:'仅供参考',pending:'待核实'};
  const categoryLabels={excellent:'优秀',good:'良好',support:'重点支持',pending:'资料待补齐',pending_review:'待评价',not_applicable:'不适用'};
  const issueLabels={data:'系统与数据',teaching:'教育教学',school:'学校支持'};
  const actionLabels={draft:'更新综合短评',professional:'专业初评',evidence:'核验依据',issue:'安排跟进', 'issue-resolve':'完成跟进',confirm:'校长确认',respond:'教师回应','assign-reviewer':'指定独立复核人',resolve:'独立复核',revise:'开启修订',archive:'归档','development-profile':'个人特点','development-goals':'个人目标','development-progress':'目标进展','development-tags':'个人标签'};
  if(typeof ROLE!=='undefined'){ROLE.teaching_leader='教研组';ROLE.information_officer='信息核验';ROLE.independent_reviewer='独立复核';}
  const safe=x=>esc(x==null?'':String(x));
  const arr=x=>Array.isArray(x)?x:[];
  const dateText=x=>x?String(x).slice(0,10).replaceAll('-','.'):'待约定';
  const isPublic=()=>typeof publicData!=='undefined';
  const actor=()=>state.data?.actor||{};
  const restrictedRole=()=>['teaching_leader','information_officer','independent_reviewer'].includes(actor().role);
  function profileContext(){
    if(state.page!=='profile'||typeof org==='undefined'||!org.detailId)return null;
    if(restrictedRole()){if(hu.teacher!==org.detailId){hu.teacher=org.detailId;hu.periodType='month';hu.period='2026-10';}return {teacher:org.detailId,type:hu.periodType,period:hu.period};}
    if(!org.detail?.person)return null;
    const p=org.detail.person;if(p.id!==org.detailId||p.teaching===false||actor().role==='mentor')return null;
    if(hu.teacher!==p.id){hu.teacher=p.id;hu.periodType='month';hu.period='2026-10';}
    return {teacher:p.id,type:hu.periodType,period:hu.period};
  }
  function dashboardContext(){
    if(!['overview','group'].includes(state.page)||actor().role==='mentor')return null;
    return {campus:(typeof org==='undefined'?'':org.campus||'')||(actor().role!=='group'?actor().campus||'':''),department:(typeof org==='undefined'?'':org.department||'')||(actor().role!=='group'?actor().department||'':''),type:'month',period:'2026-10'};
  }
  function pathFor(c){
    if(c.development)return '/development/'+encodeURIComponent(c.teacher);
    const q=new URLSearchParams({period_type:c.type,period:c.period});
    if(c.teacher)return '/human-reviews/'+encodeURIComponent(c.teacher)+'?'+q;
    q.set('campus',c.campus);q.set('department',c.department);return '/human-reviews/dashboard?'+q;
  }
  function keyFor(c){return state.actor+'|'+pathFor(c);}
  function load(c,force=false){
    if(!c)return;const key=keyFor(c);if(pending.has(key)||(!force&&(cache.has(key)||errors.has(key))))return;
    pending.add(key);errors.delete(key);const who=state.actor;
    Promise.resolve(request(pathFor(c))).then(s=>{if(who===state.actor)cache.set(key,s);}).catch(e=>{if(who===state.actor)errors.set(key,e.message);}).finally(()=>{pending.delete(key);if(who===state.actor){const current=c.teacher?profileContext():dashboardContext();if(current&&(keyFor(current)===key||(c.development&&current.teacher===c.teacher)||(!c.teacher&&!current.teacher&&c.campus===current.campus&&c.department===current.department)))render();}});
  }
  function placeholder(c,organization=false){const error=errors.get(keyFor(c));return `<section id="${organization?'humanOrganizationPanel':'humanReviewCard'}" class="hu-panel hu-loading" data-hu-loaded="false"><h2>人工综合评价</h2><p>${error?safe(error):'正在读取人工评价、专业初评与依据状态…'}</p>${error?'<button class="text-link" data-hu-retry>重新读取</button>':''}</section>`;}
  function badge(text,tone=''){return `<span class="hu-badge ${safe(tone)}">${safe(text)}</span>`;}
  function compact(value,fallback){return safe(typeof value==='string'&&value.trim()?value:fallback);}
  function named(ref){return ref?.actor_name||ref?.reviewer_name||'待指定';}
  function meta(r){const x=r.confirmation;return x?`${safe(named(x))} · ${dateText(x.date)} · 第${safe(x.version||r.version||1)}版`:`${statusLabels[r.status]||'待评价'} · 人工确认后形成正式评价`;}
  function periods(c){return `<div class="hu-periods" role="group" aria-label="人工评价期间"><button data-hu-period="month|2026-10" aria-pressed="${c.type==='month'}" class="${c.type==='month'?'active':''}">本月短评</button><button data-hu-period="semester|2026-spring" aria-pressed="${c.type==='semester'}" class="${c.type==='semester'?'active':''}">春季学期综合</button></div>`;}
  function narrativeBlock(label,text,fallback,cls=''){return `<div class="hu-narrative-item ${cls}"><h3>${label}</h3><p>${compact(text,fallback)}</p></div>`;}
  function profileCard(s,c){
    const r=s.record||{},n=r.narrative||{},caps=s.capabilities||{},confirmed=['confirmed','archived'].includes(r.status),e=arr(r.evidence),counts=Object.fromEntries(Object.keys(usageLabels).map(k=>[k,e.filter(v=>v.usability===k).length]));
    const category=r.confirmation?.category;
    const latest=arr(r.responses).at(-1),professional=r.professional||{};
    return `<section id="humanReviewCard" class="hu-panel hu-profile-card" data-hu-loaded="true" data-hu-teacher="${safe(c.teacher)}" data-hu-period="${safe(c.type+'|'+c.period)}" aria-label="人工综合评价卡"><header class="hu-heading"><div><span class="hu-eyebrow">先理解教师 · 再核对数字</span><h2>人工综合评价 ${badge(statusLabels[r.status]||'待评价',confirmed?'confirmed':'pending')}</h2><p>${safe(s.label||c.period)} · ${c.type==='month'?'月度短评，独立于最近完整学期档次':'学期综合，保留发布时的依据与版本'}</p></div>${periods(c)}</header><div class="hu-judgment"><span>当前综合判断</span><p>${compact(n.judgment,'尚未形成综合判断，先核对已有记录并完成专业初评。')}</p><small>${meta(r)}${c.type==='month'?' · 月度短评，不作学期定级':category?' · 正式分类：'+safe(categoryLabels[category]||category):''}${!confirmed?' · 以下为待确认意见':''}</small></div><div class="hu-narrative-grid">${narrativeBlock('优势与贡献',n.strengths,'待结合具体教学与育人事例确认。')}${narrativeBlock('主要困难',n.difficulties,'尚未确认；数据缺口不直接解释为教学问题。')}${narrativeBlock('教师行动',n.teacher_action,'与教师共同约定1—2项具体行动。')}${narrativeBlock('学校支持',n.school_support,'明确共备、听课、设备或资源支持。')}</div><div class="hu-next-review"><div><span>支持责任人</span><strong>${safe(n.owner_name||n.owner_id||'待指定')}</strong></div><div><span>下次复评</span><strong>${dateText(n.review_date)}</strong></div><p>${compact(n.review_focus,'约定复评时看哪些事实与变化。')}</p></div><div class="hu-professional"><span>专业分工初评</span><div><b>教学</b> ${professional.teaching?safe(named(professional.teaching))+' · '+dateText(professional.teaching.date):'待教研组初评'}</div><div><b>家校育人</b> ${professional.family?safe(named(professional.family))+' · '+dateText(professional.family.date):'待年级组初评'}</div><button class="text-link" data-hu-view="professional">查看初评依据 ↗</button></div><div class="hu-evidence-strip"><div><strong>评价依据与适用范围</strong><p>定量依据需完整；人工抽查不能替代全班完整数据。</p></div><button data-hu-view="evidence" class="hu-evidence-counts">${Object.entries(usageLabels).map(([k,label])=>`<span class="hu-usage ${k}">${label}<b>${counts[k]}</b></span>`).join('')}<span class="hu-arrow">查看来源 ↗</span></button></div>${latest?`<div class="hu-teacher-response"><b>教师${latest.kind==='appeal'?'复核申请':'回应'}</b><p>${safe(latest.text)}</p><small>${dateText(latest.created_at||latest.date)}${latest.resolution?' · 已有处理记录':' · 原评价与回应分别保留'}</small></div>`:''}${issueRows(r)}<footer class="hu-card-footer"><div class="hu-links"><button class="text-link" data-hu-view="history">流程与版本 ↗</button><button class="text-link" data-hu-view="responses">教师回应与复核 ↗</button></div>${isPublic()?'<span class="hu-readonly">虚拟流程 · 公开只读</span>':`<div class="hu-actions">${actionButtons(caps,r)}</div>`}</footer></section>`;
  }
  function actionButtons(c,r){return [c.edit_narrative&&['draft','reviewing','ready'].includes(r.status)?['draft','编写综合短评']:null,c.review_teaching?['teaching','教学初评']:null,c.review_family?['family','育人初评']:null,c.verify_evidence?['evidence','核验依据']:null,actor().role==='principal'&&!actor().review_only&&r.status!=='archived'?['issue','安排跟进']:null,c.confirm&&r.status==='ready'&&r.professional?.teaching&&r.professional?.family?['confirm','校长确认']:null,c.respond?['respond','回应／申请复核']:null,c.revise?['revise','修订评价']:null,c.archive?['archive','归档']:null].filter(Boolean).map(([k,l])=>`<button class="button ${k==='confirm'?'primary':''}" data-hu-action="${k}">${l}</button>`).join('');}
  function issueRows(r){const issues=arr(r.issues);if(!issues.length)return '';return `<div class="hu-issues"><h3>分类跟进 · 责任与期限</h3>${issues.map(x=>`<article class="hu-issue ${safe(x.type)}"><span class="hu-issue-type">${safe(issueLabels[x.type]||x.type)}</span><div><strong>${safe(x.title)}</strong><p>${safe(x.owner_name||x.owner_id||'待指定')} · ${dateText(x.due_date)}前${x.status==='resolved'?' · 已完成':' · 待落实'}</p></div>${x.status==='open'&&!isPublic()&&x.owner_id===actor().id?`<button class="text-link" data-hu-action="issue-resolve" data-hu-id="${safe(x.id)}">记录落实 ↗</button>`:''}</article>`).join('')}</div>`;}
  function dashboardPanel(s,c){
    const rows=arr(s.teachers),counts=s.counts||{},confirmed=rows.filter(x=>x.evaluation_state==='confirmed'||(!x.evaluation_state&&['confirmed','archived'].includes(x.status)));
    const themes=key=>{const m=new Map();for(const t of confirmed){const value=t[key];if(typeof value==='string'&&value.trim())m.set(value,(m.get(value)||0)+1);}return [...m].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN')).slice(0,3);};
    const strengths=themes('strengths'),difficulties=themes('difficulties');
    const themeRows=values=>values.map(([text,count])=>`<span class="hu-theme">${safe(text)} <b>${count}人</b></span>`).join('');
    const issueCount=type=>rows.reduce((sum,t)=>sum+(typeof t.issues==='object'?Number(t.issues[type]||0):0),0);
    const next=rows.filter(x=>x.next_review).map(x=>x.next_review).sort()[0];
    const spring=cache.get(keyFor({...c,type:'semester',period:'2026-spring'}));
    const historical=spring?`<p class="hu-historical-note"><b>2026年春季 · 正式学期评价</b><span>已确认 ${safe(spring.counts?.confirmed??0)} 人</span><span>待评价 ${safe(spring.counts?.pending_review??0)} 人</span><span>资料待补齐 ${safe(spring.counts?.insufficient??0)} 人</span><small>以上与本月短评分别统计，未确认不进入正式优秀／良好／重点支持。</small></p>`:'';
    return `<section id="humanOrganizationPanel" class="hu-panel hu-organization" data-hu-loaded="true" aria-label="组织人工评价概况"><header class="hu-heading"><div><span class="hu-eyebrow">${safe(c.department||c.campus||'集团')} · 评价与支持</span><h2>先看人工综合评价</h2><p>${safe(s.label||'2026年10月')} · 月度跟踪 · 学期正式档次在下方单列</p></div>${badge('人工确认后计入','confirmed')}</header><div class="hu-org-reading"><div><span class="hu-reading-index">01</span><h3>已确认记录中的优势</h3><p>${strengths.length?themeRows(strengths):'先完成专业初评与校长确认，再汇总教师优势。'}</p></div><div><span class="hu-reading-index">02</span><h3>已确认记录中的困难</h3><p>${difficulties.length?themeRows(difficulties):'待结合课堂观察、原始作业和育人记录确认，不把缺数视作表现差。'}</p></div><div><span class="hu-reading-index">03</span><h3>本月管理行动</h3><p>信息人员核对 ${issueCount('data')} 项数据事项，教研组跟进 ${issueCount('teaching')} 项教学事项，校长落实 ${issueCount('school')} 项学校支持。</p><small>${next?'最近复评 '+dateText(next)+' · ':''}关注教师变化，落实约定支持。</small></div></div><p class="hu-coverage">仅汇总本期已确认记录 · 已确认 ${confirmed.length} / 本范围 ${safe(counts.teaching??rows.length)} 位任教人员；相同表述按人数归集，未确认意见不进入主题。</p><div class="hu-workflow-counts"><button data-hu-category="confirmed"><span>本月已确认</span><strong>${safe(counts.confirmed??confirmed.length)}</strong></button><button data-hu-category="pending_review"><span>待评价</span><strong>${safe(counts.pending_review??rows.filter(x=>!['confirmed','archived'].includes(x.status)).length)}</strong></button><button data-hu-category="insufficient"><span>资料待补齐</span><strong>${safe(counts.insufficient??0)}</strong></button><button data-hu-category="data"><span>系统与数据待核 · 项</span><strong>${safe(issueCount('data'))}</strong></button><button data-hu-category="school"><span>学校支持待落实 · 项</span><strong>${safe(issueCount('school'))}</strong></button></div>${historical}<footer><p>月度短评看变化，学期综合定档次；系统建议与正式评价分别展示。${isPublic()?'页面数据仅用于演示。':''}</p><button class="text-link" data-hu-view="operations">查看分工与试点安排 ↗</button></footer></section>`;
  }
  function inject(){
    if(!state.data)return;
    const c=profileContext();if(c){
      const target=document.querySelector('.org-profile-body');if(!target)return;
      const tab=state.profileTab||'growth',s=cache.get(keyFor(c));
      if(!s)load(c);
      if(tab==='appraisal'&&!document.getElementById('humanReviewCard'))target.insertAdjacentHTML('afterbegin',`<details class="v8-details v8-full-review" data-v8-detail="full-review"><summary>综合评语与评价记录</summary>${s?profileCard(s,c):placeholder(c)}</details>`);
      const dc={teacher:c.teacher,development:true};if(!['information_officer','independent_reviewer'].includes(actor().role)){
        const ds=cache.get(keyFor(dc));if(ds)injectIdentity(ds,c);else load(dc);
        if(tab==='growth'&&!document.getElementById('teacherDevelopmentCard'))target.insertAdjacentHTML('afterbegin',`<details class="v8-details v8-development-details" data-v8-detail="personal-goals"><summary>个人特点与学期、学年目标</summary>${ds?developmentCard(ds):developmentPlaceholder(dc)}</details>`);
      }
      return;
    }
    if(document.getElementById('v8Management'))return;
    const d=dashboardContext();if(!d)return;const target=document.querySelector('.flow-main')||document.querySelector('.org-main');if(target&&!document.getElementById('humanOrganizationPanel')){const s=cache.get(keyFor(d));target.insertAdjacentHTML('afterbegin',s?dashboardPanel(s,d):placeholder(d,true));if(!s)load(d);else if(!restrictedRole())load({...d,type:'semester',period:'2026-spring'});}
  }
  function restrictedRender(){
    const c=profileContext(),d=dashboardContext()||{campus:actor().campus||'',department:actor().department||'',type:'month',period:'2026-10'},scope=c||d,s=cache.get(keyFor(scope));
    const title=actor().role==='information_officer'?'系统与数据核验':actor().role==='independent_reviewer'?'独立复核工作区':'教研组专业初评';
    let content=heading(title,'按授权教师与事项核对依据；本工作区不开放人事档案或其他职责材料。','','HUMAN APPRAISAL');
    if(c){content+='<button class="text-link hu-special-back" data-hu-list>← 返回授权教师</button>';if(actor().role==='teaching_leader'){const dc={teacher:c.teacher,development:true},ds=cache.get(keyFor(dc));content+=ds?developmentCard(ds):developmentPlaceholder(dc);if(!ds)load(dc);}content+=s?(actor().role==='information_officer'?infoCard(s,c):profileCard(s,c)):placeholder(c);}
    else content+=(s?(actor().role==='information_officer'?infoPanel(s):dashboardPanel(s,d)):placeholder(d,true))+`<section class="hu-panel hu-special-roster"><header class="hu-heading"><div><h2>授权教师与待办</h2><p>仅展示专业初评或数据核验所需的信息。</p></div></header>${arr(s?.teachers).map(t=>`<button class="hu-special-person" data-hu-person="${safe(t.teacher_id)}"><span><b>${safe(t.name)}</b><small>${safe(t.campus)} · ${safe(t.department)}</small></span><span>${safe(statusLabels[t.status]||'待评价')} →</span></button>`).join('')||'<p class="hu-empty">本范围暂无已分配教师。</p>'}</section>`;
    $('#app').innerHTML=layout(content);if(!s)load(scope);
  }
  const originalRender=render;render=function(){if(state.data&&restrictedRole())return restrictedRender();const result=originalRender.apply(this,arguments);inject();return result;};
  const identityGroups=[['characteristics','性格特点'],['specialties','特长'],['potential','发展方向']];
  const mergedSpecialties=p=>[...new Set([...arr(p.identity_tags?.specialties),...arr(p.identity_tags?.strengths)])];
  const workAreas=[['teaching','教学','◎'],['collaboration','协作','✦'],['communication','沟通','↗']];
  function characterBadge(reference){
    const character=reference.character||{},code=reference.type||'',family=['analyst','diplomat','sentinel','explorer'].includes(character.family)?character.family:'neutral';
    const path=String(character.image_url||''),licensed=['licensed','original','public_domain'].includes(character.license_status);
    const localAsset=licensed&&character.transparent===true&&/^\/?assets\/personalities\/[a-z0-9_-]+\.(?:svg|png|webp)$/i.test(path);
    const image=localAsset?`<img src="${safe(path.replace(/^\//,''))}" alt="" data-vnext-character-image loading="lazy" decoding="async">`:'';
    return `<span class="vnext-character" data-family="${family}" aria-hidden="true">${image}<span class="vnext-character-fallback" ${localAsset?'hidden':''}><b>${safe(code)}</b><span>${safe(character.role_name||'类型参考')}</span></span></span>`;
  }
  function mbtiWorkReference(reference,c){
    const work=reference.work_style||{},tags=arr(reference.reference_tags);
    if(!reference.type||!tags.length||!work.teaching)return '';
    const source=/^https:\/\//.test(reference.work_source_url||'')?`<a href="${safe(reference.work_source_url)}" target="_blank" rel="noopener noreferrer">了解类型参考 ↗</a>`:'';
    return `<section id="mbti-work-${safe(c.teacher)}" class="vnext-work-reference" data-vnext-work-reference="${safe(c.teacher)}" aria-labelledby="mbti-work-title-${safe(c.teacher)}"><header>${characterBadge(reference)}<div><span class="vnext-reference-kicker">管理沟通参考 · ${safe(reference.type)} ${safe(reference.character?.role_name||'')}</span><h2 id="mbti-work-title-${safe(c.teacher)}">可能偏好的工作方式</h2><p>类型参考，实际以本人表达和日常表现为准。</p></div></header><div class="vnext-reference-tags" aria-label="六项工作倾向参考">${workAreas.map(([key,label,glyph])=>`<div class="vnext-reference-area" data-area="${key}"><span class="vnext-area-label"><i aria-hidden="true">${glyph}</i>${label}</span>${tags.filter(t=>t.area===key).map(t=>`<span class="vnext-reference-tag" data-area="${key}">${safe(t.label)}</span>`).join('')}</div>`).join('')}</div><dl class="vnext-work-lines">${workAreas.map(([key,label])=>`<div data-area="${key}"><dt>${label}</dt><dd>${safe(work[key]||'可结合本人表达和日常相处了解。')}</dd></div>`).join('')}</dl><footer><span>不用于评优、岗位或薪酬判断。</span>${source}</footer></section>`;
  }
  function placeWorkReference(){
    const panel=document.querySelector('[data-vnext-work-reference]'),hero=document.querySelector('.profile-hero');
    if(!panel||!hero)return;
    const summary=document.getElementById('v8ProfileSummary'),anchor=summary||hero;
    if(anchor.nextElementSibling!==panel)anchor.after(panel);
  }
  function injectIdentity(s,c){
    if(s.teacher_id!==c.teacher)return;
    const hero=document.querySelector('.profile-hero'),name=hero?.querySelector('.profile-name');if(!name)return;
    name.querySelector('[data-hu-identity]')?.remove();name.querySelector('[data-hu-mbti]')?.remove();name.querySelector('[data-v81-mbti-reference]')?.remove();name.querySelector('[data-vnext-employment]')?.remove();
    document.querySelectorAll('[data-vnext-work-reference]').forEach(el=>el.remove());
    const p=s.profile||{},tags=p.identity_tags||{},reference=s.mbti_reference||{},code=p.mbti||reference.type||'',canEdit=!isPublic()&&s.capabilities?.edit_profile;
    const values={characteristics:arr(tags.characteristics),specialties:mergedSpecialties(p),potential:arr(tags.potential)};
    const pillTag=canEdit?'button':'span';
    const pill=`<${pillTag} class="hu-mbti ${code?'':'is-empty'}" data-hu-mbti="${safe(c.teacher)}" ${canEdit?'data-hu-development-action="tags" type="button"':''} title="${canEdit?'编辑本人填写的MBTI与特点':'本人填写的MBTI类型'}"><small>MBTI</small><b>${safe(code||'待本人填写')}</b></${pillTag}>`;
    const line=name.querySelector('.profile-name-line');if(line)line.insertAdjacentHTML('beforeend',pill);
    const html=`<div class="hu-identity-tags" data-hu-identity="${safe(c.teacher)}" aria-label="教师本人填写的性格特点、特长与发展方向">${identityGroups.map(([key,label])=>`<span class="hu-identity-group" data-kind="${key}"><span class="hu-identity-label">${label}</span>${values[key].length?values[key].slice(0,2).map(value=>`<span class="hu-identity-tag" data-kind="${key}">${safe(value)}</span>`).join(''):'<span class="hu-identity-pending">待本人补充</span>'}</span>`).join('')}<span class="hu-identity-source">本人填写</span>${canEdit?'<button class="text-link" data-hu-development-action="tags">编辑MBTI与标签</button>':''}</div>`;
    if(line)line.insertAdjacentHTML('afterend',html);else name.insertAdjacentHTML('beforeend',pill+html);
    const employment=s.teaching_profile||{},months=employment.tenure_months;
    if(employment.houwai_joined_on&&Number.isInteger(months)){
      const years=Math.floor(months/12),rest=months%12,tenure=years?`${years}年${rest?rest+'个月':''}`:`${rest}个月`;
      const joined=String(employment.houwai_joined_on).replaceAll('-','.');
      name.insertAdjacentHTML('beforeend',`<p class="vnext-employment" data-vnext-employment><span>入职厚外 <time datetime="${safe(employment.houwai_joined_on)}">${safe(joined)}</time></span><b>在厚外${safe(tenure)}</b></p>`);
    }
    const workHtml=state.profileTab==='growth'&&s.capabilities?.view_work_style_reference?mbtiWorkReference(reference,c):'';
    if(workHtml)hero.insertAdjacentHTML('afterend',workHtml);
    placeWorkReference();
  }
  function developmentPlaceholder(c){const error=errors.get(keyFor(c));return `<section id="teacherDevelopmentCard" class="hu-panel hu-loading" data-hu-loaded="false"><h2>我的特点与成长目标</h2><p>${error?safe(error):'正在读取教师本人填写的特点、学期目标与学年目标…'}</p></section>`;}
  function currentDevelopment(){const c=profileContext();return c?cache.get(keyFor({teacher:c.teacher,development:true})):null;}
  function developmentCard(s){
    const p=s.profile||{},caps=s.capabilities||{},goals=arr(s.goals).filter(g=>g.period_type===hu.goalType),labels={active:'实践中',achieved:'已达成',adjusting:'调整中'},self=!!p.author_id;
    return `<section id="teacherDevelopmentCard" class="hu-panel hu-development" data-hu-loaded="true" data-hu-teacher="${safe(s.teacher_id)}" aria-label="教师本人特点与目标"><header class="hu-heading"><div><span class="hu-eyebrow">从了解本人开始</span><h2>我的特点与成长目标</h2><p>${self?'教师本人填写':'由教师本人维护'} · ${safe(p.author_name||'尚未填写')} ${p.updated_at?'· '+dateText(p.updated_at):''}</p></div>${!isPublic()&&caps.edit_profile?'<button class="button" data-hu-development-action="profile">编辑我的特点</button>':badge('本人视角 · 尊重发展意愿')}</header><div class="hu-self-features">${[['characteristics','我的特点','还没有填写个人特点。'],['strengths','擅长的事','还没有填写擅长的事。'],['growth_focus','正在提升','可以先明确一项正在练习的能力。'],['support_preference','希望得到的支持','可以说明更适合自己的支持方式。']].map(([key,label,empty])=>`<article><h3>${label}</h3><p>${compact(p[key],empty)}</p></article>`).join('')}</div><section class="hu-own-goals"><header><div><span class="hu-eyebrow">由本人制定 · 与学校商量支持</span><h3>我的成长目标</h3></div><div class="hu-periods" role="group" aria-label="个人目标期间"><button data-hu-goal-period="semester" class="${hu.goalType==='semester'?'active':''}" aria-pressed="${hu.goalType==='semester'}">学期目标</button><button data-hu-goal-period="year" class="${hu.goalType==='year'?'active':''}" aria-pressed="${hu.goalType==='year'}">学年目标</button></div></header><div class="hu-own-goal-list" data-hu-goals-period="${safe(hu.goalType)}">${goals.map(g=>{const latest=arr(g.progress).at(-1);return `<article class="hu-own-goal" data-hu-goal="${safe(g.id)}"><div class="hu-goal-title"><div><small>${safe(g.period_type==='year'?g.period+'学年':g.period==='2026-fall'?'2026年秋季学期':g.period)}</small><h4>${safe(g.title)}</h4></div>${badge(labels[g.status]||'实践中')}</div><div class="hu-goal-comparison"><div><span>当前起点</span><p>${safe(g.baseline)}</p></div><div class="hu-goal-target"><span>希望达到</span><p>${safe(g.target)}</p></div></div><dl class="hu-goal-plan"><div><dt>我的行动</dt><dd>${safe(g.actions)}</dd></div><div><dt>需要的支持</dt><dd>${safe(g.support_needed)}</dd></div></dl><div class="hu-goal-update"><span>最近进展 · ${dateText(latest?.date)}</span><p>${latest?safe(latest.text):'还没有新增进展，可以在实践后如实记录。'}</p>${latest?.next_step?`<small>下一步：${safe(latest.next_step)}</small>`:''}</div><footer><span>${dateText(g.due_date)}前回看目标</span>${!isPublic()&&caps.add_progress?`<button class="text-link" data-hu-development-action="progress" data-hu-id="${safe(g.id)}">记录进展／调整 ↗</button>`:''}<details class="hu-goal-history"><summary>查看${arr(g.progress).length}条进展与调整记录</summary>${arr(g.progress).map(x=>`<article><small>${dateText(x.date)} · ${safe(x.actor_name||'教师本人')} · ${safe(labels[x.status]||'实践中')}</small><p>${safe(x.text)}</p>${x.next_step?`<p>下一步：${safe(x.next_step)}</p>`:''}</article>`).join('')||'<p>尚无进展记录。</p>'}</details></footer></article>`;}).join('')||'<p class="hu-empty">本期还没有个人目标，可以先从一个具体、可实践的方向开始。</p>'}</div><footer class="hu-development-footer"><p>个人目标与校方评价分别保存；进展和调整留记录，原目标继续保留。</p>${!isPublic()&&caps.create_goal?'<button class="button" data-hu-development-action="goals">制定我的目标</button>':isPublic()?'<span class="hu-readonly">虚拟个人目标 · 公开只读</span>':''}</footer></section></section>`;
  }
  function goalPeriods(type){return type==='year'?[['2026-2027','2026—2027学年'],['2027-2028','2027—2028学年']]:[['2026-fall','2026年秋季学期'],['2027-spring','2027年春季学期']];}
  function openDevelopment(action,id=''){
    const s=currentDevelopment();if(!s||isPublic())return;const p=s.profile||{},goal=arr(s.goals).find(g=>g.id===id);let body='';
    if(action==='tags')body='<p class="hu-note">MBTI由本人填写，也可留空。性格特点可参考类型描述后修改；特长与发展方向根据本人实际情况填写。</p>'+select('mbti','我的MBTI',[['','暂不填写'],...Object.keys(s.mbti_options||{}).map(key=>[key,key])],p.mbti||'')+`<div class="hu-mbti-reference" id="huMbtiReference"><b>类型参考特点</b><p>${safe(arr(s.mbti_reference?.traits).join('、')||'选择类型后可参考，也可以直接填写自己的特点。')}</p><small>用于了解沟通偏好，不作为教学能力或考核结论。</small></div>`+identityGroups.map(([key,label])=>input('tags_'+key,label+'（最多2个，用逗号分隔）',(key==='specialties'?mergedSpecialties(p):arr(p.identity_tags?.[key])).join('，'),'text',false)).join('');
    else if(action==='profile')body='<p class="hu-note">从自己的实践、优势和发展意愿出发填写。这里只记录本人观点，不替代校方评价。</p>'+text('characteristics','我的特点',p.characteristics)+text('strengths','擅长的事',p.strengths)+text('growth_focus','正在提升',p.growth_focus)+text('support_preference','希望得到的支持',p.support_preference);
    else if(action==='goals')body=select('period_type','目标期间',[['semester','学期目标'],['year','学年目标']],hu.goalType)+select('period','目标所属期间',goalPeriods(hu.goalType),hu.goalType==='year'?'2026-2027':'2026-fall')+input('title','目标名称')+text('baseline','当前起点')+text('target','希望达到的具体变化')+text('actions','我准备怎样实践')+text('support_needed','希望学校或同伴提供什么支持')+input('due_date','回看目标的日期',hu.goalType==='year'?'2027-08-31':'2027-01-20','date');
    else if(action==='progress'&&goal)body=`<input type="hidden" name="goal_id" value="${safe(goal.id)}"><p class="hu-note">${safe(goal.title)}：追加新的实践与调整说明，原目标和已有记录继续保留。</p>`+text('text','已做的实践、观察到的变化或调整原因')+text('next_step','下一步准备怎么做')+select('status','当前目标状态',[['active','实践中'],['achieved','已达成'],['adjusting','调整中']],goal.status||'active');
    else return;show(action==='tags'?'编辑姓名旁的个人标签':action==='profile'?'编辑我的特点':action==='goals'?'制定学期／学年目标':'记录目标进展与调整',body,'development-'+action);
  }
  function currentSummary(){const c=profileContext();return c?cache.get(keyFor(c)):null;}
  function close(){const modal=document.getElementById('humanReviewOverlay');modal?.remove();hu.modal=null;if(hu.returnFocus?.isConnected)hu.returnFocus.focus();}
  function show(title,body,formAction=''){
    close();hu.returnFocus=document.activeElement;const host=document.createElement('div');host.id='humanReviewOverlay';host.innerHTML=`<div class="hu-modal-backdrop" data-hu-backdrop></div><section class="hu-modal" id="humanReviewModal" role="dialog" aria-modal="true" aria-labelledby="humanReviewModalTitle"><header><div><span class="hu-eyebrow">${isPublic()?'评价记录 · 公开只读':'人工评价 · 保留依据'}</span><h2 id="humanReviewModalTitle">${safe(title)}</h2></div><button class="hu-close" data-hu-close aria-label="关闭">×</button></header>${formAction?`<form data-hu-form="${safe(formAction)}">${body}<div class="hu-form-status" role="status"></div><footer><button type="button" class="button" data-hu-close>取消</button><button type="submit" class="button primary">保存${safe(actionLabels[formAction]||'记录')}</button></footer></form>`:`<div class="hu-modal-body">${body}</div><footer><button class="button" data-hu-close>关闭</button></footer>`}</section>`;
    document.body.append(host);hu.modal={context:profileContext(),actor:state.actor};setTimeout(()=>host.querySelector('textarea,input:not([type=hidden]),select,button')?.focus(),0);
  }
  function evidenceRows(s){const r=s.record||{},rows=arr(r.evidence).length?arr(r.evidence):arr(s.available_evidence);return rows.length?rows.map(x=>`<article class="hu-source-row"><div>${badge(usageLabels[x.usability]||'待核实',x.usability)}<small>${dateText(x.date)} · ${safe(x.kind||'记录')}</small></div><h3>${safe(x.title||x.id)}</h3><p>${safe(x.reason||'适用范围待核对')}</p><dl><dt>来源</dt><dd>${safe(x.source_ref||x.id)}</dd><dt>依据编号</dt><dd>${safe(x.id)}</dd><dt>适用范围</dt><dd>${safe(x.scope==='quantitative'?'对应定量口径':x.scope==='qualitative'?'具体观察与定性判断':x.scope||'按原始记录核对')}</dd>${x.verified_name?`<dt>本轮核验</dt><dd>${safe(x.verified_name)} · ${dateText(x.verified_at)}</dd>`:''}</dl></article>`).join(''):'<p>本期尚无可引用依据；不据此作正面或负面判断。</p>';}
  function historyRows(s){const r=s.record||{};return `<p class="hu-note">教学初评、育人初评、校长确认与教师回应分开记录。修订产生新版本，原事实与原评语保留。</p><ol class="hu-flow"><li><b>教研组教学初评</b><span>${r.professional?.teaching?safe(named(r.professional.teaching))+' · '+dateText(r.professional.teaching.date):'待完成'}</span></li><li><b>年级组育人初评</b><span>${r.professional?.family?safe(named(r.professional.family))+' · '+dateText(r.professional.family.date):'待完成'}</span></li><li><b>学部校长综合确认</b><span>${r.confirmation?safe(named(r.confirmation))+' · '+dateText(r.confirmation.date):'待确认，暂不计入正式分类'}</span></li><li><b>教师回应与独立复核</b><span>${arr(r.responses).length}条回应或申请</span></li></ol><h3>处理记录</h3>${arr(r.history).map(x=>`<article class="hu-history"><b>${safe(actionLabels[x.action]||x.action||'评价记录')}</b><small>${safe(x.actor_name||'评价人员')} · ${dateText(x.date||x.created_at)} · 第${safe(x.version||r.version||1)}版</small><p>${safe(x.text||x.note||'已保留操作记录')}</p></article>`).join('')||'<p>尚无处理记录。</p>'}<h3>已发布版本</h3>${arr(r.published_versions).map((x,i)=>`<details class="hu-version"><summary>第${safe(x.version||i+1)}版 · ${dateText(x.date||x.published_at||x.confirmation?.date)}</summary><p>${safe(x.narrative?.judgment||x.record?.narrative?.judgment||x.snapshot?.narrative?.judgment||'保留发布时的完整快照')}</p><small>后续补采与修订不会覆盖此版本。</small></details>`).join('')||'<p>尚未发布版本。</p>'}`;}
  function responseRows(s){const r=s.record||{},c=s.capabilities||{};return `<p class="hu-note">教师可以补充事实、表达不同意见或申请复核。存在利益冲突时，由上一级指定独立复核人。</p>${arr(r.responses).map(x=>`<article class="hu-history"><b>${x.kind==='appeal'?'复核申请':'教师回应'}</b><small>${dateText(x.date||x.created_at)} · ${safe(x.actor_name||'教师本人')}</small><p>${safe(x.text)}</p>${x.reviewer_id||x.reviewer?`<p>独立复核人：${safe(x.reviewer_name||x.reviewer?.actor_name||x.reviewer_id)}</p>`:''}${x.resolution?`<div class="hu-resolution"><b>复核处理</b><p>${safe(x.resolution.text)}</p><small>${safe(x.resolution.actor_name||'独立复核人')} · ${dateText(x.resolution.date||x.resolution.created_at)}</small></div>`:x.kind==='appeal'&&!isPublic()?`${c.assign_reviewer?`<button class="text-link" data-hu-action="assign-reviewer" data-hu-id="${safe(x.id)}">指定独立复核人 ↗</button>`:''}${c.resolve?`<button class="text-link" data-hu-action="resolve" data-hu-id="${safe(x.id)}">记录复核结果 ↗</button>`:''}`:''}</article>`).join('')||'<p>本期暂无教师回应或复核申请。</p>'}`;}
  function professionalRows(s){return ['teaching','family'].map(k=>{const x=s.record?.professional?.[k];return `<article class="hu-history"><h3>${k==='teaching'?'教研组 · 教育教学':'年级组 · 家校育人'}</h3>${x?`<small>${safe(named(x))} · ${dateText(x.date)}</small><p>${safe(x.text)}</p><p>引用依据：${arr(x.evidence_ids).map(safe).join('、')||'待补充'}</p>`:'<p>尚未形成专业初评。</p>'}</article>`;}).join('');}
  function operations(){return `<p class="hu-note">沿用香江路初中8—12名教师、8—12周试点。目标是评价说得清、教师能理解、学校给得出支持、下一次看到变化。</p><div class="hu-operations"><article><h3>专业分工</h3><p>教研组评价教学，年级组评价家校育人；学部校长逐人确认，校区校长抽核重点和争议。</p></article><article><h3>减轻填报负担</h3><p>复用听评课、备课检查、作业和家校跟进记录。教师新增填报以每月10分钟以内为目标；没有新增情况可以如实说明。</p></article><article><h3>三类事项分别处理</h3><p>系统与数据问题由信息人员补采培训；教学问题由教研组安排实践改进；学校支持缺位进入校长待办。</p></article><article><h3>按阶段检验</h3><p>前两周培训与核对基线，中间至少两轮月评，最后核对判断一致性、实际负担和支持效果。由总校长决定是否扩围，不按日期自动推广。</p></article><article><h3>评价与数据使用</h3><p>原有教学标准和98%／95%满意度条件保留。资料不足不能升级为正式优秀；具体贡献可以单独表扬。学期满意度不拆成月度分数。</p></article></div>`;}
  function categoryMatch(t,k){
    if(k==='confirmed')return t.evaluation_state==='confirmed'||(!t.evaluation_state&&['confirmed','archived'].includes(t.status));
    if(k==='pending_review')return t.evaluation_state==='pending_review'||(!t.evaluation_state&&!['confirmed','archived'].includes(t.status));
    if(k==='insufficient')return t.evaluation_state==='insufficient';
    return typeof t.issues==='object'&&Number(t.issues[k]||0)>0;
  }
  function openDrill(kind){
    const c=dashboardContext(),summary=c?cache.get(keyFor(c)):null;if(!summary)return;
    const titles={confirmed:'本月已确认',pending_review:'待评价',insufficient:'资料待补齐',data:'系统与数据待核',school:'学校支持待落实'};
    hu.drill={kind,title:titles[kind]||kind,rows:arr(summary.teachers).filter(t=>categoryMatch(t,kind)),baseCampus:c.campus,baseDepartment:c.department,campus:c.campus,department:c.department,page:1};drawDrill();
  }
  function drawDrill(){
    const d=hu.drill;if(!d)return;const rows=d.rows.filter(t=>(!d.campus||t.campus===d.campus)&&(!d.department||(t.department||'待分学部')===d.department));
    const crumbs=`<nav class="hu-drill-crumb" aria-label="人工评价组织层级">${!d.baseCampus?'<button data-hu-drill-back="group">集团</button><span>›</span>':''}${d.campus?`<button data-hu-drill-back="campus">${safe(d.campus)}</button><span>›</span>`:''}${d.department?`<b>${safe(d.department)}</b>`:'<span>按组织逐级查看</span>'}</nav>`;
    let body=crumbs+`<p class="hu-note">${safe(d.title)} · 当前分布 ${rows.length} 位教师。系统与学校支持按事项计数，同一教师可以有多项；月度状态与春季正式档次分开。</p>`;
    if(!d.campus||!d.department){const kind=!d.campus?'campus':'department',groups=new Map();for(const t of rows){const label=t[kind]||'待分学部';groups.set(label,(groups.get(label)||0)+1);}body+=`<div class="hu-drill-groups">${[...groups].map(([name,count])=>`<button data-hu-drill-child="${safe(name)}" data-hu-drill-kind="${kind}"><span>${safe(name)}</span><b>${count}</b><small>进入${kind==='campus'?'校区':'学部'} →</small></button>`).join('')||'<p>当前范围暂无此类记录。</p>'}</div>`;}
    else{const size=12,total=rows.length,pages=Math.max(1,Math.ceil(total/size));d.page=Math.max(1,Math.min(d.page,pages));body+=`<div class="hu-drill-roster">${rows.slice((d.page-1)*size,d.page*size).map(t=>`<button class="hu-special-person" data-hu-person="${safe(t.teacher_id)}"><span><b>${safe(t.name)}</b><small>${safe(statusLabels[t.status]||'待评价')} · ${safe(t.judgment||'等待专业核验')}</small></span><span>查看档案 →</span></button>`).join('')||'<p>当前学部暂无此类教师。</p>'}</div><div class="hu-drill-pager"><button class="button" data-hu-drill-page="${d.page-1}" ${d.page===1?'disabled':''}>上一页</button><span>${d.page} / ${pages} · ${total}位</span><button class="button" data-hu-drill-page="${d.page+1}" ${d.page===pages?'disabled':''}>下一页</button></div>`;}
    show(d.title,body);
  }
  function infoPanel(s){return `<section id="humanOrganizationPanel" class="hu-panel hu-loading" data-hu-loaded="true"><h2>系统与数据核验待办</h2><p>当前有 ${safe(s.counts?.data||0)} 项分配给本人的数据事项。核对采集、名单与完整性，记录排查、培训或补采；不评价教师教学优劣。</p></section>`;}
  function infoCard(s,c){return `<section id="humanReviewCard" class="hu-panel" data-hu-loaded="true" data-hu-teacher="${safe(c.teacher)}" data-hu-period="${safe(c.type+'|'+c.period)}"><header class="hu-heading"><div><span class="hu-eyebrow">信息人员授权范围</span><h2>${safe(s.teacher_name||c.teacher)} · 数据事项</h2><p>仅可查看分配给本人的数据缺口与必要依据。</p></div></header>${issueRows(s.record||{})}<footer class="hu-card-footer"><button class="text-link" data-hu-view="evidence">查看待核依据与来源 ↗</button><span class="hu-readonly">教师正式评价与人事信息不开放</span></footer></section>`;}
  function view(kind){const s=currentSummary();if(kind==='operations')return show('评价分工与试点安排',operations());if(!s)return;const defs={evidence:['依据适用状态与来源',()=>evidenceRows(s)],history:['专业初评、确认与版本',()=>historyRows(s)],responses:['教师回应与独立复核',()=>responseRows(s)],professional:['专业初评与引用依据',()=>professionalRows(s)]};const d=defs[kind];if(d)show(d[0],d[1]());}
  function input(name,label,value='',type='text',required=true){return `<label class="hu-field"><span>${safe(label)}</span><input name="${safe(name)}" type="${type}" value="${safe(value)}" ${required?'required':''}></label>`;}
  function text(name,label,value='',required=true){return `<label class="hu-field"><span>${safe(label)}</span><textarea name="${safe(name)}" rows="3" maxlength="4000" ${required?'required':''}>${safe(value)}</textarea></label>`;}
  function select(name,label,options,value=''){return `<label class="hu-field"><span>${safe(label)}</span><select name="${safe(name)}" required>${options.map(([v,l])=>`<option value="${safe(v)}" ${String(v)===String(value)?'selected':''}>${safe(l)}</option>`).join('')}</select></label>`;}
  function actorChoices(){const actors=arr(state.data?.actors);return actors.map(x=>[x.id,`${x.name} · ${ROLE[x.role]||x.role}`]);}
  function evidenceChoices(s){const rows=arr(s.available_evidence).length?arr(s.available_evidence):arr(s.record?.evidence);return `<fieldset class="hu-evidence-choice"><legend>引用已有依据</legend>${rows.map(x=>`<label><input type="checkbox" name="evidence_ids" value="${safe(x.id)}"><span>${safe(x.title||x.id)}<small>${safe(usageLabels[x.usability]||'待核实')} · ${safe(x.id)}</small></span></label>`).join('')||'<p>暂无可引用依据，须先补齐记录。</p>'}</fieldset>`;}
  function openAction(name,id=''){
    const s=currentSummary();if(!s||isPublic())return;const r=s.record||{},n=r.narrative||{},a=actorChoices();let body='',action=name;
    if(name==='draft')body='<p class="hu-note">先写事实和具体行动。定性意见须与专业初评及引用依据一致；保存草稿不会形成正式档次。</p>'+text('judgment','当前综合判断',n.judgment)+text('strengths','优势与贡献',n.strengths)+text('difficulties','主要困难（没有新增情况可如实说明）',n.difficulties)+text('teacher_action','教师行动',n.teacher_action)+text('school_support','学校支持',n.school_support)+select('owner_id','支持责任人',a,n.owner_id||actor().id)+input('owner_name','责任人称呼',n.owner_name||actor().name)+input('review_date','复评日期',n.review_date||'2026-11-27','date')+text('review_focus','复评看哪些事实与变化',n.review_focus);
    else if(name==='teaching'||name==='family'){action='professional';body=`<input type="hidden" name="dimension" value="${name==='teaching'?'teaching':'family'}">`+select('conclusion','专业判断的适用范围',[['supported','已核实的专业观察'],['insufficient','资料不足，仅说明局限']],'supported')+text('text',name==='teaching'?'教学事实、优势、困难与支持建议':'家校育人事实、职责与后续落实')+evidenceChoices(s);}
    else if(name==='evidence')body=select('evidence_id','选择需要核验的依据',arr(s.available_evidence).map(x=>[x.id,x.title||x.id]))+select('usability','依据适用状态',Object.entries(usageLabels),'pending')+text('reason','身份、时间、口径、完整性与适用范围核验说明');
    else if(name==='issue')body=select('type','事项类型',Object.entries(issueLabels),'data')+text('title','具体待办事项')+select('owner_id','责任人',a)+input('due_date','完成期限','2026-11-13','date')+evidenceChoices(s);
    else if(name==='respond')body=select('kind','回应类型',[['response','补充回应'],['appeal','申请复核']],'response')+text('text','补充事实、不同意见或复核理由')+`<fieldset class="hu-evidence-choice"><legend>存在利益冲突的原评价人（如有）</legend>${arr(state.data?.actors).filter(x=>['principal','teaching_leader','grade_leader'].includes(x.role)).map(x=>`<label><input type="checkbox" name="conflict_actor_ids" value="${safe(x.id)}"><span>${safe(x.name)}</span></label>`).join('')}</fieldset>`;
    else if(name==='assign-reviewer')body=`<input type="hidden" name="response_id" value="${safe(id)}">`+select('reviewer_id','由上一级指定独立复核人',a)+text('text','独立性核验与指定说明');
    else if(name==='resolve')body=`<input type="hidden" name="response_id" value="${safe(id)}">`+text('text','核实过程、责任与处理结论');
    else if(name==='issue-resolve')body=`<input type="hidden" name="issue_id" value="${safe(id)}">`+text('text','已落实的行动、依据与剩余问题');
    else if(name==='confirm')body='<p class="hu-note">确认前核对专业初评、教师说明与依据适用范围。系统依据原标准给出可确认的档次；不能绕过教学与满意度条件升级。</p>'+text('text','综合确认依据与后续安排');
    else if(name==='revise')body='<p class="hu-note">修订将保留原发布版本，重新完成初评与确认。</p>'+text('text','修订原因');
    else if(name==='archive')body='<p class="hu-note">归档保留当前发布版本、原始依据与教师回应；未处理复核须先完成。</p>'+text('text','归档说明');
    else return;
    show(actionLabels[action]||'专业初评',body,action);
  }
  async function submit(form){
    const ctx=hu.modal?.context,who=hu.modal?.actor;if(!ctx||who!==state.actor)throw Error('当前评价对象或身份已变化，请重新打开。');
    const f=new FormData(form),v=Object.fromEntries(f),action=form.dataset.huForm;let data={teacher_id:ctx.teacher,period_type:ctx.type,period:ctx.period,...v};
    if(action==='draft'){data={teacher_id:ctx.teacher,period_type:ctx.type,period:ctx.period,narrative:Object.fromEntries(['judgment','strengths','difficulties','teacher_action','school_support','owner_id','owner_name','review_date','review_focus'].map(k=>[k,v[k]]))};}
    if(['professional','issue'].includes(action))data.evidence_ids=f.getAll('evidence_ids');
    if(action==='respond')data.conflict_actor_ids=f.getAll('conflict_actor_ids');
    if(action.startsWith('development-')){
      let endpoint=action.slice('development-'.length);data={teacher_id:ctx.teacher,...v};
      if(endpoint==='tags'){endpoint='profile';const tags={};for(const [key,label] of identityGroups){const values=String(v['tags_'+key]||'').split(/[,，、]+/).map(value=>value.trim()).filter(Boolean);if(values.length>2||values.some(value=>[...value].length>12))throw Error(label+'最多填写2个，每个1—12字。');tags[key]=values;}tags.strengths=[];data={teacher_id:ctx.teacher,mbti:v.mbti||'',identity_tags:tags};}
      await post('/development/'+endpoint,data);if(who!==state.actor)return;if(endpoint==='goals')hu.goalType=v.period_type;
      cache.delete(keyFor({teacher:ctx.teacher,development:true}));errors.delete(keyFor({teacher:ctx.teacher,development:true}));close();render();toast('个人特点与目标记录已保存。');return;
    }
    const result=await post('/human-reviews/'+action,data);if(who!==state.actor)return;
    cache.clear();errors.clear();if(result.summary)cache.set(keyFor(ctx),result.summary);close();if(typeof org!=='undefined'){org.summary=null;org.roster=null;}
    render();if(typeof orgEnsure==='function')orgEnsure();toast('人工评价记录已保存，原始事实与历史版本继续保留。');
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-hu-close]')||e.target.matches('[data-hu-backdrop]')){e.preventDefault();e.stopImmediatePropagation();close();return;}
    const development=e.target.closest('[data-hu-development-action],[data-hu-goal-period]');if(development){e.preventDefault();e.stopImmediatePropagation();if(development.hasAttribute('data-hu-goal-period')){hu.goalType=development.dataset.huGoalPeriod;render();}else openDevelopment(development.dataset.huDevelopmentAction,development.dataset.huId||'');return;}
    const category=e.target.closest('[data-hu-category]');if(category){e.preventDefault();e.stopImmediatePropagation();openDrill(category.dataset.huCategory);return;}const drill=e.target.closest('[data-hu-drill-child],[data-hu-drill-back],[data-hu-drill-page]');if(drill&&hu.drill){e.preventDefault();e.stopImmediatePropagation();if(drill.hasAttribute('data-hu-drill-child')){hu.drill[drill.dataset.huDrillKind]=drill.dataset.huDrillChild;hu.drill.page=1;}else if(drill.hasAttribute('data-hu-drill-page'))hu.drill.page=Number(drill.dataset.huDrillPage);else if(drill.dataset.huDrillBack==='group'){hu.drill.campus='';hu.drill.department='';hu.drill.page=1;}else{hu.drill.department='';hu.drill.page=1;}drawDrill();return;}
    const person=e.target.closest('[data-hu-person]');if(person){e.preventDefault();e.stopImmediatePropagation();close();state.profileTab=restrictedRole()?'human':'growth';go('profile',person.dataset.huPerson);return;}if(e.target.closest('[data-hu-list]')){e.preventDefault();e.stopImmediatePropagation();go('overview');return;}
    const el=e.target.closest('[data-hu-view],[data-hu-period],[data-hu-action],[data-hu-retry]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();
    try{if(el.hasAttribute('data-hu-view'))view(el.dataset.huView);else if(el.hasAttribute('data-hu-period')){const parts=el.dataset.huPeriod.split('|');hu.periodType=parts[0];hu.period=parts[1];render();}else if(el.hasAttribute('data-hu-action'))openAction(el.dataset.huAction,el.dataset.huId||'');else{const c=profileContext()||dashboardContext();if(c){errors.delete(keyFor(c));load(c,true);render();}}}catch(err){toast(err.message,true);}
  },true);
  document.addEventListener('submit',async e=>{const f=e.target.closest('[data-hu-form]');if(!f)return;e.preventDefault();e.stopImmediatePropagation();const b=f.querySelector('[type=submit]'),status=f.querySelector('.hu-form-status');b.disabled=true;try{await submit(f);}catch(err){if(status.isConnected)status.textContent=err.message;toast(err.message,true);}finally{if(b.isConnected)b.disabled=false;}},true);
  document.addEventListener('error',e=>{const image=e.target;if(!image.matches?.('[data-vnext-character-image]'))return;image.hidden=true;const fallback=image.parentElement.querySelector('.vnext-character-fallback');if(fallback)fallback.hidden=false;},true);
  document.addEventListener('change',e=>{if(e.target.name==='mbti'&&e.target.closest('[data-hu-form="development-tags"]')){const form=e.target.closest('form'),ref=currentDevelopment()?.mbti_options?.[e.target.value]||[];form.querySelector('[name="tags_characteristics"]').value=ref.slice(0,2).join('，');const box=form.querySelector('#huMbtiReference p');if(box)box.textContent=ref.length?ref.join('、'):'尚未填写MBTI，可直接写自己的特点。';}if(e.target.id==='actorSelect')close();const f=e.target.closest('[data-hu-form="development-goals"]');if(f&&e.target.name==='period_type'){const type=e.target.value;f.querySelector('[name=period]').innerHTML=goalPeriods(type).map(([v,l])=>`<option value="${safe(v)}">${safe(l)}</option>`).join('');f.querySelector('[name=due_date]').value=type==='year'?'2027-08-31':'2027-01-20';}},true);
  window.addEventListener('hashchange',close);
  document.addEventListener('keydown',e=>{const m=document.getElementById('humanReviewModal');if(!m)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const list=[...m.querySelectorAll('button:not(:disabled),input:not([type=hidden]),textarea,select')].filter(x=>x.offsetParent!==null),a=list[0],b=list.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b?.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a?.focus();}}},true);
  window.HouwaiHumanReview={clear(){cache.clear();errors.clear();},inject,cache};
  window.HouwaiProfileReference={place:placeWorkReference};
  if(state.data)render();
})();
