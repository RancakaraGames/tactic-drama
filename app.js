const demoDramas=[
 {id:"demo-1",title:"Rahasia Hati",genre:"Romantis • Drama pilihan",description:"Sebuah pertemuan tak terduga mengubah segalanya.",colors:["#79324d","#242b50"],episodes:[]},
 {id:"demo-2",title:"Takdir Kedua",genre:"Drama • Drama pilihan",description:"Kesempatan kedua datang saat semua terasa terlambat.",colors:["#81522c","#342448"],episodes:[]},
 {id:"demo-3",title:"Janji Senja",genre:"Keluarga • Drama pilihan",description:"Janji lama yang kembali menguji sebuah keluarga.",colors:["#a64c3d","#30233b"],episodes:[]},
 {id:"demo-4",title:"Cinta Terlarang",genre:"Romantis • Drama pilihan",description:"Dua hati terjebak di antara cinta dan rahasia.",colors:["#61365f","#1d3450"],episodes:[]}
];
let dramas=[...demoDramas],activeDrama=null,activeEpisodeIndex=0,supa=null,activeTab="home";
let searchQuery="";
let favoriteIds=new Set();try{favoriteIds=new Set(JSON.parse(localStorage.getItem("tactic-favorites")||"[]"))}catch{}
const grid=document.querySelector("#dramaGrid"),player=document.querySelector("#playerDialog"),admin=document.querySelector("#adminDialog"),video=document.querySelector("#videoPlayer");
const $=s=>document.querySelector(s);
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){grid.innerHTML="";let visible=activeTab==="saved"?dramas.filter(d=>favoriteIds.has(d.id)):dramas;if(searchQuery)visible=visible.filter(d=>String(d.title||"").toLocaleLowerCase("id").includes(searchQuery));if(!visible.length){grid.innerHTML=`<p class="empty-state">${searchQuery?"Drama tidak ditemukan. Coba kata kunci lain.":activeTab==="saved"?"Belum ada drama favorit. Tekan ikon ♡ pada poster drama untuk menyimpannya.":"Belum ada drama. Drama yang diunggah admin akan muncul di sini."}</p>`;return}visible.forEach(d=>{const card=document.createElement("article");card.className="drama-card";card.innerHTML=`<div class="poster" role="button" tabindex="0" style="background:linear-gradient(145deg,${d.colors?.[0]||"#61365f"},${d.colors?.[1]||"#20243a"})"><span class="tag">DRAMA PENDEK</span><span class="poster-title">${escapeHtml(d.title)}</span><button class="favorite-btn ${favoriteIds.has(d.id)?"is-favorite":""}" type="button" aria-label="${favoriteIds.has(d.id)?"Hapus dari":"Tambah ke"} favorit">${favoriteIds.has(d.id)?"♥":"♡"}</button></div><div class="card-meta"><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.genre||((d.episodes||[]).length+" episode"))}</span></div>`;const poster=card.querySelector(".poster");poster.addEventListener("click",()=>openDrama(d));poster.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openDrama(d)}});if(d.poster_url){const art=document.createElement("img");art.className="poster-art";art.src=d.poster_url;art.alt="Poster "+d.title;art.loading="lazy";poster.prepend(art)}card.querySelector(".favorite-btn").addEventListener("click",e=>{e.stopPropagation();if(favoriteIds.has(d.id))favoriteIds.delete(d.id);else favoriteIds.add(d.id);localStorage.setItem("tactic-favorites",JSON.stringify([...favoriteIds]));render()});grid.append(card)})}
function getVideoUrl(path){return supa.storage.from("drama-videos").getPublicUrl(path).data.publicUrl}
function playEpisode(index,autoplay=true){const eps=activeDrama?.episodes||[];if(index<0||index>=eps.length)return;activeEpisodeIndex=index;const ep=eps[index],list=$("#episodeList");list.querySelectorAll("button").forEach((b,i)=>{b.classList.toggle("active",i===index)});const prev=$("#prevEpisode"),next=$("#nextEpisode");if(prev)prev.disabled=index===0;if(next){next.disabled=index===eps.length-1;next.textContent=index===eps.length-1?"Episode terakhir":"Episode berikutnya →"}$("#playerDescription").textContent="Episode "+ep.episode_number+(ep.title?" — "+ep.title:"")+" · "+(index<eps.length-1?"Lanjut otomatis ke episode berikutnya":"Ini episode terbaru");video.src=getVideoUrl(ep.video_path);video.load();if(autoplay)video.play().catch(()=>{});}
function openDrama(d){activeDrama=d;activeEpisodeIndex=0;$("#playerSeries").textContent=d.genre||"TAC TIC DRAMA";$("#playerTitle").textContent=d.title;$("#playerDescription").textContent=d.description||"Nikmati episode drama ini.";const list=$("#episodeList");list.innerHTML="";const eps=[...(d.episodes||[])].sort((a,b)=>a.episode_number-b.episode_number);d.episodes=eps;if(!eps.length){list.textContent="Episode belum tersedia.";video.pause();video.removeAttribute("src")}eps.forEach((ep,i)=>{const b=document.createElement("button");b.textContent="Episode "+ep.episode_number+(ep.title?" · "+ep.title:"");b.addEventListener("click",()=>playEpisode(i));list.append(b)});if(eps.length)playEpisode(0,false);loadComments(d.id);player.showModal()}
async function loadCatalog(){if(!supa)return;try{const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,episodes(id,episode_number,title,video_path,status)").eq("status","approved").eq("episodes.status","approved").order("created_at",{ascending:false});if(error)throw error;if(data){dramas=data.map(d=>({...d,genre:(d.episodes||[]).length+" episode",colors:["#71324e","#252344"]}));render()}}catch(e){console.warn("Catalog online belum dapat dimuat:",e.message)}}
function setStatus(id,msg){$(id).textContent=msg}
async function loadComments(dramaId){
 const list=$("#commentList");list.innerHTML="";
 if(!supa||String(dramaId).startsWith("demo-")){setStatus("#commentStatus","Komentar online aktif setelah Supabase tersambung.");return}
 setStatus("#commentStatus","Memuat komentar...");
 const result=await supa.from("comments").select("id,display_name,body,created_at").eq("drama_id",dramaId).order("created_at",{ascending:false}).limit(50);
 if(result.error){setStatus("#commentStatus","Komentar belum bisa dimuat. Jalankan pembaruan schema Supabase.");return}
 if(!result.data.length){setStatus("#commentStatus","Belum ada komentar. Jadilah yang pertama!");return}
 setStatus("#commentStatus",result.data.length+" komentar terbaru");
 result.data.forEach(item=>{const el=document.createElement("article");el.className="comment-item";const who=document.createElement("strong");who.textContent=item.display_name;const body=document.createElement("p");body.textContent=item.body;const time=document.createElement("small");time.textContent=new Date(item.created_at).toLocaleString("id-ID");el.append(who,body,time);list.append(el)})
}
$("#commentForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa||!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#commentStatus","Komentar belum aktif. Sambungkan Supabase dan gunakan drama dari katalog online.");return}
 const form=e.currentTarget,fd=new FormData(form),display_name=String(fd.get("displayName")||"").trim(),body=String(fd.get("body")||"").trim(),btn=form.querySelector("button[type=submit]");
 if(!display_name||!body){setStatus("#commentStatus","Isi nama dan komentar terlebih dahulu.");return}
 btn.disabled=true;setStatus("#commentStatus","Mengirim komentar...");
 try{const result=await supa.from("comments").insert({drama_id:activeDrama.id,display_name,body});if(result.error)throw result.error;form.elements.displayName.value=display_name;form.elements.body.value="";await loadComments(activeDrama.id)}
 catch(err){setStatus("#commentStatus","Gagal mengirim komentar: "+err.message)}
 finally{btn.disabled=false}
});

