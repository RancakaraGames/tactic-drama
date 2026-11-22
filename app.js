const DEMO_VIDEO_URL="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const makeDemoDrama=(id,title,genre,colors)=>({
 id,title,genre:"DEMO • "+genre,
 description:"Konten sementara untuk menguji tampilan pemutar TacTic Drama. Video contoh CC0 dari MDN, bukan episode drama asli.",
 colors,episodes:[1,2,3].map(number=>({id:id+"-ep-"+number,episode_number:number,title:"Video uji "+number+" (30 detik)",video_path:DEMO_VIDEO_URL}))
});
const demoDramas=[
 makeDemoDrama("demo-cn","Demo Drama China","CHINA",["#79324d","#242b50"]),
 makeDemoDrama("demo-kr","Demo Drama Korea","KOREA",["#81522c","#342448"])
];
let dramas=[...demoDramas],activeDrama=null,activeEpisodeIndex=0,supa=null,activeTab="clips",collectionView="saved",collectionHistoryFilter="all",sharedDramaOpened=false,profileCollectionView="history",profileHistoryFilter="all",profileLikesLoadedFor=null,profileLikedIds=new Set();
let clipsObserver=null;
let autoNextEnabled=true;try{autoNextEnabled=localStorage.getItem("tactic-auto-next")!=="false"}catch{}
let searchQuery="";
let favoriteIds=new Set();try{favoriteIds=new Set(JSON.parse(localStorage.getItem("tactic-favorites")||"[]"))}catch{}
let favoriteCounts=new Map(),favoritesLoadedFor=null;
let demoLikedIds=new Set();try{demoLikedIds=new Set(JSON.parse(localStorage.getItem("tactic-demo-likes")||"[]"))}catch{}
let watchHistory={};try{watchHistory=JSON.parse(localStorage.getItem("tactic-watch-history")||"{}")||{}}catch{}
let lastHistoryPersist=0;
let episodeProgress={};try{episodeProgress=JSON.parse(localStorage.getItem("tactic-episode-progress")||"{}")||{}}catch{}
let lastEpisodeProgressPersist=0;
let activePlaybackUserId=null;
let commentLoadToken=0;
const isCloudUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));
function syncWatchHistoryRow(dramaId){
 const entry=watchHistory[dramaId];if(!supa||!activePlaybackUserId||!entry||!isCloudUuid(dramaId))return;
 const drama=dramas.find(item=>String(item.id)===String(dramaId)),episode=drama?.episodes?.find(item=>Number(item.episode_number)===Number(entry.episode_number));
 const row={user_id:activePlaybackUserId,drama_id:dramaId,episode_id:isCloudUuid(episode?.id)?episode.id:null,episode_number:Number(entry.episode_number)||1,episode_title:String(entry.episode_title||""),position_seconds:Math.max(0,Math.floor(Number(entry.position_seconds)||0)),watched_at:entry.watched_at||new Date().toISOString(),updated_at:entry.updated_at||entry.watched_at||new Date().toISOString()};
 supa.from("watch_history").upsert(row,{onConflict:"user_id,drama_id"}).then(({error})=>{if(error)console.warn("Riwayat cloud belum tersimpan:",error.message)});
}
function syncEpisodeProgressRow(key,entry){
 if(!supa||!activePlaybackUserId)return;
 const [dramaId,episodeId]=String(key).split(":");if(!isCloudUuid(dramaId)||!isCloudUuid(episodeId))return;
 const row={user_id:activePlaybackUserId,drama_id:dramaId,episode_id:episodeId,seconds:Math.max(0,Math.floor(Number(entry.seconds)||0)),duration:Math.max(0,Math.floor(Number(entry.duration)||0)),percent:Math.max(0,Math.min(100,Math.floor(Number(entry.percent)||0))),updated_at:entry.updated_at||new Date().toISOString()};
 supa.from("episode_progress").upsert(row,{onConflict:"user_id,episode_id"}).then(({error})=>{if(error)console.warn("Progres cloud belum tersimpan:",error.message)});
}
async function loadCloudPlayback(userId){
 if(!supa||!userId)return;
 try{
  const [historyResult,progressResult]=await Promise.all([
   supa.from("watch_history").select("drama_id,episode_id,episode_number,episode_title,position_seconds,watched_at,updated_at").eq("user_id",userId),
   supa.from("episode_progress").select("drama_id,episode_id,seconds,duration,percent,updated_at").eq("user_id",userId)
  ]);
  if(historyResult.error)throw historyResult.error;if(progressResult.error)throw progressResult.error;
  (historyResult.data||[]).forEach(row=>{
   const current=watchHistory[row.drama_id],remoteTime=Date.parse(row.updated_at||row.watched_at||0),localTime=Date.parse(current?.updated_at||current?.watched_at||0);
   if(!current||remoteTime>localTime)watchHistory[row.drama_id]={episode_number:row.episode_number,episode_title:row.episode_title||"",position_seconds:row.position_seconds||0,watched_at:row.watched_at,updated_at:row.updated_at};
  });
  (progressResult.data||[]).forEach(row=>{
   const key=String(row.drama_id)+":"+String(row.episode_id),current=episodeProgress[key],remoteTime=Date.parse(row.updated_at||0),localTime=Date.parse(current?.updated_at||0);
   if(!current||remoteTime>localTime)episodeProgress[key]={seconds:row.seconds,duration:row.duration,percent:row.percent,updated_at:row.updated_at};
  });
  try{localStorage.setItem("tactic-watch-history",JSON.stringify(watchHistory));localStorage.setItem("tactic-episode-progress",JSON.stringify(episodeProgress))}catch{}
  Object.keys(watchHistory).forEach(id=>syncWatchHistoryRow(id));
  Object.entries(episodeProgress).forEach(([key,value])=>syncEpisodeProgressRow(key,value));
  render();
 }catch(error){console.warn("Sinkronisasi riwayat cloud gagal:",error?.message||error)}
}
const grid=document.querySelector("#dramaGrid"),player=document.querySelector("#playerDialog"),admin=document.querySelector("#adminDialog"),video=document.querySelector("#videoPlayer");
const $=s=>document.querySelector(s);
const guestPrompt=$("#guestPromptDialog");
function showGuestPrompt(){if(!guestPrompt?.open)guestPrompt?.showModal()}
function hideGuestPrompt(){if(guestPrompt?.open)guestPrompt.close()}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatPlaybackTime(seconds=0){const n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),sec=n%60;return h?[h,m,sec].map(v=>String(v).padStart(2,"0")).join(":"):[m,sec].map(v=>String(v).padStart(2,"0")).join(":")}
function renderFeaturedHero(){const hero=$(".hero"),art=$("#heroArtwork"),button=$("#featuredPlay");if(!hero||!art||!button)return;const featured=dramas.find(d=>!String(d.id).startsWith("demo-")&&(d.episodes||[]).length);if(!featured){art.hidden=true;art.removeAttribute("src");button.hidden=true;return}let poster="";try{const url=new URL(String(featured.poster_url||""),location.href);if(url.protocol==="https:")poster=url.href}catch{}if(poster){art.src=poster;art.hidden=false}else{art.hidden=true;art.removeAttribute("src")}const title=hero.querySelector("h1"),copy=hero.querySelector(".hero-copy");if(title)title.innerHTML=escapeHtml(featured.title)+"<br><span>Drama pilihan hari ini.</span>";if(copy)copy.textContent=featured.description||"Mulai cerita pilihanmu sekarang.";button.hidden=false;button.onclick=()=>openDrama(featured)}
function pauseClipsFeed(){document.querySelectorAll(".clips-feed video").forEach(v=>v.pause())}
function resumeClipsFeed(){
 if(activeTab!=="clips"||player?.open)return;
 const videos=[...document.querySelectorAll(".clips-feed video")];
 videos.forEach(v=>{
  const r=v.getBoundingClientRect(),visible=r.bottom>0&&r.top<window.innerHeight&&r.height>0;
  if(visible){v.play().catch(()=>{})}else v.pause();
 });
}
function renderClips(items){
 if(clipsObserver){clipsObserver.disconnect();clipsObserver=null}
 const feed=document.createElement("div");feed.className="clips-feed";feed.setAttribute("aria-label","Cuplikan drama vertikal");
 items.forEach(d=>{
  const eps=[...(d.episodes||[])].sort((a,b)=>Number(a.episode_number)-Number(b.episode_number));
  const first=eps[0];if(!first)return;
  const card=document.createElement("article");card.className="clips-card";
  const videoEl=document.createElement("video");videoEl.className="clips-video";videoEl.muted=true;videoEl.playsInline=true;videoEl.setAttribute("playsinline","");videoEl.setAttribute("muted","");videoEl.preload="metadata";
  if(d.poster_url){videoEl.poster=d.poster_url}
  const videoPath=String(first.video_path||"");
  if(videoPath){videoEl.src=getVideoUrl(videoPath)}
  videoEl.addEventListener("timeupdate",()=>{if(videoEl.currentTime>=25){videoEl.currentTime=0;videoEl.play().catch(()=>{})}});
  videoEl.addEventListener("ended",()=>{videoEl.currentTime=0;videoEl.play().catch(()=>{})});
  const shade=document.createElement("div");shade.className="clips-shade";
  const details=document.createElement("div");details.className="clips-details";
  const eyebrow=document.createElement("span");eyebrow.className="clips-label";eyebrow.textContent=String(d.id).startsWith("demo-")?"DEMO • VIDEO UJI":"CUPLIKAN DRAMA";
  const title=document.createElement("h2");title.textContent=d.title||"Drama";
  const description=document.createElement("p");description.textContent=d.description||"Tonton kisah lengkapnya di TacTic Drama.";
  const meta=document.createElement("small");meta.textContent=eps.length+" episode · Mulai dari episode 1";
  const actions=document.createElement("div");actions.className="clips-actions";
  const watch=document.createElement("button");watch.type="button";watch.className="clips-watch";watch.textContent="▶  Tonton Full";
  watch.addEventListener("click",()=>openDrama(d,true));
  const fav=document.createElement("button");fav.type="button";fav.className="clips-icon-btn";fav.setAttribute("aria-label",favoriteIds.has(d.id)?"Hapus dari favorit":"Tambah ke favorit");fav.innerHTML=favoriteIds.has(d.id)?"♥":"♡";fav.classList.toggle("is-favorite",favoriteIds.has(d.id));
  fav.addEventListener("click",async()=>{await toggleDramaFavorite(d);const saved=favoriteIds.has(String(d.id));fav.innerHTML=saved?"♥":"♡";fav.classList.toggle("is-favorite",saved);fav.setAttribute("aria-label",saved?"Hapus dari favorit":"Tambah ke favorit")});
  const share=document.createElement("button");share.type="button";share.className="clips-icon-btn";share.setAttribute("aria-label","Bagikan drama");share.textContent="↗";
  share.addEventListener("click",async()=>{const shareData={title:d.title||"TacTic Drama",text:"Tonton "+(d.title||"drama ini")+" di TacTic Drama",url:location.href};try{if(navigator.share)await navigator.share(shareData);else if(navigator.clipboard)await navigator.clipboard.writeText(shareData.text+" "+shareData.url)}catch(err){if(err?.name!=="AbortError")console.warn("Bagikan drama gagal:",err)}});
  actions.append(watch,fav,share);details.append(eyebrow,title,description,meta,actions);card.append(videoEl,shade,details);feed.append(card);
 });
 grid.replaceChildren(feed);
 if("IntersectionObserver"in window){
  clipsObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{const v=entry.target;if(entry.isIntersecting&&entry.intersectionRatio>=.6){if(!player?.open)v.play().catch(()=>{})}else v.pause()}),{root:feed,threshold:[0,.6,1]});
  feed.querySelectorAll("video").forEach(v=>clipsObserver.observe(v));
 }else resumeClipsFeed();
}
function profileDateLabel(value){
 const date=new Date(value||0);if(!Number.isFinite(date.getTime()))return "Riwayat";
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),day=new Date(date.getFullYear(),date.getMonth(),date.getDate());
 const diff=Math.round((today-day)/86400000);return diff<=0?"Hari ini":diff===1?"Kemarin":date.toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
}
async function renderProfileCollections(){
 const list=$("#profileDramaList");if(!list)return;
 const view=profileCollectionView,filter=profileHistoryFilter;
 document.querySelectorAll("[data-profile-view]").forEach(btn=>{const active=btn.dataset.profileView===view;btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active))});
 const filters=$("#profileHistoryFilters");const uploadPanel=$("#uploadSection");$("#profilePanel")?.classList.toggle("admin-upload-view",view==="upload");
 filters?.querySelectorAll("[data-profile-filter]").forEach(btn=>btn.classList.toggle("active",btn.dataset.profileFilter===filter));
 if(view==="upload"){if(filters)filters.hidden=true;list.hidden=true;if(uploadPanel)uploadPanel.hidden=uploadPanel.dataset.admin!=="true";if(uploadPanel?.dataset.admin!=="true"){profileCollectionView="history";return renderProfileCollections()}return}
 if(uploadPanel)uploadPanel.hidden=true;list.hidden=false;if(filters)filters.hidden=view!=="history";
 let entries=[];
 if(view==="history"){
  entries=Object.entries(watchHistory).map(([id,entry])=>({drama:dramas.find(d=>String(d.id)===String(id)),entry})).filter(x=>x.drama).sort((a,b)=>new Date(b.entry.watched_at||0)-new Date(a.entry.watched_at||0));
  if(filter!=="all")entries=entries.filter(({drama,entry})=>{const ep=(drama.episodes||[]).find(x=>Number(x.episode_number)===Number(entry.episode_number));const key=String(drama.id)+":"+String(ep?.id||"");const pct=Number(episodeProgress[key]?.percent||0);return filter==="finished"?pct>=95:pct<95});
 }else if(view==="saved"){
  entries=[...favoriteIds].map(id=>({drama:dramas.find(d=>String(d.id)===String(id)),entry:null})).filter(x=>x.drama);
 }else{
  const {data:sessionData}=supa?await supa.auth.getSession():{data:{session:null}};
  const user=sessionData?.session?.user;
  if(user&&profileLikesLoadedFor!==user.id){
   const result=await supa.from("drama_likes").select("drama_id").eq("user_id",user.id);
   profileLikedIds=new Set((result.data||[]).map(row=>String(row.drama_id)));profileLikesLoadedFor=user.id;
  }else if(!user){profileLikedIds=new Set();profileLikesLoadedFor=null}
  entries=[...new Set([...profileLikedIds,...demoLikedIds])].map(id=>({drama:dramas.find(d=>String(d.id)===String(id)),entry:null})).filter(x=>x.drama);
 }
 list.innerHTML="";
 if(!entries.length){const p=document.createElement("p");p.className="empty-state";p.textContent=view==="history"?"Belum ada riwayat tontonan. Putar drama untuk menyimpannya di sini.":view==="saved"?"Belum ada drama favorit. Simpan drama dengan menekan ikon bookmark.":"Belum ada drama yang kamu sukai.";list.append(p);return}
 let lastGroup="";
 entries.forEach(({drama,entry})=>{
  const group=view==="history"?profileDateLabel(entry.watched_at):view==="saved"?"Drama favorit":"Drama disukai";
  if(group!==lastGroup){const heading=document.createElement("h3");heading.className="profile-date-heading";heading.textContent=group;list.append(heading);lastGroup=group}
  const card=document.createElement("article");card.className="profile-drama-row";
  const poster=document.createElement("div");poster.className="profile-drama-poster";
  if(drama.poster_url){const img=document.createElement("img");img.src=drama.poster_url;img.alt="Poster "+drama.title;img.loading="lazy";poster.append(img)}else{poster.textContent="T"}
  const info=document.createElement("div");info.className="profile-drama-info";
  const title=document.createElement("strong");title.textContent=drama.title||"Drama";
  const genre=document.createElement("span");genre.textContent=drama.genre||((drama.episodes||[]).length+" episode");
  const episode=document.createElement("small");episode.textContent=entry?"Ep."+entry.episode_number+" / Ep."+(drama.episodes||[]).length:(drama.episodes||[]).length+" episode";
  info.append(title,genre,episode);
  if(view==="history"&&entry){
   const watchedEpisode=(drama.episodes||[]).find(item=>Number(item.episode_number)===Number(entry.episode_number));
   const progress=watchedEpisode?episodeProgress[String(drama.id)+":"+String(watchedEpisode.id||"")]:null;
   const percent=Math.max(0,Math.min(100,Number(progress?.percent)||0));
   const progressLabel=document.createElement("small");progressLabel.className="profile-progress-label";
   progressLabel.textContent=percent>=95?"Episode selesai":percent>0?"Progres "+percent+"% · "+formatPlaybackTime(progress.seconds):"Belum ada progres";
   const track=document.createElement("span");track.className="profile-progress-track";
   const fill=document.createElement("span");fill.className="profile-progress-fill";fill.style.width=percent+"%";track.append(fill);
   info.append(progressLabel,track);
  }
  card.append(poster,info);
  card.addEventListener("click",()=>{openDrama(drama);if(entry){const idx=(drama.episodes||[]).findIndex(ep=>Number(ep.episode_number)===Number(entry.episode_number));if(idx>=0)playEpisode(idx,true,Number(entry.position_seconds)||0)}});
  list.append(card);
 });
}
function render(){
 const profilePage=activeTab==="profile",collectionPage=activeTab==="collection",clipsPage=activeTab==="clips";
 document.body.classList.toggle("clips-mode",clipsPage);
 if(!clipsPage)pauseClipsFeed();
 const profilePanel=$("#profilePanel");if(profilePanel)profilePanel.hidden=!profilePage;
 [...document.querySelectorAll(".hero,.section-heading,.catalog-tools,.catalog-sort-row,.catalog-count,.catalog-status,.viewer-promo")].forEach(el=>{el.hidden=profilePage});
 const historyTools=$("#historyTools");if(historyTools)historyTools.hidden=!(collectionPage&&collectionView==="history");
 const collectionFilters=$("#collectionHistoryFilters");if(collectionFilters)collectionFilters.hidden=!(collectionPage&&collectionView==="history");
 document.querySelectorAll("[data-collection-history-filter]").forEach(button=>{const active=button.dataset.collectionHistoryFilter===collectionHistoryFilter;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active))});
 const collectionTabs=$("#collectionTabs");if(collectionTabs)collectionTabs.hidden=!collectionPage;
 const savedPage=collectionPage&&collectionView==="saved",historyPage=collectionPage&&collectionView==="history";
 grid.hidden=profilePage;
 if(profilePage){
  const savedSection=$("#savedSection");if(savedSection)savedSection.hidden=true;
  if(historyTools)historyTools.hidden=true;
  if(collectionTabs)collectionTabs.hidden=true;
  renderProfileCollections();
  grid.innerHTML="";return;
 }
 grid.innerHTML="";
 const savedSection=$("#savedSection"),homeHero=$(".hero"),headingTitle=$(".section-heading h2"),headingEyebrow=$(".section-heading .eyebrow"),savedCount=$("#savedCount");
 if(savedSection)savedSection.hidden=!savedPage;
 if(homeHero)homeHero.hidden=clipsPage||savedPage||historyPage;
 if(headingTitle)headingTitle.textContent=clipsPage?"Cuplikan drama":savedPage?"Drama favorit":historyPage?"Riwayat tontonan":"Drama pilihan";
 if(headingEyebrow)headingEyebrow.textContent=clipsPage?"PILIH CERITA DAN MULAI MENONTON":savedPage?"TERSIMPAN UNTUKMU":historyPage?"LANJUTKAN CERITAMU":"UNTUKMU";
 if(savedCount)savedCount.textContent=favoriteIds.size.toLocaleString("id-ID");
 document.querySelectorAll("[data-collection-view]").forEach(button=>{const active=button.dataset.collectionView===collectionView;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active))});
 const favoriteCount=$("#collectionFavoriteCount"),historyCount=$("#collectionHistoryCount");
 if(favoriteCount)favoriteCount.textContent=favoriteIds.size>99?"99+":String(favoriteIds.size);
 if(historyCount)historyCount.textContent=Object.keys(watchHistory).length>99?"99+":String(Object.keys(watchHistory).length);
 let visible=clipsPage?dramas.filter(d=>(d.episodes||[]).length>0):savedPage?dramas.filter(d=>favoriteIds.has(d.id)):historyPage?dramas.filter(d=>watchHistory[d.id]).sort((a,b)=>new Date(watchHistory[b.id]?.watched_at||0)-new Date(watchHistory[a.id]?.watched_at||0)):dramas;
 if(historyPage&&collectionHistoryFilter!=="all")visible=visible.filter(d=>{const entry=watchHistory[d.id],ep=(d.episodes||[]).find(item=>Number(item.episode_number)===Number(entry?.episode_number)),progress=episodeProgress[String(d.id)+":"+String(ep?.id||"")],percent=Number(progress?.percent)||0;return collectionHistoryFilter==="finished"?percent>=95:percent<95});
 if(searchQuery)visible=visible.filter(d=>(String(d.title||"")+" "+String(d.description||"")+" "+String(d.genre||"")).toLocaleLowerCase("id").includes(searchQuery));
 if(!historyPage){const mode=$("#dramaSort")?.value||"newest";if(mode==="popular")visible.sort((a,b)=>(Number(b.like_count||0)+Number(b.favorite_count||0))-(Number(a.like_count||0)+Number(a.favorite_count||0))||String(a.title||"").localeCompare(String(b.title||""),"id"));else if(mode==="az")visible.sort((a,b)=>String(a.title||"").localeCompare(String(b.title||""),"id"));else if(mode==="za")visible.sort((a,b)=>String(b.title||"").localeCompare(String(a.title||""),"id"))}
 const countLabel=$("#catalogCount");if(countLabel)countLabel.textContent=searchQuery?visible.length+" hasil pencarian":visible.length+" drama ditampilkan";
 const clearSearch=$("#clearSearch");if(clearSearch)clearSearch.hidden=!searchQuery;
 if(activeTab==="home")renderFeaturedHero();
 if(!visible.length){
  if(!searchQuery&&(savedPage||historyPage)){
   const filteredHistory=historyPage&&collectionHistoryFilter!=="all";
   const filterLabel=collectionHistoryFilter==="finished"?"selesai":"sedang ditonton";
   const empty=document.createElement("section");empty.className="collection-empty-state";
   const icon=document.createElement("span");icon.className="collection-empty-icon";icon.setAttribute("aria-hidden","true");icon.textContent=savedPage?"♡":"◷";
   const eyebrow=document.createElement("small");eyebrow.textContent="KOLEKSI PRIBADI";
   const title=document.createElement("h3");title.textContent=savedPage?"Belum ada drama favorit":filteredHistory?"Belum ada drama "+filterLabel:"Belum ada riwayat tontonan";
   const copy=document.createElement("p");copy.textContent=savedPage?"Simpan drama yang kamu suka dengan menekan ikon hati pada poster. Semua pilihanmu akan terkumpul di sini.":filteredHistory?"Belum ada riwayat dengan status "+filterLabel+". Coba lihat semua riwayat tontonanmu.":"Mulai tonton drama pilihanmu. Riwayat episode dan progres menonton akan tersimpan otomatis di akun saat masuk, serta di perangkat ini sebagai cadangan.";
   const action=document.createElement("button");action.type="button";action.className="collection-empty-action";action.textContent=filteredHistory?"Lihat semua riwayat":"Jelajahi drama";
   action.addEventListener("click",()=>{if(filteredHistory){collectionHistoryFilter="all";render();return}activeTab="home";setActiveNav(activeTab);render();window.scrollTo({top:0,behavior:"smooth"})});
   empty.append(icon,eyebrow,title,copy,action);grid.replaceChildren(empty);
  }else{
   grid.innerHTML=`<p class="empty-state">${searchQuery?"Drama tidak ditemukan. Coba kata kunci lain atau hapus pencarian.":clipsPage?"Belum ada drama dengan episode lengkap untuk ditampilkan di Cuplikan.":"Belum ada drama. Drama yang diunggah admin akan muncul di sini."}</p>`;
  }
  return;
}
 if(clipsPage){renderClips(visible);return}
 visible.forEach(d=>{
  const card=document.createElement("article");card.className="drama-card";
  const historyEntry=historyPage?watchHistory[d.id]:null;
  const historyLabel=historyEntry?"Lanjutkan · Episode "+historyEntry.episode_number+(Number(historyEntry.position_seconds)>0?" · "+formatPlaybackTime(historyEntry.position_seconds):""):"";
  const tag=String(d.id).startsWith("demo-")?"DEMO • VIDEO UJI":clipsPage?"CUPLIKAN":historyLabel?historyLabel:"DRAMA PENDEK";
  card.innerHTML=`<div class="poster" role="button" tabindex="0" style="background:linear-gradient(145deg,${d.colors?.[0]||"#61365f"},${d.colors?.[1]||"#20243a"})"><span class="tag">${escapeHtml(tag)}</span><span class="poster-title">${escapeHtml(d.title)}</span><button class="favorite-btn ${favoriteIds.has(d.id)?"is-favorite":""}" type="button" aria-label="${favoriteIds.has(d.id)?"Hapus dari":"Tambah ke"} favorit" aria-pressed="${favoriteIds.has(d.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17.2 6.5 21z"/></svg></button></div><div class="card-meta"><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.genre||((d.episodes||[]).length+" episode"))}</span></div>`;
  const poster=card.querySelector(".poster");
  const openCardDrama=()=>{const saved=watchHistory[d.id];const resumeNumber=saved?.episode_number??null,resumeSeconds=Number(saved?.position_seconds||0);openDrama(d);if(resumeNumber!=null){const resumeIndex=(d.episodes||[]).findIndex(ep=>Number(ep.episode_number)===Number(resumeNumber));if(resumeIndex>=0)playEpisode(resumeIndex,false,resumeSeconds)}};
  if(historyPage&&historyEntry){
   const watchedEpisode=(d.episodes||[]).find(ep=>Number(ep.episode_number)===Number(historyEntry.episode_number));
   const progress=watchedEpisode?episodeProgress[String(d.id)+":"+String(watchedEpisode.id||"")]:null;
   const percent=Math.max(0,Math.min(100,Number(progress?.percent)||0));
   const historyProgress=document.createElement("div");historyProgress.className="history-card-progress";
   const progressLabel=document.createElement("small");progressLabel.className="history-card-progress-label";
   progressLabel.textContent=percent>=95?"Episode selesai":percent>0?"Progres "+percent+"% · "+formatPlaybackTime(progress.seconds):"Belum ada progres tersimpan";
   const progressTrack=document.createElement("span");progressTrack.className="history-card-progress-track";
   const progressFill=document.createElement("span");progressFill.className="history-card-progress-fill";progressFill.style.width=percent+"%";progressTrack.append(progressFill);
   const resumeButton=document.createElement("button");resumeButton.type="button";resumeButton.className="history-card-resume";resumeButton.textContent=percent>=95?"Tonton lagi":"Lanjutkan menonton";
   resumeButton.addEventListener("click",openCardDrama);
   historyProgress.append(progressLabel,progressTrack,resumeButton);card.querySelector(".card-meta").append(historyProgress);
  }
  poster.addEventListener("click",openCardDrama);poster.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openCardDrama()}});
  if(d.poster_url){const art=document.createElement("img");art.className="poster-art";art.src=d.poster_url;art.alt="Poster "+d.title;art.loading="lazy";poster.prepend(art)}
  card.querySelector(".favorite-btn").addEventListener("click",e=>{e.stopPropagation();toggleDramaFavorite(d).then(()=>{const button=e.currentTarget,active=favoriteIds.has(String(d.id));button.classList.toggle("is-favorite",active);button.setAttribute("aria-pressed",String(active));button.setAttribute("aria-label",active?"Hapus dari favorit":"Tambah ke favorit")})});
  grid.append(card)
 })
}
function getVideoUrl(path){const value=String(path||"");if(/^https:\/\//i.test(value))return value;return supa?.storage?.from("drama-videos").getPublicUrl(value).data.publicUrl||""}
function saveWatchHistory(ep,positionSeconds=0){if(!activeDrama||!ep?.id)return;const stamp=new Date().toISOString();watchHistory[activeDrama.id]={episode_number:ep.episode_number,episode_title:ep.title||"",position_seconds:Math.max(0,Math.floor(Number(positionSeconds)||0)),watched_at:stamp,updated_at:stamp};try{localStorage.setItem("tactic-watch-history",JSON.stringify(watchHistory))}catch{}syncWatchHistoryRow(activeDrama.id)}
function episodeProgressKey(ep){return String(activeDrama?.id||"")+":"+String(ep?.id||"")}
function saveEpisodeProgress(force=false,completed=false){
 if(!activeDrama||!Number.isFinite(video.duration)||video.duration<=0)return;
 const now=Date.now();if(!force&&now-lastEpisodeProgressPersist<5000)return;lastEpisodeProgressPersist=now;
 const ep=activeDrama.episodes?.[activeEpisodeIndex];if(!ep?.id)return;
 const key=episodeProgressKey(ep),seconds=Math.max(0,Math.floor(video.currentTime||0)),duration=Math.floor(video.duration);
 episodeProgress[key]={seconds:completed?duration:seconds,duration,percent:completed?100:Math.min(100,Math.floor(seconds/duration*100)),updated_at:new Date().toISOString()};
 syncEpisodeProgressRow(key,episodeProgress[key]);
 try{localStorage.setItem("tactic-episode-progress",JSON.stringify(episodeProgress))}catch{}
 renderEpisodeProgress(ep);
}
function formatEpisodeTime(seconds){const value=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(value/60)+":"+String(value%60).padStart(2,"0")}
function renderEpisodeProgress(ep){
 const key=episodeProgressKey(ep),data=episodeProgress[key],button=[...$("#episodeList").querySelectorAll("button")].find(item=>item.dataset.progressKey===key);
 if(!button)return;
 const fill=button.querySelector(".episode-progress-fill"),label=button.querySelector(".episode-progress-label"),percent=data?.percent||0;
 if(fill)fill.style.width=percent+"%";
 if(label)label.textContent=percent>=95?"Selesai":percent>0?"Lanjutkan · "+formatEpisodeTime(data.seconds)+" · "+percent+"%":"Belum ditonton";
}
function syncEpisodeDeepLink(drama,episode){
 if(!drama||String(drama.id).startsWith("demo-"))return;
 const url=new URL(location.href);
 url.searchParams.set("drama",String(drama.id));
 if(episode?.episode_number)url.searchParams.set("episode",String(episode.episode_number));
 try{history.replaceState(history.state,"",url.toString())}catch{}
 document.title=drama.title+(episode?.episode_number?" · Episode "+episode.episode_number:"")+" | TacTic Drama";
}
function playEpisode(index,autoplay=true,resumeSeconds=0){const eps=activeDrama?.episodes||[];if(index<0||index>=eps.length)return;if(activeEpisodeIndex!==index){persistCurrentPlayback();saveEpisodeProgress(true)}activeEpisodeIndex=index;const ep=eps[index];syncEpisodeDeepLink(activeDrama,ep);const list=$("#episodeList");list.querySelectorAll("button").forEach((b,i)=>{b.classList.toggle("active",i===index)});const prev=$("#prevEpisode"),next=$("#nextEpisode");if(prev)prev.disabled=index===0;if(next){next.disabled=index===eps.length-1;next.textContent=index===eps.length-1?"Episode terakhir":"Episode berikutnya →"}$("#playerDescription").textContent="Episode "+ep.episode_number+(ep.title?" — "+ep.title:"")+" · "+(index<eps.length-1?(autoNextEnabled?"Putar otomatis aktif":"Putar otomatis nonaktif"):"Ini episode terbaru");if(resumeSeconds>0){video.addEventListener("loadedmetadata",()=>{if(Number.isFinite(video.duration)&&resumeSeconds<video.duration-2)video.currentTime=resumeSeconds},{once:true})}applyPlaybackPreferences();video.querySelectorAll("track[data-episode-subtitle]").forEach(track=>track.remove());if(ep.subtitle_path&&supa){const track=document.createElement("track");track.kind="captions";track.label="Bahasa Indonesia";track.srclang="id";track.src=supa.storage.from("drama-videos").getPublicUrl(ep.subtitle_path).data.publicUrl;track.default=true;track.dataset.episodeSubtitle="true";video.append(track)}video.src=getVideoUrl(ep.video_path);video.load();saveWatchHistory(ep,resumeSeconds);recordEpisodeView(ep);if(autoplay)video.play().catch(()=>{});syncPlayerEpisodeDrawer();syncPlayerOverlay();}

function syncPlayerActionRail(){
 if(!activeDrama)return;
 const id=String(activeDrama.id),fav=favoriteIds.has(id),btn=$("#playerFavoriteAction");
 btn.setAttribute("aria-pressed",String(fav));btn.setAttribute("aria-label",fav?"Hapus dari favorit":"Tambah ke favorit");btn.classList.toggle("is-active",fav);
 const favoriteCount=$("#playerFavoriteRailCount");if(favoriteCount)favoriteCount.textContent=String(favoriteCounts.get(id)??Number(activeDrama.favorite_count||0)).toLocaleString("id-ID");
 const like=$("#likeDrama"),likeBtn=$("#playerLikeAction"),likeAvailable=Boolean(like&&!like.hidden);
 likeBtn.hidden=!likeAvailable;likeBtn.setAttribute("aria-pressed",likeAvailable&&like.dataset.liked==="true"?"true":"false");likeBtn.classList.toggle("is-active",likeAvailable&&like.dataset.liked==="true");
}
$("#playerFavoriteAction").addEventListener("click",async()=>{if(!activeDrama)return;await toggleDramaFavorite(activeDrama);showPlayerControls()});
$("#playerLikeAction").addEventListener("click",()=>{if($("#playerLikeAction").hidden)return;$("#likeDrama").click();setTimeout(syncPlayerActionRail,250);showPlayerControls()});
$("#playerShareAction").addEventListener("click",()=>{$("#shareDrama").click();showPlayerControls()});
$("#playerCommentAction").addEventListener("click",()=>{
 const drawer=$("#playerCommentsDrawer"),open=drawer.hidden;drawer.hidden=!open;
 if(open){$("#playerEpisodeDrawer").hidden=true;$("#playerEpisodeToggle")?.setAttribute("aria-expanded","false");const content=$("#playerCommentsContent"),comments=document.querySelector(".comments");if(comments&&!content.contains(comments))content.append(comments);comments?.scrollIntoView({block:"nearest"});}
 $("#playerCommentAction").setAttribute("aria-expanded",String(open));
 showPlayerControls();
});
$("#playerCommentsClose").addEventListener("click",()=>{$("#playerCommentsDrawer").hidden=true;$("#playerCommentAction").setAttribute("aria-expanded","false");$("#playerCommentAction").focus()});

function syncPlayerEpisodeDrawer(){const source=$("#episodeList"),target=$("#playerEpisodeList");if(!source||!target)return;target.innerHTML="";[...source.children].forEach(button=>{const clone=document.createElement("button");clone.type="button";clone.className="player-episode-item"+(button.classList.contains("active")?" active":"");const title=document.createElement("strong");title.textContent=button.querySelector(".episode-button-title")?.textContent||button.textContent;const meta=document.createElement("small");meta.textContent=button.querySelector(".episode-progress-label")?.textContent||"";clone.append(title,meta);clone.addEventListener("click",()=>{button.click();$("#playerEpisodeDrawer").hidden=true;$("#playerEpisodeToggle")?.setAttribute("aria-expanded","false");showPlayerControls()});target.append(clone)})}
function openDrama(d,startPlayback=false){if(activeDrama&&player.open){persistCurrentPlayback();saveEpisodeProgress(true)}pauseClipsFeed();activeDrama=d;activeEpisodeIndex=0;$("#playerEpisodeDrawer").hidden=true;$("#playerCommentsDrawer").hidden=true;$("#playerEpisodeToggle")?.setAttribute("aria-expanded","false");$("#playerCommentAction").setAttribute("aria-expanded","false");$("#playerSeries").textContent=d.genre||"TAC TIC DRAMA";$("#playerTitle").textContent=d.title;$("#playerDescription").textContent=d.description||"Nikmati episode drama ini.";const list=$("#episodeList");list.innerHTML="";const episodeSearch=$("#episodeSearch"),episodeCount=$("#episodeSearchCount");if(episodeSearch){episodeSearch.value="";episodeSearch.oninput=()=>{const query=episodeSearch.value.trim().toLocaleLowerCase("id");let shown=0;list.querySelectorAll("button").forEach(button=>{const match=button.textContent.toLocaleLowerCase("id").includes(query);button.hidden=!match;if(match)shown++});if(episodeCount)episodeCount.textContent=query?shown+" episode ditemukan":list.children.length+" episode"};}const eps=[...(d.episodes||[])].sort((a,b)=>a.episode_number-b.episode_number);d.episodes=eps;if(!eps.length){list.textContent="Episode belum tersedia.";video.pause();video.removeAttribute("src")}if(episodeCount)episodeCount.textContent=eps.length+" episode";eps.forEach((ep,i)=>{const b=document.createElement("button");b.dataset.progressKey=String(d.id)+":"+String(ep.id||"");const title=document.createElement("span");title.className="episode-button-title";title.textContent="Episode "+ep.episode_number+(ep.title?" · "+ep.title:"");const meta=document.createElement("small");meta.className="episode-progress-label";const saved=episodeProgress[b.dataset.progressKey];meta.textContent=saved?.percent>=95?"Selesai":saved?.percent>0?"Lanjutkan · "+formatEpisodeTime(saved.seconds)+" · "+saved.percent+"%":"Belum ditonton";const track=document.createElement("span");track.className="episode-progress-track";const fill=document.createElement("span");fill.className="episode-progress-fill";fill.style.width=Math.min(100,Number(saved?.percent)||0)+"%";track.append(fill);b.append(title,meta,track);b.addEventListener("click",()=>{const saved=episodeProgress[b.dataset.progressKey],resume=saved&&saved.percent>0&&saved.percent<95?Math.max(0,Number(saved.seconds)||0):0;playEpisode(i,true,resume)});list.append(b)});if(eps.length)playEpisode(0,startPlayback);loadComments(d.id);loadDramaLikeState(d.id);loadDramaFavoriteState(d.id);player.showModal();player.classList.add("controls-visible");syncPlayerEpisodeDrawer();syncPlayerOverlay();syncPlayerActionRail();showPlayerControls()}
async function loadCatalog(){const status=$("#catalogStatus"),reload=$("#reloadCatalog"),grid=$("#dramaGrid");if(!supa){if(status)status.textContent="Katalog online belum tersambung.";return}if(status)status.textContent="Menyiapkan pilihan drama…";if(reload){reload.disabled=true;reload.textContent="Memuat…"}if(grid){grid.classList.add("is-loading");grid.innerHTML=Array.from({length:4},()=>'<article class="skeleton-card" aria-hidden="true"><div class="skeleton-poster"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></article>').join("")}try{const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,episodes(id,episode_number,title,video_path,subtitle_path,status)").eq("status","approved").eq("episodes.status","approved").order("created_at",{ascending:false});if(error)throw error;if(data){const [likesResult,favoritesResult]=await Promise.all([supa.from("drama_like_counts").select("drama_id,like_count"),supa.from("drama_favorite_counts").select("drama_id,favorite_count")]);const likesByDrama=new Map((likesResult.data||[]).map(row=>[String(row.drama_id),Number(row.like_count||0)]));favoriteCounts=new Map((favoritesResult.data||[]).map(row=>[String(row.drama_id),Number(row.favorite_count||0)]));if(likesResult.error)console.warn("Jumlah suka katalog belum dapat dimuat:",likesResult.error.message);if(favoritesResult.error)console.warn("Jumlah favorit katalog belum dapat dimuat:",favoritesResult.error.message);dramas=data.length?data.map(d=>({...d,like_count:likesByDrama.get(String(d.id))||0,favorite_count:favoriteCounts.get(String(d.id))||0,genre:(d.episodes||[]).length+" episode",colors:["#71324e","#252344"]})): [...demoDramas];render();loadUserFavorites();const sharedId=new URLSearchParams(location.search).get("drama");if(sharedId&&!sharedDramaOpened){const sharedDrama=dramas.find(item=>String(item.id)===sharedId);if(sharedDrama){sharedDramaOpened=true;openDrama(sharedDrama);const sharedEpisode=Number(new URLSearchParams(location.search).get("episode"));if(Number.isInteger(sharedEpisode)&&sharedEpisode>0){const episodeIndex=(sharedDrama.episodes||[]).findIndex(ep=>Number(ep.episode_number)===sharedEpisode);if(episodeIndex>=0)playEpisode(episodeIndex,false)}}}if(status)status.textContent=data.length?data.length+" drama tersedia. Katalog berhasil diperbarui.":"Belum ada drama resmi. Menampilkan 2 konten DEMO dengan video uji CC0 dari MDN."}}catch(e){console.warn("Catalog online belum dapat dimuat:",e.message);render();if(status)status.textContent="Katalog gagal dimuat. Periksa koneksi lalu coba muat ulang."}finally{grid?.classList.remove("is-loading");if(reload){reload.disabled=false;reload.textContent="↻ Muat ulang"}}}
function setStatus(id,msg){$(id).textContent=msg}
function setPlayerCommentCount(count){const badge=$("#playerCommentCount"),rail=$("#playerCommentRailCount"),value=Number.isFinite(count)?count.toLocaleString("id-ID"):"—";if(badge)badge.textContent=Number.isFinite(count)?value+" komentar":"";if(rail)rail.textContent=value}
function formatCommentAge(value){
 const date=new Date(value),seconds=Math.max(0,Math.floor((Date.now()-date.getTime())/1000));
 if(!Number.isFinite(date.getTime()))return "";
 if(seconds<60)return "Baru saja";
 if(seconds<3600)return Math.floor(seconds/60)+" mnt lalu";
 if(seconds<86400)return Math.floor(seconds/3600)+" jam lalu";
 if(seconds<604800)return Math.floor(seconds/86400)+" hari lalu";
 return date.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:date.getFullYear()===new Date().getFullYear()?undefined:"numeric"});
}
async function loadComments(dramaId){
 const requestToken=++commentLoadToken,requestedDramaId=String(dramaId);
 const list=$("#commentList");if(!list)return;list.innerHTML="";setPlayerCommentCount(0);
 if(!supa||String(dramaId).startsWith("demo-")){setStatus("#commentStatus","Komentar online akan tersedia untuk drama yang terhubung ke katalog.");return}
 setStatus("#commentStatus","Memuat komentar...");
 let result;
 try{
  result=await supa.from("comments").select("id,display_name,body,created_at",{count:"exact"}).eq("drama_id",dramaId).order("created_at",{ascending:false}).limit(50);
 }catch(error){
  if(requestToken===commentLoadToken&&String(activeDrama?.id)===requestedDramaId)setStatus("#commentStatus","Koneksi bermasalah. Komentar belum bisa dimuat. Coba buka panel lagi.");
  return;
 }
 if(requestToken!==commentLoadToken||String(activeDrama?.id)!==requestedDramaId)return;
 if(result.error){setStatus("#commentStatus","Komentar belum bisa dimuat. Coba lagi nanti.");return}
 setPlayerCommentCount(Number.isFinite(result.count)?result.count:result.data.length);
 if(!result.data.length){setStatus("#commentStatus","Belum ada komentar. Jadilah yang pertama!");return}
 setStatus("#commentStatus","");
 result.data.forEach(item=>{
  const name=String(item.display_name||"Pengguna").trim()||"Pengguna";
  const el=document.createElement("article");el.className="comment-item";
  const avatar=document.createElement("span");avatar.className="comment-avatar";avatar.textContent=Array.from(name)[0].toLocaleUpperCase("id-ID");avatar.setAttribute("aria-hidden","true");
  const content=document.createElement("div");content.className="comment-content";
  const meta=document.createElement("div");meta.className="comment-meta";
  const who=document.createElement("strong");who.textContent=name;
  const time=document.createElement("time");time.dateTime=item.created_at;time.textContent=formatCommentAge(item.created_at);time.title=new Date(item.created_at).toLocaleString("id-ID");
  const body=document.createElement("p");body.textContent=item.body;
  meta.append(who,time);content.append(meta,body);el.append(avatar,content);list.append(el);
 })
}
function updateCommentCounters(){
 const form=$("#commentForm");if(!form)return;
 const name=form.elements.displayName,body=form.elements.body;
 const nameCount=$("#commentNameCount"),bodyCount=$("#commentBodyCount");
 if(nameCount)nameCount.textContent=name.value.length+"/40 karakter";
 if(bodyCount)bodyCount.textContent=body.value.length.toLocaleString("id-ID")+"/1.000 karakter";
}
$("#commentForm").elements.displayName.addEventListener("input",updateCommentCounters);
$("#commentForm").elements.body.addEventListener("input",updateCommentCounters);
$("#commentForm").addEventListener("reset",()=>setTimeout(updateCommentCounters,0));
updateCommentCounters();
$("#commentForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa||!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#commentStatus","Komentar belum aktif. Sambungkan Supabase dan gunakan drama dari katalog online.");return}
 const form=e.currentTarget,fd=new FormData(form),body=String(fd.get("body")||"").trim(),btn=form.querySelector("button[type=submit]"),dramaId=activeDrama.id;
 if(btn.disabled)return;
 if(!body){setStatus("#commentStatus","Tulis komentar terlebih dahulu.");return}
 btn.disabled=true;setStatus("#commentStatus","Menyiapkan komentar...");
 let display_name=String(fd.get("displayName")||"").trim();
 if(!display_name){try{const {data}=await supa.auth.getUser();const user=data?.user;display_name=String(user?.user_metadata?.display_name||user?.email?.split("@")[0]||"Penonton").trim().slice(0,40)}catch{display_name="Penonton"}}
 if(!display_name)display_name="Penonton";
 setStatus("#commentStatus","Mengirim komentar...");
 try{const result=await supa.from("comments").insert({drama_id:dramaId,display_name,body});if(result.error)throw result.error;if(String(activeDrama?.id)===String(dramaId)){form.elements.displayName.value=display_name;form.elements.body.value="";await loadComments(dramaId)}}
 catch(err){if(String(activeDrama?.id)===String(dramaId))setStatus("#commentStatus","Gagal mengirim komentar: "+err.message)}
 finally{btn.disabled=false}
});

