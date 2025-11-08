// /js/locations.js
(function () {
  const i18nText = (key, vars) =>
    (window.__I18N__ && window.__I18N__.t) ? window.__I18N__.t(key, vars) : key;

  /************ 实用：加载遮罩 ************/
  function showLoading(msg) {
    const el = document.getElementById("loading");
    document.getElementById("loadingText").textContent = msg || i18nText("tools.locations.loading");
    el.classList.add("show");
  }
  function hideLoading() { document.getElementById("loading").classList.remove("show"); }

  /************ 坐标转换 ************/
  function _outOfChina(lng, lat){return(lng<72.004||lng>137.8347||lat<0.8293||lat>55.8271);}
  function _transformLat(lng,lat){let ret=-100+2*lng+3*lat+0.2*lat*lat+0.1*lng*lat+0.2*Math.sqrt(Math.abs(lng));ret+=(20*Math.sin(6*lng*Math.PI)+20*Math.sin(2*lng*Math.PI))*2/3;ret+=(20*Math.sin(lat*Math.PI)+40*Math.sin(lat/3*Math.PI))*2/3;ret+=(160*Math.sin(lat/12*Math.PI)+320*Math.sin(lat*Math.PI/30))*2/3;return ret;}
  function _transformLng(lng,lat){let ret=300+lng+2*lat+0.1*lng*lng+0.1*lng*lat+0.1*Math.sqrt(Math.abs(lng));ret+=(20*Math.sin(6*lng*Math.PI)+20*Math.sin(2*lng*Math.PI))*2/3;ret+=(20*Math.sin(lng*Math.PI)+40*Math.sin(lng/3*Math.PI))*2/3;ret+=(150*Math.sin(lng/12*Math.PI)+300*Math.sin(lng/30*Math.PI))*2/3;return ret;}
  function wgs84ToGcj02(lng,lat){ if(_outOfChina(lng,lat)) return [lng,lat]; const a=6378245.0,ee=0.00669342162296594323; let dLat=_transformLat(lng-105,lat-35), dLng=_transformLng(lng-105,lat-35); const radLat=lat/180*Math.PI; let magic=Math.sin(radLat); magic=1-ee*magic*magic; const sqrtMagic=Math.sqrt(magic); dLat=(dLat*180)/((a*(1-ee))/(magic*sqrtMagic)*Math.PI); dLng=(dLng*180)/(a/sqrtMagic*Math.cos(radLat)*Math.PI); return [lng+dLng, lat+dLat];}
  function gcj02ToBd09(lng,lat){const x=lng,y=lat; const z=Math.sqrt(x*x+y*y)+0.00002*Math.sin(y*Math.PI*3000/180); const th=Math.atan2(y,x)+0.000003*Math.cos(x*Math.PI*3000/180); return [z*Math.cos(th)+0.0065, z*Math.sin(th)+0.006];}
  function wgs84ToBd09(lng,lat){const [glng,glat]=wgs84ToGcj02(lng,lat); return gcj02ToBd09(glng,glat);}

  /************ 小工具 ************/
  const pad2=n=>n<10?('0'+n):''+n;
  function tsToLocal(ts){const d=new Date(ts);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;}
  function tsToLocalInput(ts){const d=new Date(ts);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;}
  function inputToTs(val){ if(!val) return null; const t=new Date(val).getTime(); return Number.isFinite(t)?t:null; }
  const num = x => (x==null || x==="") ? NaN : Number(x);

  /************ 兼容解析（JSON/CSV/GPX/KML）************/
  function parseTsFlexible(p){
    if (Number.isFinite(p.ts)) return p.ts<1e12?p.ts*1000:p.ts;
    if (Number.isFinite(p.timestamp)) return p.timestamp<1e12?p.timestamp*1000:p.timestamp;
    if (p.time_ms && Number.isFinite(p.time_ms)) return Number(p.time_ms);
    if (p.time && Number.isFinite(p.time)) return (p.time<1e12? p.time*1000 : p.time);
    if (typeof p.timeString === 'string'){ const d=new Date(p.timeString.replace(" ","T")); const t=d.getTime(); if(Number.isFinite(t)) return t; }
    if (typeof p.datetime === 'string'){ const t=new Date(p.datetime).getTime(); if (Number.isFinite(t)) return t; }
    if (typeof p.date === 'string'){ const t=new Date(p.date).getTime(); if (Number.isFinite(t)) return t; }
    return NaN;
  }
  function pickDegFlexible(p){
    if (Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) return {lng:+p.longitude, lat:+p.latitude, gcj:false};
    if (Number.isFinite(p.gcj02latitude) && Number.isFinite(p.gcj02longitude)) return {lng:+p.gcj02longitude, lat:+p.gcj02latitude, gcj:true};
    if (Number.isFinite(p.lon_e6) && Number.isFinite(p.lat_e6)) return {lng:p.lon_e6/1e6, lat:p.lat_e6/1e6, gcj:false};
    if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) return {lng:+p.lon, lat:+p.lat, gcj:false};
    if (Number.isFinite(p.lng) && Number.isFinite(p.lat)) return {lng:+p.lng, lat:+p.lat, gcj:false};
    return null;
  }

  function splitCSVLine(line){
    const out=[]; let cur=''; let inQ=false;
    for (let i=0;i<line.length;i++){
      const ch=line[i];
      if (ch==='\"'){
        if (inQ && line[i+1]==='\"'){ cur+='\"'; i++; }
        else inQ=!inQ;
      } else if (ch===',' && !inQ){
        out.push(cur); cur='';
      } else {
        cur+=ch;
      }
    }
    out.push(cur);
    return out.map(s=>s.trim());
  }
  function parseCSV(text){
    const lines=text.replace(/\r\n?/g,'\n').split('\n').filter(l=>l.trim().length>0);
    if (lines.length===0) return [];
    const header=splitCSVLine(lines[0]).map(h=>h.trim().toLowerCase());
    const idx = nameList=>{
      for (const n of nameList){
        const k=n.toLowerCase(); const j=header.indexOf(k);
        if (j>=0) return j;
      } return -1;
    };
    const tidx=idx(['timestamp','time_ms','time','ts','times','datetime','date','timestring']);
    const lonIdx=idx(['longitude','lon','lng','lon_e6']);
    const latIdx=idx(['latitude','lat','lat_e6']);
    const gcjIdx=idx(['ismarslocation','gcj','gcj02','is_gcj']);
    const out=[];
    for (let i=1;i<lines.length;i++){
      const cols=splitCSVLine(lines[i]);
      const lonRaw = lonIdx>=0? cols[lonIdx] : null;
      const latRaw = latIdx>=0? cols[latIdx] : null;
      if (lonRaw==null || latRaw==null) continue;
      const lonV = num(lonRaw), latV = num(latRaw);
      let ts = NaN;
      if (tidx>=0){
        const tv = cols[tidx];
        const n = Number(tv);
        if (Number.isFinite(n)){
          ts = (n<1e12 ? n*1000 : n);
        }else{
          const t2=new Date(String(tv).replace(' ','T')).getTime();
          if (Number.isFinite(t2)) ts=t2;
        }
      }
      if (!Number.isFinite(ts)) ts = Date.now() + i;
      const useDeg = Math.abs(lonV)<=180 && Math.abs(latV)<=90;
      const obj = useDeg
        ? { ts, longitude: lonV, latitude: latV }
        : { ts, lon_e6: Math.round(lonV), lat_e6: Math.round(latV) };
      if (gcjIdx>=0){
        const flag=cols[gcjIdx]; const b = String(flag).trim();
        if (b==='1' || /^true$/i.test(b)) obj.gcj = true;
      }
      out.push(obj);
    }
    return out;
  }

  function parseGPX(text){
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const out=[];
    const pick = (el)=>el ? el.textContent.trim() : '';
    const trkpts = Array.from(doc.getElementsByTagName('trkpt'));
    for (const p of trkpts){
      const lat = num(p.getAttribute('lat'));
      const lon = num(p.getAttribute('lon'));
      const t = pick(p.getElementsByTagName('time')[0]||null);
      const ts = Number.isFinite(Number(t)) ? (Number(t)<1e12?Number(t)*1000:Number(t)) : new Date(t).getTime();
      const tsFinal = Number.isFinite(ts)? ts : (Date.now()+out.length);
      if (Number.isFinite(lat) && Number.isFinite(lon)){
        out.push({ ts: tsFinal, latitude: lat, longitude: lon });
      }
    }
    const wpts = Array.from(doc.getElementsByTagName('wpt'));
    for (const p of wpts){
      const lat = num(p.getAttribute('lat'));
      const lon = num(p.getAttribute('lon'));
      const tEl = p.getElementsByTagName('time')[0]||null;
      const t = tEl ? tEl.textContent.trim() : '';
      const ts = Number.isFinite(Number(t)) ? (Number(t)<1e12?Number(t)*1000:Number(t)) : new Date(t).getTime();
      const tsFinal = Number.isFinite(ts)? ts : (Date.now()+out.length);
      if (Number.isFinite(lat) && Number.isFinite(lon)){
        out.push({ ts: tsFinal, latitude: lat, longitude: lon });
      }
    }
    return out;
  }

  function parseKML(text){
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const out=[];
    const txt = el=> (el? el.textContent.trim() : '');
    const tracks = doc.getElementsByTagNameNS('*','Track');
    for (const trk of tracks){
      const when = Array.from(trk.getElementsByTagName('when')).map(e=>txt(e));
      const coords = Array.from(trk.getElementsByTagNameNS('*','coord')).map(e=>txt(e));
      const m = Math.min(when.length, coords.length);
      for (let i=0;i<m;i++){
        const ts = new Date(when[i]).getTime();
        const parts = coords[i].split(/\s+/).map(Number); // lon lat alt
        const lon=parts[0], lat=parts[1];
        if (Number.isFinite(lon)&&Number.isFinite(lat)){
          const tsFinal = Number.isFinite(ts)?ts:(Date.now()+out.length);
          out.push({ ts: tsFinal, longitude: lon, latitude: lat });
        }
      }
    }
    const lines = doc.getElementsByTagName('LineString');
    for (const ls of lines){
      const coordNode = ls.getElementsByTagName('coordinates')[0];
      if (!coordNode) continue;
      const list = coordNode.textContent.trim().split(/\s+/);
      for (let i=0;i<list.length;i++){
        const parts = list[i].split(',').map(Number); // lon,lat,alt
        const lon=parts[0], lat=parts[1];
        if (Number.isFinite(lon)&&Number.isFinite(lat)){
          out.push({ ts: Date.now()+out.length, longitude: lon, latitude: lat });
        }
      }
    }
    const points = doc.getElementsByTagName('Point');
    for (const pt of points){
      const coordNode = pt.getElementsByTagName('coordinates')[0];
      if (!coordNode) continue;
      const parts = coordNode.textContent.trim().split(',').map(Number);
      const lon=parts[0], lat=parts[1];
      if (Number.isFinite(lon)&&Number.isFinite(lat)){
        out.push({ ts: Date.now()+out.length, longitude: lon, latitude: lat });
      }
    }
    return out;
  }

  /************ 全局状态 ************/
  let map=null;
  let rawTrack=[]; // { ts(ms), lon_e6, lat_e6, __gcj? }
  let minTs=null, maxTs=null;
  let bigLayer=null, smallMarkers=[];
  let canvasLayer=null; // Canvas 点
  let lineLayer=null;   // 折线

  const MAX_LINE_POINTS = 50000;

  /************ 能力探测（PointCollection 兼容） ************/
  function getPointConsts(){
    const sizeSmall = (window.BMAP_POINT_SIZE_SMALL!==undefined) ? window.BMAP_POINT_SIZE_SMALL
                      : (BMapGL && BMapGL.PointSizeType && BMapGL.PointSizeType.SMALL) || 1;
    const shapeCircle = (window.BMAP_POINT_SHAPE_CIRCLE!==undefined) ? window.BMAP_POINT_SHAPE_CIRCLE
                      : (BMapGL && BMapGL.PointShapeType && BMapGL.PointShapeType.CIRCLE) || 0;
    const hasPC = !!(BMapGL && typeof BMapGL.PointCollection === 'function');
    return { sizeSmall, shapeCircle, hasPC };
  }

  class CanvasDots extends BMapGL.Overlay {
    constructor(points, color='#5ab1ff', radius=2){
      super();
      this.points = points; this.color = color; this.radius = radius;
      this._map = null; this._canvas = null; this._ctx = null;
      this._bindedDraw = this.draw.bind(this);
    }
    initialize(map){
      this._map = map;
      const canvas = this._canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = 0; canvas.style.top = 0;
      canvas.style.pointerEvents = 'none';
      this._ctx = canvas.getContext('2d');
      map.getPanes().labelPane.appendChild(canvas);
      map.addEventListener('zoomend', this._bindedDraw);
      map.addEventListener('moveend', this._bindedDraw);
      map.addEventListener('resize', this._bindedDraw);
      this._syncSize();
      return canvas;
    }
    _syncSize(){
      const sz = this._map.getSize();
      const ratio = window.devicePixelRatio || 1;
      this._canvas.width = Math.round(sz.width * ratio);
      this._canvas.height = Math.round(sz.height * ratio);
      this._canvas.style.width = sz.width + 'px';
      this._canvas.style.height = sz.height + 'px';
      this._ctx.setTransform(ratio,0,0,ratio,0,0);
    }
    draw(){
      if (!this._map || !this._ctx) return;
      this._syncSize();
      const ctx = this._ctx;
      const radius = this.radius;
      ctx.clearRect(0,0,this._canvas.width,this._canvas.height);
      ctx.fillStyle = this.color;
      const bounds = this._map.getBounds();
      for (let i=0;i<this.points.length;i++){
        const p = this.points[i];
        if (!bounds.containsPoint(p)) continue;
        const pix = this._map.pointToPixel(p);
        ctx.beginPath();
        ctx.arc(pix.x, pix.y, radius, 0, Math.PI*2);
        ctx.fill();
      }
    }
    setPoints(points){ this.points = points || []; this.draw(); }
    setStyle({color, radius}){ if (color) this.color=color; if (radius) this.radius=radius; this.draw(); }
    remove(){
      if (!this._map) return;
      this._map.removeEventListener('zoomend', this._bindedDraw);
      this._map.removeEventListener('moveend', this._bindedDraw);
      this._map.removeEventListener('resize', this._bindedDraw);
      if (this._canvas && this._canvas.parentNode) this._canvas.parentNode.removeChild(this._canvas);
      this._canvas = null; this._ctx = null; this._map = null;
    }
  }

  function clearOverlays(){
    if (bigLayer){ map.removeOverlay(bigLayer); bigLayer=null; }
    if (canvasLayer){ map.removeOverlay(canvasLayer); canvasLayer.remove?.(); canvasLayer=null; }
    if (lineLayer){ map.removeOverlay(lineLayer); lineLayer=null; }
    if (smallMarkers.length){ for (const m of smallMarkers) map.removeOverlay(m); smallMarkers.length=0; }
  }

  function renderUnified(arr){
    clearOverlays();

    const showPoints = document.getElementById('optShowPoints').checked;
    const showLine   = document.getElementById('optShowLine').checked;
    const colorHex   = document.getElementById('pointColor').value || '#5ab1ff';

    if (!arr || arr.length===0){
      map.centerAndZoom(new BMapGL.Point(116.404,39.915),12);
      document.getElementById("statsCount").textContent = i18nText("tools.locations.statsCount", { count: 0 });
      document.getElementById("statsRange").textContent = i18nText("tools.locations.statsRange", { start: "—", end: "—" });
      document.getElementById("miniStats").textContent  = i18nText("tools.locations.miniStats", { count: 0, start: "—", end: "—" });
      hideLoading(); return;
    }

    const pts=[];
    for (const p of arr){
      const lng=p.lon_e6/1e6, lat=p.lat_e6/1e6;
      let bdLng, bdLat;
      if (p.__gcj===true){ [bdLng,bdLat]=gcj02ToBd09(lng,lat); }
      else { [bdLng,bdLat]=wgs84ToBd09(lng,lat); }
      pts.push(new BMapGL.Point(bdLng,bdLat));
    }
    try{ map.setViewport(pts); }catch(_){}

    const { sizeSmall, shapeCircle, hasPC } = getPointConsts();

    if (showLine && pts.length>=2){
      if (pts.length <= MAX_LINE_POINTS){
        const lineLayerLocal = new BMapGL.Polyline(pts, { strokeColor: colorHex, strokeWeight: 3, strokeOpacity: 0.9 });
        map.addOverlay(lineLayerLocal);
        lineLayer = lineLayerLocal;
      } else {
        const fe=document.getElementById("fileStatus");
        fe.style.display="block";
        fe.textContent = i18nText("tools.locations.skipPolyline", { n: pts.length, limit: MAX_LINE_POINTS });
      }
    }

    if (showPoints){
      if (arr.length < 1000){
        const dots = new CanvasDots(pts, colorHex, 2.5);
        map.addOverlay(dots);
        canvasLayer = dots;

        const first = new BMapGL.Marker(pts[0]); first.setTitle(i18nText("tools.locations.startPoint")); map.addOverlay(first); smallMarkers.push(first);
        const firstLabel=new BMapGL.Label(i18nText("tools.locations.startPoint"),{position:pts[0],offset:new BMapGL.Size(10,-20)});
        firstLabel.setStyle({color:"#00E0FF",backgroundColor:"rgba(0,0,0,0.6)",border:"1px solid #00E0FF",borderRadius:"6px",padding:"2px 4px",fontSize:"12px",lineHeight:"14px"});
        map.addOverlay(firstLabel); smallMarkers.push(firstLabel);

        if (pts.length>=2){
          const last = new BMapGL.Marker(pts[pts.length-1]); last.setTitle(i18nText("tools.locations.endPoint")); map.addOverlay(last); smallMarkers.push(last);
          const lastLabel=new BMapGL.Label(i18nText("tools.locations.endPoint"),{position:pts[pts.length-1],offset:new BMapGL.Size(10,-20)});
          lastLabel.setStyle({color:"#FF4D4F",backgroundColor:"rgba(0,0,0,0.6)",border:"1px solid #FF4D4F",borderRadius:"6px",padding:"2px 4px",fontSize:"12px",lineHeight:"14px"});
          map.addOverlay(lastLabel); smallMarkers.push(lastLabel);
        }
      } else if (hasPC && sizeSmall!=null && shapeCircle!=null){
        const opts = { size: sizeSmall, shape: shapeCircle, color: colorHex };
        const pc = new BMapGL.PointCollection(pts, opts);
        pc.addEventListener('click', e=>{
          const idx=e.index!=null?e.index:null;
          if (idx!=null && arr[idx]){
            const lbl=new BMapGL.Label(tsToLocal(arr[idx].ts), { position: e.point, offset:new BMapGL.Size(10,-20) });
            lbl.setStyle({color:"#fff",backgroundColor:"rgba(0,0,0,0.6)",border:"1px solid #30363d",borderRadius:"6px",padding:"2px 4px",fontSize:"12px",lineHeight:"14px"});
            map.addOverlay(lbl); setTimeout(()=>map.removeOverlay(lbl), 1200);
          }
        });
        map.addOverlay(pc);
        bigLayer = pc;
      } else {
        const dots = new CanvasDots(pts, colorHex, 2);
        map.addOverlay(dots);
        canvasLayer = dots;
      }
    }

    const count=arr.length, startTxt=tsToLocal(arr[0].ts), endTxt=tsToLocal(arr[count-1].ts);
    const statsCountEl = document.getElementById("statsCount");
    statsCountEl.dataset.count = String(count);
    statsCountEl.textContent = i18nText("tools.locations.statsCount", { count });

    const statsRangeEl = document.getElementById("statsRange");
    statsRangeEl.dataset.start = startTxt;
    statsRangeEl.dataset.end = endTxt;
    statsRangeEl.textContent = i18nText("tools.locations.statsRange", { start: startTxt, end: endTxt });

    document.getElementById("miniStats").textContent = i18nText("tools.locations.miniStats", { count, start: startTxt, end: endTxt });

    hideLoading();
  }

  function applyFilter_JSON(){
    showLoading(i18nText("tools.locations.loadingFilter"));
    requestAnimationFrame(()=>{
      const sTs=inputToTs(document.getElementById("startInput").value);
      const eTs=inputToTs(document.getElementById("endInput").value);
      const s=(sTs==null)?minTs:sTs;
      const e=(eTs==null)?maxTs:eTs;
      if (s>e){ alert(i18nText("tools.locations.errStartAfterEnd")); hideLoading(); return; }
      const arr=rawTrack.filter(p=>p.ts>=s&&p.ts<=e);
      renderUnified(arr);
    });
  }

  function applyFilter_DB(){
    const sess=window.__TT_SQLDB__; if (!sess){ applyFilter_JSON(); return; }
    showLoading(i18nText("tools.locations.loadingDB"));
    requestAnimationFrame(()=>{
      const sTs=inputToTs(document.getElementById("startInput").value);
      const eTs=inputToTs(document.getElementById("endInput").value);
      const s=(sTs==null)?minTs:sTs, e=(eTs==null)?maxTs:eTs;
      if (s>e){ alert(i18nText("tools.locations.errStartAfterEnd")); hideLoading(); return; }

      const { db, table, tsCol, lonCol, latCol, gcjLatCol, gcjLonCol, isMarsCol, tsIsMs } = sess;
      const qS = tsIsMs ? Math.floor(s) : Math.floor(s/1000);
      const qE = tsIsMs ? Math.floor(e) : Math.floor(e/1000);

      const sel = [
        `${tsCol} AS _ts`,
        `${lonCol} AS _lon`,
        `${latCol} AS _lat`,
        gcjLatCol ? `${gcjLatCol} AS _gclat` : null,
        gcjLonCol ? `${gcjLonCol} AS _gclon` : null,
        isMarsCol ? `${isMarsCol} AS _ismars` : null
      ].filter(Boolean).join(", ");
      const sql=`SELECT ${sel} FROM ${table} WHERE ${tsCol} BETWEEN ? AND ? ORDER BY ${tsCol} ASC;`;

      let stmt;
      try{
        stmt = db.prepare(sql); stmt.bind([qS,qE]);
        const arr=[];
        while (stmt.step()){
          const row=stmt.getAsObject();
          const ts = tsIsMs ? Number(row._ts) : Number(row._ts)*1000;
          const lon=Number(row._lon), lat=Number(row._lat);
          const looksDeg=Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=90;
          const lon_e6=looksDeg?Math.round(lon*1e6):Math.round(lon);
          const lat_e6=looksDeg?Math.round(lat*1e6):Math.round(lat);
          let isGcj=false;
          if (typeof row._ismars!=="undefined" && Number(row._ismars)===1) isGcj=true;
          else if (typeof row._gclat!=="undefined" && typeof row._gclon!=="undefined"){
            const glat=Number(row._gclat), glon=Number(row._gclon);
            if (Number.isFinite(glat)&&Number.isFinite(glon)) isGcj=true;
          }
          arr.push({ ts, lon_e6, lat_e6, __gcj:isGcj });
        }
        stmt.free();

        renderUnified(arr);
      }catch(err){
        if (stmt) try{ stmt.free(); }catch(_){}
        const fe=document.getElementById("fileError"); fe.style.display="block"; fe.textContent=i18nText("tools.locations.errSQLiteQuery", { msg: err.message });
        console.error(err); renderUnified([]);
      }
    });
  }

  function applyFilter(){ if (window.__TT_SQLDB__) applyFilter_DB(); else applyFilter_JSON(); }
  function resetRange(){ document.getElementById("startInput").value=tsToLocalInput(minTs); document.getElementById("endInput").value=tsToLocalInput(maxTs); applyFilter(); }

  function setTrackData(arr, sourceLabel=i18nText("tools.locations.srcInline")){
    showLoading(i18nText("tools.locations.parsing"));
    window.__TT_SQLDB__=null;
    if (!Array.isArray(arr)) { hideLoading(); throw new Error("Array required"); }
    const cleaned=[];
    for (const p of arr){
      const ts=parseTsFlexible(p), deg=pickDegFlexible(p);
      if (!Number.isFinite(ts) || !deg) continue;
      cleaned.push({ ts: (ts<1e12?ts*1000:ts), lon_e6: Math.round(deg.lng*1e6), lat_e6: Math.round(deg.lat*1e6), __gcj: !!(p.__gcj || p.gcj) });
    }
    cleaned.sort((a,b)=>a.ts-b.ts);
    if (cleaned.length>0){ minTs=cleaned[0].ts; maxTs=cleaned[cleaned.length-1].ts; }
    else { const now=Date.now(); minTs=now-3600_000; maxTs=now; }

    const fileStatus=document.getElementById("fileStatus");
    fileStatus.style.display="block";
    fileStatus.textContent=i18nText("tools.locations.loaded", { source: sourceLabel, n: cleaned.length });
    document.getElementById("fileError").style.display="none";

    const s=document.getElementById("startInput"), e=document.getElementById("endInput");
    s.min=tsToLocalInput(minTs); s.max=tsToLocalInput(maxTs);
    e.min=tsToLocalInput(minTs); e.max=tsToLocalInput(maxTs);
    s.value=tsToLocalInput(minTs); e.value=tsToLocalInput(maxTs);

    rawTrack=cleaned;
    applyFilter();
  }

  function loadFromInlineScript(){
    const node=document.getElementById('trackData');
    const rawText=node.textContent.trim();
    try{ setTrackData(JSON.parse(rawText||"[]"), i18nText("tools.locations.srcInline")); }
    catch(e){
      const fe=document.getElementById("fileError"); fe.style.display="block";
      fe.textContent=i18nText("tools.locations.errInlineJSON", { msg: e.message }); hideLoading();
    }
  }

  // sql.js init once
  let SQL_INIT_PROMISE=null;
  function initSqlJsOnce(){
    if (!SQL_INIT_PROMISE){
      SQL_INIT_PROMISE=initSqlJs({ locateFile:file=>`https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}` });
    }
    return SQL_INIT_PROMISE;
  }

  async function loadFromSQLite(file){
    const fileError=document.getElementById("fileError");
    const fileStatus=document.getElementById("fileStatus");
    fileError.style.display="none"; fileStatus.style.display="none";
    showLoading("SQLite…");
    try{
      const SQL=await initSqlJsOnce();
      const buf=new Uint8Array(await file.arrayBuffer());
      const db=new SQL.Database(buf);

      const tables=db.exec(`SELECT name FROM sqlite_master WHERE type='table'`)?.flatMap(r=>r.values.map(v=>String(v[0])))||[];
      const prefer=["location","Location","locations","userMark","frequentIndexTable","points","track","tracking"];
      let candidate=prefer.find(n=>tables.includes(n))||null;

      function tableInfo(name){ return db.exec(`PRAGMA table_info(${JSON.stringify(name)})`); }
      function colSet(info){ return new Set(info[0]?.values?.map(v=>String(v[1]))||[]); }
      function pickOne(names,cands){ for (const c of cands) if (names.has(c)) return c; return null; }

      const need = {
        ts : ["ts","timestamp","time_ms","time","ts_ms","created_at","recorded_at"],
        lon: ["lon_e6","longitude_e6","lon_e7","longitude_e7","lon","longitude","lng"],
        lat: ["lat_e6","latitude_e6","lat_e7","latitude_e7","lat","latitude"]
      };

      function findTable(){
        const tryOne=(t)=>{ const info=tableInfo(t); if(!info||info.length===0) return null;
          const names=colSet(info);
          const tsCol=pickOne(names,need.ts), lonCol=pickOne(names,need.lon), latCol=pickOne(names,need.lat);
          return (tsCol&&lonCol&&latCol)?{table:t,names,tsCol,lonCol,latCol}:null; };
        if (candidate){ const r=tryOne(candidate); if (r) return r; }
        for (const t of tables){ const r=tryOne(t); if (r) return r; }
        return null;
      }

      const found=findTable();
      if (!found) throw new Error("no table with ts/lon/lat");
      const { table, tsCol, lonCol, latCol, names } = found;

      const hasGcjLat = names.has("gcj02latitude");
      const hasGcjLon = names.has("gcj02longitude");
      const hasIsMars = names.has("isMarsLocation");

      const mm=db.exec(`SELECT MIN(${tsCol}) AS min_ts, MAX(${tsCol}) AS max_ts FROM ${table};`);
      const row=mm[0]?.values?.[0]||[];
      const rawMin = Number(row[0]);
      const rawMax = Number(row[1]);
      if (!Number.isFinite(rawMin)||!Number.isFinite(rawMax)) throw new Error("MIN/MAX(ts) not readable");

      const tsIsMs = (rawMin >= 1e12 || rawMax >= 1e12);
      minTs = tsIsMs ? rawMin : rawMin * 1000;
      maxTs = tsIsMs ? rawMax : rawMax * 1000;

      window.__TT_SQLDB__={
        db, table, tsCol, lonCol, latCol,
        gcjLatCol: hasGcjLat ? "gcj02latitude"  : null,
        gcjLonCol: hasGcjLon ? "gcj02longitude" : null,
        isMarsCol: hasIsMars ? "isMarsLocation" : null,
        tsIsMs
      };

      const s=document.getElementById("startInput"), e=document.getElementById("endInput");
      s.min=tsToLocalInput(minTs); s.max=tsToLocalInput(maxTs);
      e.min=tsToLocalInput(minTs); e.max=tsToLocalInput(maxTs);
      s.value=tsToLocalInput(minTs); e.value=tsToLocalInput(maxTs);

      document.getElementById("fileStatus").style.display="block";
      document.getElementById("fileStatus").textContent=i18nText("tools.locations.sqliteConnected", { name: file.name, table });

      applyFilter_DB();
    }catch(e){
      const fe=document.getElementById("fileError");
      fe.style.display="block";
      fe.textContent=i18nText("tools.locations.errSQLiteParse", { msg: e.message });
      console.error(e);
      hideLoading();
      window.__TT_SQLDB__=null;
    }
  }

  async function loadFromFile(file){
    const name=(file?.name||"").toLowerCase();
    try{
      if (name.endsWith(".json")){
        const txt = await file.text(); const json = JSON.parse(txt);
        setTrackData(json, file.name);
      } else if (name.endsWith(".db") || name.endsWith(".sqlite")){
        await loadFromSQLite(file);
      } else if (name.endsWith(".csv")){
        showLoading(i18nText("tools.locations.loadingCSV"));
        const txt = await file.text();
        const arr = parseCSV(txt);
        setTrackData(arr, file.name);
      } else if (name.endsWith(".gpx")){
        showLoading(i18nText("tools.locations.loadingGPX"));
        const txt = await file.text();
        const arr = parseGPX(txt);
        setTrackData(arr, file.name);
      } else if (name.endsWith(".kml")){
        showLoading(i18nText("tools.locations.loadingKML"));
        const txt = await file.text();
        const arr = parseKML(txt);
        setTrackData(arr, file.name);
      } else {
        const txt = await file.text();
        const trimmed = txt.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')){
          setTrackData(JSON.parse(trimmed), file.name);
        } else if (/^\s*<\?xml|<gpx/i.test(trimmed)){
          setTrackData(parseGPX(trimmed), file.name);
        } else if (/^\s*<kml/i.test(trimmed)){
          setTrackData(parseKML(trimmed), file.name);
        } else if (trimmed.includes(',') && trimmed.split('\n')[0].includes(',')){
          setTrackData(parseCSV(trimmed), file.name);
        } else {
          throw new Error(i18nText("tools.locations.errUnknownFormat"));
        }
      }
    }catch(e){
      const fe=document.getElementById("fileError");
      fe.style.display="block";
      fe.textContent=i18nText("tools.locations.errFileLoad", { msg: e.message });
      console.error(e);
      hideLoading();
    }
  }

  function setPanelCollapsed(collapsed){
    const panel=document.getElementById("infoPanel");
    const btn=document.getElementById("togglePanel");
    if (collapsed){
      panel.classList.add("collapsed");
      btn.textContent=i18nText("tools.locations.unfold");
      btn.setAttribute("aria-expanded","false");
      localStorage.setItem("tt_panel_collapsed","1");
    } else {
      panel.classList.remove("collapsed");
      btn.textContent=i18nText("tools.locations.fold");
      btn.setAttribute("aria-expanded","true");
      localStorage.setItem("tt_panel_collapsed","0");
    }
  }

  function persistOpts(){
    localStorage.setItem('tt_show_points', document.getElementById('optShowPoints').checked ? '1' : '0');
    localStorage.setItem('tt_show_line',   document.getElementById('optShowLine').checked ? '1' : '0');
    localStorage.setItem('tt_point_color', document.getElementById('pointColor').value || '#5ab1ff');
  }
  function restoreOpts(){
    const sp = localStorage.getItem('tt_show_points'); if (sp!=null) document.getElementById('optShowPoints').checked = sp==='1';
    const sl = localStorage.getItem('tt_show_line');   if (sl!=null) document.getElementById('optShowLine').checked   = sl==='1';
    const pc = localStorage.getItem('tt_point_color'); if (pc) document.getElementById('pointColor').value = pc;
  }

  function init(){
    window.__TT_SQLDB__=null;

    // 地图
    window.map=new BMapGL.Map("map",{ enableRotate:false, enableTilt:false });
    map.centerAndZoom(new BMapGL.Point(116.404,39.915),12);
    map.addControl(new BMapGL.ZoomControl());
    map.enableScrollWheelZoom(true);

    setPanelCollapsed(localStorage.getItem("tt_panel_collapsed")==="1");
    restoreOpts();

    document.getElementById("togglePanel").addEventListener("click",()=>{
      setPanelCollapsed(!document.getElementById("infoPanel").classList.contains("collapsed"));
    });
    document.querySelector(".panel-header").addEventListener("dblclick", ()=>{
      setPanelCollapsed(!document.getElementById("infoPanel").classList.contains("collapsed"));
    });

    document.getElementById("applyBtn").addEventListener("click",()=>{ persistOpts(); applyFilter(); });
    document.getElementById("resetBtn").addEventListener("click",()=>{ persistOpts(); resetRange(); });
    document.getElementById("startInput").addEventListener("change",()=>{ persistOpts(); applyFilter(); });
    document.getElementById("endInput").addEventListener("change",()=>{ persistOpts(); applyFilter(); });
    document.getElementById("optShowPoints").addEventListener("change",()=>{ persistOpts(); applyFilter(); });
    document.getElementById("optShowLine").addEventListener("change",()=>{ persistOpts(); applyFilter(); });
    document.getElementById("pointColor").addEventListener("input",()=>{ persistOpts(); applyFilter(); });

    document.getElementById("fileInput").addEventListener("change",(e)=>{ const f=e.target.files?.[0]; if (f) loadFromFile(f); });
    const dz=document.getElementById("dropzone");
    const prevent=ev=>{ ev.preventDefault(); ev.stopPropagation(); };
    ["dragenter","dragover","dragleave","drop"].forEach(evt=>dz.addEventListener(evt,prevent,false));
    dz.addEventListener("dragenter",()=>dz.classList.add("dragover"));
    dz.addEventListener("dragover",()=>dz.classList.add("dragover"));
    dz.addEventListener("dragleave",()=>dz.classList.remove("dragover"));
    dz.addEventListener("drop",(ev)=>{ dz.classList.remove("dragover"); const f=ev.dataTransfer.files?.[0]; if (f) loadFromFile(f); });

    if (location.protocol === 'file:'){
      const fe=document.getElementById("fileError");
      fe.style.display="block";
      fe.textContent=i18nText("tools.locations.tipHttpServer");
    }

    loadFromInlineScript();
  }

  // 等 i18n 初始化后再 init，以确保初始文本渲染
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
