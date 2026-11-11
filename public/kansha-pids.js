/*
 * 看車 PIDS — 車內旅客資訊顯示器
 * 版面依日本地下鐵車內 LCD 的資訊配置：上方固定「種別＋行先／狀態／站號圈／大站名」，
 * 下方輪播「停車站路線條（直書站名、站號、剩餘分鐘、各站轉乘）」與「のりかえ」頁。
 * 不含任何鐵道公司 logo；配色取自路線色。
 *
 * kanshaPIDS(map, container) -> {update(train|null, visible)}
 * 站號、平假名、路線代號來自 station-meta.json（npm run station-meta 產生），沒有也能跑，只是不顯示。
 */
(function () {
    const L = {
        next: {ja: 'つぎは', kana: 'つぎは', en: 'Next', ko: '다음 역', 'zh-Hant': '下一站'},
        soon: {ja: 'まもなく', kana: 'まもなく', en: 'Soon', ko: '곧 도착', 'zh-Hant': '即將抵達'},
        now: {ja: 'ただいま', kana: 'ただいま', en: 'Now at', ko: '이번 역', 'zh-Hant': '本站'},
        last: {ja: '終点', kana: 'しゅうてん', en: 'Last Stop', ko: '종점', 'zh-Hant': '終點'},
        bound: {
            ja: s => `${s} ゆき`, kana: s => `${s} ゆき`, en: s => `For ${s}`,
            ko: s => `${s} 행`, 'zh-Hant': s => `開往 ${s}`
        },
        delay: {
            ja: n => `この電車は約${n}分遅れて運転しています`,
            en: n => `This train is running about ${n} min late`,
            ko: n => `이 열차는 약 ${n}분 지연 운행 중입니다`,
            'zh-Hant': n => `本列車目前延誤約 ${n} 分鐘`
        }
    };
    // 上方大站名的語言輪播（kana 沒資料時自動跳過）
    const HEAD = [
        {lang: 'ja', dur: 4500}, {lang: 'kana', dur: 3500}, {lang: 'en', dur: 4500},
        {lang: 'ko', dur: 3000}, {lang: 'zh-Hant', dur: 3000}
    ];

    const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&family=Noto+Sans+KR:wght@700;900&family=Noto+Sans+TC:wght@700;900&display=swap');
.kp{--c:#00a37a;position:absolute;right:16px;bottom:28px;width:min(680px,52vw);aspect-ratio:16/9;z-index:6;
  background:#e9e3d6;border-radius:12px;padding:1.4cqw;box-sizing:border-box;box-shadow:0 8px 28px rgba(0,0,0,.45);
  display:none;container-type:inline-size;font-family:"Noto Sans JP","Noto Sans KR","Noto Sans TC",system-ui,sans-serif;color:#222}
.kp.show{display:block;animation:kp-on .45s ease-out}
@keyframes kp-on{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.kp-scr{position:relative;width:100%;height:100%;background:#f3f4f2;border:.5cqw solid #1d1d1d;border-radius:.6cqw;overflow:hidden;box-sizing:border-box}
/* 上方 */
.kp-head{position:absolute;left:0;right:0;top:0;height:19.5cqw}
.kp-head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:.6cqw;background:var(--c)}
.kp-tl{position:absolute;left:2cqw;top:1.4cqw;display:flex;align-items:center;gap:1.4cqw;white-space:nowrap}
.kp-type{background:#2b4a9b;color:#fff;font-weight:700;font-size:3.1cqw;padding:.1cqw 1.2cqw;border-radius:.6cqw}
.kp-type.ex{background:#d32f2f}.kp-type.rp{background:#ef6c00}
.kp-dest{font-weight:700;font-size:3.3cqw}
.kp-label{position:absolute;left:2cqw;bottom:2cqw;font-weight:900;font-size:3.6cqw;line-height:1.1}
.kp-label.en{font-family:"Noto Sans",system-ui,sans-serif}
.kp-label.blink{animation:kp-blink 1.2s steps(1) infinite}
@keyframes kp-blink{60%{opacity:.15}}
.kp-badge{position:absolute;left:23cqw;top:6.4cqw;width:11.6cqw;height:11.6cqw;border-radius:50%;background:#fff;
  border:1.3cqw solid var(--c);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;
  font:700 3cqw/1.05 "Noto Sans",system-ui,sans-serif;color:#222}
.kp-badge b{font-size:3.5cqw}
.kp-badge.none{display:none}
.kp-name{position:absolute;left:36cqw;right:2cqw;top:3.2cqw;height:14cqw;display:flex;align-items:center;justify-content:center}
.kp-name span{font-weight:900;font-size:9.4cqw;white-space:nowrap;letter-spacing:.04em;animation:kp-up .45s cubic-bezier(.2,.8,.2,1)}
.kp-name span.en{font-family:"Noto Sans",system-ui,sans-serif;font-weight:700;letter-spacing:0}
.kp-name span.l{font-size:7.2cqw}.kp-name span.xl{font-size:5.4cqw}
.kp-tl span,.kp-label span{display:inline-block;animation:kp-up .45s cubic-bezier(.2,.8,.2,1)}
@keyframes kp-up{from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:none}}
/* 下方 */
.kp-body{position:absolute;left:0;right:0;top:19.5cqw;bottom:0;overflow:hidden}
.kp-page{position:absolute;inset:0;animation:kp-in .5s cubic-bezier(.2,.8,.2,1)}
@keyframes kp-in{from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}}
.kp-foot{position:absolute;left:2cqw;bottom:.8cqw;font-weight:700;font-size:1.3cqw;line-height:1.3;color:#555}
.kp-ticker{position:absolute;left:0;right:0;bottom:0;height:3.6cqw;background:#c62828;color:#fff;font-weight:700;font-size:2cqw;
  display:none;align-items:center;overflow:hidden;white-space:nowrap;z-index:3}
.kp-ticker.on{display:flex}
.kp-ticker span{display:inline-block;padding-left:100%;animation:kp-scroll 16s linear infinite}
@keyframes kp-scroll{to{transform:translateX(-100%)}}
/* 路線條 */
.kp-c{position:absolute;top:0;bottom:0;transform:translateX(-50%);width:11cqw}
.kp-v{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - 13cqw);writing-mode:vertical-rl;text-orientation:upright;
  font-weight:700;font-size:2.9cqw;letter-spacing:.06em;white-space:nowrap;line-height:1}
.kp-v.sm{font-size:2.25cqw;letter-spacing:0}
.kp-v.xs{font-size:1.8cqw;letter-spacing:0}
.kp-code{position:absolute;left:0;right:0;top:13.2cqw;text-align:center;font:700 1.8cqw/1 "Noto Sans",system-ui,sans-serif}
.kp-band{position:absolute;top:15.6cqw;height:4.2cqw}
.kp-band.g{left:0;background:#4b5560}
.kp-band.c{right:5cqw;background:var(--c)}
.kp-tip{position:absolute;right:2cqw;top:15.1cqw;width:0;height:0;border-top:2.6cqw solid transparent;border-bottom:2.6cqw solid transparent;border-left:3cqw solid var(--c)}
.kp-fun{position:absolute;right:5.4cqw;top:16.5cqw;color:#fff;font-weight:700;font-size:1.9cqw;z-index:1}
.kp-min{position:absolute;left:50%;top:15.85cqw;margin-left:-1.85cqw;width:3.7cqw;height:3.7cqw;border-radius:50%;background:#fff;border:.35cqw solid #333;
  box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:700 1.95cqw/1 "Noto Sans",system-ui,sans-serif;z-index:1}
.kp-chev{position:absolute;top:15.1cqw;width:3.6cqw;height:5.2cqw;margin-left:-1.8cqw;background:#e53935;z-index:2;
  clip-path:polygon(0 0,45% 0,100% 50%,45% 100%,0 100%,55% 50%);animation:kp-nudge 1.2s ease-in-out infinite}
@keyframes kp-nudge{0%,100%{transform:translateX(-.5cqw)}50%{transform:translateX(.6cqw)}}
.kp-xs{position:absolute;left:50%;transform:translateX(-50%);top:20.6cqw;width:10.6cqw;font-weight:700;font-size:1.4cqw;line-height:1.3}
.kp-xs div{display:flex;align-items:center;gap:.4cqw;white-space:nowrap}
.kp-xs div em{font-style:normal;overflow:hidden;text-overflow:ellipsis;min-width:0}
.kp-dot{flex:none;width:1.55cqw;height:1.55cqw;border-radius:50%;border:.3cqw solid;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;
  font:700 .95cqw/1 "Noto Sans",system-ui,sans-serif;background:#fff}
.kp-dot.sq{border-radius:.25cqw;color:#fff}
/* のりかえ */
.kp-xfh{position:absolute;left:0;right:0;top:0;height:5cqw;background:#e2e5e7;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:2.8cqw}
.kp-xfl{position:absolute;left:4cqw;right:3cqw;top:6.6cqw;bottom:2cqw;display:grid;grid-template-columns:1fr 1fr;align-content:start;gap:1.2cqw 3cqw}
.kp-xfl>div{display:flex;align-items:center;gap:1.4cqw;animation:kp-up .4s both}
.kp-xfl .kp-dot{width:5.6cqw;height:5.6cqw;border-width:.9cqw;font-size:2.4cqw}
.kp-xfl .kp-dot.sq{border-radius:.8cqw}
.kp-xfl b{display:block;font-size:3cqw;line-height:1.15;white-space:nowrap}
.kp-xfl small{display:block;font:500 2cqw/1.2 "Noto Sans",system-ui,sans-serif;white-space:nowrap}
.kp-xfl.dense .kp-dot{width:4.2cqw;height:4.2cqw;font-size:1.8cqw}.kp-xfl.dense b{font-size:2.3cqw}.kp-xfl.dense small{font-size:1.5cqw}
/* 月台圖 */
.kp-pf-board{position:absolute;transform:translateX(-50%);box-sizing:border-box;background:#f3b33d;border:.25cqw solid #8a5a00;border-radius:.4cqw;padding:.3cqw 1cqw;
  text-align:center;white-space:nowrap;z-index:2;animation:kp-up .4s both}
.kp-pf-board b{display:block;font-size:1.9cqw;line-height:1.2}
.kp-pf-board small{display:block;font:600 1.15cqw/1.2 "Noto Sans",system-ui,sans-serif}
.kp-pf-lead{position:absolute;width:.3cqw;background:#333;transform:translateX(-50%)}
.kp-pf-ic{position:absolute;top:17cqw;transform:translateX(-50%);display:flex;gap:.3cqw}
.kp-pf-ic svg{width:3.2cqw;height:3.2cqw;background:#fff;border:.25cqw solid #333;border-radius:.4cqw;box-sizing:border-box;padding:.2cqw}
.kp-pf-plat{position:absolute;left:5cqw;right:9cqw;top:21cqw;height:1cqw;background:#9aa3ab}
.kp-pf-car{position:absolute;top:22.4cqw;height:4cqw;background:#fff;border:.3cqw solid #333;box-sizing:border-box;border-radius:.6cqw;
  display:flex;align-items:center;justify-content:center;font:700 2cqw/1 "Noto Sans",system-ui,sans-serif}
.kp-pf-car.here{background:#e53935;color:#fff;border-color:#b71c1c}
.kp-pf-here{position:absolute;top:27.2cqw;transform:translateX(-50%);background:#e53935;color:#fff;font-weight:700;font-size:1.6cqw;
  line-height:1.1;padding:.3cqw .8cqw;border-radius:.4cqw;text-align:center;z-index:3;animation:kp-blink 1.4s steps(1) infinite}
.kp-pf-here small{display:block;font:600 1cqw "Noto Sans",system-ui,sans-serif}
.kp-pf-arrow{position:absolute;right:3cqw;top:22.1cqw;font:900 4cqw/1 system-ui,sans-serif;color:#333}
.kp-pf-note{position:absolute;left:2cqw;bottom:.6cqw;font-weight:700;font-size:1.3cqw;color:#555}
.kp-pf-note.img{color:#c62828}
@media (max-width:600px){.kp{left:8px;right:8px;bottom:12px;width:auto}}`;

    const colorOf = c => (Array.isArray(c) ? c[0] : c) || '#00a37a';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));

    window.kanshaPIDS = function (map, container) {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        let meta = {stations: {}, lines: {}};
        fetch('station-meta.json').then(r => (r.ok ? r.json() : null)).then(j => {
            if (j) {
                meta = j;
                seqKey = '';
            }
        }).catch(() => {});

        const root = document.createElement('div');
        root.className = 'kp';
        root.innerHTML = '<div class="kp-scr"><div class="kp-head"><div class="kp-tl"></div><div class="kp-label"></div>' +
            '<div class="kp-badge none"></div><div class="kp-name"></div></div><div class="kp-body"></div>' +
            '<div class="kp-ticker"><span></span></div></div>';
        container.appendChild(root);
        const $ = s => root.querySelector(s);
        const tl = $('.kp-tl'), label = $('.kp-label'), badge = $('.kp-badge'), nameEl = $('.kp-name'),
            body = $('.kp-body'), ticker = $('.kp-ticker');

        let train = null, visible = false;
        let seqKey = '', st = null, pages = [], page = 0, pageT = 0, heads = [], head = 0, headT = 0, tickKey = '';

        const sMeta = s => (s && meta.stations[s.id]) || {};
        const now = () => (map.clock ? map.clock.getTimeOffset() : 0);

        // 各語言站名：kana 用 ODPT 的 ja-Hrkt
        function sName(s, lang) {
            if (!s) return '';
            if (lang === 'kana') return sMeta(s).kana || '';
            const t = s.title || {};
            return t[lang] || t.en || t.ja || '';
        }
        const tTitle = (o, lang) => (o && o.title ? o.title[lang === 'kana' ? 'ja' : lang] || o.title.en || o.title.ja || '' : '');

        function splitCode(code) {
            const m = /^([A-Za-z]+)-?(\d+)$/.exec(code || '');
            return m ? {line: m[1].toUpperCase(), num: m[2]} : null;
        }

        function stopList() {
            const tb = train.timetable;
            if (tb && tb.stations && tb.stations.length) {
                return {stations: tb.stations, arr: tb.arrivalTimes || [], dep: tb.departureTimes || []};
            }
            const r = train.r, stations = r.stations.slice();
            if (train.d && r.descending && train.d.id === r.descending.id) stations.reverse();
            return {stations, arr: [], dep: []};
        }

        function transfers(station) {
            const g = map.stationGroupLookup && map.stationGroupLookup.get(station.group);
            const seen = new Set(), out = [];
            for (const s of g ? g.stations.concat(g.hidden || []) : []) {
                const r = s && s.railway;
                if (!r || r === train.r || seen.has(r.id)) continue;
                seen.add(r.id);
                out.push(r);
            }
            return out;
        }

        function dot(r) {
            const c = colorOf(r.color), code = meta.lines[r.id] && meta.lines[r.id].code;
            return code ?
                `<span class="kp-dot" style="border-color:${c}">${esc(code.slice(0, 2))}</span>` :
                `<span class="kp-dot sq" style="border-color:${c};background:${c}"></span>`;
        }

        function computeState() {
            const delay = train.delay || 0;
            const {stations} = stopList();
            if (train.standing || !train.arrivalStation) {
                return {phase: 'now', target: train.departureStation, last: stations[stations.length - 1] === train.departureStation};
            }
            const eta = train.arrivalTime !== undefined ? (train.arrivalTime + delay - now()) / 1000 : Infinity;
            return {
                phase: eta <= 40 ? 'soon' : 'next', target: train.arrivalStation, eta,
                last: stations[stations.length - 1] === train.arrivalStation
            };
        }

        // ---- 上方 ----
        function renderHead() {
            const h = heads[head], lang = h.lang, t = st.target;
            const typeTxt = tTitle(train.y, lang) || tTitle(train.r, lang);
            const typeJa = tTitle(train.y, 'ja');
            const typeCls = /特|急|Express/.test(typeJa) ? ' ex' : /快速/.test(typeJa) ? ' rp' : '';
            const ds = train.ds && train.ds[0];
            const destName = ds ? (lang === 'kana' ? sMeta(ds).kana || sName(ds, 'ja') : sName(ds, lang)) : '';
            const dest = ds ? L.bound[lang](destName) : tTitle(train.d, lang);
            tl.innerHTML = `<span class="kp-type${typeCls}">${esc(typeTxt)}</span><span class="kp-dest">${esc(dest)}</span>`;

            let lab = L[st.phase][lang];
            if (st.last && st.phase !== 'now') lab += `<br>${L.last[lang]}`;
            label.className = `kp-label${lang === 'en' ? ' en' : ''}${st.phase === 'soon' ? ' blink' : ''}`;
            label.innerHTML = `<span>${lab}</span>`;

            const nm = sName(t, lang);
            const len = lang === 'en' ? nm.length / 2 : nm.length;
            const cls = (lang === 'en' ? 'en' : '') + (len > 8 ? ' xl' : len > 5 ? ' l' : '');
            nameEl.innerHTML = `<span class="${cls}">${esc(nm)}</span>`;
        }

        function renderBadge() {
            const c = splitCode(sMeta(st.target).code);
            badge.className = `kp-badge${c ? '' : ' none'}`;
            badge.innerHTML = c ? `${esc(c.line)}<b>${esc(c.num)}</b>` : '';
        }

        // ---- 路線條 ----
        function routePage() {
            const {stations, arr, dep} = stopList();
            let idx = stations.indexOf(train.departureStation);
            if (idx < 0) idx = 0;
            const standing = st.phase === 'now';
            const view = stations.slice(idx, idx + 8), n = view.length;
            const colW = 88 / 8;
            const x = i => 6 + colW * (i + 0.5) - colW / 2 + 3; // 每欄中心（%）
            const chevX = standing ? x(0) : (x(0) + x(Math.min(1, n - 1))) / 2;
            const delay = train.delay || 0, t0 = now();
            let h = `<div class="kp-page"><div class="kp-band g" style="width:${chevX}%"></div>` +
                `<div class="kp-band c" style="left:${chevX}%"></div><div class="kp-tip"></div><div class="kp-fun">分</div>` +
                `<div class="kp-chev" style="left:${chevX}%"></div>`;
            view.forEach((s, i) => {
                const gi = idx + i, ja = sName(s, 'ja');
                const code = sMeta(s).code, sc = splitCode(code);
                const tm = arr[gi] !== undefined ? arr[gi] : dep[gi];
                const min = i > 0 && tm !== undefined ? Math.max(1, Math.ceil((tm + delay - t0) / 60000)) : null;
                const xs = transfers(s).slice(0, 4);
                h += `<div class="kp-c" style="left:${x(i)}%">` +
                    `<div class="kp-v${ja.length > 6 ? ' xs' : ja.length > 4 ? ' sm' : ''}">${esc(ja)}</div>` +
                    (code ? `<div class="kp-code">${esc(sc ? `${sc.line}-${sc.num}` : code)}</div>` : '') +
                    (min !== null ? `<div class="kp-min">${min}</div>` : '') +
                    (xs.length ? `<div class="kp-xs">${xs.map(r => `<div>${dot(r)}<em>${esc(tTitle(r, 'ja'))}</em></div>`).join('')}</div>` : '') +
                    '</div>';
            });
            h += delayMin() ? '' : '<div class="kp-foot">※運転状況により、時刻が前後する場合があります。</div>';
            return h + '</div>';
        }

        // ---- のりかえ ----
        function transferPage() {
            const list = transfers(st.target).slice(0, 10);
            return '<div class="kp-page"><div class="kp-xfh">のりかえ / Transfer</div>' +
                `<div class="kp-xfl${list.length > 6 ? ' dense' : ''}">` +
                list.map((r, i) => `<div style="animation-delay:${100 + i * 60}ms">${dot(r)}<span><b>${esc(tTitle(r, 'ja'))}</b>` +
                    `<small>${esc(tTitle(r, 'en'))}</small></span></div>`).join('') + '</div></div>';
        }

        function delayMin() {
            return Math.floor((train.delay || 0) / 60000);
        }


        // ---- 月台圖：用出口座標推算各出口靠第幾節，沒資料就產示意圖 ----
        const ICON = {
            stairs: '<svg viewBox="0 0 24 24"><path d="M2 21h5v-4h4v-4h4V9h4V5h3" fill="none" stroke="#222" stroke-width="2.6"/></svg>',
            escalator: '<svg viewBox="0 0 24 24"><path d="M2 20h5L17 8h5" fill="none" stroke="#222" stroke-width="2.6"/><path d="M2 15h4l9-9h7" fill="none" stroke="#222" stroke-width="1.4"/></svg>',
            elevator: '<svg viewBox="0 0 24 24"><rect x="4" y="2.5" width="16" height="19" rx="1.5" fill="none" stroke="#222" stroke-width="2"/><path d="M12 5l3.5 4.5h-7zM12 19l3.5-4.5h-7z" fill="#222"/></svg>',
            ramp: '<svg viewBox="0 0 24 24"><path d="M2 20L22 10v10z" fill="#222"/></svg>'
        };
        const CODE_RE = /^[A-Za-z]{0,2}\d+[a-z]?$/;

        function hash(str) {
            let h = 2166136261;
            for (let i = 0; i < str.length; i++) {
                h ^= str.charCodeAt(i);
                h = Math.imul(h, 16777619);
            }
            return () => {
                h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
                return ((h >>> 0) % 10000) / 10000;
            };
        }

        function platformData() {
            const s = st.target, {stations} = stopList(), i = stations.indexOf(s);
            const n = Math.min(16, Math.max(2, +train.carComposition || +train.r.carComposition || 8));
            const prev = stations[i - 1] || (st.phase === 'now' ? null : train.departureStation), next = stations[i + 1];
            const from = prev || s, to = prev ? (next || s) : next;
            let exits = (s.exit || []).filter(e => e && e.coord);
            if (!exits.length) {
                const g = map.stationGroupLookup && map.stationGroupLookup.get(s.group);
                for (const o of g ? g.stations : []) {
                    const ex = (o.exit || []).filter(e => e && e.coord);
                    if (ex.length) {
                        exits = ex;
                        break;
                    }
                }
            }
            if (exits.length && s.coord && from && to && from.coord && to.coord && from !== to) {
                const k = Math.cos(s.coord[1] * Math.PI / 180) * 111320, kl = 110540;
                let ux = (to.coord[0] - from.coord[0]) * k, uy = (to.coord[1] - from.coord[1]) * kl;
                const len = Math.hypot(ux, uy) || 1;
                ux /= len;
                uy /= len;
                const half = n * 10, groups = new Map();
                for (const e of exits) {
                    const off = (e.coord[0] - s.coord[0]) * k * ux + (e.coord[1] - s.coord[1]) * kl * uy;
                    const car = Math.min(n - 1, Math.max(0, Math.floor((off + half) / 20))); // 0 = 最後面（左）
                    const gr = groups.get(car) || {car, exits: [], fac: new Set()};
                    gr.exits.push(e);
                    (e.facilities || ['stairs']).forEach(f => gr.fac.add(f));
                    groups.set(car, gr);
                }
                return {n, kind: 'est', groups: [...groups.values()].sort((a, b) => a.car - b.car).slice(0, 5)};
            }
            // 沒資料：用站 ID 當種子產固定的示意圖（每次同一站都長一樣）
            const rnd = hash(s.id || tTitle(s, 'en'));
            const names = [['北口', 'North Gate'], ['南口', 'South Gate'], ['中央口', 'Central Gate'], ['東口', 'East Gate'], ['西口', 'West Gate']];
            const count = 2 + Math.floor(rnd() * 2), used = new Set(), groups = [];
            while (groups.length < count) {
                const car = Math.floor(rnd() * n);
                if (used.has(car)) continue;
                used.add(car);
                const nm = names.splice(Math.floor(rnd() * names.length), 1)[0];
                const fac = new Set(['stairs']);
                if (rnd() > 0.4) fac.add('escalator');
                if (rnd() > 0.5) fac.add('elevator');
                groups.push({car, fake: nm, fac});
            }
            return {n, kind: 'img', groups: groups.sort((a, b) => a.car - b.car)};
        }

        function boardText(g) {
            if (g.fake) return {ja: `${g.fake[0]}改札方面`, en: `${g.fake[1]}`};
            // 電梯（ID 含 .EV）只算設施，不當出口名
            const ex = g.exits.filter(e => !/\.EV[^.]*$/.test(e.id || ''));
            if (!ex.length) return {ja: 'エレベーター', en: 'Elevator'};
            const names = ex.map(e => (e.title && (e.title.ja || e.title.en)) || '').filter(Boolean);
            const more = names.length > 3 ? '…' : '';
            if (names.every(t => CODE_RE.test(t))) {
                return {ja: `${names.slice(0, 3).join('・')}${more} 出口`, en: `Exit ${names.slice(0, 3).join('/')}${more}`};
            }
            const en = ex.slice(0, 2).map(e => (e.description && e.description.en) || (e.title && e.title.en) || '').join(' / ');
            return {ja: `${names.slice(0, 3).join('・')}${more}方面`, en};
        }

        function platformPage() {
            const d = platformData(), n = d.n;
            const L0 = 7, W = 80, cw = W / n;          // 車廂區域：左 7% 寬 80%
            const cx = c => L0 + cw * (c + 0.5);
            let h = '<div class="kp-page">';
            h += '<div class="kp-pf-plat"></div>';
            for (let c = 0; c < n; c++) {
                h += `<div class="kp-pf-car${c === n - 1 ? ' here' : ''}" style="left:calc(${L0 + cw * c}% + .25cqw);width:calc(${cw}% - .5cqw)">${c + 1}</div>`;
            }
            h += `<div class="kp-pf-arrow">→</div><div class="kp-pf-here" style="left:${cx(n - 1)}%">現在地<small>You are here</small></div>`;
            // 看板：估寬度，貪婪塞進兩排，塞不下就往右推；不准超出畫面
            const rows = [[], []];
            d.groups.forEach((g, i) => {
                const x = cx(g.car), t = boardText(g);
                const w = Math.max(t.ja.length * 1.95, t.en.length * 0.72) + 2.6;
                let best = null;
                for (let r = 0; r < 2 && !best; r++) {
                    let bx = Math.min(99 - w / 2, Math.max(1 + w / 2, x));
                    const last = rows[r][rows[r].length - 1];
                    if (!last || bx - w / 2 >= last.right + 0.8) best = {r, bx};
                }
                if (!best) {
                    const r = rows[0][rows[0].length - 1].right <= rows[1][rows[1].length - 1].right ? 0 : 1;
                    best = {r, bx: Math.min(99 - w / 2, rows[r][rows[r].length - 1].right + 0.8 + w / 2)};
                }
                rows[best.r].push({right: best.bx + w / 2});
                const top = best.r ? 7.4 : 1.6;
                h += `<div class="kp-pf-board" style="left:${best.bx}%;top:${top}cqw;animation-delay:${i * 90}ms"><b>${esc(t.ja)}</b><small>${esc(t.en)}</small></div>`;
                h += `<div class="kp-pf-lead" style="left:${x}%;top:${top + 4.4}cqw;height:${17 - top - 4.4}cqw"></div>`;
                h += `<div class="kp-pf-ic" style="left:${x}%">${['stairs', 'escalator', 'elevator', 'ramp'].filter(f => g.fac.has(f)).map(f => ICON[f]).join('')}</div>`;
            });
            h += d.kind === 'est' ?
                '<div class="kp-pf-note">※出口の位置から推算した目安です。実際の階段位置とは異なる場合があります。</div>' :
                '<div class="kp-pf-note img">※イメージです（この駅の出口データなし）</div>';
            return h + '</div>';
        }

        function renderBody() {
            const p = pages[page];
            body.innerHTML = p === 'route' ? routePage() : p === 'platform' ? platformPage() : transferPage();
        }

        function rebuild(t) {
            st = computeState();
            const hasXf = transfers(st.target).length > 0;
            const hasKana = !!sMeta(st.target).kana;
            heads = HEAD.filter(h => h.lang !== 'kana' || hasKana);
            const xfp = hasXf ? ['transfer'] : [];
            pages = st.phase === 'soon' ? ['platform', ...xfp] :
                st.phase === 'next' ? ['route', 'platform', ...xfp] : ['route'];
            page = head = 0;
            pageT = headT = t;
            root.style.setProperty('--c', colorOf((train.v || train.r).color));
            renderHead();
            renderBadge();
            renderBody();
        }

        function tick() {
            if (!visible || !train) return;
            const t = performance.now();
            const s = computeState();
            const key = `${train.id}|${s.phase}|${s.target && s.target.id}`;
            if (key !== seqKey) {
                // 狀態一變（例如進入まもなく）立刻重播，跟實車一樣
                seqKey = key;
                rebuild(t);
            } else {
                st = s;
                if (t - headT > heads[head].dur) {
                    head = (head + 1) % heads.length;
                    headT = t;
                    renderHead();
                }
                if (t - pageT > (pages[page] === 'route' ? 11000 : pages[page] === 'platform' ? 9000 : 7000)) {
                    page = (page + 1) % pages.length;
                    pageT = t;
                    renderBody();
                }
            }
            const d = delayMin();
            const tk = d >= 1 ? ['ja', 'en', 'ko', 'zh-Hant'].map(l => L.delay[l](d)).join('　　　') : '';
            if (tk !== tickKey) {
                tickKey = tk;
                ticker.classList.toggle('on', !!tk);
                ticker.firstChild.textContent = tk;
            }
        }
        setInterval(() => {
            try {
                tick();
            } catch (e) {
                console.warn('[kansha-pids]', e);
            }
        }, 200);

        return {
            update(t, show) {
                const want = !!(t && show);
                if (t !== train) seqKey = '';
                train = t || null;
                if (want !== visible) {
                    visible = want;
                    root.classList.toggle('show', want);
                    seqKey = '';
                }
            }
        };
    };
})();