$("#reportDrama").addEventListener("click",async()=>{if(!activeDrama||String(activeDrama.id).startsWith("demo-")){setStatus("#reportStatus","Laporan tersedia untuk drama dari katalog online.");return}if(!supa){setStatus("#reportStatus","Backend belum tersambung.");return}const {data}=await supa.auth.getSession();if(!data.session){setStatus("#reportStatus","Masuk atau daftar akun untuk melaporkan video.");admin.showModal();return}$("#reportForm").reset();$("#reportDialog").showModal()});
$("#reportForm").addEventListener("submit",async event=>{event.preventDefault();if(!activeDrama||!supa)return;const {data}=await supa.auth.getSession();if(!data.session){$("#reportDialog").close();setStatus("#reportStatus","Sesi akun berakhir. Masuk kembali untuk melaporkan video.");admin.showModal();return}const form=event.currentTarget,values=new FormData(form),reason=String(values.get("reason")||"").trim(),details=String(values.get("details")||"").trim(),button=form.querySelector('button[type="submit"]');if(!reason){setStatus("#reportFormStatus","Pilih alasan laporan terlebih dahulu.");return}button.disabled=true;setStatus("#reportFormStatus","Mengirim laporan…");try{const {error}=await supa.from("video_reports").insert({drama_id:activeDrama.id,reporter_id:data.session.user.id,reason,details:details.slice(0,1000)});if(error)throw error;$("#reportDialog").close();setStatus("#reportStatus","Terima kasih. Laporan sudah dikirim ke tim admin.");}catch(error){setStatus("#reportFormStatus","Gagal mengirim laporan: "+error.message)}finally{button.disabled=false}});


