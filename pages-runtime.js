const PUBLIC_DEMO_VERSION = '20261103-research-people-v9-r1';
'use strict';
/* Public Pages adapter: read-only, fresh synthetic snapshots, no live backend. */
state.actor = 'group-all';
if (!location.hash || location.hash === '#') history.replaceState(null, '', '#group');
const publicVersion = typeof PUBLIC_DEMO_VERSION === 'undefined' ? '20261102-evidence-v2' : PUBLIC_DEMO_VERSION;
const publicData = fetch('data/index.json?v='+encodeURIComponent(publicVersion)).then(r => {if (!r.ok) throw new Error('演示资料暂未读取，请刷新重试。'); return r.json();});
const publicProfiles = new Map();
const publicCopy = value => JSON.parse(JSON.stringify(value));
async function publicPerson(id) {
  if (!/^(teacher-\d{3}|staff-\d{4})$/.test(id)) throw new Error('未找到该人员。');
  if (!publicProfiles.has(id)) publicProfiles.set(id, fetch(`data/people/${id}.json?v=${encodeURIComponent(publicVersion)}`).then(r => {if (!r.ok) throw new Error('未找到该档案。'); return r.json();}));
  return publicCopy(await publicProfiles.get(id));
}
function publicRows(data, q) {
  const basis=q.get('education_basis')||'highest';
  if (!['highest','undergraduate'].includes(basis)) throw new Error('学历口径无效。');
  let rows=data.people.filter(p=>(!q.get('campus')||p.campus===q.get('campus'))&&(!q.get('department')||(p.department||'待分学部')===q.get('department')));
  if (q.get('category')) rows=rows.filter(p=>p.category===q.get('category'));
  if (q.get('q')) {const word=q.get('q').toLocaleLowerCase();rows=rows.filter(p=>(p.name+p.id+p.subject+p.position).toLocaleLowerCase().includes(word));}
  const facet=q.get('facet'), value=q.get('value');
  if (facet) rows=rows.filter(p=>facet==='teaching'?p.teaching===(value==='true'):facet==='bachelor_plus'?['本科','硕士','博士'].includes(p[basis].education):facet==='university_985'?p[basis].tier==='985':facet==='university_211'?['985','211非985'].includes(p[basis].tier):(p.facets[basis][facet]||[]).includes(value));
  return rows.map(p=>({...p,education:p[basis].education,university:p[basis].university,university_tier:p[basis].tier}));
}
request = async function(path, options={}) {
  if ((options.method||'GET').toUpperCase()!=='GET') throw new Error('公开演示仅供浏览，新增与修改请使用本地完整版。');
  const data=await publicData, url=new URL(path,'https://public.invalid'), route=url.pathname,q=url.searchParams;
  if (route==='/future-exam/catalog') {
    if(!window.HouwaiFutureExam||!data.future_exam_source)throw new Error('未来考试作业资料规划暂未读取。');
    return publicCopy(window.HouwaiFutureExam.catalog(data.future_exam_source,Object.fromEntries(q)));
  }
  if (route==='/learning-sources/catalog') {
    if(!window.HouwaiLearningSources||!data.learning_sources_source)throw new Error('系统接入准备资料暂未读取。');
    return publicCopy(window.HouwaiLearningSources.catalog(data.learning_sources_source,Object.fromEntries(q)));
  }
  if(route.startsWith('/learning-sources/')) {
    if(!window.HouwaiLearningSources||!data.learning_sources_source)throw new Error('系统接入准备资料暂未读取。');
    const parts=route.split('/');
    if(parts.length===4&&parts[3]==='capabilities')return publicCopy(window.HouwaiLearningSources.capabilities(data.learning_sources_source,parts[2]));
    if(parts.length===5&&parts[3]==='data')return window.HouwaiLearningSources.fetch(data.learning_sources_source,parts[2],parts[4]);
    throw new Error('数据接入接口不存在。');
  }
  if (route==='/research-hub/catalog'||route==='/research-hub/works') {
    if(!window.HouwaiResearchHub||!data.research_hub_source)throw new Error('学科作品库暂未读取，请刷新重试。');
    return publicCopy(window.HouwaiResearchHub[route.endsWith('/catalog')?'catalog':'works'](data.research_hub_source,Object.fromEntries(q)));
  }
  if (route.startsWith('/platform/')) {
    const method={'/platform/overview':'overview','/platform/teaching':'teaching','/platform/research':'research','/platform/salary':'salary','/platform/data-center':'data_center'}[route];
    if(!method||!window.HouwaiPlatform||!data.platform_source)throw new Error('当前管理专题尚未读取，请刷新重试。');
    return publicCopy(window.HouwaiPlatform[method](data.platform_source,Object.fromEntries(q)));
  }
  if (route==='/organization/talent-structure'||route==='/organization/talent-structure/personnel') {
    if(!window.HouwaiTalent||!data.talent_structure_source)throw new Error('当前队伍结构资料尚未读取。');
    return publicCopy(window.HouwaiTalent[route.endsWith('/personnel')?'personnel':'analyze'](data.talent_structure_source,Object.fromEntries(q)));
  }
  if (route==='/organization/management') {
    const campus=q.get('campus')||'',department=q.get('department')||'',period=q.get('period')||'2026-fall';
    const view=q.get('view')||'all';
    if(!['all','overview','appraisal','development','teams','roster'].includes(view))throw new Error('管理专题无效。');
    const key=[campus,department,period].join('|'),summary=data.management_v8_scopes?.[key],full=data.management_v8;
    if(!summary||!full)throw new Error('当前组织或学期未收录管理概况，请重新选择。');
    const inScope=row=>(!campus||row.campus===campus)&&(!department||(row.department||'待分学部')===department);
    return publicCopy({...summary,view,teachers:full.teachers.filter(inScope),teams:full.teams.filter(inScope),positions:full.positions.filter(inScope)});
  }
  if(route.startsWith('/management/')) {
    const p=await publicPerson(decodeURIComponent(route.split('/').pop()));
    if(!p.management_v8)throw new Error('本人员尚未收录管理概况。');
    return publicCopy(p.management_v8);
  }
  if (route==='/organization/tree') return publicCopy(data.tree);
  if (route==='/organization/summary'||route==='/organization/group') {
    const key=[q.get('campus')||'',q.get('department')||'',q.get('education_basis')||'highest'].join('|');
    if (!data.summaries[key]) throw new Error('当前组织范围没有收录，请先选择校区。');
    return publicCopy(data.summaries[key]);
  }
  if (route==='/organization/workspace'||route==='/bootstrap') return q.get('teacher_id')?(await publicPerson(q.get('teacher_id'))).workspace:publicCopy(data.workspace);
  if (route==='/organization/personnel') {
    const rows=publicRows(data,q),page=Math.max(1,Number(q.get('page')||1)),size=Math.max(1,Math.min(100,Number(q.get('page_size')||25)));
    return {items:rows.slice((page-1)*size,page*size),total:rows.length,page,page_size:size,pages:Math.ceil(rows.length/size),scope:data.tree.scope};
  }
  if (route.startsWith('/organization/personnel/')) return publicPerson(decodeURIComponent(route.split('/').pop()));
  if (route.startsWith('/development/')) {
    const p=await publicPerson(route.split('/').pop());
    if(!p.development) throw new Error('本岗位未收录教师个人目标。');
    return publicCopy(p.development);
  }
  if (route==='/human-reviews/dashboard') {
    const key=[q.get('campus')||'',q.get('department')||'',q.get('period_type')||'month',q.get('period')||'2026-10'].join('|');
    if(!data.human_dashboards?.[key]) throw new Error('当前范围或周期未收录人工评价演示，请选择已展示的校区与学部。');
    return publicCopy(data.human_dashboards[key]);
  }
  if (route.startsWith('/human-reviews/')) {
    const p=await publicPerson(route.split('/').pop()),key=(q.get('period_type')||'month')+'|'+(q.get('period')||'2026-10');
    if(!p.human_reviews?.[key]) throw new Error('本岗位或周期未收录人工评价；公开演示展示2026年10月短评与春季综合。');
    return publicCopy(p.human_reviews[key]);
  }
  if (route==='/appraisals/dashboard') return publicCopy(data.appraisal_dashboard);
  if (route.startsWith('/appraisals/')) {
    const p=await publicPerson(route.split('/').pop()),key=(q.get('period_type')||'month')+'|'+(q.get('period')||'2026-10');
    if (!p.public_appraisals[key]) throw new Error('公开演示展示2026年10月月评及2026年春、秋学期；其他周期尚未收录。');
    return p.public_appraisals[key];
  }
  if (route.startsWith('/reports/')) {
    const p=await publicPerson(route.split('/')[2]),period=q.get('period')||'4weeks';
    if (!p.public_reports[period]) throw new Error('该岗位不适用教学阶段报告。');
    return p.public_reports[period];
  }
  if (route==='/classroom-lab') return publicCopy(data.lab);
  throw new Error('此功能未收录在公开浏览版，请使用本地完整版。');
};
const publicOriginalLayout=layout;
layout=function(content) {
  const box=document.createElement('div');box.innerHTML=publicOriginalLayout(content);
  const control=box.querySelector('.actor-control');
  if(control)control.innerHTML='<span class="tag blue">集团视角 · 公开演示</span>';
  const notice=box.querySelector('.demo-notice span:not(.demo-dot)');
  if(notice)notice.textContent='公开只读演示 · 教师档案与评价为演示数据 · 真实系统未接入';
  const brand=box.querySelector('.brand');if(brand)brand.setAttribute('href','#group');
  const month=box.querySelector('#appraisalMonth');if(month){month.min='2026-10';month.max='2026-10';month.title='本演示收录2026年10月';}
  return box.innerHTML;
};
