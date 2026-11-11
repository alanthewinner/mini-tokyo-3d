/*
 * 看車 PIDS — 車內旅客資訊顯示器（原創設計，行為參考日本車內 LCD）
 * kanshaPIDS(map, container) -> {update(train|null, visible)}
 *
 * 頁面狀態機：
 *   行駛中、距到站 > 40 秒  -> 「次は」日/英/中/韓 輪播 -> 停車站路線圖 -> 轉乘資訊
 *   行駛中、距到站 ≤ 40 秒  -> 立刻跳「まもなく」(閃爍) 四語輪播 -> 轉乘資訊
 *   停站中                  -> 「ただいま」四語輪播 -> 停車站路線圖
 * 用到 mt3d.Map 內部欄位：clock、stationGroupLookup、train.timetable 等。
 */
(function () {
    const LANGS = ['ja', 'en', 'zh-Hant', 'ko'];
    const T = {
        next: {ja: '次は', en: 'Next', 'zh-Hant': '下一站', ko: '다음 역'},
        soon: {ja: 'まもなく', en: 'Arriving at', 'zh-Hant': '即將抵達', ko: '곧 도착'},
        now: {ja: 'ただいま', en: 'Now stopping at', 'zh-Hant': '本站', ko: '이번 역'},
        transfer: {ja: '乗換えのご案内', en: 'Transfers', 'zh-Hant': '轉乘資訊', ko: '환승 안내'},
        stops: {ja: '停車駅', en: 'Stops', 'zh-Hant': '停靠站', ko: '정차역'},
        terminal: {ja: '終点', en: 'Terminal', 'zh-Hant': '終點', ko: '종점'},
        bound: {ja: s => `${s} 行`, en: s => `for ${s}`, 'zh-Hant': s => `開往 ${s}`, ko: s => `${s} 행`},
        delay: {
            ja: n => `この列車は約${n}分遅れて運転しています`,
            en: n => `This train is running about ${n} min behind schedule`,
            'zh-Hant': n => `本列車目前延誤約 ${n} 分鐘`,
            ko: n => `이 열차는 약 ${n}분 지연 운행 중입니다`
        }
    };

    const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&family=Noto+Sans+TC:wght@500;700;900&family=Noto+Sans+KR:wght@500;700;900&display=swap');
.kp{--c:#4db6ac;position:absolute;right:16px;bottom:28px;width:min(560px,46vw);aspect-ratio:16/9;z-index:6;
  background:#0d1117;border-radius:10px;padding:8px;box-sizing:border-box;box-shadow:0 8px 28px rgba(0,0,0,.45);
  display:none;font-family:"Noto Sans JP","Noto Sans TC","Noto Sans KR",system-ui,sans-serif;container-type:inline-size}
.kp.show{display:block;animation:kp-on .45s ease-out}
@keyframes kp-on{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.kp-scr{position:relative;width:100%;height:100%;background:#fff;border-radius:4px;overflow:hidden;display:flex;flex-direction:column}
.kp-head{height:17%;display:flex;align-items:center;background:linear-gradient(#2a3442,#18202b);color:#fff;gap:2.2cqw;padding-right:2.5cqw}
.kp-head .bar{width:2.2cqw;height:100%;background:var(--c)}
.kp-type{font-weight:900;font-size:3.6cqw;padding:.4cqw 1.6cqw;border-radius:.8cqw;background:var(--c);color:#fff;white-space:nowrap}
.kp-dest{font-weight:700;font-size:4.3cqw;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-dest span,.kp-type span{display:inline-block;animation:kp-flip .5s ease-out}
@keyframes kp-flip{from{opacity:0;transform:translateY(60%)}to{opacity:1;transform:none}}
.kp-clock{font:700 3.6cqw/1 "Noto Sans",system-ui,sans-serif;font-variant-numeric:tabular-nums;opacity:.9}
.kp-body{position:relative;flex:1;overflow:hidden}
.kp-page{position:absolute;inset:0;animation:kp-in .4s cubic-bezier(.2,.8,.2,1)}
@keyframes kp-in{from{transform:translateX(100%)}to{transform:none}}
.kp-ticker{height:9%;background:#c62828;color:#fff;font-weight:700;font-size:2.8cqw;display:none;align-items:center;overflow:hidden;white-space:nowrap}
.kp-ticker.on{display:flex}
.kp-ticker span{display:inline-block;padding-left:100%;animation:kp-scroll 14s linear infinite}
@keyframes kp-scroll{to{transform:translateX(-100%)}}
/* 站名頁 */
.kp-name{display:flex;flex-direction:column;justify-content:center;padding:0 5cqw 9cqw}
.kp-label{font-weight:900;font-size:5cqw;color:var(--c);animation:kp-fade .4s .1s both}
.kp-label.blink{animation:kp-blink 1s steps(1) infinite}
@keyframes kp-blink{50%{opacity:0}}
@keyframes kp-fade{from{opacity:0;transform:translateX(-3cqw)}to{opacity:1;transform:none}}
.kp-big{font-weight:900;font-size:13cqw;line-height:1.15;color:#111;white-space:nowrap;animation:kp-wipe .7s .15s cubic-bezier(.3,.7,.2,1) both}
.kp-big.l{font-size:9cqw}.kp-big.xl{font-size:6.6cqw}
@keyframes kp-wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.kp-sub{font-weight:700;font-size:3.6cqw;color:#555;animation:kp-fade .4s .5s both}
.kp-eta{position:absolute;right:5cqw;top:5cqw;font-weight:700;font-size:3.4cqw;color:#333;background:#f1f3f5;border-radius:1cqw;padding:.6cqw 1.6cqw}
.kp-mini{position:absolute;left:5cqw;right:5cqw;bottom:3.5cqw;height:7cqw}
.kp-mini .ln{position:absolute;left:0;right:0;top:1.3cqw;height:1.4cqw;background:var(--c);border-radius:1cqw}
.kp-mini .s{position:absolute;top:0;transform:translateX(-50%);text-align:center;font-weight:700;font-size:2.3cqw;color:#333;white-space:nowrap}
.kp-mini .s i{display:block;width:4cqw;height:4cqw;margin:0 auto .4cqw;border-radius:50%;background:#fff;border:.7cqw solid var(--c);box-sizing:border-box}
.kp-mini .s.t i{background:var(--c);animation:kp-blink 1s steps(1) infinite}
/* 停車站路線圖 */
.kp-stops{padding:2.5cqw 4cqw}
.kp-stops h4{margin:0;font-weight:900;font-size:3.4cqw;color:#333}
.kp-rail{position:absolute;left:4cqw;right:4cqw;top:33cqw;height:2.4cqw;background:var(--c);border-radius:2cqw}
.kp-rail.pass{background:#c4c8cd}
.kp-col{position:absolute;top:8cqw;width:9cqw;height:36cqw;transform:translateX(-50%);animation:kp-rise .4s both}
@keyframes kp-rise{from{opacity:0;transform:translate(-50%,3cqw)}to{opacity:1;transform:translateX(-50%)}}
.kp-col .v{writing-mode:vertical-rl;text-orientation:upright;font-weight:900;font-size:3.5cqw;letter-spacing:.1em;color:#111;
  position:absolute;top:0;left:50%;transform:translateX(-50%);height:22cqw;overflow:hidden;white-space:nowrap}
.kp-col .v.sm{font-size:2.7cqw;letter-spacing:0}
.kp-col.past .v{color:#aaa}
.kp-col .d{position:absolute;left:50%;top:23cqw;margin-left:-2.2cqw;width:4.4cqw;height:4.4cqw;border-radius:50%;background:#fff;border:.8cqw solid var(--c);box-sizing:border-box;z-index:1}
.kp-col.past .d{border-color:#c4c8cd}
.kp-col.t .d{background:var(--c)}
.kp-col.end .d{border-radius:.6cqw}
.kp-col .m{position:absolute;left:50%;transform:translateX(-50%);top:29cqw;font:700 2.6cqw "Noto Sans",system-ui,sans-serif;color:#333;white-space:nowrap}
.kp-col .m b{font-size:3.6cqw}
.kp-arrow{position:absolute;top:31.2cqw;width:0;height:0;border-top:3cqw solid transparent;border-bottom:3cqw solid transparent;
  border-left:4.4cqw solid #e53935;transform:translateX(-50%);animation:kp-nudge 1s ease-in-out infinite;z-index:2}
@keyframes kp-nudge{0%,100%{margin-left:-1.2cqw;opacity:1}50%{margin-left:1.2cqw;opacity:.35}}
/* 轉乘 */
.kp-xf{padding:3cqw 5cqw}
.kp-xf h4{margin:0 0 .6cqw;font-weight:900;font-size:3.4cqw;color:#333}
.kp-xf .at{font-weight:900;font-size:6.4cqw;color:#111;margin-bottom:2cqw}
.kp-xf .at small{font-size:3.2cqw;color:#666;margin-left:1.4cqw}
.kp-xf ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:1.6cqw 3cqw}
.kp-xf li{display:flex;align-items:center;gap:1.6cqw;font-weight:700;font-size:3.4cqw;color:#111;animation:kp-fade .35s both}
.kp-xf li i{width:2.2cqw;height:5.6cqw;border-radius:1cqw;flex:none}
.kp-xf li small{display:block;font-size:2.3cqw;color:#666;font-weight:500}
@media (max-width:600px){.kp{left:8px;right:8px;bottom:12px;width:auto}}`;

    const col = c => (Array.isArray(c) ? c[0] : c) || '#4db6ac';
    const tt = (obj, lang) => (obj && obj.title && (obj.title[lang] || obj.title.en || obj.title.ja)) || '';
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
    const sizeCls = s => (s.length > 9 ? ' xl' : s.length > 5 ? ' l' : '');

    window.kanshaPIDS = function (map, container) {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const root = document.createElement('div');
        root.className = 'kp';
        root.innerHTML = '<div class="kp-scr"><div class="kp-head"><div class="bar"></div><div class="kp-type"></div>' +
            '<div class="kp-dest"></div><div class="kp-clock"></div></div><div class="kp-body"></div>' +
            '<div class="kp-ticker"><span></span></div></div>';
        container.appendChild(root);
        const $ = s => root.querySelector(s);
        const body = $('.kp-body'), typeEl = $('.kp-type'), destEl = $('.kp-dest'),
            clockEl = $('.kp-clock'), ticker = $('.kp-ticker');

        let train = null, visible = false, seq = [], page = 0, pageStart = 0, seqKey = '', headKey = '', tickKey = '';

        const nowOff = () => (map.clock ? map.clock.getTimeOffset() : 0);

        function stopList(t) {
            const tb = t.timetable;
            if (tb && tb.stations && tb.stations.length) {
                return {stations: tb.stations, arr: tb.arrivalTimes || [], dep: tb.departureTimes || []};
            }
            const r = t.r, stations = r.stations.slice();
            if (t.d && r.descending && t.d.id === r.descending.id) stations.reverse();
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
            return out.slice(0, 8);
        }

        function state() {
            const t = train, delay = t.delay || 0;
            if (t.standing || !t.arrivalStation) {
                return {phase: 'now', target: t.departureStation};
            }
            const eta = t.arrivalTime !== undefined ? (t.arrivalTime + delay - nowOff()) / 1000 : Infinity;
            return {phase: eta <= 40 ? 'soon' : 'next', target: t.arrivalStation, eta};
        }

        function buildSeq(st) {
            const names = LANGS.map(lang => ({kind: 'name', lang, dur: 3600}));
            const xf = transfers(st.target).length ? [{kind: 'xf', dur: 6500}] : [];
            if (st.phase === 'next') return names.concat([{kind: 'stops', dur: 9000}], xf);
            if (st.phase === 'soon') return names.concat(xf);
            return names.concat([{kind: 'stops', dur: 8000}]);
        }

        function namePage(p, st) {
            const s = st.target, lang = p.lang;
            const big = tt(s, lang), sub = lang === 'ja' ? tt(s, 'en') : tt(s, 'ja');
            const label = T[st.phase][lang];
            let eta = '';
            if (st.phase === 'next' && isFinite(st.eta)) {
                const m = Math.max(1, Math.ceil(st.eta / 60));
                eta = `<div class="kp-eta">${lang === 'en' ? `${m} min` : lang === 'ko' ? `약 ${m}분` : `約${m}分`}</div>`;
            }
            // 迷你路線：目標站前一站 + 目標站 + 後面兩站
            const {stations} = stopList(train);
            const ti = stations.indexOf(s);
            let mini = '';
            if (ti >= 0) {
                const view = stations.slice(Math.max(0, ti - 1), ti + 3);
                mini = '<div class="kp-mini"><div class="ln"></div>' + view.map((v, i) =>
                    `<div class="s${v === s ? ' t' : ''}" style="left:${((i + 0.5) / view.length) * 100}%"><i></i>${esc(tt(v, lang))}</div>`).join('') + '</div>';
            }
            return `<div class="kp-page kp-name">${eta}<div class="kp-label${st.phase === 'soon' ? ' blink' : ''}">${esc(label)}</div>` +
                `<div class="kp-big${sizeCls(big)}">${esc(big)}</div><div class="kp-sub">${esc(sub)}</div>${mini}</div>`;
        }

        function stopsPage(st) {
            const {stations, arr, dep} = stopList(train);
            let idx = stations.indexOf(train.departureStation);
            if (idx < 0) idx = 0;
            const standing = st.phase === 'now';
            const from = idx, view = stations.slice(from, from + 8), n = view.length;
            const last = from + n - 1 === stations.length - 1;
            const x = i => 6 + (i / Math.max(1, n - 1)) * 88;
            const delay = train.delay || 0, now = nowOff();
            const arrowX = standing ? x(0) : (x(0) + x(Math.min(1, n - 1))) / 2;
            let h = `<div class="kp-page kp-stops"><h4>${T.stops.ja} <span style="color:#888;font-weight:700">${T.stops.en}</span></h4>`;
            h += `<div class="kp-rail pass" style="right:${100 - arrowX}%"></div><div class="kp-rail" style="left:${arrowX}%"></div>`;
            view.forEach((s, i) => {
                const gi = from + i, past = !standing && i === 0;
                const tm = arr[gi] !== undefined ? arr[gi] : dep[gi];
                let m = '';
                if (i > 0 && tm !== undefined) {
                    m = `<b>${Math.max(1, Math.ceil((tm + delay - now) / 60000))}</b>分`;
                } else if (i === n - 1 && last) {
                    m = T.terminal.ja;
                }
                const cls = (past ? ' past' : '') + (s === st.target ? ' t' : '') + (i === n - 1 && last ? ' end' : '');
                h += `<div class="kp-col${cls}" style="left:${x(i)}%;animation-delay:${i * 60}ms"><div class="v${tt(s, 'ja').length > 4 ? ' sm' : ''}">${esc(tt(s, 'ja'))}</div><div class="d"></div><div class="m">${m}</div></div>`;
            });
            h += `<div class="kp-arrow" style="left:${arrowX}%"></div></div>`;
            return h;
        }

        function xfPage(st) {
            const list = transfers(st.target);
            return `<div class="kp-page kp-xf"><h4>${T.transfer.ja}　<span style="color:#888">${T.transfer.en}</span></h4>` +
                `<div class="at">${esc(tt(st.target, 'ja'))}<small>${esc(tt(st.target, 'en'))}</small></div><ul>` +
                list.map((r, i) => `<li style="animation-delay:${120 + i * 70}ms"><i style="background:${col(r.color)}"></i>` +
                    `<span>${esc(tt(r, 'ja'))}<small>${esc(tt(r, 'en'))}</small></span></li>`).join('') + '</ul></div>';
        }

        function render(st) {
            const p = seq[page];
            if (!p) return;
            body.innerHTML = p.kind === 'name' ? namePage(p, st) : p.kind === 'stops' ? stopsPage(st) : xfPage(st);
        }

        function header(now) {
            const lang = seq[page] && seq[page].lang ? seq[page].lang : LANGS[Math.floor(now / 4000) % LANGS.length];
            const type = tt(train.y, lang);
            const destStation = train.ds && train.ds[0];
            const dest = destStation ? T.bound[lang](tt(destStation, lang)) : tt(train.d, lang);
            const k = lang + type + dest;
            if (k !== headKey) {
                headKey = k;
                typeEl.innerHTML = `<span>${esc(type || tt(train.r, lang))}</span>`;
                destEl.innerHTML = `<span>${esc(dest)}</span>`;
            }
            const off = nowOff();
            clockEl.textContent = `${`0${(Math.floor(off / 3600000) + 3) % 24}`.slice(-2)}:${`0${Math.floor(off / 60000) % 60}`.slice(-2)}`;
            const d = Math.floor((train.delay || 0) / 60000);
            const tk = d >= 1 ? LANGS.map(l => T.delay[l](d)).join('　　') : '';
            if (tk !== tickKey) {
                tickKey = tk;
                ticker.classList.toggle('on', !!tk);
                ticker.firstChild.textContent = tk;
            }
        }

        function tick() {
            if (!visible || !train) return;
            const now = performance.now();
            let st;
            try {
                st = state();
            } catch (e) {
                return;
            }
            const key = `${train.id}|${st.phase}|${st.target && st.target.id}`;
            if (key !== seqKey) {
                // 狀態一變（例如進入まもなく）就立刻從第一頁重播，跟真的 LCD 一樣
                seqKey = key;
                seq = buildSeq(st);
                page = 0;
                pageStart = now;
                root.style.setProperty('--c', col((train.v || train.r).color));
                render(st);
            } else if (now - pageStart > seq[page].dur) {
                page = (page + 1) % seq.length;
                pageStart = now;
                render(st);
            }
            header(now);
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