let playerControlsTimer=null,playerSeekDragging=false;
function showPlayerControls(){if(!player?.open)return;player.classList.add("controls-visible");clearTimeout(playerControlsTimer);if(!video.paused)playerControlsTimer=setTimeout(()=>player.classList.remove("controls-visible"),3200)}
function syncPlayerOverlay(){const duration=Number.isFinite(video.duration)?video.duration:0,current=Number(video.currentTime)||0;const currentLabel=$("#playerCurrentTime"),durationLabel=$("#playerDuration"),seek=$("#playerSeek"),playPause=$("#playerPlayPause"),centerPlay=$("#playerCenterPlay"),speed=$("#playerSpeed"),previous=$("#playerPrevious"),next=$("#playerNext"),drawerTitle=$("#playerDrawerTitle");if(currentLabel)currentLabel.textContent=formatPlaybackTime(current);if(durationLabel)durationLabel.textContent=formatPlaybackTime(duration);if(seek&&!playerSeekDragging)seek.value=duration?String(Math.round(current/duration*1000)):"0";if(playPause)playPause.textContent=video.paused?"▶":"Ⅱ";if(centerPlay)centerPlay.hidden=!video.paused;if(speed)speed.textContent=(video.playbackRate||1)+"×";if(previous)previous.disabled=activeEpisodeIndex<=0;if(next)next.disabled=activeEpisodeIndex>=(activeDrama?.episodes?.length||1)-1;if(drawerTitle)drawerTitle.textContent=activeDrama?.title||"Daftar episode";syncPlayerActionRail()}
$("#playerCenterPlay")?.addEventListener("click",()=>{video.play().catch(()=>setVideoStatus("Tekan putar untuk melanjutkan.",true));showPlayerControls()});
$("#playerPlayPause")?.addEventListener("click",()=>{if(video.paused)video.play().catch(()=>{});else video.pause();showPlayerControls()});
$("#playerPrevious")?.addEventListener("click",()=>{playEpisode(activeEpisodeIndex-1);showPlayerControls()});
$("#playerNext")?.addEventListener("click",()=>{playEpisode(activeEpisodeIndex+1);showPlayerControls()});
$("#playerEpisodeToggle")?.addEventListener("click",()=>{const drawer=$("#playerEpisodeDrawer"),open=drawer.hidden;drawer.hidden=!open;if(open){$("#playerCommentsDrawer").hidden=true;$("#playerCommentAction").setAttribute("aria-expanded","false");syncPlayerEpisodeDrawer()}$("#playerEpisodeToggle")?.setAttribute("aria-expanded",String(open));showPlayerControls()});
$("#playerEpisodeClose").addEventListener("click",()=>{$("#playerEpisodeDrawer").hidden=true;$("#playerEpisodeToggle")?.setAttribute("aria-expanded","false");$("#playerEpisodeToggle")?.focus()});
$("#playerSpeed")?.addEventListener("click",()=>{const rates=[1,1.25,1.5,2,.75],current=Number(video.playbackRate)||1,next=rates[(rates.indexOf(current)+1)%rates.length];video.playbackRate=next;$("#playbackSpeed").value=String(next);try{localStorage.setItem("tactic-playback-rate",String(next))}catch{}syncPlayerOverlay();showPlayerControls()});
$("#playerFullscreen")?.addEventListener("click",()=>$("#fullscreenVideo").click());
$("#playerSeek")?.addEventListener("input",e=>{playerSeekDragging=true;if(Number.isFinite(video.duration))video.currentTime=video.duration*Number(e.target.value)/1000;syncPlayerOverlay();playerSeekDragging=true});
$("#playerSeek")?.addEventListener("change",()=>{playerSeekDragging=false;syncPlayerOverlay()});
video.addEventListener("click",()=>{if(player.classList.contains("controls-visible"))player.classList.remove("controls-visible");else showPlayerControls()});
["timeupdate","loadedmetadata","durationchange","play","pause","ratechange"].forEach(name=>video.addEventListener(name,()=>syncPlayerOverlay()));
player.addEventListener("close",()=>{clearTimeout(playerControlsTimer);player.classList.remove("controls-visible");$("#playerEpisodeDrawer").hidden=true;$("#playerCommentsDrawer").hidden=true;$("#playerEpisodeToggle")?.setAttribute("aria-expanded","false");$("#playerCommentAction").setAttribute("aria-expanded","false");commentLoadToken++;video.pause()});

