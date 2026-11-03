(function(root){'use strict';const clone=x=>JSON.parse(JSON.stringify(x));
function error(code,message,status){const e=new Error(message);e.code=code;e.status=status;throw e;}
function catalog(source,q={}){if(q.teacher_id!==undefined&&q.teacher_id!==null&&typeof q.teacher_id!=='string')error('invalid_teacher_context','教师编号无效。',400);const origin=source.scope||{},teacher_id=q.teacher_id||source.context?.teacher_id||null,contexts=source.authorized_contexts||[];
 if(teacher_id!==null&&(typeof teacher_id!=='string'||!(/^[A-Za-z0-9_.:-]{1,100}$/).test(teacher_id)))error('invalid_teacher_context','教师编号无效。',400);
 const context=teacher_id?contexts.find(c=>c.teacher_id===teacher_id):null;if(teacher_id&&!context)error('outside_scope','教师不在当前评价资料规划的授权范围。',403);
 const campus=q.campus||context?.campus||origin.campus||'',department=q.department||context?.department||origin.department||'';
 if(context&&((campus&&campus!==context.campus)||(department&&department!==context.department)))error('outside_scope','教师与所选组织范围不一致。',403);
 if((campus||department)&&!contexts.some(c=>(!campus||c.campus===campus)&&(!department||c.department===department)))error('outside_scope','组织不在当前评价资料规划的授权范围。',403);
 const result=clone(source);for(const k of ['authorized_contexts','scope','context','teacher'])delete result[k];
 return {...result,scope:{campus,department,label:[campus,department].filter(Boolean).join(' · ')||origin.label||'集团'},context:{teacher_id},teacher:teacher_id?{id:teacher_id}:null};}
const api={catalog};root.HouwaiFutureExam=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
