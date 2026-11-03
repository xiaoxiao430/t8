/* Pure staffing reference; no network, DOM access, personnel writes or AI calls. */
(function(root){
"use strict";
const DEFAULTS={"mentor_min":1,"backup_min":1,"mentor_capacity":3,"new_teacher_years":3};
const BOUNDS={"mentor_min":[1,5],"backup_min":[1,5],"mentor_capacity":[1,8],"new_teacher_years":[0,5]};
const LABELS={"met":"符合演示参考","gap":"需要补强","limited":"资料有限"};
const STAGES=[["primary","小学","关注基础学习、课程衔接与综合育人。"],["middle","初中","关注学科衔接、共同备课与学生支持。"],["high","高中","关注学科深耕、课程教研与负责人后备。"],["unassigned","未分学部","先明确任教学部与职责，不套用学段梯队目标。"]];
const MAJORS={"语文":["汉语言","中文","语文"],"数学":["数学"],"英语":["英语","英文","外国语"],"物理":["物理"],"化学":["化学"],"历史":["历史"],"体育":["体育","运动"],"艺术":["艺术","美术","音乐","舞蹈","设计"],"生物":["生物"],"地理":["地理"],"政治":["政治","思想政治","马克思"]};
const copy=v=>JSON.parse(JSON.stringify(v)), arr=v=>Array.isArray(v)?v:[], number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const percent=(n,d)=>d?Math.floor(n*10000/d+0.5)/100:null;
const stageFor=d=>String(d||'').includes('小学')?'primary':String(d||'').includes('初中')?'middle':String(d||'').includes('高中')?'high':'unassigned';
function fail(code,message){const e=new Error(message);e.code=code;throw e;}
function referenceFor(query){
 const values={...DEFAULTS};let incoming=Object.hasOwn(query,'reference')?query.reference:{};
 if(typeof incoming==='string'){try{incoming=JSON.parse(incoming);}catch{fail('invalid_talent_reference','演示参考参数格式无效。');}}
 if(!incoming||Array.isArray(incoming)||typeof incoming!=='object'||Object.keys(incoming).some(k=>!(k in DEFAULTS)))fail('invalid_talent_reference','请选择已提供的演示参考参数。');
 incoming={...incoming,...Object.fromEntries(Object.keys(DEFAULTS).filter(k=>Object.hasOwn(query,k)).map(k=>[k,query[k]]))};
 for(const [key,raw] of Object.entries(incoming)){let value=raw;if(typeof value==='string'&&/^\d+$/.test(value.trim()))value=Number(value.trim());if(!number(value)||!Number.isInteger(value)||value<BOUNDS[key][0]||value>BOUNDS[key][1])fail('invalid_talent_reference','演示参考参数须为允许范围内的整数。');values[key]=value;}
 return {label:'演示参考目标',values,bounds:copy(BOUNDS),note:'本次模拟参考，可调整；不是国家标准，不改变教师评价或实际岗位。'};
}
const gapItem=(row,reason)=>({...Object.fromEntries(['id','name','campus','department','subject'].map(k=>[k,Object.hasOwn(row,k)?row[k]:''])),reason});
function check(key,label,target,items){
 const states=items.map(x=>x.status),status=states.includes('gap')?'gap':states.includes('limited')||!states.length?'limited':'met',missing=states.filter(x=>x==='limited').length,matched=states.filter(x=>x==='met').length;
 return {key,label,status,target,matched,total:items.length,missing,rate:missing?null:percent(matched,items.length),gaps:items.filter(x=>x.status!=='met').map(x=>x.item)};
}
function assess(people,teachers,teams,positions,reference,allPeople){
 const r=reference.values,byId=new Map(teachers.map(x=>[x.id,x])),all=new Map((allPeople||people).map(x=>[x.id,x]));
 const teaching=people.filter(p=>p.teaching),known=teaching.filter(p=>stageFor(p.department)!=='unassigned'),ids=new Set(known.map(p=>p.id));let rows=[];
 for(const p of known){const major=p.major||'',subject=p.subject||'',keys=MAJORS[subject],match=!!(keys&&major&&keys.some(k=>major.includes(k))),status=match?'met':'limited',reason=!major||!subject?'专业或学科资料待补齐。':'专业背景与学科需结合任教经历了解，不据此判断任教资格。';rows.push({status,item:gapItem(p,reason)});}
 const checks=[check('subject_match','专业与任教学科对照','专业背景仅作了解，不判断资格合规',rows)];
 const groups=teams.filter(t=>t.type==='教研组'&&stageFor(t.department)!=='unassigned');rows=[];const grouped=new Set();
 for(const t of groups){const members=arr(t.member_ids).filter(i=>ids.has(i));members.forEach(i=>grouped.add(i));const candidates=members.filter(i=>byId.get(i)?.career?.readiness==='可考虑承担'),unknown=members.some(i=>!byId.get(i)?.career?.readiness),status=candidates.length>=r.mentor_min?'met':unknown||!members.length?'limited':'gap';rows.push({status,item:gapItem(t,`带教候选${candidates.length}人，演示参考至少${r.mentor_min}人。`)});}
 const absent=new Map();for(const p of known)if(!grouped.has(p.id)){const key=JSON.stringify([p.campus,p.department,p.subject]);if(!absent.has(key))absent.set(key,p);}
 for(const p of absent.values())rows.push({status:'limited',item:gapItem(p,'该学科教研组与成员资料待补齐。')});
 checks.push(check('mentor_coverage','学科带教候选',`每个学科教研组至少${r.mentor_min}位候选`,rows));
 rows=[];const positioned=new Set(),teamsById=new Map(teams.map(t=>[t.id,t]));
 for(const position of positions){if(stageFor(position.department)==='unassigned')continue;positioned.add(position.team_id);const team=teamsById.get(position.team_id),backups=position.backups,valid=new Set();let unknown=!Array.isArray(backups)||!team;
  for(const b of arr(backups)){if(!b||typeof b!=='object'||Array.isArray(b)){unknown=true;continue;}const ident=b.teacher_id,person=all.get(ident);if(!person||!person.teaching||!arr(team?.member_ids).includes(ident)||ident===position.incumbent_id)unknown=true;else valid.add(ident);}
  const status=valid.size>=r.backup_min?'met':unknown?'limited':'gap';rows.push({status,item:gapItem(position,`具名后备${valid.size}人，演示参考至少${r.backup_min}人。`)});
 }
 for(const t of teams)if(stageFor(t.department)!=='unassigned'&&!positioned.has(t.id))rows.push({status:'limited',item:gapItem(t,'负责人岗位与后备资料待补齐。')});
 checks.push(check('backup_coverage','负责人岗位后备',`每个负责人岗位至少${r.backup_min}位后备`,rows));
 rows=[];
 for(const p of known){const teacher=byId.get(p.id)||{},years=p.years,focus=teacher.category==='support';if(!focus&&!number(years)){rows.push({status:'limited',item:gapItem(p,'教龄资料待补齐，暂不判断是否需要新教师带教。')});continue;}if(!focus&&years>r.new_teacher_years)continue;const career=teacher.career,mentorId=career?.mentor_id,mentor=mentorId?all.get(mentorId):null;let status;if(career==null)status='limited';else if(mentorId&&!mentor)status='limited';else if(mentor&&mentorId!==p.id&&mentor.teaching&&career?.mentor_name)status='met';else status='gap';rows.push({status,item:gapItem(p,'需要一位具名导师；先明确实际支持安排，不按教龄或评价给教师贴能力标签。')});}
 checks.push(check('support_coverage','新教师与重点支持带教',`教龄不超过${r.new_teacher_years}年或正式重点支持教师有具名导师`,rows));
 const mentorLoad=new Map();for(const t of teachers){const mentorId=t.career?.mentor_id;if(mentorId)mentorLoad.set(mentorId,(mentorLoad.get(mentorId)||0)+1);}
 rows=[];
 for(const p of known){const teacher=byId.get(p.id)||{},declared=teacher.workload?.mentee_count,assigned=mentorLoad.get(p.id)||0;if(!number(declared)&&!assigned){rows.push({status:'limited',item:gapItem(p,'带教任务数资料待补齐。')});continue;}const load=Math.max(assigned,number(declared)?declared:0);if(load<=0)continue;rows.push({status:load<=r.mentor_capacity?'met':'gap',item:gapItem(p,`同时带教${Math.trunc(load)}人，演示参考上限${r.mentor_capacity}人。`)});}
 checks.push(check('mentor_load','导师带教负担',`同时带教不超过${r.mentor_capacity}人`,rows));
 const unknownStage=teaching.filter(p=>stageFor(p.department)==='unassigned').length,notes=[];
 if(unknownStage)notes.push(`${unknownStage}位任教人员尚未明确学段，不套用学段梯队目标。`);
 if(checks.some(c=>c.missing))notes.push('未填资料、专业背景差异及未确认关系先了解，不直接判断教师表现差。');
 let status=checks.some(c=>c.status==='gap')?'gap':unknownStage||checks.some(c=>c.status==='limited')?'limited':'met';
 if(!teaching.length){status='limited';notes.push('本范围没有独立任课教师，教学配置暂不适用。');}
 const summary={met:'已记录的带教、后备与支持安排符合本次演示参考，继续回看实际成效。',gap:'部分学科或岗位仍需补强，不能用集团总量抵消局部缺口。',limited:'先补齐学段、任教经历或培养关系，再作完整判断。'}[status];
 return {status,label:LABELS[status],summary,checks,limit_notes:notes,mode:'规则演示研判 · 未调用真实大模型'};
}
function chart(values){const count=new Map();for(const k of values)count.set(k,(count.get(k)||0)+1);return [...count.keys()].sort().map(k=>({key:k,label:k,count:count.get(k)}));}
function degreeFor(p,basis){return (basis==='first'?p.first_education:(p.highest||p.final_education))||{};}
function valuesFor(p,basis){
 const age=p.age,years=p.years,final=degreeFor(p,basis),first=p.first_education||{},vals={age:!number(age)?'未填写':age<30?'30岁以下':age<40?'30—39岁':age<50?'40—49岁':'50岁及以上',experience:!number(years)?'未填写':years<=3?'3年及以下':years<10?'4—9年':years<20?'10—19年':'20年及以上',gender:p.gender,first_education:first.education,education:final.education,major:p.major,subject:p.teaching?p.subject:'未独立任课',university:final.tier,school:final.university,position:p.position};
 const output=Object.fromEntries(Object.entries(vals).map(([k,v])=>[k,[v==null||v===''?'未填写':String(v)]])),awards=[...new Set(arr(p.honors).map(h=>h.level||'未填写'))].sort(),certs=[...new Set(arr(p.qualifications))].sort();output.awards=awards.length?awards:['暂无记录'];output.certificates=certs.length?certs:['暂无记录'];return output;
}
function chartsFor(people,basis='highest'){
 const output=Object.fromEntries(['age','gender','first_education','education','major','subject','experience','university','school','awards','certificates','position'].map(k=>[k,[]]));for(const p of people)for(const [k,values] of Object.entries(valuesFor(p,basis)))output[k].push(...values);return Object.fromEntries(Object.entries(output).map(([k,v])=>[k,chart(v)]));
}
function countsFor(people,teachers,positions,reference,population,basis='highest'){
 const teaching=people.filter(p=>p.teaching),ids=new Set(teaching.map(p=>p.id)),byId=new Map(teachers.map(t=>[t.id,t])),selected=population==='all'?people:teaching;
 const needed=teaching.filter(p=>byId.get(p.id)?.category==='support'||number(p.years)&&p.years<=reference.values.new_teacher_years),backups=new Set(positions.flatMap(x=>arr(x.backups).filter(b=>ids.has(b.teacher_id)).map(b=>b.teacher_id)));
 return {staff:people.length,teaching:teaching.length,non_teaching:people.length-teaching.length,selected:selected.length,reserve:people.filter(p=>['跟岗','待岗','储备'].some(k=>String(p.position||'').includes(k))).length,mentor_candidates:teachers.filter(t=>ids.has(t.id)&&t.career?.readiness==='可考虑承担').length,backups:backups.size,new_teachers:teaching.filter(p=>number(p.years)&&p.years<=reference.values.new_teacher_years).length,focus_teachers:teaching.filter(p=>byId.get(p.id)?.category==='support').length,covered_teachers:needed.filter(p=>!!byId.get(p.id)?.career?.mentor_id).length,bachelor_plus:selected.filter(p=>['本科','硕士','博士'].includes(degreeFor(p,basis).education)).length,university_985:selected.filter(p=>degreeFor(p,basis).tier==='985').length,university_211:selected.filter(p=>['985','211非985'].includes(degreeFor(p,basis).tier)).length};
}
function selection(source,query){
 const population=Object.hasOwn(query,'population')?query.population:'teaching',basis=Object.hasOwn(query,'education_basis')?query.education_basis:'highest';if(!['teaching','all'].includes(population))fail('invalid_talent_population','请选择任教人员或全部教职工。');if(!['highest','first'].includes(basis))fail('invalid_talent_basis','请选择最终学历或第一学历。');
 const base=source.scope||{},campus=query.campus||base.campus||'',department=query.department||base.department||'',inside=p=>(!campus||p.campus===campus)&&(!department||(p.department||'待分学部')===department),people=arr(source.people).filter(inside);if((campus||department)&&!people.length)fail('outside_scope','组织不在当前授权范围。');
 const scope={campus,department,label:[campus,department].filter(Boolean).join(' · ')||base.label||'授权集团',level:department?'department':campus?'campus':base.level||'group'};return {scope,population,basis,people,selected:population==='all'?people:people.filter(p=>p.teaching)};
}
function filterPeople(source,query={}){
 const {basis,selected}=selection(source,query),facet=query.facet,value=query.value;if(!facet)return copy(selected);const allowed=[...Object.keys(valuesFor({},basis)),'bachelor_plus','university_985','university_211'];if(!allowed.includes(facet))fail('invalid_talent_facet','结构分类无效。');if(!['bachelor_plus','university_985','university_211'].includes(facet)&&value==null)fail('invalid_talent_facet','请选择结构分类值。');
 return copy(selected.filter(p=>{const d=degreeFor(p,basis);if(facet==='bachelor_plus')return ['本科','硕士','博士'].includes(d.education);if(facet==='university_985')return d.tier==='985';if(facet==='university_211')return ['985','211非985'].includes(d.tier);return valuesFor(p,basis)[facet].includes(value);}));
}
function personnel(source,query={}){
 const {scope,population,basis}=selection(source,query),rows=filterPeople(source,query);function integer(key,defaultValue,maximum){let value=Object.hasOwn(query,key)?query[key]:defaultValue;if(typeof value==='string'&&/^\d+$/.test(value.trim()))value=Number(value.trim());if(!number(value)||!Number.isInteger(value)||value<1||value>maximum)fail('invalid_talent_page','页码或每页人数无效。');return value;}
 const size=integer('page_size',20,100),pages=Math.max(1,Math.ceil(rows.length/size)),page=Math.min(integer('page',1,1000000),pages),distribution=[];
 for(const campus of [...new Set(rows.map(p=>p.campus||'未填写'))].sort()){const local=rows.filter(p=>(p.campus||'未填写')===campus),departments=[...new Set(local.map(p=>p.department||'待分学部'))].sort().map(department=>({department,count:local.filter(p=>(p.department||'待分学部')===department).length}));distribution.push({campus,count:local.length,departments});}
 return {scope,population,education_basis:basis,items:rows.slice((page-1)*size,page*size),total:rows.length,page,page_size:size,pages,distribution};
}
function actionsFor(analysis,counts){
 const checks=Object.fromEntries(analysis.checks.map(x=>[x.key,x]));
 function action(title,text,key){const gaps=checks[key].gaps;return {title,text,teacher_ids:gaps.filter(x=>/^(teacher-|staff-)/.test(String(x.id))).map(x=>x.id),team_ids:gaps.filter(x=>String(x.id).startsWith('management-team-')).map(x=>x.id),position_ids:gaps.filter(x=>String(x.id).startsWith('management-position-')).map(x=>x.id)};}
 return {talent:[action('了解专业与任教背景','结合任教经历、课程任务和实际教学了解专业差异，不据此判定任教资格。','subject_match'),action('统筹实习与储备安排',`本范围${counts.reserve}位跟岗、待岗或储备人员，单列岗位用途，不计为教学不合格。`,'subject_match'),action('优先落实具体支持','先为新教师及重点支持教师落实具名导师，再回看课堂与育人变化。','support_coverage')],ladder:[action('按学科补充带教候选','逐个教研组查看候选与实际带教意愿，不能只看全集团总人数。','mentor_coverage'),action('安排负责人后备实践','缺后备的岗位先提供一次组织实践机会，再由校方确认准备情况。','backup_coverage'),action('平衡导师带教任务','结合周课量、班主任职责和同时带教人数，协商分担与共备时间。','mentor_load')]};
}
function analyze(source,query={}){
 const reference=referenceFor(query),{scope,population,basis,people,selected}=selection(source,query),{campus,department}=scope,inside=p=>(!campus||p.campus===campus)&&(!department||(p.department||'待分学部')===department);
 const ids=new Set(people.map(p=>p.id)),teachers=arr(source.teachers).filter(p=>ids.has(p.id)),teams=arr(source.teams).filter(inside),positions=arr(source.positions).filter(inside);
 const analysis=assess(people,teachers,teams,positions,reference,arr(source.people)),counts=countsFor(people,teachers,positions,reference,population,basis),stages=[];
 for(const [key,label,focus] of STAGES){const ps=people.filter(p=>stageFor(p.department)===key);if(!ps.length)continue;const is=new Set(ps.map(p=>p.id)),ts=teachers.filter(p=>is.has(p.id)),groups=teams.filter(p=>stageFor(p.department)===key),roles=positions.filter(p=>stageFor(p.department)===key);stages.push({key,label,focus,counts:countsFor(ps,ts,roles,reference,population,basis),analysis:assess(ps,ts,groups,roles,reference,arr(source.people))});}
 return {scope,population,education_basis:basis,counts,charts:chartsFor(selected,basis),reference,analysis,stages,actions:actionsFor(analysis,counts)};
}
const api={analyze,referenceFor,stageFor,personnel,filterPeople};root.HouwaiTalent=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