function setVideoStatus(message="",retry=false){
 const panel=$("#videoStatus"),label=$("#videoStatusText"),button=$("#retryVideo");
 if(!panel||!label||!button)return;
 panel.hidden=!message;label.textContent=message;button.hidden=!retry;
}
video.addEventListener("loadstart",()=>setVideoStatus("Menghubungkan ke video…"));
video.addEventListener("waiting",()=>setVideoStatus("Video sedang memuat. Periksa koneksi jika terlalu lama."));
video.addEventListener("canplay",()=>setVideoStatus(""));
video.addEventListener("playing",()=>setVideoStatus(""));
video.addEventListener("error",()=>{
 const messages={1:"Pemutaran video dibatalkan.",2:"Koneksi terputus saat memuat video.",3:"Format atau data video tidak dapat diproses.",4:"Video tidak tersedia atau formatnya tidak didukung."};
 const code=video.error?.code;
 setVideoStatus(messages[code]||"Video gagal diputar. Periksa koneksi lalu coba lagi.",true);
});
$("#retryVideo").addEventListener("click",()=>{
 if(!video.src)return;
 const resumeAt=Number.isFinite(video.currentTime)?Math.max(0,video.currentTime):0;
 setVideoStatus("Mencoba memuat ulang video…");
 video.addEventListener("loadedmetadata",()=>{
  if(resumeAt>0&&Number.isFinite(video.duration)&&resumeAt<video.duration-2)video.currentTime=resumeAt;
  video.play().catch(()=>setVideoStatus("Tekan tombol putar pada video untuk melanjutkan.",true));
 },{once:true});
 video.load();
});
video.addEventListener("ended",()=>{const endedEpisode=activeDrama?.episodes?.[activeEpisodeIndex];if(endedEpisode)saveWatchHistory(endedEpisode,video.duration||video.currentTime||0);saveEpisodeProgress(true,true);if(activeDrama&&activeEpisodeIndex<(activeDrama.episodes||[]).length-1){if(autoNextEnabled)playEpisode(activeEpisodeIndex+1);else setStatus("#playerDescription","Episode selesai. Putar otomatis nonaktif — pilih episode berikutnya jika ingin lanjut.")}else setStatus("#playerDescription","Kamu sudah menyelesaikan episode terbaru. Pilih drama lain atau tonton ulang episode ini.");});

function seekVideoBy(seconds){
 if(!Number.isFinite(video.duration)||!Number.isFinite(video.currentTime))return;
 video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+seconds));
 updateSeekTime();
}
function updateSeekTime(){
 const current=formatPlaybackTime(video.currentTime||0);
 const duration=Number.isFinite(video.duration)?formatPlaybackTime(video.duration):"--:--";
 const label=$("#seekTime");if(label)label.textContent=current+" / "+duration;
}
$("#seekBack").addEventListener("click",()=>seekVideoBy(-10));
$("#seekForward").addEventListener("click",()=>seekVideoBy(10));
document.addEventListener("keydown",event=>{
 if(!player.open||event.altKey||event.ctrlKey||event.metaKey)return;
 if(event.key==="Escape"){
  if(!$("#playerCommentsDrawer").hidden){$("#playerCommentsDrawer").hidden=true;$("#playerCommentAction").setAttribute("aria-expanded","false");$("#playerCommentAction").focus();event.preventDefault();return}
  if(!$("#playerEpisodeDrawer").hidden){$("#playerEpisodeDrawer").hidden=true;$("#playerEpisodeToggle")?.setAttribute("aria-expanded","false");$("#playerEpisodeToggle")?.focus();event.preventDefault();return}
 }
 const target=event.target;
 if(target instanceof HTMLElement&&(target.isContentEditable||["INPUT","TEXTAREA","SELECT","BUTTON"].includes(target.tagName)))return;
 let handled=true;
 switch(event.key){
  case " ":case "k":case "K":
   if(video.paused)video.play().catch(()=>setVideoStatus("Tekan tombol putar untuk melanjutkan.",true));else video.pause();
   break;
  case "ArrowLeft":seekVideoBy(-10);break;
  case "ArrowRight":seekVideoBy(10);break;
  case "ArrowUp":video.volume=Math.min(1,Math.round((video.volume+0.05)*100)/100);video.muted=false;break;
  case "ArrowDown":video.volume=Math.max(0,Math.round((video.volume-0.05)*100)/100);break;
  case "m":case "M":video.muted=!video.muted;break;
  default:handled=false;
 }
 if(handled)event.preventDefault();
});

function updateFullscreenButton(){const btn=$("#fullscreenVideo");if(!btn)return;const active=Boolean(document.fullscreenElement||video.webkitDisplayingFullscreen);btn.textContent=active?"⤢ Keluar layar penuh":"⛶ Layar penuh";btn.setAttribute("aria-pressed",String(active));btn.setAttribute("aria-label",active?"Keluar dari layar penuh":"Tampilkan video layar penuh")}
$("#fullscreenVideo").addEventListener("click",async()=>{try{if(document.fullscreenElement){await document.exitFullscreen()}else if(video.webkitDisplayingFullscreen&&video.webkitExitFullscreen){video.webkitExitFullscreen()}else if(video.requestFullscreen){await video.requestFullscreen()}else if(video.webkitEnterFullscreen){video.webkitEnterFullscreen()}else{setStatus("#shareStatus","Mode layar penuh tidak didukung browser ini.")}}catch(err){setStatus("#shareStatus","Tidak dapat membuka layar penuh: "+(err?.message||"coba lagi"))}updateFullscreenButton()});
document.addEventListener("fullscreenchange",updateFullscreenButton);
video.addEventListener("webkitbeginfullscreen",updateFullscreenButton);
video.addEventListener("webkitendfullscreen",updateFullscreenButton);
function supportsPictureInPicture(){return Boolean((document.pictureInPictureEnabled&&!video.disablePictureInPicture)||typeof video.webkitSetPresentationMode==="function")}
function updatePipButton(){const btn=$("#pipVideo");if(!btn)return;const active=document.pictureInPictureElement===video||video.webkitPresentationMode==="picture-in-picture";btn.hidden=!supportsPictureInPicture();btn.textContent=active?"▣ Tutup video mengambang":"▣ Video mengambang";btn.setAttribute("aria-pressed",String(active));btn.setAttribute("aria-label",active?"Keluar dari video mengambang":"Aktifkan video mengambang")}
$("#pipVideo").addEventListener("click",async()=>{try{if(document.pictureInPictureElement===video){await document.exitPictureInPicture()}else if(video.webkitPresentationMode==="picture-in-picture"){video.webkitSetPresentationMode("inline")}else if(document.pictureInPictureEnabled&&video.requestPictureInPicture){await video.requestPictureInPicture()}else if(typeof video.webkitSetPresentationMode==="function"){video.webkitSetPresentationMode("picture-in-picture")}else{setStatus("#shareStatus","Video mengambang tidak didukung browser ini.")}}catch(err){setStatus("#shareStatus","Tidak dapat mengaktifkan video mengambang: "+(err?.message||"coba lagi"))}updatePipButton()});
video.addEventListener("enterpictureinpicture",updatePipButton);
video.addEventListener("leavepictureinpicture",updatePipButton);
video.addEventListener("webkitpresentationmodechanged",updatePipButton);
updatePipButton();

video.addEventListener("timeupdate",updateSeekTime);
video.addEventListener("timeupdate",()=>saveEpisodeProgress());
video.addEventListener("pause",()=>saveEpisodeProgress(true));
window.addEventListener("pagehide",()=>saveEpisodeProgress(true));
video.addEventListener("loadedmetadata",updateSeekTime);
video.addEventListener("durationchange",updateSeekTime);
$("#prevEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex-1));
function readPlaybackPreferences(){
 const prefs={rate:1,volume:1,muted:false};
 try{
  const rate=Number(localStorage.getItem("tactic-playback-rate"));
  const volume=Number(localStorage.getItem("tactic-playback-volume"));
  if([0.75,1,1.25,1.5,2].includes(rate))prefs.rate=rate;
  if(Number.isFinite(volume)&&volume>=0&&volume<=1)prefs.volume=volume;
  prefs.muted=localStorage.getItem("tactic-playback-muted")==="true";
 }catch{}
 return prefs;
}
function applyPlaybackPreferences(){
 const prefs=readPlaybackPreferences();
 video.playbackRate=prefs.rate;
 video.volume=prefs.volume;
 video.muted=prefs.muted;
 const selector=$("#playbackSpeed");
 if(selector)selector.value=String(prefs.rate);
}
function updateAutoNextButton(){const btn=$("#autoNextToggle");if(!btn)return;btn.textContent="Putar otomatis: "+(autoNextEnabled?"Aktif":"Nonaktif");btn.setAttribute("aria-pressed",String(autoNextEnabled))}
$("#autoNextToggle").addEventListener("click",()=>{autoNextEnabled=!autoNextEnabled;try{localStorage.setItem("tactic-auto-next",String(autoNextEnabled))}catch{}updateAutoNextButton();if(activeDrama)$("#playerDescription").textContent="Episode "+(activeDrama.episodes?.[activeEpisodeIndex]?.episode_number||"")+" · "+(activeEpisodeIndex<(activeDrama.episodes||[]).length-1?(autoNextEnabled?"Putar otomatis aktif":"Putar otomatis nonaktif"):"Ini episode terbaru")});
const playbackSpeed=$("#playbackSpeed");
if(playbackSpeed)playbackSpeed.addEventListener("change",()=>{const rate=Number(playbackSpeed.value);if(![0.75,1,1.25,1.5,2].includes(rate))return;video.playbackRate=rate;try{localStorage.setItem("tactic-playback-rate",String(rate))}catch{}});
video.addEventListener("volumechange",()=>{try{localStorage.setItem("tactic-playback-volume",String(video.volume));localStorage.setItem("tactic-playback-muted",String(video.muted))}catch{}});
applyPlaybackPreferences();
updateAutoNextButton();
$("#nextEpisode").addEventListener("click",()=>playEpisode(activeEpisodeIndex+1));
let swipeStart=null;
video.addEventListener("touchstart",event=>{
 if(event.touches.length!==1){swipeStart=null;return}
 const touch=event.touches[0];swipeStart={x:touch.clientX,y:touch.clientY};
},{passive:true});
video.addEventListener("touchend",event=>{
 if(!swipeStart||event.changedTouches.length!==1){swipeStart=null;return}
 const touch=event.changedTouches[0],deltaX=touch.clientX-swipeStart.x,deltaY=swipeStart.y-touch.clientY;
 swipeStart=null;
 if(!$("#playerEpisodeDrawer").hidden||!$("#playerCommentsDrawer").hidden)return;
 if(Math.abs(deltaY)<65||Math.abs(deltaY)<Math.abs(deltaX)*1.25)return;
 const nextIndex=activeEpisodeIndex+(deltaY>0?1:-1);
 if(nextIndex<0||nextIndex>=(activeDrama?.episodes?.length||0))return;
 playEpisode(nextIndex);showPlayerControls();
},{passive:true});
video.addEventListener("touchcancel",()=>{swipeStart=null},{passive:true});

function persistCurrentPlayback(){if(!activeDrama||!video.currentTime||!Number.isFinite(video.currentTime))return;const ep=activeDrama.episodes?.[activeEpisodeIndex];if(ep?.id){saveWatchHistory(ep,video.currentTime);lastHistoryPersist=Date.now()}}
video.addEventListener("timeupdate",()=>{if(Date.now()-lastHistoryPersist<5000)return;persistCurrentPlayback()});
video.addEventListener("pause",persistCurrentPlayback);
window.addEventListener("pagehide",persistCurrentPlayback);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){persistCurrentPlayback();saveEpisodeProgress(true)}});