$("#reportDrama").addEventListener("click",async()=>{if(!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#reportStatus","Laporan tersedia untuk drama dari katalog online.");return}if(!supa){setStatus("#reportStatus","Backend belum tersambung.");return}const {data}=await supa.auth.getSession();if(!data.session){setStatus("#reportStatus","Masuk atau daftar akun untuk melaporkan video.");admin.showModal();return}const reason=window.prompt("Apa alasan laporan? Contoh: hak cipta, kekerasan, spam, atau konten tidak pantas.");if(!reason)return;if(reason.trim().length<3){setStatus("#reportStatus","Alasan laporan minimal 3 karakter.");return}const details=window.prompt("Keterangan tambahan (opsional):")||"";const {error}=await supa.from("video_reports").insert({drama_id:activeDrama.id,reporter_id:data.session.user.id,reason:reason.trim().slice(0,80),details:details.trim().slice(0,1000)});if(error){setStatus("#reportStatus","Gagal mengirim laporan: "+error.message);return}setStatus("#reportStatus","Terima kasih. Laporan sudah dikirim ke tim admin.")});
video.addEventListener("ended",()=>{if(activeDrama&&activeEpisodeIndex<(activeDrama.episodes||[]).length-1)playEpisode(activeEpisodeIndex+1);else setStatus("#playerDescription","Kamu sudah menyelesaikan episode terbaru. Pilih drama lain atau tonton ulang episode ini.");});
$("#prevEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex-1));
$("#nextEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex+1));
let swipeStartY=null;video.addEventListener("touchstart",e=>{swipeStartY=e.changedTouches[0].clientY},{passive:true});video.addEventListener("touchend",e=>{if(swipeStartY===null)return;const delta=swipeStartY-e.changedTouches[0].clientY;swipeStartY=null;if(Math.abs(delta)>55)playEpisode(activeEpisodeIndex+(delta>0?1:-1))},{passive:true});
player.addEventListener("keydown",e=>{if(e.key==="ArrowUp"){e.preventDefault();playEpisode(activeEpisodeIndex+1)}else if(e.key==="ArrowDown"){e.preventDefault();playEpisode(activeEpisodeIndex-1)}});
async function verifySession(session){$("#uploadSection").hidden=true;$("#loginForm").hidden=false;$("#signupForm").hidden=false;$("#moderationSection").hidden=true;if(!session||!supa)return;const {data,error}=await supa.from("user_roles").select("role").eq("user_id",session.user.id).maybeSingle();if(error){setStatus("#loginStatus","Gagal memeriksa akun: "+error.message);return}const isAdmin=data?.role==="admin";$("#uploadSection").hidden=false;$("#loginForm").hidden=true;$("#signupForm").hidden=true;$("#adminIdentity").textContent=(isAdmin?"Admin masuk sebagai ":"Masuk sebagai ")+session.user.email;setStatus("#loginStatus",isAdmin?"Login admin berhasil.":"Login berhasil. Kamu bisa langsung mengunggah dan menerbitkan drama.");loadMyDramas(session.user.id);if(isAdmin){$("#moderationSection").hidden=false;loadModeration()}}
async function editCreatorDrama(drama,userId){const title=window.prompt("Ubah judul drama:",drama.title);if(title===null)return;if(!title.trim()){setStatus("#loginStatus","Judul drama tidak boleh kosong.");return}const description=window.prompt("Ubah deskripsi drama:",drama.description||"");if(description===null)return;const {data,error}=await supa.from("dramas").update({title:title.trim().slice(0,120),description:description.trim().slice(0,2000)}).eq("id",drama.id).eq("uploader_id",userId).select("id").maybeSingle();if(error){setStatus("#loginStatus","Gagal mengubah drama: "+error.message);return}if(!data){setStatus("#loginStatus","Drama tidak berubah. Pastikan akun memiliki akses edit.");return}setStatus("#loginStatus","Judul dan deskripsi drama berhasil diperbarui.");await loadMyDramas(userId);await loadCatalog()}
$("#openAdmin").addEventListener("click",()=>admin.showModal());
async function loadMyDramas(userId){const list=$("#myDramaList"),count=$("#creatorCount"),target=$("#targetDrama");if(!list||!supa)return;list.textContent="Memuat drama...";const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,status,created_at,episodes(id,episode_number,title,video_path,status)").eq("uploader_id",userId).order("created_at",{ascending:false});if(error){list.textContent="Daftar drama belum dapat dimuat: "+error.message;count.textContent="—";return}count.textContent=(data?.length||0)+" drama";if(target){const selected=target.value;target.innerHTML='<option value="">Buat drama baru</option>';(data||[]).filter(d=>d.status==="approved").forEach(d=>{const o=document.createElement("option");o.value=d.id;o.textContent=d.title;target.append(o)});target.value=selected}list.innerHTML="";if(!data?.length){list.innerHTML='<p class="notice">Kamu belum mengunggah drama. Gunakan formulir unggah di bawah untuk mulai menerbitkan.</p>';return}for(const d of data){const card=document.createElement("article");card.className="creator-item";const info=document.createElement("div");info.className="creator-item-info";const title=document.createElement("strong");title.textContent=d.title;const meta=document.createElement("span");const eps=d.episodes||[];meta.textContent=eps.length+" episode · "+(d.status==="approved"?"Tayang":d.status==="rejected"?"Disembunyikan":"Status: "+d.status);const date=document.createElement("small");date.textContent=d.created_at?new Date(d.created_at).toLocaleDateString("id-ID"):"";info.append(title,meta,date);card.append(info);const edit=document.createElement("button");edit.className="secondary-btn";edit.type="button";edit.textContent="Edit";edit.addEventListener("click",()=>editCreatorDrama(d,userId));card.append(edit);if(d.status==="approved"&&eps.some(ep=>ep.status==="approved")){const open=document.createElement("button");open.className="secondary-btn";open.type="button";open.textContent="Lihat";open.addEventListener("click",()=>{const published={...d,episodes:eps.filter(ep=>ep.status==="approved"),genre:eps.length+" episode"};admin.close();openDrama(published)});card.append(open)}list.append(card)}}
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.close).close()));
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const f=new FormData(e.currentTarget);setStatus("#loginStatus","Memeriksa akun...");const {data,error}=await supa.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){setStatus("#loginStatus","Login gagal: "+error.message);return}await verifySession(data.session)});
$("#signupForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const f=new FormData(e.currentTarget);setStatus("#loginStatus","Mendaftarkan akun...");const {data,error}=await supa.auth.signUp({email:f.get("email"),password:f.get("password"),options:{emailRedirectTo:location.origin+location.pathname}});if(error){setStatus("#loginStatus","Pendaftaran gagal: "+error.message);return}if(data.session){await verifySession(data.session)}else{setStatus("#loginStatus","Pendaftaran berhasil. Buka email untuk konfirmasi akun, lalu masuk di sini.")}});
$("#logoutBtn").addEventListener("click",async()=>{if(supa)await supa.auth.signOut();$("#uploadSection").hidden=true;$("#loginForm").hidden=false;$("#signupForm").hidden=false;setStatus("#loginStatus","Kamu sudah keluar.")});
async function loadModeration(){const list=$("#moderationList");if(!list||!supa)return;list.textContent="Memuat laporan...";const {data,error}=await supa.from("video_reports").select("id,drama_id,reason,details,status,created_at").eq("status","open").order("created_at",{ascending:false}).limit(50);if(error){list.textContent="Gagal memuat laporan: "+error.message;return}list.innerHTML="";if(!data?.length){list.textContent="Belum ada laporan video.";return}for(const report of data){const card=document.createElement("article");card.className="comment-item";const title=document.createElement("strong");title.textContent="Alasan: "+report.reason;const detail=document.createElement("p");detail.textContent=report.details||"Tidak ada keterangan tambahan.";const date=document.createElement("small");date.textContent=new Date(report.created_at).toLocaleString("id-ID");const review=document.createElement("button");review.className="secondary-btn";review.textContent="Tandai ditinjau";review.addEventListener("click",()=>updateReport(report.id,"reviewed"));const hide=document.createElement("button");hide.className="primary-btn";hide.textContent="Sembunyikan drama";hide.addEventListener("click",()=>hideReportedDrama(report.id,report.drama_id));card.append(title,detail,date,review,hide);list.append(card)}}
async function updateReport(id,status){const {error}=await supa.from("video_reports").update({status}).eq("id",id);if(error){setStatus("#loginStatus","Gagal memperbarui laporan: "+error.message);return}await loadModeration()}
async function hideReportedDrama(reportId,dramaId){const ep=await supa.from("episodes").update({status:"rejected"}).eq("drama_id",dramaId);if(ep.error){setStatus("#loginStatus","Gagal menyembunyikan episode: "+ep.error.message);return}const d=await supa.from("dramas").update({status:"rejected"}).eq("id",dramaId);if(d.error){setStatus("#loginStatus","Gagal menyembunyikan drama: "+d.error.message);return}const r=await supa.from("video_reports").update({status:"actioned"}).eq("id",reportId);if(r.error){setStatus("#loginStatus","Drama disembunyikan, tetapi status laporan gagal diperbarui: "+r.error.message);return}setStatus("#loginStatus","Drama dan episode sudah disembunyikan dari katalog.");await loadModeration();await loadCatalog()}
async function moderateDrama(id,status){const ep=await supa.from("episodes").update({status}).eq("drama_id",id);if(ep.error){setStatus("#loginStatus","Gagal memperbarui episode: "+ep.error.message);return}const result=await supa.from("dramas").update({status}).eq("id",id);if(result.error){setStatus("#loginStatus","Gagal memperbarui drama: "+result.error.message);return}setStatus("#loginStatus",status==="approved"?"Drama disetujui dan tampil untuk semua penonton.":"Kiriman ditolak.");await loadModeration();await loadCatalog()}
function loadTusLibrary(){
 if(window.tus?.Upload)return Promise.resolve(window.tus);
 return new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-tus-client="true"]');
  if(existing){existing.addEventListener("load",()=>resolve(window.tus),{once:true});existing.addEventListener("error",()=>reject(new Error("Library upload resumable gagal dimuat.")),{once:true});return}
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js";script.async=true;script.dataset.tusClient="true";
  script.onload=()=>window.tus?.Upload?resolve(window.tus):reject(new Error("Library upload tidak tersedia."));
  script.onerror=()=>reject(new Error("Tidak bisa memuat fitur upload resumable. Periksa koneksi internet."));
  document.head.append(script);
 });
}
function uploadVideoResumable(file,path,session,onProgress){
 return loadTusLibrary().then(tus=>new Promise((resolve,reject)=>{
  const projectRef=(cfg.url||"").replace(/^https:\/\//,"").split(".")[0];
  const upload=new tus.Upload(file,{
   endpoint:"https://"+projectRef+".storage.supabase.co/storage/v1/upload/resumable",
   retryDelays:[0,3000,5000,10000,20000],
   headers:{authorization:"Bearer "+session.access_token},
   metadata:{bucketName:"drama-videos",objectName:path,contentType:file.type||"application/octet-stream",cacheControl:"3600"},
   chunkSize:6*1024*1024,
   uploadDataDuringCreation:true,
   removeFingerprintOnSuccess:true,
   onError:error=>reject(error),
   onProgress:(sent,total)=>onProgress(Math.round(sent/total*100)),
   onSuccess:()=>resolve()
  });
  // Unique object paths must never resume another upload with the same filename.
  upload.start();
 }));
}
$("#uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa){setStatus("#uploadStatus","Backend belum dikonfigurasi.");return}
 const {data:sessionData}=await supa.auth.getSession(),session=sessionData.session,user=session?.user;
 if(!user){setStatus("#uploadStatus","Masuk ke akun terlebih dahulu.");return}
 const f=e.currentTarget,data=new FormData(f),file=data.get("video"),targetDrama=String(data.get("targetDrama")||""),posterFile=targetDrama?null:data.get("poster"),title=String(data.get("title")||"").trim(),episode=Number(data.get("episode"));
 if(!targetDrama&&!title){setStatus("#uploadStatus","Isi judul drama terlebih dahulu.");return}
 if(!Number.isInteger(episode)||episode<1){setStatus("#uploadStatus","Nomor episode harus bilangan positif.");return}
 if(posterFile&&posterFile.size>10*1024*1024){setStatus("#uploadStatus","Ukuran poster maksimal 10 MB.");return}
 if(posterFile&&!["image/jpeg","image/png","image/webp"].includes(posterFile.type)){setStatus("#uploadStatus","Poster harus JPG, PNG, atau WebP.");return}
 if(!file||!["video/mp4","video/webm","video/quicktime"].includes(file.type)){setStatus("#uploadStatus","Pilih video MP4, WebM, atau MOV.");return}
 if(file.size>500*1024*1024){setStatus("#uploadStatus","Ukuran video maksimal 500 MB.");return}
 const btn=f.querySelector('button[type="submit"]');btn.disabled=true;
 let dramaId=targetDrama||null,createdDrama=false,videoPath=null,posterPath=null;
 setStatus("#uploadStatus","Menyiapkan unggahan video...");
 try{
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  videoPath=user.id+"/"+crypto.randomUUID()+"-"+safeName;
  if(posterFile&&posterFile.size){
   posterPath=user.id+"/"+crypto.randomUUID()+"-"+posterFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const posterUpload=await supa.storage.from("drama-posters").upload(posterPath,posterFile,{contentType:posterFile.type,upsert:false});
   if(posterUpload.error)throw posterUpload.error;
  }
  await uploadVideoResumable(file,videoPath,session,pct=>setStatus("#uploadStatus","Mengunggah video... "+pct+"% (jangan tutup halaman)."));
  setStatus("#uploadStatus","Video selesai diunggah. Menyimpan episode...");
  if(!dramaId){const created=await supa.from("dramas").insert({title,description:String(data.get("description")||""),poster_url:posterPath?supa.storage.from("drama-posters").getPublicUrl(posterPath).data.publicUrl:null,uploader_id:user.id,status:"approved"}).select("id").single();if(created.error)throw created.error;dramaId=created.data.id;createdDrama=true;}else{const exists=await supa.from("dramas").select("id").eq("id",dramaId).eq("uploader_id",user.id).eq("status","approved").maybeSingle();if(exists.error)throw exists.error;if(!exists.data)throw new Error("Drama tujuan tidak ditemukan atau bukan milik akun ini.");const duplicate=await supa.from("episodes").select("id").eq("drama_id",dramaId).eq("episode_number",episode).maybeSingle();if(duplicate.error)throw duplicate.error;if(duplicate.data)throw new Error("Nomor episode tersebut sudah ada di drama ini.");}
  const saved=await supa.from("episodes").insert({drama_id:dramaId,episode_number:episode,title:String(data.get("episodeTitle")||""),video_path:videoPath,uploader_id:user.id,status:"approved"});
  if(saved.error)throw saved.error;
  setStatus("#uploadStatus",createdDrama?"Berhasil! Drama baru dan episode sudah langsung diterbitkan.":"Berhasil! Episode baru sudah ditambahkan ke drama pilihan.");
  f.reset();syncTargetForm();await loadCatalog();await loadMyDramas(user.id);
 }catch(err){
  if(dramaId&&createdDrama){
   const rollback=await supa.from("dramas").delete().eq("id",dramaId).eq("uploader_id",user.id);
   if(rollback.error)console.warn("Pembersihan data drama gagal:",rollback.error.message);
  }
  const cleanup=[];
  if(videoPath)cleanup.push(supa.storage.from("drama-videos").remove([videoPath]));
  if(posterPath)cleanup.push(supa.storage.from("drama-posters").remove([posterPath]));
  const cleanupResults=await Promise.allSettled(cleanup);
  cleanupResults.forEach(result=>{if(result.status==="rejected")console.warn("Pembersihan file unggahan gagal:",result.reason)});
  setStatus("#uploadStatus","Gagal menerbitkan drama: "+(err?.message||String(err))+". File sementara yang sudah terkirim akan dibersihkan jika izin penyimpanan mengizinkan. Periksa koneksi lalu coba lagi.");
 }finally{btn.disabled=false}
});
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeTab=b.dataset.tab;if(activeTab==="profile"){admin.showModal();return}render()}));
$("#shareDrama").addEventListener("click",async()=>{if(!activeDrama)return;const shareData={title:activeDrama.title,text:"Tonton "+activeDrama.title+" di TacTic Drama",url:location.href};try{if(navigator.share)await navigator.share(shareData);else if(navigator.clipboard){await navigator.clipboard.writeText(shareData.text+" — "+shareData.url);setStatus("#shareStatus","Link berhasil disalin.")}else setStatus("#shareStatus","Bagikan: "+shareData.url)}catch(e){if(e.name!=="AbortError")setStatus("#shareStatus","Belum bisa membagikan link dari perangkat ini.")}});
const targetSelect=$("#targetDrama");function syncTargetForm(){const existing=Boolean(targetSelect?.value);$("#posterField").hidden=existing;$("#uploadForm [name=title]").disabled=existing;$("#uploadForm [name=description]").disabled=existing}targetSelect?.addEventListener("change",syncTargetForm);syncTargetForm();
 const searchBox=$("#dramaSearch");searchBox.addEventListener("input",()=>{searchQuery=searchBox.value.trim().toLocaleLowerCase("id");render()});
render();
const cfg=window.TACTIC_SUPABASE_CONFIG||{};
if(window.supabase?.createClient&&cfg.url?.startsWith("https://")&&!cfg.url.includes("YOUR-PROJECT")&&cfg.anonKey&&!cfg.anonKey.includes("YOUR-SUPABASE")){supa=window.supabase.createClient(cfg.url,cfg.anonKey);$("#backendNotice").textContent="Daftar akun untuk mengirim video. Email perlu dikonfirmasi sebelum login jika verifikasi email aktif.";loadCatalog();supa.auth.getSession().then(({data})=>verifySession(data.session));supa.auth.onAuthStateChange((_event,session)=>{verifySession(session)})}else{$("#backendNotice").textContent="Koneksi backend belum diisi. Website dan katalog contoh tetap bisa dibuka; upload online aktif setelah konfigurasi Supabase."}
let installPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;const btn=$("#installBtn");btn.hidden=false;btn.addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;btn.hidden=true},{once:true})});
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
