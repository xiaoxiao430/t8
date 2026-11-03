/* Safe read projections for the public, read-only subject link library. */
(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function error(code,message){const e=new Error(message);e.code=code;throw e;}
function base(source,q={}){
 const origin=source.scope||{},campus=q.campus||origin.campus||'',department=q.department||origin.department||'';
 if(campus&&!(source.campuses||[]).includes(campus))error('outside_scope','校区不在当前教研授权范围。');
 if(origin.department&&department!==origin.department)error('outside_scope','学部不在当前教研授权范围。');
 if(department&&!(source.organizations||[]).some(x=>(!campus||x.campus===campus)&&x.department===department))error('outside_scope','学部不在当前教研授权范围。');
 return {scope:{campus,department,label:[campus,department].filter(Boolean).join(' · ')||'集团大教研'},capabilities:clone(source.capabilities),read_only:!source.capabilities.submit_work&&!source.capabilities.review_work,notice:source.notice};
}
function filtered(source,q,result){
 const scope=result.scope;let items=clone(source.items||[]).filter(w=>(!scope.campus||w.campus===scope.campus)&&(!scope.department||w.department===scope.department));
 for(const key of ['subject','type','track_id'])if(q[key])items=items.filter(w=>w[key]===q[key]);
 if(q.line==='special')items=items.filter(w=>w.track_id!=='discipline');else if(q.line==='discipline')items=items.filter(w=>w.track_id==='discipline');else if(q.line&&!['all'].includes(q.line))error('invalid_research_line','请选择专项教研或学科课堂创新。');
 if(q.status&&!['all'].includes(q.status)){if(!['pending','published','returned','reserved'].includes(q.status))error('invalid_research_status','资料状态无效。');items=items.filter(w=>w.status===q.status);}
 if(q.q){const needle=String(q.q).toLowerCase();items=items.filter(w=>['title','summary','subject','teacher_name','applicable_grade'].map(k=>String(w[k]||'')).join(' ').toLowerCase().includes(needle));}
 items.sort((a,b)=>{const x=(a.submitted_at||'')+'|'+a.id,y=(b.submitted_at||'')+'|'+b.id;return x<y?1:x>y?-1:0;});
 return items;
}
function works(source,q={}){
 const result=base(source,q),items=filtered(source,q,result);
 const int=value=>typeof value==='number'&&Number.isInteger(value)?value:typeof value==='string'&&/^[+-]?\d+$/.test(value.trim())?Number(value):NaN;
 let page=int(q.page===undefined?1:q.page),size=int(q.page_size===undefined?12:q.page_size);if(!Number.isFinite(page)||!Number.isFinite(size)||page<1||size<1||size>100)error('invalid_research_page','请选择有效页码，每页最多100项。');
 const total=items.length,pages=Math.ceil(total/size);page=Math.min(page,Math.max(1,pages));
 return {...result,items:items.slice((page-1)*size,page*size),total,page,page_size:size,pages,subjects:clone(source.subjects),types:clone(source.types)};
}
function catalog(source,q={}){
 const result=base(source,q);
 const organizations=source.organizations.filter(o=>(!result.scope.campus||o.campus===result.scope.campus)&&(!result.scope.department||o.department===result.scope.department)),total=organizations.reduce((n,o)=>n+o.teaching,0);
 const displayTracks=(source.track_definitions||[]).map(definition=>{const track=clone(definition),ratio=track.ratio;delete track.ratio;return {...track,member_count:total?Math.max(1,Math.floor(total*ratio+.5)):0,count_kind:'example',notice:'委员会及负责人名称已确认；成员人数、项目和周报为示例，实际以专项名单及确认发布的记录为准。专项之间可能有同一位教师。'};});
 const scoped=filtered(source,q,result);
 const disciplineCampus=source.discipline_campus||null;
 return {...result,tracks:displayTracks,discipline_line:{id:'discipline',label:'学科课堂创新',leads:[{name:'集团负责人',role:'集团牵头'},{name:'李媚',role:'初中分管教学副校长'}],campus:disciplineCampus,campus_label:disciplineCampus?disciplineCampus+'初中部':'初中部（校区待设置）',priority_subjects:['英语','地理','历史'],expansion_subjects:['数学','物理','化学','生物'],methods:['Vibe Coding','Vibe Knowledge'],notice:'牵头人与先行学科来自已确认的推进方向；作品及团队成员另行确认，不据此建立人事评价。'},subjects:clone(source.subjects),types:clone(source.types),programs:clone(source.programs||[]),counts:Object.fromEntries(['published','pending','returned','reserved'].map(k=>[k,scoped.filter(w=>w.status===k).length])),integration:{dingtalk_connected:false,mode:'入口预留',flow:['群内推进','本人确认','审核发布'],notice:'钉钉机器人由另一项工作推进，本平台暂不读取群消息或自动发布。'},organizations:clone(organizations),tree:clone(source.tree)};
}
const api={catalog,works};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HouwaiResearchHub=api;
})(typeof window==='undefined'?globalThis:window);