let pendingViewListener=null;
function recordEpisodeView(ep){
 if(!supa||!activeDrama||String(activeDrama.id).startsWith("demo-")||!ep?.id)return;
 if(pendingViewListener)video.removeEventListener("timeupdate",pendingViewListener);
 const dramaId=activeDrama.id,episodeId=ep.id;
 let watchedSeconds=0,lastMediaTime=video.currentTime;
 const onTimeUpdate=()=>{
  const current=video.currentTime,delta=current-lastMediaTime;
  if(!video.paused&&!video.seeking&&delta>0&&delta<=2.5)watchedSeconds+=delta;
  lastMediaTime=current;
  if(watchedSeconds>=10){
   video.removeEventListener("timeupdate",onTimeUpdate);pendingViewListener=null;
   supa.functions.invoke("record-episode-view",{body:{drama_id:dramaId,episode_id:episodeId}})
    .then(({error})=>{if(error)console.warn("Pencatatan penayangan gagal:",error.message)})
    .catch(error=>console.warn("Pencatatan penayangan gagal:",error?.message||error));
  }
 };
 pendingViewListener=onTimeUpdate;
 video.addEventListener("timeupdate",onTimeUpdate);
}
async function loadUserFavorites(){
 if(!supa)return;
 try{
  const {data:sessionData}=await supa.auth.getSession(),user=sessionData?.session?.user;
  if(!user){favoriteIds=new Set([...favoriteIds].filter(id=>String(id).startsWith("demo-")));favoritesLoadedFor=null;syncPlayerActionRail();return}
  const demoIds=[...favoriteIds].filter(id=>String(id).startsWith("demo-"));
  const legacyIds=[...favoriteIds].filter(id=>!String(id).startsWith("demo-")&&dramas.some(d=>String(d.id)===String(id)));
  if(legacyIds.length){const imported=await supa.from("drama_favorites").upsert(legacyIds.map(drama_id=>({drama_id})),{onConflict:"drama_id,user_id",ignoreDuplicates:true});if(imported.error)console.warn("Favorit lokal lama belum dapat disinkronkan:",imported.error.message)}
  const [ownResult,countResult]=await Promise.all([supa.from("drama_favorites").select("drama_id").eq("user_id",user.id),supa.from("drama_favorite_counts").select("drama_id,favorite_count")]);
  if(ownResult.error)throw ownResult.error;if(countResult.error)throw countResult.error;
  favoriteIds=new Set([...demoIds,...(ownResult.data||[]).map(row=>String(row.drama_id))]);favoriteCounts=new Map((countResult.data||[]).map(row=>[String(row.drama_id),Number(row.favorite_count||0)]));favoritesLoadedFor=user.id;
  try{localStorage.setItem("tactic-favorites",JSON.stringify(demoIds))}catch{}
  dramas.forEach(d=>{d.favorite_count=favoriteCounts.get(String(d.id))||0});syncPlayerActionRail();render();
  if($("#profilePanel")&&!$("#profilePanel").hidden)renderProfileCollections();
 }catch(error){console.warn("Favorit akun belum dapat dimuat:",error?.message||error)}
}
async function loadDramaFavoriteState(dramaId){
 const id=String(dramaId);if(!supa||id.startsWith("demo-")){syncPlayerActionRail();return}
 try{
  const [{data:count,error:countError},{data:sessionData}]=await Promise.all([supa.from("drama_favorite_counts").select("favorite_count").eq("drama_id",id).maybeSingle(),supa.auth.getSession()]);
  if(countError)throw countError;const user=sessionData?.session?.user;let saved=false;
  if(user){const own=await supa.from("drama_favorites").select("drama_id").eq("drama_id",id).eq("user_id",user.id).maybeSingle();if(own.error)throw own.error;saved=Boolean(own.data)}
  if(saved)favoriteIds.add(id);else favoriteIds.delete(id);
  const total=Number(count?.favorite_count||0);favoriteCounts.set(id,total);const drama=dramas.find(item=>String(item.id)===id);if(drama)drama.favorite_count=total;syncPlayerActionRail();
 }catch(error){const count=$("#playerFavoriteRailCount");if(count)count.textContent="—";console.warn("Jumlah favorit belum dapat dimuat:",error?.message||error)}
}
async function toggleDramaFavorite(drama){
 if(!drama)return;const id=String(drama.id);
 if(id.startsWith("demo-")){if(favoriteIds.has(id))favoriteIds.delete(id);else favoriteIds.add(id);try{localStorage.setItem("tactic-favorites",JSON.stringify([...favoriteIds].filter(value=>String(value).startsWith("demo-"))))}catch{}syncPlayerActionRail();renderProfileCollections?.();render();return}
 if(!supa){setStatus("#reportStatus","Favorit online belum tersambung.");return}
 const {data:sessionData}=await supa.auth.getSession(),user=sessionData?.session?.user;
 if(!user){setStatus("#reportStatus","Masuk ke akun untuk menyimpan favorit.");if(admin&&!admin.open)admin.showModal();return}
 const wasSaved=favoriteIds.has(id),button=$("#playerFavoriteAction");if(button)button.disabled=true;
 try{const result=wasSaved?await supa.from("drama_favorites").delete().eq("drama_id",id).eq("user_id",user.id):await supa.from("drama_favorites").insert({drama_id:id});if(result.error)throw result.error;await loadDramaFavoriteState(id);renderProfileCollections?.();render()}
 catch(error){setStatus("#reportStatus","Gagal memperbarui favorit: "+(error?.message||String(error)))}
 finally{if(button)button.disabled=false}
}
async function loadDramaLikeState(dramaId){
 const btn=$("#likeDrama");if(!btn)return;
 if(String(dramaId).startsWith("demo-")){
  const liked=demoLikedIds.has(String(dramaId)),count=liked?1:0;
  btn.hidden=false;btn.disabled=false;btn.dataset.liked=String(liked);btn.setAttribute("aria-pressed",String(liked));
  btn.textContent=(liked?"♥ Disukai · ":"♡ Suka · ")+count;
  const railLikeCount=$("#playerLikeRailCount");if(railLikeCount)railLikeCount.textContent=String(count);
  syncPlayerActionRail();return;
 }
 if(!supa){btn.hidden=false;btn.disabled=true;btn.dataset.liked="false";btn.textContent="♡ Suka · —";const railLikeCount=$("#playerLikeRailCount");if(railLikeCount)railLikeCount.textContent="—";syncPlayerActionRail();return}
 btn.hidden=false;btn.disabled=true;syncPlayerActionRail();
 try{
  const countResult=await supa.from("drama_like_counts").select("like_count").eq("drama_id",dramaId).maybeSingle();
  if(countResult.error)throw countResult.error;
  const {data:sessionData}=await supa.auth.getSession(),user=sessionData?.session?.user;
  let liked=false;
  if(user){const own=await supa.from("drama_likes").select("drama_id").eq("drama_id",dramaId).eq("user_id",user.id).maybeSingle();if(own.error)throw own.error;liked=Boolean(own.data)}
  const likeCount=Number(countResult.data?.like_count||0);
  const railLikeCount=$("#playerLikeRailCount");if(railLikeCount)railLikeCount.textContent=likeCount.toLocaleString("id-ID");
  btn.dataset.liked=String(liked);btn.setAttribute("aria-pressed",String(liked));
  btn.textContent=(liked?"♥ Disukai · ":"♡ Suka · ")+likeCount;
  const catalogDrama=dramas.find(item=>String(item.id)===String(dramaId));if(catalogDrama)catalogDrama.like_count=likeCount;
 }catch(err){btn.textContent="♡ Suka";const railLikeCount=$("#playerLikeRailCount");if(railLikeCount)railLikeCount.textContent="—";console.warn("Jumlah suka belum dapat dimuat:",err?.message||err)}
 finally{btn.disabled=false;syncPlayerActionRail()}
}
let authCheckSequence=0;
async function verifySession(session){
 const check=++authCheckSequence;activePlaybackUserId=session?.user?.id||null;document.body.classList.remove("admin-mode");
 if(session)hideGuestPrompt();
 const profileTitle=$("#profileAccountTitle"),profileDescription=$("#profileAccountDescription"),profileEmail=$("#profileEmail"),profileLogin=$("#profileLoginBtn"),profileLogout=$("#profileLogoutBtn"),profileAvatar=$("#profileAvatar"),profileSince=$("#profileSince");
 if(profileAvatar){const email=session?.user?.email||"";profileAvatar.textContent=(email.split("@")[0].trim().charAt(0)||"T").toUpperCase()}
 if(profileSince){const created=session?.user?.created_at?new Date(session.user.created_at):null;const days=created?Math.max(0,Math.floor((Date.now()-created.getTime())/86400000)):null;profileSince.textContent=session?(days===null?"Penonton TacTic Drama":days+" hari bersama TacTic Drama"):"Nikmati drama bersama TacTic Drama"}
 if(profileTitle){profileTitle.textContent=session?"Memeriksa akun…":"Mode tamu";profileDescription.textContent=session?"Memeriksa status akunmu.":"Masuk untuk mengelola akun penontonmu.";profileEmail.textContent=session?.user?.email||"Kamu sedang menonton sebagai tamu.";profileLogin.hidden=!!session;if(profileLogout)profileLogout.hidden=true}
 const panel=$("#uploadSection"),adminTab=$("#adminUploadTab");panel.hidden=true;panel.removeAttribute("data-admin");if(adminTab)adminTab.hidden=true;$("#viewerAccount").hidden=true;$("#moderationSection").hidden=true;setAuthMode("login");$("#resetPasswordForm").hidden=true;
 if(!session||!supa)return;
 loadCloudPlayback(session.user.id);
 let isAdmin=false,checkError=null;
 const rpc=await supa.rpc("is_admin");
 if(check!==authCheckSequence)return;
 if(!rpc.error)isAdmin=rpc.data===true;else checkError=rpc.error;
 if(!isAdmin){
  const role=await supa.from("user_roles").select("role").eq("user_id",session.user.id).maybeSingle();
  if(check!==authCheckSequence)return;
  if(role.error)checkError=role.error;else isAdmin=role.data?.role==="admin";
 }
 if(check!==authCheckSequence)return;
 // Apply the latest Supabase profile metadata to viewer and admin profile surfaces.
 renderViewerProfile(session.user);
 if(isAdmin){
  document.body.classList.add("admin-mode");
  if(profileTitle){profileTitle.textContent="Admin TacTic";profileDescription.textContent="Akun administrator aktif. Kamu dapat mengelola katalog drama resmi.";profileEmail.textContent=session.user.email||""}
  panel.dataset.admin="true";panel.hidden=true;
  const profilePanel=$("#profilePanel");if(profilePanel&&panel.parentElement!==profilePanel)profilePanel.append(panel);
  if(adminTab)adminTab.hidden=false;
  $("#loginForm").hidden=true;$("#signupForm").hidden=true;$("#moderationSection").hidden=false;
  $("#adminIdentity").textContent="Admin masuk sebagai "+session.user.email;
  setStatus("#loginStatus","Hak admin terverifikasi. Tab Upload tersedia di Profil.");
  if(admin.open)admin.close();
  activeTab="clips";setActiveNav("clips");render();loadAdminDramas(session.user.id);loadModeration();return;
 }
 renderViewerProfile(session.user);$("#viewerAccount").hidden=false;$("#viewerEmail").textContent=session.user.email||"Akun penonton aktif";
 if(profileTitle){profileTitle.textContent="Akun penonton aktif";profileDescription.textContent="Akunmu sudah terhubung dan siap digunakan.";profileEmail.textContent=session.user.email||"Akun penonton aktif"}
 $("#loginForm").hidden=true;$("#signupForm").hidden=true;$("#forgotPasswordBtn").hidden=true;$("#resendConfirmationBtn").hidden=true;
 setStatus("#loginStatus",checkError?"Tidak dapat memverifikasi hak admin: "+checkError.message:"Login berhasil. Akun penonton aktif.");
}async function editAdminDrama(drama,userId){const title=window.prompt("Ubah judul drama:",drama.title);if(title===null)return;if(!title.trim()){setStatus("#loginStatus","Judul drama tidak boleh kosong.");return}const description=window.prompt("Ubah deskripsi drama:",drama.description||"");if(description===null)return;const {data,error}=await supa.from("dramas").update({title:title.trim().slice(0,120),description:description.trim().slice(0,2000)}).eq("id",drama.id).eq("uploader_id",userId).select("id").maybeSingle();if(error){setStatus("#loginStatus","Gagal mengubah drama: "+error.message);return}if(!data){setStatus("#loginStatus","Drama tidak berubah. Pastikan akun memiliki akses edit.");return}setStatus("#loginStatus","Judul dan deskripsi drama berhasil diperbarui.");await loadAdminDramas(userId);await loadCatalog()}
$("#guestPromptLogin").addEventListener("click",()=>{hideGuestPrompt();admin.showModal()});
$("#guestPromptContinue").addEventListener("click",hideGuestPrompt);
$("#openAdmin")?.addEventListener("click",()=>admin.showModal());
$("#profileLoginBtn").addEventListener("click",()=>admin.showModal());
document.querySelectorAll("[data-profile-tab]").forEach(button=>button.addEventListener("click",()=>{collectionView=button.dataset.profileTab;activeTab="collection";setActiveNav("collection");render();window.scrollTo({top:0,behavior:"smooth"})}));
document.querySelectorAll("[data-profile-view]").forEach(button=>button.addEventListener("click",()=>{profileCollectionView=button.dataset.profileView;renderProfileCollections()}));
document.querySelectorAll("[data-profile-filter]").forEach(button=>button.addEventListener("click",()=>{profileHistoryFilter=button.dataset.profileFilter;renderProfileCollections()}));

const profileSettingsDialog=$("#profileSettingsDialog");
const logoutConfirmDialog=$("#logoutConfirmDialog");
function openLogoutConfirmation(){if(logoutConfirmDialog&&!logoutConfirmDialog.open)logoutConfirmDialog.showModal()}
function openProfileSettings(){
 const email=$("#profileEmail")?.textContent||"";
 const title=$("#profileTitle")?.textContent||"Penonton TacTic";
 const signedIn=!!(supa&&email&&email!=="Kamu sedang menonton sebagai tamu.");
 $("#settingsAccountName").textContent=title;
 $("#settingsAccountEmail").textContent=email;
 // Keep the avatar rendered from the current Supabase user metadata.
 $("#settingsAccountStatus").textContent=signedIn?"Akun penonton aktif":"Kamu sedang menggunakan mode tamu";
 $("#settingsLoginButton").hidden=signedIn;
 $("#settingsLogoutButton").hidden=!signedIn;
 $("#profileSettingsNotice").textContent="Bahasa Indonesia aktif. Menu bantuan dan privasi akan dilengkapi bertahap.";
 if(profileSettingsDialog&&!profileSettingsDialog.open)profileSettingsDialog.showModal();
}
$("#profileSettingsBtn")?.addEventListener("click",openProfileSettings);
$("#closeProfileSettings")?.addEventListener("click",()=>profileSettingsDialog?.close());
$("#closeProfileSettingsBottom")?.addEventListener("click",()=>profileSettingsDialog?.close());
const editViewerProfileDialog=$("#editViewerProfileDialog");
const editViewerProfileForm=$("#editViewerProfileForm");
const editViewerAvatarInput=$("#editViewerAvatarInput");
const editViewerAvatarPreview=$("#editViewerAvatarPreview");
let editViewerAvatarObjectUrl=null,editViewerSelectedAvatar=null;
function paintViewerAvatar(element,user,name){
 if(!element)return;
 const url=user?.user_metadata?.avatar_url||"";
 element.replaceChildren();
 if(url){const img=document.createElement("img");img.src=url;img.alt="Foto profil";img.loading="lazy";img.onerror=()=>{element.textContent=(name||"T").trim().charAt(0).toUpperCase()||"T"};element.append(img)}
 else element.textContent=(name||"T").trim().charAt(0).toUpperCase()||"T";
}
function renderViewerProfile(user){
 const meta=user?.user_metadata||{},name=String(meta.display_name||"").trim()||"Penonton TacTic";
 const title=$("#profileTitle");if(title)title.textContent=name;
 paintViewerAvatar($("#profileAvatar"),user,name);
 paintViewerAvatar($("#settingsAccountAvatar"),user,name);
 const accountName=$("#settingsAccountName");if(accountName)accountName.textContent=name;
}
function resetViewerAvatarPreview(){
 if(editViewerAvatarObjectUrl){URL.revokeObjectURL(editViewerAvatarObjectUrl);editViewerAvatarObjectUrl=null}
 editViewerSelectedAvatar=null;if(editViewerAvatarInput)editViewerAvatarInput.value="";
}
function openEditViewerProfile(){
 if(!supa){$("#editViewerProfileStatus").textContent="Layanan akun belum siap. Coba lagi nanti.";return}
 supa.auth.getUser().then(({data,error})=>{
  if(error||!data.user){editViewerProfileDialog?.close();profileSettingsDialog?.close();admin.showModal();return}
  const user=data.user,meta=user.user_metadata||{};
  $("#editViewerProfileEmail").textContent=user.email||"Email tidak tersedia";
  $("#editViewerDisplayName").value=String(meta.display_name||"").slice(0,40);
  $("#editViewerNameCount").textContent=$("#editViewerDisplayName").value.length+"/40 karakter";
  paintViewerAvatar(editViewerAvatarPreview,user,meta.display_name||"T");
  resetViewerAvatarPreview();
  if(editViewerProfileDialog&&!editViewerProfileDialog.open)editViewerProfileDialog.showModal();
 });
}

