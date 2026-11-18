(() => {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const STORAGE_KEY = "mahamy_data_v1";
const DEFAULT_CATEGORIES = ["الدراسة","الواجبات","المراجعة","المشاريع","شخصية","المواعيد","أخرى"];
const PRIORITIES = {urgent:"عاجلة جداً",high:"عالية",medium:"متوسطة",low:"منخفضة"};
const PRIORITY_ORDER = {urgent:0,high:1,medium:2,low:3};
const quotes = ["الإنجاز يبدأ بقرار صغير.","لا تحتاج إلى إنجاز كل شيء اليوم؛ ابدأ بالأهم.","الاستمرارية تصنع ما لا تصنعه السرعة.","نظّم وقتك، واترك مساحة للأشياء الجميلة.","كل خطوة واضحة تقرّبك من هدفك."];
let data = {tasks:[],notes:[],reminders:[],subjects:[],lectures:[],fridayReview:{},categories:[...DEFAULT_CATEGORIES]};
let activeFilter = "all";
let toastTimer;

function localDate(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+d;
}
function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "m"+Date.now().toString(36)+Math.random().toString(36).slice(2); }
function saveData() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (error) { console.error("LocalStorage save failed",error); toast("تعذر حفظ البيانات. قد تكون مساحة التخزين ممتلئة."); return false; }
}
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      data.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      data.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
      data.reminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];
      data.subjects = Array.isArray(parsed.subjects) ? parsed.subjects : [];
      data.lectures = Array.isArray(parsed.lectures) ? parsed.lectures : [];
      data.fridayReview = parsed.fridayReview && typeof parsed.fridayReview === "object" ? parsed.fridayReview : {};
      data.categories = Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : [...DEFAULT_CATEGORIES];
    }
  } catch (error) { console.error("LocalStorage read failed",error); toast("تعذر قراءة بعض البيانات المحفوظة."); }
}
function toast(message) {
  const node = $("#toast"); if (!node) return;
  node.textContent = message; node.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>node.classList.remove("show"),2600);
}
function updateClock() {
  const now = new Date(), hour = now.getHours();
  $("#greeting").textContent = hour>=5&&hour<12 ? "صباح الخير 👋" : hour>=12&&hour<18 ? "مساء الخير 👋" : hour>=18&&hour<23 ? "مساء النور 👋" : "أهلاً بك 👋";
  $("#liveClock").textContent = new Intl.DateTimeFormat("ar-EG",{hour:"2-digit",minute:"2-digit",hour12:true}).format(now);
  $("#fullDate").textContent = new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(now);
  $("#topbarDate").textContent = new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long"}).format(now);
}
function showPage(name) {
  const target=$("#page-"+name); if(!target)return;
  $$(".page").forEach(p=>p.classList.toggle("active",p===target));
  $$("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="tasks") renderTasks();
  if(name==="notes") renderNotes();
  if(name==="reminders") renderReminders();
  if(name==="schedule") renderSchedule();
}
function bindNavigation() {
  $$("[data-page]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();showPage(el.dataset.page);}));
}
function cleanupCompleted() {
  const cutoff=Date.now()-24*60*60*1000;
  const before=data.tasks.length;
  data.tasks=data.tasks.filter(t=>!t.completed || !t.completedAt || new Date(t.completedAt).getTime()>cutoff);
  if(data.tasks.length!==before){saveData();toast("تم تنظيف المهام المكتملة التي مرّ عليها أكثر من 24 ساعة.");}
}
function openModal(id) { const modal=$("#"+id); modal.hidden=false; document.body.style.overflow="hidden"; }
function closeModal(id) { const modal=$("#"+id); if(modal){modal.hidden=true;document.body.style.overflow="";} }
function bindModals() {
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
  $$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id);}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".modal-backdrop:not([hidden])").forEach(m=>closeModal(m.id));});
}
function populateCategorySelect(selected) {
  $("#taskCategory").innerHTML=data.categories.map(c=>'<option value="'+escapeHTML(c)+'">'+escapeHTML(c)+'</option>').join("");
  if(selected && data.categories.includes(selected)) $("#taskCategory").value=selected;
}
function resetTaskForm() {
  $("#taskForm").reset(); $("#taskId").value=""; $("#taskModalTitle").textContent="إضافة مهمة جديدة";
  $("#taskDate").value=localDate(); populateCategorySelect("الدراسة"); $("#taskPriority").value="medium";
}
function openTaskForm(task) {
  resetTaskForm();
  if(task) {
    $("#taskModalTitle").textContent="تعديل المهمة"; $("#taskId").value=task.id;
    $("#taskTitle").value=task.title||""; $("#taskDescription").value=task.description||"";
    $("#taskDate").value=task.date||""; $("#taskDueDate").value=task.dueDate||"";
    $("#taskStart").value=task.startTime||""; $("#taskEnd").value=task.endTime||"";
    populateCategorySelect(task.category); $("#taskPriority").value=task.priority||"medium";
    $("#taskNotes").value=task.notes||""; $("#taskRepeat").value=task.repeat||"none";
    $("#taskReminder").value=task.reminder||"";
  }
  openModal("taskModal"); setTimeout(()=>$("#taskTitle").focus(),60);
}
function taskFormSubmit(e) {
  e.preventDefault();
  const title=$("#taskTitle").value.trim();
  if(!title){toast("اكتب عنوان المهمة أولاً.");return;}
  const date=$("#taskDate").value, dueDate=$("#taskDueDate").value;
  if(date && dueDate && dueDate<date){toast("موعد التسليم لا يمكن أن يسبق تاريخ المهمة.");return;}
  const id=$("#taskId").value, old=data.tasks.find(t=>t.id===id);
  const task={
    id:id||uid(),title,description:$("#taskDescription").value.trim(),date,dueDate,
    startTime:$("#taskStart").value,endTime:$("#taskEnd").value,category:$("#taskCategory").value,
    priority:$("#taskPriority").value,notes:$("#taskNotes").value.trim(),repeat:$("#taskRepeat").value,
    reminder:$("#taskReminder").value,completed:old?!!old.completed:false,completedAt:old?old.completedAt:null,
    createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  if(old) data.tasks=data.tasks.map(t=>t.id===id?task:t); else data.tasks.unshift(task);
  if(saveData()){closeModal("taskModal");renderAll();toast(old?"تم تحديث المهمة.":"تمت إضافة المهمة وحفظها.");}
}
function taskMatches(task,filter,today,tomorrow) {
  const due=task.dueDate||task.date;
  if(filter==="completed")return task.completed;
  if(filter==="all")return true;
  if(task.completed)return false;
  if(filter==="today")return due===today;
  if(filter==="tomorrow")return due===tomorrow;
  if(filter==="upcoming")return !!due&&due>today;
  if(filter==="overdue")return !!due&&due<today;
  if(filter==="high")return ["urgent","high"].includes(task.priority);
  return true;
}
function sortedTasks(list) {
  const sort=$("#taskSort").value;
  return [...list].sort((a,b)=>{
    if(sort==="priority")return (PRIORITY_ORDER[a.priority]??9)-(PRIORITY_ORDER[b.priority]??9);
    if(sort==="created")return new Date(b.createdAt)-new Date(a.createdAt);
    if(sort==="title")return a.title.localeCompare(b.title,"ar");
    const ad=a.dueDate||a.date||"9999-12-31",bd=b.dueDate||b.date||"9999-12-31";
    return ad.localeCompare(bd)||((PRIORITY_ORDER[a.priority]??9)-(PRIORITY_ORDER[b.priority]??9));
  });
}
function formatDate(value) {
  if(!value)return "بدون موعد";
  const d=new Date(value+"T12:00:00");
  return new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short",year:"numeric"}).format(d);
}
function renderTasks() {
  const today=localDate(), tomorrow=localDate(new Date(Date.now()+86400000));
  const query=$("#taskSearch").value.trim().toLocaleLowerCase("ar");
  const list=sortedTasks(data.tasks.filter(t=>taskMatches(t,activeFilter,today,tomorrow)).filter(t=>(t.title+" "+(t.description||"")+" "+(t.notes||"")+" "+(t.category||"")).toLocaleLowerCase("ar").includes(query)));
  $("#taskSummary").textContent="عرض "+list.length+" من "+data.tasks.length+" مهمة";
  $("#taskList").innerHTML=list.length?list.map(t=>{
    const due=t.dueDate||t.date, overdue=!t.completed&&due&&due<today;
    return '<article class="task-card '+(t.completed?'is-completed':'')+'"><input class="task-check" type="checkbox" data-action="toggle" data-id="'+escapeHTML(t.id)+'" '+(t.completed?'checked':'')+' aria-label="تحديد اكتمال المهمة"><div class="task-main"><div class="task-title-line"><strong>'+escapeHTML(t.title)+'</strong><span class="task-pill priority-'+escapeHTML(t.priority||"medium")+'">'+(PRIORITIES[t.priority]||"متوسطة")+'</span></div>'+(t.description?'<p class="task-description">'+escapeHTML(t.description)+'</p>':'')+'<div class="task-meta"><span>▦ '+escapeHTML(t.category||"أخرى")+'</span><span '+(overdue?'style="color:#D63D5B;font-weight:700"':'')+'>◷ '+(overdue?"متأخرة · ":"")+formatDate(due)+'</span>'+(t.startTime?'<span>◴ '+escapeHTML(t.startTime)+(t.endTime?' – '+escapeHTML(t.endTime):"")+'</span>':'')+(t.repeat&&t.repeat!=="none"?'<span>↻ '+({daily:"يومياً",weekly:"أسبوعياً",monthly:"شهرياً"}[t.repeat]||"متكرر")+'</span>':'')+'</div></div><div class="task-actions"><button type="button" data-action="edit" data-id="'+escapeHTML(t.id)+'" aria-label="تعديل">✎</button><button type="button" data-action="delete" data-id="'+escapeHTML(t.id)+'" aria-label="حذف">×</button></div></article>';
  }).join(""):'<div class="empty-inline">'+(query?"لا توجد نتائج مطابقة للبحث.":activeFilter==="completed"?"لا توجد مهام مكتملة حالياً.":"لا توجد مهام في هذا العرض. أضف مهمتك الأولى وابدأ.")+'</div>';
  $$("#taskFilters [data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===activeFilter));
  renderCategories();
}
function renderCategories() {
  populateCategorySelect($("#taskCategory").value);
  $("#categoryList").innerHTML=data.categories.map(c=>'<span class="category-tag">'+escapeHTML(c)+' <button type="button" data-category-edit="'+escapeHTML(c)+'" aria-label="تغيير اسم '+escapeHTML(c)+'">✎</button> <button type="button" data-category-delete="'+escapeHTML(c)+'" aria-label="حذف '+escapeHTML(c)+'">×</button></span>').join("");
}
function handleTaskAction(e) {
  const control=e.target.closest("[data-action]");if(!control)return;
  const task=data.tasks.find(t=>t.id===control.dataset.id);if(!task)return;
  const action=control.dataset.action;
  if(action==="toggle"){if(e.type!=="change")return;task.completed=control.checked;task.completedAt=control.checked?new Date().toISOString():null;saveData();renderAll();toast(control.checked?"تم تسجيل اكتمال المهمة.":"تمت إعادة فتح المهمة.");}
  if(action==="edit")openTaskForm(task);
  if(action==="delete"&&confirm("هل تريد حذف هذه المهمة نهائياً؟")){data.tasks=data.tasks.filter(t=>t.id!==task.id);saveData();renderAll();toast("تم حذف المهمة.");}
}
function handleCategoryAction(e) {
  const edit=e.target.closest("[data-category-edit]"), del=e.target.closest("[data-category-delete]");
  if(edit){const old=edit.dataset.categoryEdit, name=prompt("اكتب الاسم الجديد للتصنيف:",old);if(name===null)return;const clean=name.trim();if(!clean){toast("اسم التصنيف لا يمكن أن يكون فارغاً.");return;}if(data.categories.includes(clean)&&clean!==old){toast("هذا التصنيف موجود بالفعل.");return;}data.categories=data.categories.map(c=>c===old?clean:c);data.tasks.forEach(t=>{if(t.category===old)t.category=clean;});saveData();renderAll();toast("تم تغيير اسم التصنيف.");}
  if(del){const name=del.dataset.categoryDelete;if(data.categories.length===1){toast("يجب الاحتفاظ بتصنيف واحد على الأقل.");return;}if(!confirm("حذف التصنيف «"+name+"»؟ ستُنقل مهامه إلى «أخرى»."))return;data.categories=data.categories.filter(c=>c!==name);if(!data.categories.includes("أخرى"))data.categories.push("أخرى");data.tasks.forEach(t=>{if(t.category===name)t.category="أخرى";});saveData();renderAll();toast("تم حذف التصنيف.");}
}
function addCategory(e){e.preventDefault();const input=$("#newCategory"),name=input.value.trim();if(!name)return;if(data.categories.includes(name)){toast("التصنيف موجود بالفعل.");return;}data.categories.push(name);input.value="";saveData();renderAll();toast("تمت إضافة التصنيف.");}
function resetNoteForm(){ $("#noteForm").reset();$("#noteId").value="";$("#noteModalTitle").textContent="ملاحظة جديدة";$("#noteColor").value="lilac"; }
function openNoteForm(note){resetNoteForm();if(note){$("#noteModalTitle").textContent="تعديل الملاحظة";$("#noteId").value=note.id;$("#noteTitle").value=note.title;$("#noteContent").value=note.content;$("#noteColor").value=note.color||"lilac";$("#notePinned").checked=!!note.pinned;}openModal("noteModal");setTimeout(()=>$("#noteTitle").focus(),60);}
function noteFormSubmit(e){e.preventDefault();const title=$("#noteTitle").value.trim(),content=$("#noteContent").value.trim();if(!title||!content){toast("أدخل عنوان الملاحظة ومحتواها.");return;}const id=$("#noteId").value,old=data.notes.find(n=>n.id===id);const note={id:id||uid(),title,content,color:$("#noteColor").value,pinned:$("#notePinned").checked,createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};if(old)data.notes=data.notes.map(n=>n.id===id?note:n);else data.notes.unshift(note);if(saveData()){closeModal("noteModal");renderNotes();toast(old?"تم تحديث الملاحظة.":"تم حفظ الملاحظة.");}}
function renderNotes(){const q=$("#noteSearch").value.trim().toLocaleLowerCase("ar");const notes=[...data.notes].filter(n=>(n.title+" "+n.content).toLocaleLowerCase("ar").includes(q)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updatedAt)-new Date(a.updatedAt));$("#notesList").innerHTML=notes.length?notes.map(n=>'<article class="note-card '+escapeHTML(n.color||"lilac")+(n.pinned?" pinned":"")+'">'+(n.pinned?'<span class="note-pin">◆</span>':'')+'<div class="note-actions"><button type="button" data-note-edit="'+escapeHTML(n.id)+'" aria-label="تعديل">✎</button><button type="button" data-note-delete="'+escapeHTML(n.id)+'" aria-label="حذف">×</button></div><h3>'+escapeHTML(n.title)+'</h3><p>'+escapeHTML(n.content)+'</p><span class="note-date">آخر تعديل: '+new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short"}).format(new Date(n.updatedAt))+'</span></article>').join(""):'<div class="empty-inline">'+(q?"لا توجد ملاحظات مطابقة.":"لا توجد ملاحظات بعد. أنشئ أول ملاحظة للاحتفاظ بأفكارك.")+'</div>';}
function handleNoteAction(e){const edit=e.target.closest("[data-note-edit]"),del=e.target.closest("[data-note-delete]");if(edit){const n=data.notes.find(x=>x.id===edit.dataset.noteEdit);if(n)openNoteForm(n);}if(del){const id=del.dataset.noteDelete;if(confirm("هل تريد حذف هذه الملاحظة؟")){data.notes=data.notes.filter(n=>n.id!==id);saveData();renderNotes();toast("تم حذف الملاحظة.");}}}

function reminderDateTime(reminder){return new Date((reminder.date||"")+"T"+(reminder.time||"00:00")+":00");}
function formatReminderDate(reminder){const d=reminderDateTime(reminder);return new Intl.DateTimeFormat("ar-EG",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);}
function resetReminderForm(){ $("#reminderForm").reset();$("#reminderId").value="";$("#reminderModalTitle").textContent="تذكير جديد";$("#reminderDate").value=localDate();$("#reminderTime").value="09:00";populateReminderTasks("");}
function populateReminderTasks(selected){const select=$("#reminderTask");select.innerHTML='<option value="">بدون مهمة</option>'+data.tasks.filter(t=>!t.completed).map(t=>'<option value="'+escapeHTML(t.id)+'">'+escapeHTML(t.title)+'</option>').join("");if(selected)select.value=selected;}
function openReminderForm(reminder){resetReminderForm();if(reminder){$("#reminderModalTitle").textContent="تعديل التذكير";$("#reminderId").value=reminder.id;$("#reminderTitle").value=reminder.title||"";$("#reminderDescription").value=reminder.description||"";$("#reminderDate").value=reminder.date||localDate();$("#reminderTime").value=reminder.time||"09:00";$("#reminderRepeat").value=reminder.repeat||"none";populateReminderTasks(reminder.taskId||"");}openModal("reminderModal");setTimeout(()=>$("#reminderTitle").focus(),60);}
function reminderFormSubmit(e){e.preventDefault();const title=$("#reminderTitle").value.trim(),date=$("#reminderDate").value,time=$("#reminderTime").value;if(!title||!date||!time){toast("أكمل عنوان التذكير والتاريخ والوقت.");return;}const id=$("#reminderId").value,old=data.reminders.find(r=>r.id===id);const reminder={id:id||uid(),title,description:$("#reminderDescription").value.trim(),date,time,repeat:$("#reminderRepeat").value,taskId:$("#reminderTask").value,enabled:old?old.enabled!==false:true,lastNotifiedKey:old?old.lastNotifiedKey:null,createdAt:old?old.createdAt:new Date().toISOString()};if(old)data.reminders=data.reminders.map(r=>r.id===id?reminder:r);else data.reminders.unshift(reminder);if(saveData()){closeModal("reminderModal");renderReminders();toast(old?"تم تحديث التذكير.":"تم حفظ التذكير.");}}
let activeReminderFilter="all";
function renderReminders(){const now=Date.now();const list=data.reminders.filter(r=>activeReminderFilter==="paused"?!r.enabled:activeReminderFilter==="done"?r.enabled:activeReminderFilter==="upcoming"?r.enabled&&reminderDateTime(r).getTime()>=now:true).sort((a,b)=>reminderDateTime(a)-reminderDateTime(b));$("#remindersList").innerHTML=list.length?list.map(r=>{const task=data.tasks.find(t=>t.id===r.taskId);return '<article class="reminder-card '+(r.enabled?'':'is-paused')+'"><div class="reminder-symbol">◷</div><div class="reminder-main"><strong>'+escapeHTML(r.title)+'</strong>'+(r.description?'<p>'+escapeHTML(r.description)+'</p>':'')+'<div class="task-meta"><span>'+formatReminderDate(r)+'</span><span>'+({none:"مرة واحدة",daily:"يومياً",weekly:"أسبوعياً",monthly:"شهرياً"}[r.repeat]||"مرة واحدة")+'</span>'+(task?'<span>مهمة: '+escapeHTML(task.title)+'</span>':'')+'</div><span class="reminder-state">'+(r.enabled?'مفعّل':'متوقف')+'</span></div><div class="task-actions"><button type="button" data-reminder-toggle="'+escapeHTML(r.id)+'" aria-label="'+(r.enabled?'إيقاف':'تفعيل')+'">'+(r.enabled?'Ⅱ':'▶')+'</button><button type="button" data-reminder-edit="'+escapeHTML(r.id)+'" aria-label="تعديل">✎</button><button type="button" data-reminder-delete="'+escapeHTML(r.id)+'" aria-label="حذف">×</button></div></article>';}).join(""):'<div class="empty-inline">'+(activeReminderFilter==="paused"?"لا توجد تذكيرات متوقفة.":"لا توجد تذكيرات هنا. أضف تذكيرك الأول.")+'</div>';$("[data-reminder-filter]").forEach(b=>b.classList.toggle("active",b.dataset.reminderFilter===activeReminderFilter));updateNotificationStatus();}
function updateNotificationStatus(){const el=$("#notificationStatus");if(!("Notification" in window)){el.textContent="المتصفح لا يدعم إشعارات الويب";return;}el.textContent=Notification.permission==="granted"?"الإشعارات مفعّلة":Notification.permission==="denied"?"تم حظر الإشعارات من إعدادات المتصفح":"الإشعارات لم تُفعّل بعد";}
async function requestNotificationPermission(){if(!("Notification" in window)){toast("هذا المتصفح لا يدعم إشعارات الويب.");return;}try{const result=await Notification.requestPermission();updateNotificationStatus();toast(result==="granted"?"تم تفعيل إشعارات المتصفح.":result==="denied"?"تم رفض الإذن. يمكنك تغييره من إعدادات المتصفح.":"لم يتم منح إذن الإشعارات.");}catch(error){toast("تعذر طلب إذن الإشعارات من المتصفح.");}}
function advanceReminder(reminder){const d=reminderDateTime(reminder);if(reminder.repeat==="daily")d.setDate(d.getDate()+1);else if(reminder.repeat==="weekly")d.setDate(d.getDate()+7);else if(reminder.repeat==="monthly")d.setMonth(d.getMonth()+1);else return false;reminder.date=localDate(d);return true;}
function checkDueReminders(){const now=Date.now();let changed=false;data.reminders.forEach(r=>{if(!r.enabled)return;const due=reminderDateTime(r),key=due.toISOString();if(due.getTime()<=now&&r.lastNotifiedKey!==key){const message=r.description||"حان موعد التذكير.";toast("تذكير: "+r.title);if("Notification" in window&&Notification.permission==="granted"){try{new Notification("مهامي | MAHAMY",{body:r.title+" — "+message,tag:"mahamy-"+r.id,icon:"/favicon.ico"});}catch(error){console.warn("Notification failed",error);}}r.lastNotifiedKey=key;if(!advanceReminder(r))r.enabled=false;changed=true;}});if(changed){saveData();renderReminders();}}
function handleReminderActions(e){const toggle=e.target.closest("[data-reminder-toggle]"),edit=e.target.closest("[data-reminder-edit]"),del=e.target.closest("[data-reminder-delete]");if(toggle){const r=data.reminders.find(x=>x.id===toggle.dataset.reminderToggle);if(r){r.enabled=!r.enabled;saveData();renderReminders();toast(r.enabled?"تم تفعيل التذكير.":"تم إيقاف التذكير.");}}if(edit){const r=data.reminders.find(x=>x.id===edit.dataset.reminderEdit);if(r)openReminderForm(r);}if(del){const id=del.dataset.reminderDelete;if(confirm("هل تريد حذف هذا التذكير؟")){data.reminders=data.reminders.filter(r=>r.id!==id);saveData();renderReminders();toast("تم حذف التذكير.");}}}


const WEEKDAYS=["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
let scheduleWeekOffset=0;
function weekStart(offset=0){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay()+offset*7);return d;}
function dayKey(d){return localDate(d);}
function shiftDate(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function fillSubjectSelect(selected){const el=$("#lectureSubject");el.innerHTML=data.subjects.map(s=>'<option value="'+escapeHTML(s.id)+'">'+escapeHTML(s.name)+'</option>').join("");if(selected)el.value=selected;}
function openSubjectForm(subject){$("#subjectForm").reset();$("#subjectId").value="";$("#subjectModalTitle").textContent=subject?"تعديل المادة":"إضافة مادة";if(subject){$("#subjectId").value=subject.id;$("#subjectName").value=subject.name;$("#subjectTeacher").value=subject.teacher||"";$("#subjectColor").value=subject.color||"purple";$("#subjectNotes").value=subject.notes||"";}openModal("subjectModal");}
function subjectSubmit(e){e.preventDefault();const name=$("#subjectName").value.trim();if(!name){toast("اكتب اسم المادة.");return;}const id=$("#subjectId").value,old=data.subjects.find(s=>s.id===id);if(data.subjects.some(s=>s.name.toLocaleLowerCase("ar")===name.toLocaleLowerCase("ar")&&s.id!==id)){toast("هذه المادة موجودة بالفعل.");return;}const subject={id:id||uid(),name,teacher:$("#subjectTeacher").value.trim(),color:$("#subjectColor").value,notes:$("#subjectNotes").value.trim(),createdAt:old?old.createdAt:new Date().toISOString()};data.subjects=old?data.subjects.map(s=>s.id===id?subject:s):[...data.subjects,subject];if(saveData()){closeModal("subjectModal");renderSchedule();toast(old?"تم تحديث المادة.":"تمت إضافة المادة.");}}
function openLectureForm(lecture){if(!data.subjects.length){toast("أضف مادة دراسية أولاً.");openSubjectForm();return;}$("#lectureForm").reset();$("#lectureId").value="";$("#lectureModalTitle").textContent=lecture?"تعديل المحاضرة":"إضافة محاضرة";fillSubjectSelect(lecture?lecture.subjectId:data.subjects[0].id);if(lecture){$("#lectureId").value=lecture.id;$("#lectureTitle").value=lecture.title||"";$("#lectureDay").value=String(lecture.day);$("#lectureTime").value=lecture.time||"";$("#lecturePeriod").value=lecture.period||"";$("#lectureNotes").value=lecture.notes||"";}else{const d=weekStart(scheduleWeekOffset);$("#lectureDay").value=String((new Date()).getDay());}openModal("lectureModal");}
function lectureSubmit(e){e.preventDefault();const subjectId=$("#lectureSubject").value;if(!data.subjects.some(s=>s.id===subjectId)){toast("اختر مادة صحيحة.");return;}const id=$("#lectureId").value,old=data.lectures.find(l=>l.id===id);const lecture={id:id||uid(),subjectId,title:$("#lectureTitle").value.trim(),day:Number($("#lectureDay").value),time:$("#lectureTime").value,period:$("#lecturePeriod").value,notes:$("#lectureNotes").value.trim(),completedDates:old?(old.completedDates||[]):[]};data.lectures=old?data.lectures.map(l=>l.id===id?lecture:l):[...data.lectures,lecture];if(saveData()){closeModal("lectureModal");renderSchedule();toast(old?"تم تحديث المحاضرة.":"تمت إضافة المحاضرة الأسبوعية.");}}
function renderSubjects(){const el=$("#subjectsList");el.innerHTML=data.subjects.length?data.subjects.map(s=>'<article class="subject-card subject-'+escapeHTML(s.color||"purple")+'"><div class="subject-dot"></div><div class="subject-info"><strong>'+escapeHTML(s.name)+'</strong><small>'+escapeHTML(s.teacher||"لم يُحدد مدرس")+'</small></div><div class="subject-actions"><button data-subject-edit="'+escapeHTML(s.id)+'" aria-label="تعديل المادة">✎</button><button data-subject-delete="'+escapeHTML(s.id)+'" aria-label="حذف المادة">×</button></div></article>').join(""):'<div class="empty-inline">لم تضف مواداً بعد. ابدأ بإضافة أول مادة.</div>';}
function renderSchedule(){renderSubjects();const start=weekStart(scheduleWeekOffset),end=shiftDate(start,6);$("#scheduleWeekLabel").textContent="من "+formatDate(dayKey(start))+" إلى "+formatDate(dayKey(end));const days=[];for(let i=0;i<7;i++){const d=shiftDate(start,i),key=dayKey(d),lectures=data.lectures.filter(l=>Number(l.day)===d.getDay()).sort((a,b)=>(a.time||"99:99").localeCompare(b.time||"99:99"));const cards=lectures.map(l=>{const subject=data.subjects.find(s=>s.id===l.subjectId);if(!subject)return "";const done=(l.completedDates||[]).includes(key);return '<article class="lecture-card '+(done?'lecture-done':'')+'"><div class="lecture-color subject-'+escapeHTML(subject.color||"purple")+'"></div><div class="lecture-content"><strong>'+escapeHTML(l.title||subject.name)+'</strong><span>'+escapeHTML(subject.name)+(subject.teacher?' · '+escapeHTML(subject.teacher):"")+'</span><small>'+(l.time?escapeHTML(l.time):escapeHTML(l.period||"بدون وقت"))+'</small>'+(l.notes?'<p>'+escapeHTML(l.notes)+'</p>':'')+'</div><div class="lecture-actions"><button data-lecture-done="'+escapeHTML(l.id)+'" data-date="'+key+'" title="تحديد كمكتملة">'+(done?'↶':'✓')+'</button><button data-lecture-edit="'+escapeHTML(l.id)+'" title="تعديل">✎</button><button data-lecture-delete="'+escapeHTML(l.id)+'" title="حذف">×</button></div></article>';}).join("");days.push('<section class="weekday-column '+(d.getDay()===5?'friday-column':'')+'"><header><strong>'+WEEKDAYS[d.getDay()]+'</strong><span>'+new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short"}).format(d)+'</span></header>'+(cards||'<div class="day-empty">لا توجد محاضرات</div>')+'</section>');}$("#weeklySchedule").innerHTML=days.join("");loadFridayReview();}
function loadFridayReview(){const r=data.fridayReview||{};$("#fridayTopics").value=r.topics||"";$("#fridayStudy").checked=!!r.study;$("#fridayExercises").checked=!!r.exercises;$("#fridayHomework").checked=!!r.homework;$("#fridaySubjects").value=r.subjects||"";$("#fridayNotes").value=r.notes||"";}
function saveFridayReview(e){e.preventDefault();data.fridayReview={topics:$("#fridayTopics").value.trim(),study:$("#fridayStudy").checked,exercises:$("#fridayExercises").checked,homework:$("#fridayHomework").checked,subjects:$("#fridaySubjects").value.trim(),notes:$("#fridayNotes").value.trim(),updatedAt:new Date().toISOString()};if(saveData())toast("تم حفظ خطة مراجعة الجمعة.");}
function handleScheduleActions(e){const se=e.target.closest("[data-subject-edit]"),sd=e.target.closest("[data-subject-delete]"),le=e.target.closest("[data-lecture-edit]"),ld=e.target.closest("[data-lecture-delete]"),done=e.target.closest("[data-lecture-done]");if(se){const s=data.subjects.find(x=>x.id===se.dataset.subjectEdit);if(s)openSubjectForm(s);}if(sd){const id=sd.dataset.subjectDelete;if(confirm("حذف المادة؟ سيتم حذف محاضراتها أيضاً.")){data.subjects=data.subjects.filter(s=>s.id!==id);data.lectures=data.lectures.filter(l=>l.subjectId!==id);saveData();renderSchedule();toast("تم حذف المادة ومحاضراتها.");}}if(le){const l=data.lectures.find(x=>x.id===le.dataset.lectureEdit);if(l)openLectureForm(l);}if(ld){const id=ld.dataset.lectureDelete;if(confirm("حذف هذه المحاضرة من جدولك الأسبوعي؟")){data.lectures=data.lectures.filter(l=>l.id!==id);saveData();renderSchedule();toast("تم حذف المحاضرة.");}}if(done){const l=data.lectures.find(x=>x.id===done.dataset.lectureDone);if(l){const date=done.dataset.date;l.completedDates=l.completedDates||[];l.completedDates=l.completedDates.includes(date)?l.completedDates.filter(x=>x!==date):[...l.completedDates,date];saveData();renderSchedule();toast(l.completedDates.includes(date)?"تم تسجيل المحاضرة كمكتملة.":"تمت إعادة فتح المحاضرة.");}}}

function renderDashboard(){
 const today=localDate(),tasks=data.tasks,active=tasks.filter(t=>!t.completed),completed=tasks.filter(t=>t.completed),overdue=active.filter(t=>(t.dueDate||t.date)&&(t.dueDate||t.date)<today),todayTasks=tasks.filter(t=>!t.completed&&(t.date===today||t.dueDate===today));
 const dayAll=tasks.filter(t=>t.date===today||t.dueDate===today),done=dayAll.filter(t=>t.completed).length,pct=dayAll.length?Math.round(done/dayAll.length*100):0;
 $("#totalTasks").textContent=tasks.length;$("#completedTasks").textContent=completed.length;$("#remainingTasks").textContent=active.length;$("#overdueTasks").textContent=overdue.length;
 $("#progressPercent").textContent=pct+"%";$("#progressBar").style.width=pct+"%";$("#progressCount").textContent=done+" / "+dayAll.length;$("#progressText").textContent=dayAll.length?"أحسنت، واصل تقدمك":"لم تضف مهاماً لهذا اليوم بعد";
 const preview=todayTasks.slice(0,4);$("#todayPreview").innerHTML=preview.length?preview.map(t=>'<div class="preview-item"><span class="task-pill priority-'+escapeHTML(t.priority||"medium")+'">'+(PRIORITIES[t.priority]||"متوسطة")+'</span><b>'+escapeHTML(t.title)+'</b><small>'+(t.startTime?escapeHTML(t.startTime):"اليوم")+'</small></div>').join(""):'<div class="empty-inline">لا توجد مهام غير مكتملة لليوم. وقت مناسب للتخطيط!</div>';
}
function renderAll(){renderDashboard();renderTasks();renderNotes();}
function exportData(){const blob=new Blob([JSON.stringify({app:"MAHAMY",version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="MAHAMY-backup-"+localDate()+".json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("تم تجهيز النسخة الاحتياطية.");}
function bindEvents(){
 bindNavigation();bindModals();
 $("#addTaskBtn").addEventListener("click",()=>openTaskForm());
 $("#taskForm").addEventListener("submit",taskFormSubmit);
 $("#taskList").addEventListener("click",handleTaskAction);$("#taskList").addEventListener("change",handleTaskAction);
 $("#taskSearch").addEventListener("input",renderTasks);$("#taskSort").addEventListener("change",renderTasks);
 $("#taskFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;activeFilter=b.dataset.filter;renderTasks();});
 $("#categoryForm").addEventListener("submit",addCategory);$("#categoryList").addEventListener("click",handleCategoryAction);
 $("#addNoteBtn").addEventListener("click",()=>openNoteForm());$("#noteForm").addEventListener("submit",noteFormSubmit);
 $("#notesList").addEventListener("click",handleNoteAction);$("#noteSearch").addEventListener("input",renderNotes);
 $("#exportDataBtn").addEventListener("click",exportData);
 $("#addSubjectBtn").addEventListener("click",()=>openSubjectForm());$("#subjectForm").addEventListener("submit",subjectSubmit);$("#addLectureBtn").addEventListener("click",()=>openLectureForm());$("#lectureForm").addEventListener("submit",lectureSubmit);$("#subjectsList").addEventListener("click",handleScheduleActions);$("#weeklySchedule").addEventListener("click",handleScheduleActions);$("#fridayReviewForm").addEventListener("submit",saveFridayReview);$("#schedulePrevWeek").addEventListener("click",()=>{scheduleWeekOffset--;renderSchedule();});$("#scheduleNextWeek").addEventListener("click",()=>{scheduleWeekOffset++;renderSchedule();});$("#scheduleThisWeek").addEventListener("click",()=>{scheduleWeekOffset=0;renderSchedule();});
 $("#addReminderBtn").addEventListener("click",()=>openReminderForm());$("#reminderForm").addEventListener("submit",reminderFormSubmit);$("#remindersList").addEventListener("click",handleReminderActions);$("#enableNotificationsBtn").addEventListener("click",requestNotificationPermission);$("#reminderFilters").addEventListener("click",e=>{const b=e.target.closest("[data-reminder-filter]");if(!b)return;activeReminderFilter=b.dataset.reminderFilter;renderReminders();});
 window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY){loadData();renderAll();}});
}
function init(){
 loadData();cleanupCompleted();updateClock();setInterval(updateClock,1000);
 $("#dailyQuote").textContent=quotes[Math.floor(Math.random()*quotes.length)];
 bindEvents();renderAll();renderReminders();renderSchedule();checkDueReminders();setInterval(checkDueReminders,15000);
 setInterval(()=>{const before=data.tasks.length;cleanupCompleted();if(data.tasks.length!==before)renderAll();},60000);
}
document.addEventListener("DOMContentLoaded",init);
})();