$("#sendPasswordRecoveryButton")?.addEventListener("click",async()=>{
 const button=$("#sendPasswordRecoveryButton"),status=$("#accountSecurityStatus");
 if(!supa){status.textContent="Layanan akun belum siap. Coba lagi nanti.";return}
 button.disabled=true;status.textContent="Memeriksa email akun...";
 try{
  const {data,error:userError}=await supa.auth.getUser();
  if(userError)throw userError;
  const email=data.user?.email;
  if(!email)throw new Error("Email akun tidak ditemukan. Silakan masuk kembali.");
  const {error}=await supa.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(error)throw error;
  status.textContent="Tautan pemulihan sudah diminta untuk "+email+". Periksa kotak masuk dan folder Spam.";
  button.textContent="Kirim ulang tautan";
 }catch(err){status.textContent="Tidak dapat mengirim tautan: "+(err?.message||String(err))}
 finally{button.disabled=false}
});
$("#closeEditViewerProfile")?.addEventListener("click",()=>{editViewerProfileDialog?.close();resetViewerAvatarPreview()});
$("#editViewerDisplayName")?.addEventListener("input",e=>{$("#editViewerNameCount").textContent=e.currentTarget.value.length+"/40 karakter"});
editViewerAvatarInput?.addEventListener("change",()=>{
 const file=editViewerAvatarInput.files?.[0];if(!file)return;
 if(file.size>2*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){
  $("#editViewerProfileStatus").textContent=file.size>2*1024*1024?"Foto profil maksimal 2 MB.":"Format foto harus JPG, PNG, atau WebP.";
  editViewerAvatarInput.value="";return;
 }
 if(editViewerAvatarObjectUrl)URL.revokeObjectURL(editViewerAvatarObjectUrl);
 editViewerAvatarObjectUrl=URL.createObjectURL(file);editViewerSelectedAvatar=file;
 editViewerAvatarPreview.replaceChildren();const img=document.createElement("img");img.src=editViewerAvatarObjectUrl;img.alt="Pratinjau foto profil";editViewerAvatarPreview.append(img);
 $("#editViewerProfileStatus").textContent="Pratinjau foto siap. Tekan Simpan perubahan.";
});
editViewerProfileForm?.addEventListener("submit",async e=>{
 e.preventDefault();if(!supa)return;
 const name=$("#editViewerDisplayName").value.trim(),button=$("#saveViewerProfileButton");
 if(!name){$("#editViewerProfileStatus").textContent="Nama tampilan wajib diisi.";return}
 if(name.length>40){$("#editViewerProfileStatus").textContent="Nama maksimal 40 karakter.";return}
 const file=editViewerSelectedAvatar;
 if(file&&(file.size>2*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type))){$("#editViewerProfileStatus").textContent="Pilih foto JPG, PNG, atau WebP maksimal 2 MB.";return}
 button.disabled=true;$("#editViewerProfileStatus").textContent="Menyimpan profil...";
 let uploadedPath=null;
 try{
  const {data:sessionData,error:sessionError}=await supa.auth.getSession();
  if(sessionError)throw sessionError;
  const user=sessionData.session?.user;if(!user)throw new Error("Sesi login berakhir. Silakan masuk kembali.");
  const oldAvatar=user.user_metadata?.avatar_url||null;let avatarUrl=oldAvatar;
  if(file){
   const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[file.type];
   uploadedPath=user.id+"/viewer-avatar-"+crypto.randomUUID()+"."+ext;
   const uploaded=await supa.storage.from("drama-posters").upload(uploadedPath,file,{contentType:file.type,upsert:false});
   if(uploaded.error)throw uploaded.error;
   avatarUrl=supa.storage.from("drama-posters").getPublicUrl(uploadedPath).data.publicUrl;
  }
  const updated=await supa.auth.updateUser({data:{display_name:name,avatar_url:avatarUrl}});
  if(updated.error)throw updated.error;
  const savedUser=updated.data.user||{...user,user_metadata:{...(user.user_metadata||{}),display_name:name,avatar_url:avatarUrl}};
  renderViewerProfile(savedUser);
  if(oldAvatar&&avatarUrl!==oldAvatar){const oldPath=storagePathFromPublicUrl(oldAvatar,"drama-posters");if(oldPath&&oldPath.startsWith(user.id+"/"))await removeOwnedStorageFiles("drama-posters",[oldPath])}
  $("#editViewerProfileStatus").textContent="Profil berhasil diperbarui.";
  resetViewerAvatarPreview();
  setTimeout(()=>editViewerProfileDialog?.close(),650);
 }catch(err){
  if(uploadedPath){try{await removeOwnedStorageFiles("drama-posters",[uploadedPath])}catch{}}
  $("#editViewerProfileStatus").textContent="Gagal menyimpan profil: "+(err?.message||String(err));
 }finally{button.disabled=false}
});
const vipInfoDialog=$("#vipInfoDialog");
async function loadVipDashboard(){
 const title=$("#vipMembershipStatusTitle"),detail=$("#vipMembershipStatusText"),pill=$("#vipMembershipStatusPill"),history=$("#vipTransactionList");
 if(!title||!detail||!pill||!history)return;
 const showEmpty=(heading,message)=>{history.className="vip-empty-transactions";history.innerHTML='<span>▤</span><p><strong>'+escapeHtml(heading)+'</strong><small>'+escapeHtml(message)+'</small></p>'};
 if(!supa){title.textContent="Belum terhubung";detail.textContent="Koneksi akun belum tersedia.";pill.textContent="OFFLINE";showEmpty("Riwayat belum tersedia","Hubungkan akun untuk melihat transaksi VIP.");return}
 title.textContent="Memeriksa status...";detail.textContent="Mengambil status keanggotaan akun.";pill.textContent="...";
 try{
  const {data:userData,error:userError}=await supa.auth.getUser();
  if(userError)throw userError;
  const currentUser=userData?.user;
  if(!currentUser){title.textContent="Masuk diperlukan";detail.textContent="Masuk ke akun untuk melihat status VIP.";pill.textContent="TAMU";showEmpty("Masuk untuk melihat riwayat","Riwayat transaksi hanya tersedia untuk akun yang masuk.");return}
  const [membershipResult,transactionsResult]=await Promise.all([
   supa.from("vip_memberships").select("plan_code,status,current_period_start,current_period_end,updated_at").eq("user_id",currentUser.id).maybeSingle(),
   supa.from("vip_transactions").select("plan_code,duration_days,amount_minor,currency,status,created_at,paid_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(10)
  ]);
  if(membershipResult.error)throw membershipResult.error;
  if(transactionsResult.error)throw transactionsResult.error;
  const membership=membershipResult.data;
  const active=membership?.status==="active"&&membership.current_period_end&&new Date(membership.current_period_end).getTime()>Date.now();
  if(active){
   title.textContent="VIP sedang aktif";
   detail.textContent="Berlaku sampai "+new Date(membership.current_period_end).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})+".";
   pill.textContent="VIP AKTIF";
  }else if(membership?.status==="suspended"){
   title.textContent="Keanggotaan ditangguhkan";detail.textContent="Hubungi bantuan jika kamu merasa ini keliru.";pill.textContent="DITANGGUHKAN";
  }else{
   title.textContent=membership?.status==="refunded"?"Keanggotaan dikembalikan":"Belum berlangganan";
   detail.textContent=membership?.current_period_end&&new Date(membership.current_period_end).getTime()<=Date.now()?"Masa aktif VIP telah berakhir.":"VIP aktif setelah pembayaran berhasil diverifikasi.";
   pill.textContent="NON-VIP";
  }
  const rows=transactionsResult.data||[];
  if(!rows.length){showEmpty("Belum ada transaksi","Riwayat pembayaran VIP akan muncul di sini setelah transaksi dibuat.");return}
  const statusLabels={pending:"Menunggu pembayaran",paid:"Berhasil",expired:"Kedaluwarsa",failed:"Gagal",refunded:"Dikembalikan"};
  const planLabels={vip_1m:"VIP 1 Bulan",vip_3m:"VIP 3 Bulan",vip_12m:"VIP 12 Bulan"};
  history.className="vip-transaction-list";
  history.innerHTML=rows.map(row=>{
   const amount=new Intl.NumberFormat("id-ID",{style:"currency",currency:row.currency||"IDR",maximumFractionDigits:0}).format(Number(row.amount_minor||0));
   const date=new Date(row.created_at).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
   return '<article class="vip-transaction-item"><div><strong>'+escapeHtml(planLabels[row.plan_code]||"Paket VIP")+'</strong><small>'+escapeHtml(date)+' · '+escapeHtml(statusLabels[row.status]||"Status tidak diketahui")+'</small></div><b>'+escapeHtml(amount)+'</b></article>';
  }).join("");
 }catch(error){
  title.textContent="Status belum dapat dimuat";detail.textContent="Coba buka kembali halaman ini beberapa saat lagi.";pill.textContent="PERIKSA";
  showEmpty("Riwayat belum dapat dimuat",error?.message||"Terjadi kendala saat mengambil data.");
 }
}
$("#openVipInfo")?.addEventListener("click",()=>{if(vipInfoDialog&&!vipInfoDialog.open)vipInfoDialog.showModal();loadVipDashboard()});
$("#closeVipInfo")?.addEventListener("click",()=>vipInfoDialog?.close());
$("#closeVipInfoBottom")?.addEventListener("click",()=>vipInfoDialog?.close());
const settingsInfoDialog=$("#settingsInfoDialog");
function showSettingsInfo(title,subtitle,body){
 $("#settingsInfoTitle").textContent=title;
 $("#settingsInfoSubtitle").textContent=subtitle;
 $("#settingsInfoBody").innerHTML=body;
 if(settingsInfoDialog&&!settingsInfoDialog.open)settingsInfoDialog.showModal();
}
$("#settingsAccountRow")?.addEventListener("click",()=>{
 profileSettingsDialog?.close();
 openEditViewerProfile();
});
$("#settingsLanguageRow")?.addEventListener("click",()=>showSettingsInfo("Bahasa aplikasi","Preferensi bahasa",'<p><strong>Bahasa Indonesia</strong> adalah bahasa yang saat ini tersedia.</p><p>Dukungan bahasa lain akan ditambahkan pada pembaruan berikutnya.</p>'));
$("#settingsHelpRow")?.addEventListener("click",()=>showSettingsInfo("Pusat bantuan","Bantuan penggunaan TacTic Drama",'<h3>Bagaimana cara menonton?</h3><p>Pilih drama dari Beranda atau Cuplikan, lalu tekan tombol tonton untuk membuka episode.</p><h3>Bagaimana menyimpan drama?</h3><p>Tekan tombol Favorit pada halaman drama. Daftar favorit dapat ditemukan di menu Koleksi.</p><h3>Bagaimana jika video tidak diputar?</h3><p>Periksa koneksi internet, lalu coba muat ulang halaman atau tekan tombol Coba lagi pada pemutar.</p><p>Fitur kontak bantuan langsung akan tersedia pada pembaruan berikutnya.</p>'));
$("#settingsPrivacyRow")?.addEventListener("click",()=>showSettingsInfo("Privasi dan keamanan","Pengelolaan data penonton",'<p>TacTic Drama menggunakan informasi akun untuk proses masuk dan menyinkronkan fitur yang memerlukan akun.</p><p>Riwayat tontonan dan preferensi tertentu dapat tersimpan di perangkat ini agar pengalaman menonton berlanjut.</p><p>Jangan bagikan kata sandi atau kode verifikasi kepada siapa pun. Keluar dari akun jika menggunakan perangkat bersama.</p><p>Kebijakan privasi lengkap akan ditampilkan sebelum layanan dirilis secara publik.</p>'));
$("#closeSettingsInfo")?.addEventListener("click",()=>settingsInfoDialog?.close());
$("#closeSettingsInfoBottom")?.addEventListener("click",()=>settingsInfoDialog?.close());
$("#settingsLoginButton")?.addEventListener("click",()=>{profileSettingsDialog?.close();admin.showModal()});
$("#settingsLogoutButton")?.addEventListener("click",openLogoutConfirmation);
$("#cancelLogoutButton")?.addEventListener("click",()=>logoutConfirmDialog?.close());
$("#confirmLogoutButton")?.addEventListener("click",async()=>{const button=$("#confirmLogoutButton");button.disabled=true;button.textContent="Sedang keluar...";try{await signOutViewer();logoutConfirmDialog?.close();profileSettingsDialog?.close();editViewerProfileDialog?.close()}catch(error){const p=logoutConfirmDialog?.querySelector("p");if(p)p.textContent="Gagal keluar: "+(error?.message||String(error))}finally{button.disabled=false;button.textContent="Ya, keluar"}});


function storagePathFromPublicUrl(url,bucket){if(!url)return null;try{const u=new URL(url);const marker="/storage/v1/object/public/"+bucket+"/";const at=u.pathname.indexOf(marker);return at<0?null:decodeURIComponent(u.pathname.slice(at+marker.length))}catch{return null}}
async function removeOwnedStorageFiles(bucket,paths){const clean=[...new Set(paths.filter(Boolean))];if(!clean.length)return;const {error}=await supa.storage.from(bucket).remove(clean);if(error)throw error}
async function editAdminEpisode(drama,ep,userId){
 const numberInput=window.prompt("Ubah nomor episode:",String(ep.episode_number));if(numberInput===null)return;
 const episodeNumber=Number(numberInput);if(!Number.isInteger(episodeNumber)||episodeNumber<1){setStatus("#uploadStatus","Nomor episode harus bilangan bulat positif.");return}
 const title=window.prompt("Ubah judul episode:",ep.title||"");if(title===null)return;
 try{
  const duplicate=await supa.from("episodes").select("id").eq("drama_id",drama.id).eq("episode_number",episodeNumber).neq("id",ep.id).maybeSingle();
  if(duplicate.error)throw duplicate.error;if(duplicate.data){setStatus("#uploadStatus","Nomor episode tersebut sudah dipakai.");return}
  const result=await supa.from("episodes").update({episode_number:episodeNumber,title:title.trim().slice(0,120)}).eq("id",ep.id).eq("uploader_id",userId).select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data)throw new Error("Akun ini tidak memiliki izin mengubah episode tersebut.");
  setStatus("#uploadStatus","Episode berhasil diperbarui.");await loadCatalog();await loadAdminDramas(userId)
 }catch(err){setStatus("#uploadStatus","Gagal mengubah episode: "+(err?.message||String(err)))}
}
async function deleteAdminEpisode(drama,ep,userId){if(!confirm("Hapus episode "+ep.episode_number+" dari drama "+drama.title+"? Video episode ini juga akan dihapus permanen."))return;try{await removeOwnedStorageFiles("drama-videos",[ep.video_path,ep.subtitle_path]);const {error}=await supa.from("episodes").delete().eq("id",ep.id).eq("drama_id",drama.id).eq("uploader_id",userId);if(error)throw error;setStatus("#uploadStatus","Episode "+ep.episode_number+" berhasil dihapus.");await loadCatalog();await loadAdminDramas(userId)}catch(err){setStatus("#uploadStatus","Episode belum berhasil dihapus: "+(err?.message||String(err)))}}
async function deleteAdminDrama(drama,userId){const eps=drama.episodes||[];if(!confirm("Hapus drama “"+drama.title+"” beserta "+eps.length+" episode? Tindakan ini permanen."))return;try{await removeOwnedStorageFiles("drama-videos",eps.flatMap(ep=>[ep.video_path,ep.subtitle_path]));const posterPath=storagePathFromPublicUrl(drama.poster_url,"drama-posters");await removeOwnedStorageFiles("drama-posters",[posterPath]);const {error}=await supa.from("dramas").delete().eq("id",drama.id).eq("uploader_id",userId);if(error)throw error;setStatus("#uploadStatus","Drama dan seluruh episode berhasil dihapus.");if(activeDrama?.id===drama.id){video.pause();video.removeAttribute("src");player.close();activeDrama=null}await loadCatalog();await loadAdminDramas(userId)}catch(err){setStatus("#uploadStatus","Drama belum berhasil dihapus: "+(err?.message||String(err))+". Jika file sudah terhapus, muat ulang daftar dan coba periksa kembali.")}}
async function loadAdminDramas(userId){
 const list=$("#myDramaList"),count=$("#adminDramaCount"),target=$("#targetDrama");
 if(!list||!supa)return;
 list.textContent="Memuat series…";
 const {data,error}=await supa.from("dramas").select("id,title,description,poster_url,status,created_at,episodes(id,episode_number,title,video_path,subtitle_path,status)").eq("uploader_id",userId).order("created_at",{ascending:false});
 if(error){list.textContent="Daftar series belum dapat dimuat: "+error.message;if(count)count.textContent="—";return}
 const seriesList=data||[];
 if(count)count.textContent=seriesList.length+" series";
 if(target){
  const selected=target.value;
  target.innerHTML='<option value="">＋ Buat series baru</option>';
  seriesList.filter(d=>d.status==="approved").forEach(d=>{const option=document.createElement("option");option.value=d.id;option.textContent=d.title+" · "+(d.episodes||[]).length+" eps";target.append(option)});
  target.value=selected;
  syncTargetForm();
 }
 list.innerHTML="";
 if(!seriesList.length){const empty=document.createElement("p");empty.className="notice";empty.textContent="Belum ada series. Buat series pertama lewat formulir di bawah.";list.append(empty);return}
 for(const d of seriesList){
  const eps=[...(d.episodes||[])].sort((x,y)=>Number(x.episode_number)-Number(y.episode_number));
  const card=document.createElement("article");card.className="admin-series-card";
  const top=document.createElement("div");top.className="admin-series-top";
  const cover=document.createElement("div");cover.className="admin-series-cover";
  if(d.poster_url){const img=document.createElement("img");img.src=d.poster_url;img.alt="";img.loading="lazy";cover.append(img)}else cover.textContent="T";
  const info=document.createElement("div");info.className="admin-series-info";
  const title=document.createElement("strong");title.textContent=d.title;
  const meta=document.createElement("span");meta.textContent=eps.length+" episode · "+(d.status==="approved"?"Tayang":d.status==="rejected"?"Disembunyikan":"Status: "+d.status);
  const date=document.createElement("small");date.textContent=d.created_at?new Date(d.created_at).toLocaleDateString("id-ID"):"";
  info.append(title,meta,date);top.append(cover,info);card.append(top);
  const actions=document.createElement("div");actions.className="admin-series-actions";
  const add=document.createElement("button");add.className="primary-btn";add.type="button";add.textContent="+ Tambah episode";
  add.disabled=d.status!=="approved";
  add.addEventListener("click",()=>{
   if(!target)return;
   target.value=d.id;target.dispatchEvent(new Event("change"));
   const next=Math.max(0,...eps.map(ep=>Number(ep.episode_number)||0))+1;
   $("#uploadForm [name=episode]").value=next;
   $("#uploadForm [name=episodeTitle]").value="";
   $("#uploadForm [name=video]").focus({preventScroll:true});
   $("#uploadForm").scrollIntoView({behavior:"smooth",block:"start"});
   setStatus("#uploadStatus","Siap menambahkan Episode "+next+" ke series “"+d.title+"”.");
  });
  const edit=document.createElement("button");edit.className="secondary-btn";edit.type="button";edit.textContent="Edit series";edit.addEventListener("click",()=>editAdminDrama(d,userId));
  if(d.status==="approved"&&eps.some(ep=>ep.status==="approved")){const open=document.createElement("button");open.className="secondary-btn";open.type="button";open.textContent="Pratinjau";open.addEventListener("click",()=>{const published={...d,episodes:eps.filter(ep=>ep.status==="approved"),genre:eps.length+" episode"};admin.close();openDrama(published)});actions.append(open)}
  const remove=document.createElement("button");remove.className="danger-btn";remove.type="button";remove.textContent="Hapus series";remove.addEventListener("click",()=>deleteAdminDrama(d,userId));
  actions.prepend(add,edit);actions.append(remove);card.append(actions);
  if(eps.length){
   const details=document.createElement("details");details.className="admin-episodes";
   const summary=document.createElement("summary");summary.textContent="Daftar episode · "+eps.length;details.append(summary);
   for(const ep of eps){const row=document.createElement("div");row.className="admin-episode-row";const label=document.createElement("span");label.textContent="EP "+String(ep.episode_number).padStart(2,"0")+(ep.title?" · "+ep.title:"");const status=document.createElement("small");status.textContent=ep.status==="approved"?"Tayang":ep.status;const editEp=document.createElement("button");editEp.className="secondary-btn";editEp.type="button";editEp.textContent="Edit";editEp.addEventListener("click",()=>editAdminEpisode(d,ep,userId));const del=document.createElement("button");del.className="danger-btn";del.type="button";del.textContent="Hapus";del.addEventListener("click",()=>deleteAdminEpisode(d,ep,userId));row.append(label,status,editEp,del);details.append(row)}
   card.append(details);
  }else{const empty=document.createElement("p");empty.className="admin-series-empty";empty.textContent="Belum ada episode. Tekan Tambah episode untuk mulai.";card.append(empty)}
  list.append(card);
 }
}
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.close==="playerDialog"){persistCurrentPlayback();video.pause()}document.getElementById(b.dataset.close).close()}));
player.addEventListener("cancel",()=>{persistCurrentPlayback();video.pause()});
player.addEventListener("close",()=>{if(activeTab==="clips")resumeClipsFeed()});
// Switch between the compact sign-in and registration screens.
function setAuthMode(mode){
 const login=mode!=="signup";
 $("#loginForm").hidden=!login;$("#signupForm").hidden=login;
 $("#forgotPasswordBtn").hidden=!login;$("#resendConfirmationBtn").hidden=true;
 $("#authLoginTab").classList.toggle("active",login);$("#authSignupTab").classList.toggle("active",!login);
 $("#authLoginTab").setAttribute("aria-selected",String(login));$("#authSignupTab").setAttribute("aria-selected",String(!login));
 $("#googleAuthGroup").hidden=!login;
 $("#loginStatus").textContent="";
}
$("#authLoginTab").addEventListener("click",()=>setAuthMode("login"));
$("#authSignupTab").addEventListener("click",()=>setAuthMode("signup"));
$("#googleAuthBtn").addEventListener("click",async()=>{
 if(!supa){setStatus("#loginStatus","Koneksi akun belum siap. Coba lagi sebentar.");return}
 const button=$("#googleAuthBtn");button.disabled=true;setStatus("#loginStatus","Menghubungkan ke Google...");
 try{const {error}=await supa.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});if(error)throw error}
 catch(error){setStatus("#loginStatus","Login Google belum tersedia: "+(error?.message||"Penyedia Google belum diaktifkan."));button.disabled=false}
});
// Password visibility controls for mobile sign-in and registration.
document.querySelectorAll('#adminDialog input[type="password"]').forEach(input=>{
 const wrapper=document.createElement("div");wrapper.className="password-input-wrap";
 input.parentNode.insertBefore(wrapper,input);wrapper.append(input);
 const toggle=document.createElement("button");toggle.type="button";toggle.className="password-toggle";
 toggle.textContent="Tampilkan";toggle.setAttribute("aria-label","Tampilkan password");toggle.setAttribute("aria-pressed","false");
 toggle.addEventListener("click",()=>{
  const visible=input.type==="password";input.type=visible?"text":"password";
  toggle.textContent=visible?"Sembunyikan":"Tampilkan";
  toggle.setAttribute("aria-label",visible?"Sembunyikan password":"Tampilkan password");
  toggle.setAttribute("aria-pressed",String(visible));
 });
 wrapper.append(toggle);
});
$("#resetPasswordForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const form=e.currentTarget,values=new FormData(form),password=String(values.get("password")||""),confirm=String(values.get("confirmPassword")||"");if(password.length<6){setStatus("#loginStatus","Password minimal 6 karakter.");return}if(password!==confirm){setStatus("#loginStatus","Konfirmasi password belum sama.");return}const btn=form.querySelector('button[type="submit"]');btn.disabled=true;setStatus("#loginStatus","Menyimpan password baru...");try{const {data,error}=await supa.auth.updateUser({password});if(error)throw error;form.reset();form.hidden=true;$("#forgotPasswordBtn").hidden=false;setStatus("#loginStatus","Password berhasil diperbarui. Kamu sudah masuk.");await verifySession((await supa.auth.getSession()).data.session)}catch(err){setStatus("#loginStatus","Gagal memperbarui password: "+(err?.message||String(err)))}finally{btn.disabled=false}});
$("#resendConfirmationBtn").addEventListener("click",async()=>{if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const email=$("#loginForm input[name=email]").value.trim()||$("#signupForm input[name=email]").value.trim();if(!email){setStatus("#loginStatus","Masukkan alamat email terlebih dahulu.");return}const btn=$("#resendConfirmationBtn");btn.disabled=true;setStatus("#loginStatus","Meminta pengiriman ulang verifikasi...");try{const {error}=await supa.auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;setStatus("#loginStatus","Permintaan diproses. Jika akun belum terverifikasi, email akan dikirim. Periksa Spam. Jika tidak masuk, pengaturan SMTP aplikasi perlu diselesaikan.")}catch(err){setStatus("#loginStatus","Tidak dapat mengirim ulang: "+(err?.message||String(err))+". Jika akun sudah terverifikasi, gunakan Lupa password?.")}finally{btn.disabled=false}});
 $("#forgotPasswordBtn").addEventListener("click",async()=>{if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const email=$("#loginForm input[name=email]").value.trim();if(!email){setStatus("#loginStatus","Masukkan email pada kolom login terlebih dahulu.");$("#loginForm input[name=email]").focus();return}const btn=$("#forgotPasswordBtn");btn.disabled=true;setStatus("#loginStatus","Mengirim tautan pemulihan password...");try{const {error}=await supa.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;setStatus("#loginStatus","Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam.")}catch(err){setStatus("#loginStatus","Gagal mengirim tautan pemulihan: "+(err?.message||String(err)))}finally{btn.disabled=false}});
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const f=new FormData(e.currentTarget);setStatus("#loginStatus","Memeriksa akun...");const {data,error}=await supa.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error){const msg=error.message||"Terjadi kesalahan.";if(/email not confirmed/i.test(msg)){$("#resendConfirmationBtn").hidden=false;setStatus("#loginStatus","Email belum dikonfirmasi. Tekan Kirim ulang verifikasi email. Jika email tidak masuk, layanan email aplikasi perlu diaktifkan.");}else{setStatus("#loginStatus","Login gagal: "+msg+" Jika lupa password, gunakan Lupa password?.");}return}$("#resendConfirmationBtn").hidden=true;await verifySession(data.session)});
$("#signupForm").addEventListener("submit",async e=>{e.preventDefault();if(!supa){setStatus("#loginStatus","Backend belum siap.");return}const f=new FormData(e.currentTarget),email=String(f.get("email")||"").trim();setStatus("#loginStatus","Mendaftarkan akun...");const {data,error}=await supa.auth.signUp({email,password:f.get("password"),options:{emailRedirectTo:location.origin+location.pathname}});if(error){setStatus("#loginStatus","Pendaftaran gagal: "+error.message);return}if(data.session){$("#resendConfirmationBtn").hidden=true;await verifySession(data.session)}else{$("#loginForm input[name=email]").value=email;$("#resendConfirmationBtn").hidden=false;setStatus("#loginStatus","Permintaan pendaftaran diterima. Jika akun belum terverifikasi, gunakan tombol Kirim ulang verifikasi email. Periksa juga folder Spam. Jika akun sudah pernah dibuat, gunakan Lupa password?.")}});
async function signOutViewer(){if(supa)await supa.auth.signOut();$("#profileAccountTitle").textContent="Mode tamu";$("#profileAccountDescription").textContent="Masuk untuk mengelola akun penontonmu.";
$("#profileEmail").textContent="Kamu sedang menonton sebagai tamu.";
$("#profileLoginBtn").hidden=false;$("#viewerAccount").hidden=true;$("#uploadSection").hidden=true;$("#uploadSection").removeAttribute("data-admin");$("#adminUploadTab").hidden=true;profileCollectionView="history";$("#moderationSection").hidden=true;$("#loginForm").hidden=false;$("#signupForm").hidden=false;$("#forgotPasswordBtn").hidden=false;setStatus("#loginStatus","Kamu sudah keluar.")}
$("#logoutBtn")?.addEventListener("click",signOutViewer);$("#viewerLogoutBtn").addEventListener("click",signOutViewer);
async function loadModeration(){const list=$("#moderationList");if(!list||!supa)return;list.textContent="Memuat laporan...";const {data,error}=await supa.from("video_reports").select("id,drama_id,reason,details,status,created_at").eq("status","open").order("created_at",{ascending:false}).limit(50);if(error){list.textContent="Gagal memuat laporan: "+error.message;return}list.innerHTML="";if(!data?.length){list.textContent="Belum ada laporan video.";return}for(const report of data){const card=document.createElement("article");card.className="comment-item";const title=document.createElement("strong");title.textContent="Alasan: "+report.reason;const detail=document.createElement("p");detail.textContent=report.details||"Tidak ada keterangan tambahan.";const date=document.createElement("small");date.textContent=new Date(report.created_at).toLocaleString("id-ID");const review=document.createElement("button");review.className="secondary-btn";review.textContent="Tandai ditinjau";review.addEventListener("click",()=>updateReport(report.id,"reviewed"));const hide=document.createElement("button");hide.className="primary-btn";hide.textContent="Sembunyikan drama";hide.addEventListener("click",()=>hideReportedDrama(report.id,report.drama_id));card.append(title,detail,date,review,hide);list.append(card)}}
async function updateReport(id,status){const {error}=await supa.from("video_reports").update({status}).eq("id",id);if(error){setStatus("#loginStatus","Gagal memperbarui laporan: "+error.message);return}await loadModeration()}
async function hideReportedDrama(reportId,dramaId){const ep=await supa.from("episodes").update({status:"rejected"}).eq("drama_id",dramaId);if(ep.error){setStatus("#loginStatus","Gagal menyembunyikan episode: "+ep.error.message);return}const d=await supa.from("dramas").update({status:"rejected"}).eq("id",dramaId);if(d.error){setStatus("#loginStatus","Gagal menyembunyikan drama: "+d.error.message);return}const r=await supa.from("video_reports").update({status:"actioned"}).eq("id",reportId);if(r.error){setStatus("#loginStatus","Drama disembunyikan, tetapi status laporan gagal diperbarui: "+r.error.message);return}setStatus("#loginStatus","Drama dan episode sudah disembunyikan dari katalog.");await loadModeration();await loadCatalog()}

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
function getUploadMimeType(file,kind){
 const supplied=String(file?.type||"").toLowerCase();
 const extension=String(file?.name||"").split(".").pop().toLowerCase();
 const allowed=kind==="video"?{"mp4":"video/mp4","webm":"video/webm","mov":"video/quicktime"}:{"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"};
 return Object.values(allowed).includes(supplied)?supplied:(allowed[extension]||"");
}
function uploadVideoResumable(file,path,session,onProgress){
 return loadTusLibrary().then(tus=>new Promise((resolve,reject)=>{
  const projectRef=(cfg.url||"").replace(/^https:\/\//,"").split(".")[0];
  const upload=new tus.Upload(file,{
   endpoint:"https://"+projectRef+".storage.supabase.co/storage/v1/upload/resumable",
   retryDelays:[0,3000,5000,10000,20000],
   headers:{authorization:"Bearer "+session.access_token},
   metadata:{bucketName:"drama-videos",objectName:path,contentType:getUploadMimeType(file,"video")||"application/octet-stream",cacheControl:"3600"},
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
function updateUploadProgress(percent,visible=true){
 const wrap=$("#uploadProgressWrap"),bar=$("#uploadProgressBar"),label=$("#uploadProgressLabel");
 if(!wrap||!bar||!label)return;
 wrap.hidden=!visible;
 const value=Math.max(0,Math.min(100,Math.round(Number(percent)||0)));
 bar.value=value;bar.setAttribute("aria-valuenow",String(value));label.textContent=value+"%";
}
$("#uploadForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!supa){setStatus("#uploadStatus","Backend belum dikonfigurasi.");return}
 const {data:sessionData}=await supa.auth.getSession(),session=sessionData.session,user=session?.user;
 if(!user){setStatus("#uploadStatus","Masuk ke akun terlebih dahulu.");return}
 const f=e.currentTarget,data=new FormData(f),file=data.get("video"),subtitleFile=data.get("subtitle"),targetDrama=String(data.get("targetDrama")||""),posterFile=targetDrama?null:data.get("poster"),title=String(data.get("title")||"").trim(),episode=Number(data.get("episode"));
 if(!targetDrama&&!title){setStatus("#uploadStatus","Isi judul drama terlebih dahulu.");return}
 if(!Number.isInteger(episode)||episode<1){setStatus("#uploadStatus","Nomor episode harus bilangan positif.");return}
 if(posterFile&&posterFile.size>10*1024*1024){setStatus("#uploadStatus","Ukuran poster maksimal 10 MB.");return}
 if(posterFile&&!getUploadMimeType(posterFile,"image")){setStatus("#uploadStatus","Poster harus JPG, PNG, atau WebP.");return}
 if(!file||!getUploadMimeType(file,"video")){setStatus("#uploadStatus","Pilih video MP4, WebM, atau MOV.");return}
 if(file.size===0){setStatus("#uploadStatus","File video kosong. Pilih video lain.");return}
 if(file.size>500*1024*1024){setStatus("#uploadStatus","Ukuran video maksimal 500 MB.");return}
 if(subtitleFile&&subtitleFile.size){if(subtitleFile.size>1024*1024){setStatus("#uploadStatus","Ukuran subtitle maksimal 1 MB.");return}if(!/\.vtt$/i.test(subtitleFile.name)){setStatus("#uploadStatus","Subtitle harus menggunakan format .VTT.");return}const subtitleText=await subtitleFile.text();if(!/^WEBVTT(?:\s|$)/.test(subtitleText.replace(/^\uFEFF/,""))){setStatus("#uploadStatus","File subtitle tidak valid. Gunakan format WebVTT yang diawali WEBVTT.");return}}
 if(targetDrama){
  setStatus("#uploadStatus","Memeriksa drama dan nomor episode...");
  const exists=await supa.from("dramas").select("id").eq("id",targetDrama).eq("uploader_id",user.id).eq("status","approved").maybeSingle();
  if(exists.error){setStatus("#uploadStatus","Gagal memeriksa drama tujuan: "+exists.error.message);return}
  if(!exists.data){setStatus("#uploadStatus","Drama tujuan tidak ditemukan atau bukan milik akun ini.");return}
  const duplicate=await supa.from("episodes").select("id").eq("drama_id",targetDrama).eq("episode_number",episode).maybeSingle();
  if(duplicate.error){setStatus("#uploadStatus","Gagal memeriksa nomor episode: "+duplicate.error.message);return}
  if(duplicate.data){setStatus("#uploadStatus","Nomor episode tersebut sudah ada. Ubah nomor sebelum mengunggah.");return}
 }
 const btn=f.querySelector('button[type="submit"]');btn.disabled=true;
 let dramaId=targetDrama||null,createdDrama=false,videoPath=null,posterPath=null,subtitlePath=null;
 setStatus("#uploadStatus","Menyiapkan unggahan video...");
 try{
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  videoPath=user.id+"/"+crypto.randomUUID()+"-"+safeName;
  if(posterFile&&posterFile.size){
   posterPath=user.id+"/"+crypto.randomUUID()+"-"+posterFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const posterUpload=await supa.storage.from("drama-posters").upload(posterPath,posterFile,{contentType:getUploadMimeType(posterFile,"image"),upsert:false});
   if(posterUpload.error)throw posterUpload.error;
  }
  updateUploadProgress(0);await uploadVideoResumable(file,videoPath,session,pct=>{updateUploadProgress(pct);setStatus("#uploadStatus","Mengunggah video... "+pct+"% (jangan tutup halaman).")});updateUploadProgress(100);
  if(subtitleFile&&subtitleFile.size){subtitlePath=user.id+"/"+crypto.randomUUID()+"-subtitle.vtt";const subtitleUpload=await supa.storage.from("drama-videos").upload(subtitlePath,subtitleFile,{contentType:"text/vtt",upsert:false});if(subtitleUpload.error)throw subtitleUpload.error}
  setStatus("#uploadStatus","Video selesai diunggah. Menyimpan episode...");
  if(!dramaId){const created=await supa.from("dramas").insert({title,description:String(data.get("description")||""),poster_url:posterPath?supa.storage.from("drama-posters").getPublicUrl(posterPath).data.publicUrl:null,uploader_id:user.id,status:"approved"}).select("id").single();if(created.error)throw created.error;dramaId=created.data.id;createdDrama=true;}else{/* Drama and episode were checked before uploading; keep DB insert as final race-safe validation. */}
  const saved=await supa.from("episodes").insert({drama_id:dramaId,episode_number:episode,title:String(data.get("episodeTitle")||""),video_path:videoPath,subtitle_path:subtitlePath,uploader_id:user.id,status:"approved"});
  if(saved.error)throw saved.error;
  setStatus("#uploadStatus",createdDrama?"Berhasil! Drama baru dan episode sudah langsung diterbitkan.":"Berhasil! Episode baru sudah ditambahkan ke drama pilihan.");
  f.reset();syncTargetForm();await loadCatalog();await loadAdminDramas(user.id);
 }catch(err){
  if(dramaId&&createdDrama){
   const rollback=await supa.from("dramas").delete().eq("id",dramaId).eq("uploader_id",user.id);
   if(rollback.error)console.warn("Pembersihan data drama gagal:",rollback.error.message);
  }
  const cleanup=[];
  if(videoPath)cleanup.push(supa.storage.from("drama-videos").remove([videoPath]));
  if(subtitlePath)cleanup.push(supa.storage.from("drama-videos").remove([subtitlePath]));
  if(posterPath)cleanup.push(supa.storage.from("drama-posters").remove([posterPath]));
  const cleanupResults=await Promise.allSettled(cleanup);
  cleanupResults.forEach(result=>{if(result.status==="rejected")console.warn("Pembersihan file unggahan gagal:",result.reason)});
  setStatus("#uploadStatus","Gagal menerbitkan drama: "+(err?.message||String(err))+". File sementara yang sudah terkirim akan dibersihkan jika izin penyimpanan mengizinkan. Periksa koneksi lalu coba lagi.");
 }finally{btn.disabled=false}
});
function setActiveNav(tab){document.querySelectorAll(".nav-item").forEach(item=>{const active=item.dataset.tab===tab;item.classList.toggle("active",active);if(active)item.setAttribute("aria-current","page");else item.removeAttribute("aria-current")})}
document.querySelectorAll(".nav-item").forEach(button=>button.addEventListener("click",()=>{activeTab=button.dataset.tab;setActiveNav(activeTab);render();window.scrollTo({top:0,behavior:"smooth"})}));
document.querySelectorAll("[data-collection-view]").forEach(button=>button.addEventListener("click",()=>{collectionView=button.dataset.collectionView;render()}));
document.querySelectorAll("[data-collection-history-filter]").forEach(button=>button.addEventListener("click",()=>{collectionHistoryFilter=button.dataset.collectionHistoryFilter;render()}));
$("#clearHistory").addEventListener("click",async()=>{if(!Object.keys(watchHistory).length)return;if(!window.confirm("Hapus seluruh riwayat dan progres tontonan dari akun serta perangkat ini?"))return;watchHistory={};episodeProgress={};try{localStorage.removeItem("tactic-watch-history");localStorage.removeItem("tactic-episode-progress")}catch{}if(supa&&activePlaybackUserId){const [historyDelete,progressDelete]=await Promise.all([supa.from("watch_history").delete().eq("user_id",activePlaybackUserId),supa.from("episode_progress").delete().eq("user_id",activePlaybackUserId)]);if(historyDelete.error||progressDelete.error)console.warn("Sebagian riwayat cloud belum terhapus:",historyDelete.error?.message||progressDelete.error?.message)}render()});

$("#likeDrama").addEventListener("click",async()=>{
 if(!activeDrama)return;
 const btn=$("#likeDrama"),id=String(activeDrama.id);
 if(id.startsWith("demo-")){
  if(demoLikedIds.has(id))demoLikedIds.delete(id);else demoLikedIds.add(id);
  try{localStorage.setItem("tactic-demo-likes",JSON.stringify([...demoLikedIds]))}catch{}
  await loadDramaLikeState(id);renderProfileCollections();showPlayerControls();return;
 }
 if(!supa)return;
 const {data:sessionData}=await supa.auth.getSession(),user=sessionData?.session?.user;
 if(!user){setStatus("#reportStatus","Masuk ke akun untuk memberi suka.");admin.showModal();return}
 const liked=btn.dataset.liked==="true";btn.disabled=true;
 try{
  const result=liked?await supa.from("drama_likes").delete().eq("drama_id",id).eq("user_id",user.id):await supa.from("drama_likes").insert({drama_id:id});
  if(result.error)throw result.error;
  await loadDramaLikeState(id);renderProfileCollections();
 }catch(err){setStatus("#reportStatus","Gagal memperbarui suka: "+(err?.message||String(err)));btn.disabled=false}
});

async function copyShareText(text){
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}
 const field=document.createElement("textarea");field.value=text;field.setAttribute("readonly","");field.style.position="fixed";field.style.opacity="0";field.style.pointerEvents="none";document.body.append(field);field.select();field.setSelectionRange(0,field.value.length);let copied=false;try{copied=document.execCommand("copy")}catch{}field.remove();return copied;
}
$("#shareDrama").addEventListener("click",async()=>{if(!activeDrama)return;const shareUrl=new URL(location.href);shareUrl.searchParams.set("drama",String(activeDrama.id));const currentEpisode=activeDrama.episodes?.[activeEpisodeIndex];if(currentEpisode)shareUrl.searchParams.set("episode",String(currentEpisode.episode_number));const shareData={title:activeDrama.title+(currentEpisode?" · Episode "+currentEpisode.episode_number:""),text:"Tonton "+activeDrama.title+(currentEpisode?" episode "+currentEpisode.episode_number:"")+" di TacTic Drama",url:shareUrl.toString()};const copyText=shareData.text+" — "+shareData.url;try{if(navigator.share){await navigator.share(shareData);setStatus("#shareStatus","Menu berbagi berhasil dibuka.")}else if(await copyShareText(copyText))setStatus("#shareStatus","Link episode berhasil disalin. Siap dibagikan!");else setStatus("#shareStatus","Salin link ini secara manual: "+shareData.url)}catch(error){if(error.name==="AbortError")return;if(await copyShareText(copyText))setStatus("#shareStatus","Link episode berhasil disalin sebagai alternatif.");else setStatus("#shareStatus","Link episode: "+shareData.url)}});
const targetSelect=$("#targetDrama");function syncTargetForm(){const existing=Boolean(targetSelect?.value);$("#posterField").hidden=existing;$("#seriesTitleField").hidden=existing;$("#seriesDescriptionField").hidden=existing;$("#uploadForm [name=title]").disabled=existing;$("#uploadForm [name=description]").disabled=existing;$("#uploadForm [name=episode]").value=existing?(Number($("#uploadForm [name=episode]").value)||1):1;const heading=$("#uploadSeriesMode");if(heading)heading.textContent=existing?"Menambahkan episode ke series terpilih":"Membuat series baru + episode pertama"}targetSelect?.addEventListener("change",syncTargetForm);syncTargetForm();
 const uploadForm=$("#uploadForm");
 let posterPreviewUrl=null;
 function formatUploadSize(bytes){if(!Number.isFinite(bytes)||bytes<0)return "";const units=["B","KB","MB","GB"];let value=bytes,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return value.toFixed(index===0?0:1)+" "+units[index]}
 function updateUploadPreview(){
  const poster=uploadForm?.elements.poster?.files?.[0],videoFile=uploadForm?.elements.video?.files?.[0],preview=$("#uploadPreview"),image=$("#uploadPosterPreview"),name=$("#uploadVideoName"),size=$("#uploadVideoSize");
  if(posterPreviewUrl){URL.revokeObjectURL(posterPreviewUrl);posterPreviewUrl=null}
  if(poster){posterPreviewUrl=URL.createObjectURL(poster);image.src=posterPreviewUrl;image.hidden=false}else{image.removeAttribute("src");image.hidden=true}
  name.textContent=videoFile?videoFile.name:"Pilih file video dari galeri";
  size.textContent=videoFile?formatUploadSize(videoFile.size)+" · "+(videoFile.type||"Format tidak diketahui"):"";
  preview.hidden=!poster&&!videoFile;
 }
 uploadForm?.elements.poster?.addEventListener("change",updateUploadPreview);
 uploadForm?.elements.video?.addEventListener("change",updateUploadPreview);
 uploadForm?.addEventListener("reset",()=>{setTimeout(()=>{updateUploadPreview();updateUploadProgress(0,false)},0)});
 const searchBox=$("#dramaSearch");searchBox.addEventListener("input",()=>{searchQuery=searchBox.value.trim().toLocaleLowerCase("id");render()});$("#searchSubmit")?.addEventListener("click",()=>{searchBox.dispatchEvent(new Event("input",{bubbles:true}));searchBox.blur()});searchBox.addEventListener("keydown",event=>{if(event.key==="Enter")$("#searchSubmit")?.click()});$("#clearSearch")?.addEventListener("click",()=>{searchBox.value="";searchQuery="";render();searchBox.focus()});
$("#dramaSort")?.addEventListener("change",render);
$("#reloadCatalog")?.addEventListener("click",()=>loadCatalog());
function updateNetworkStatus(){const el=$("#networkStatus");if(!el)return;const online=navigator.onLine;el.classList.toggle("is-offline",!online);el.setAttribute("aria-label",online?"Koneksi online":"Koneksi offline");el.title=online?"Koneksi online":"Koneksi offline"}
window.addEventListener("online",()=>{updateNetworkStatus();loadCatalog()});window.addEventListener("offline",updateNetworkStatus);updateNetworkStatus();
render();
const cfg=window.TACTIC_SUPABASE_CONFIG||{};
const backendConfigured=cfg.url?.startsWith("https://")&&!cfg.url.includes("YOUR-PROJECT")&&cfg.anonKey&&!cfg.anonKey.includes("YOUR-SUPABASE");
if(backendConfigured){
 $("#backendNotice").textContent="Tonton drama tanpa akun atau masuk untuk fitur akun penonton. Email mungkin perlu dikonfirmasi saat mendaftar.";
 const guestFallback=setTimeout(()=>showGuestPrompt(),1500);
 function startBackend(){
  if(!window.supabase?.createClient)throw new Error("Pustaka koneksi belum tersedia.");
  supa=window.supabase.createClient(cfg.url,cfg.anonKey);
  loadCatalog();
  supa.auth.getSession().then(({data})=>{clearTimeout(guestFallback);const session=data.session;verifySession(session);loadUserFavorites();if(!session)showGuestPrompt()}).catch(()=>{clearTimeout(guestFallback);showGuestPrompt()});
  supa.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY"){if(admin&&!admin.open)admin.showModal();$("#uploadSection").hidden=true;$("#loginForm").hidden=true;$("#signupForm").hidden=true;$("#forgotPasswordBtn").hidden=true;$("#resetPasswordForm").hidden=false;setStatus("#loginStatus","Tautan pemulihan valid. Silakan buat password baru.")}else{verifySession(session);loadUserFavorites().then(()=>{if(activeDrama)loadDramaFavoriteState(activeDrama.id)})}});
 }
 if(window.supabase?.createClient)startBackend();
 else{
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";script.async=true;
  const timeout=setTimeout(()=>{$("#catalogStatus").textContent="Koneksi katalog lambat. Tampilan dan navigasi tetap bisa digunakan; coba muat ulang saat internet stabil.";},10000);
  script.onload=()=>{clearTimeout(timeout);try{startBackend()}catch(error){clearTimeout(guestFallback);showGuestPrompt();$("#catalogStatus").textContent="Koneksi katalog gagal dimulai. Coba muat ulang halaman."}};
  script.onerror=()=>{clearTimeout(timeout);clearTimeout(guestFallback);showGuestPrompt();$("#catalogStatus").textContent="Pustaka katalog gagal dimuat. Periksa koneksi internet lalu coba muat ulang."};
  document.head.append(script);
 }
}else{$("#backendNotice").textContent="Koneksi backend belum diisi. Website dan katalog contoh tetap bisa dibuka; upload online aktif setelah konfigurasi Supabase.";showGuestPrompt()}
const installBtn=$("#installBtn");
let installPrompt=null;
const isInstalled=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
installBtn.hidden=isInstalled();installBtn.textContent="↓";
window.addEventListener("beforeinstallprompt",event=>{
 event.preventDefault();installPrompt=event;installBtn.hidden=false;
 installBtn.title="Pasang TacTic Drama";installBtn.setAttribute("aria-label","Pasang TacTic Drama");installBtn.textContent="↓";
});
installBtn.addEventListener("click",async()=>{
 if(!installPrompt){setStatus("#catalogStatus","Untuk memasang aplikasi, buka menu Chrome ⋮ lalu pilih Tambahkan ke layar utama.");return}
 const promptEvent=installPrompt;installPrompt=null;
 try{await promptEvent.prompt();const choice=await promptEvent.userChoice;
  if(choice?.outcome==="accepted")setStatus("#catalogStatus","TacTic Drama sedang dipasang ke layar utama.");
  else setStatus("#catalogStatus","Pemasangan belum dilakukan. Kamu bisa mencoba lagi melalui menu Chrome.");
 }catch(error){setStatus("#catalogStatus","Tidak dapat membuka pemasangan. Gunakan menu Chrome ⋮ lalu Tambahkan ke layar utama.")}
 installBtn.hidden=true;
});
window.addEventListener("appinstalled",()=>{
 installPrompt=null;installBtn.hidden=true;
 setStatus("#catalogStatus","TacTic Drama berhasil dipasang di perangkat ini.");
});
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
