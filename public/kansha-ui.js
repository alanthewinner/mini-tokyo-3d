/*
 * 看車 UI — Mini Tokyo 3D 外掛層
 * 右上角圓形按鈕（隨機 / 景色 / 列車 / 乘客 / 俯瞰 / ✕）＋ 追蹤列車時的路線條。
 * 用法：在 new mt3d.Map(options) 之後呼叫 kanshaUI(map)。
 * 注意：讀的是 mt3d.Map 的內部欄位（trackedObject、activeTrainLookup、stationGroupLookup），
 * 上游改版時可能要跟著修。
 */
(function () {
    const ICONS = {
        random: '<path d="M4 7h11v-3l5 4-5 4V9H4zM20 17H9v3l-5-4 5-4v3h11z"/>',
        scenery: '<path d="M4 20V10h3v10zm6 0V4h4v16zm7 0v-7h3v7z"/>',
        train: '<path d="M6 3h12a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3l2 3h-2.5l-2-3h-5l-2 3H5l2-3a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zm0 3v4h12V6zm1 7.5a1.5 1.5 0 1 0 0 .01zm10 0a1.5 1.5 0 1 0 0 .01z"/>',
        passenger: '<circle cx="12" cy="5" r="2.5"/><path d="M9.5 9h5l1 6h-2l-.5 7h-2l-.5-7h-2z"/>',
        overview: '<path d="M11 3h2v8l3-3 1.4 1.4L12 14.8 6.6 9.4 8 8l3 3zM4 16h16v4H4z"/>',
        close: '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>'
    };

    const CSS = `
.ks-bar{position:absolute;top:12px;right:12px;display:flex;gap:10px;z-index:5}
.ks-btn{width:64px;height:64px;border-radius:50%;border:none;background:#fff;color:#222;
  box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center;
  justify-content:center;font:600 12px/1.2 "Noto Sans TC",system-ui,sans-serif;cursor:pointer;padding:0}
.ks-btn svg{width:24px;height:24px;fill:currentColor;margin-bottom:2px}
.ks-btn.on{background:#1a1a1a;color:#fff}
.ks-btn.x{width:44px;height:44px;align-self:center}
.ks-btn.x span{display:none}
.mapboxgl-ctrl-top-right{top:84px!important}
.ks-strip{position:absolute;top:100px;left:50%;transform:translateX(-50%);width:min(840px,calc(100% - 32px));
  background:#fff;border:4px solid #111;border-radius:14px;padding:84px 0 0;height:190px;z-index:4;display:none;
  font-family:"Noto Serif JP","Noto Serif TC",serif;box-sizing:border-box;overflow:hidden}
.ks-strip.show{display:block}
.ks-head{position:absolute;top:14px;left:20px;right:20px;display:flex;align-items:center;gap:10px;
  font:700 15px "Noto Sans TC",system-ui,sans-serif;color:#222}
.ks-head i{display:inline-block;width:14px;height:14px;border-radius:3px}
.ks-head small{font-weight:500;color:#666}
.ks-track{position:relative;height:14px;margin:0}
.ks-track .bg{position:absolute;left:0;right:0;top:0;height:14px;background:#c9ccd1}
.ks-track .fg{position:absolute;right:0;top:0;height:14px}
.ks-track .arrow{position:absolute;top:-3px;width:0;height:0;border-top:10px solid transparent;
  border-bottom:10px solid transparent;border-left:14px solid #111;transform:translateX(-50%)}
.ks-st{position:absolute;top:-7px;transform:translateX(-50%);text-align:center;width:14%}
.ks-st .dot{width:22px;height:22px;border-radius:50%;margin:0 auto;border:3px solid #111;background:#f5c518;box-sizing:border-box}
.ks-st.past .dot{border-color:#9aa0a6;background:#fff}
.ks-st.now .dot{box-shadow:0 0 0 5px rgba(245,197,24,.45)}
.ks-st .ja.long{font-size:17px;margin-top:14px}
.ks-st .ja{font-size:24px;font-weight:700;margin-top:10px;color:#111;white-space:nowrap}
.ks-st.past .ja,.ks-st.past .en{color:#a5a9ae}
.ks-st .en{font:600 12px "Noto Sans",system-ui,sans-serif;color:#222;white-space:nowrap}
.ks-st .xf{position:absolute;top:-26px;left:50%;transform:translateX(-50%);display:flex;gap:3px}
.ks-st .xf b{width:15px;height:26px;border-radius:8px 8px 0 0;display:block}
@media (max-width:600px){
  .ks-btn{width:48px;height:48px;font-size:10px}.ks-btn svg{width:18px;height:18px}
  .ks-bar{gap:6px;right:8px}.ks-st{width:24%}.ks-st .ja{font-size:17px}.ks-st .ja.long{font-size:12px}.ks-st .ja.long{font-size:11px;white-space:normal}.ks-st .en{font-size:9px}
  .ks-strip{top:76px;height:160px;padding-top:70px}.mapboxgl-ctrl-top-right{top:66px!important}
}`;

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function colorOf(c) {
        return Array.isArray(c) ? c[0] : c;
    }

    window.kanshaUI = function (map) {
        const container = map.container || document.getElementById('map');
        const style = el('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const bar = el('div', 'ks-bar');
        const strip = el('div', 'ks-strip');
        container.appendChild(bar);
        container.appendChild(strip);

        let stripOn = true;
        const buttons = {};

        function addBtn(key, label, onClick, extra) {
            const b = el('button', 'ks-btn' + (extra ? ' ' + extra : ''),
                `<svg viewBox="0 0 24 24">${ICONS[key]}</svg><span>${label}</span>`);
            b.title = label;
            b.addEventListener('click', onClick);
            bar.appendChild(b);
            buttons[key] = b;
        }

        function activeTrains() {
            const lookup = map.activeTrainLookup;
            return lookup ? Array.from(lookup.values()).filter(t => t && t.type === 'train') : [];
        }

        function setMode(mode) {
            if (!map.trackedObject || map.trackedObject.type !== 'train') {
                randomTrain(mode);
                return;
            }
            map.setTrackingMode(mode);
            sync();
        }

        function randomTrain(mode) {
            const trains = activeTrains();
            if (!trains.length) return;
            const t = trains[Math.floor(Math.random() * trains.length)];
            map.trackObject(t);
            if (mode) map.setTrackingMode(mode);
            sync();
        }

        addBtn('random', '隨機', () => {
            const modes = ['back', 'topback', 'front', 'helicopter', 'drone'];
            randomTrain(modes[Math.floor(Math.random() * modes.length)]);
        });
        addBtn('scenery', '景色', () => setMode('drone'));
        addBtn('train', '列車', () => {
            stripOn = !stripOn;
            sync();
        });
        addBtn('passenger', '乘客', () => setMode('front'));
        addBtn('overview', '俯瞰', () => setMode('bird'));
        addBtn('close', '關閉', () => {
            map.trackObject();
            sync();
        }, 'x');

        function stopList(train) {
            const tt = train.timetable;
            let stations;
            if (tt && tt.stations && tt.stations.length) {
                stations = tt.stations;
            } else {
                const r = train.r;
                stations = r.stations.slice();
                if (train.d && r.descending && train.d.id === r.descending.id) stations.reverse();
            }
            let idx = stations.indexOf(train.departureStation);
            if (idx < 0) idx = 0;
            return {stations, idx};
        }

        function transferColors(station, railway) {
            const group = map.stationGroupLookup && map.stationGroupLookup.get(station.group);
            const seen = new Set();
            const out = [];
            const list = group ? group.stations.concat(group.hidden || []) : [];
            for (const s of list) {
                const r = s && s.railway;
                if (!r || r === railway || seen.has(r.id)) continue;
                seen.add(r.id);
                out.push(colorOf(r.color));
            }
            return out.slice(0, 4);
        }

        function title(station, lang) {
            const t = station.title || {};
            return t[lang] || t.en || t.ja || '';
        }

        let lastKey = '';

        function renderStrip(train) {
            const {stations, idx} = stopList(train);
            // 跟截圖一樣：前面留兩個灰色站，後面放到總共約 6 站
            const from = Math.max(0, idx - (train.standing ? 2 : 1));
            const count = container.clientWidth < 600 ? 4 : 6;
            const view = stations.slice(from, from + count);
            const cur = idx - from;
            const key = count + ':' + train.id + ':' + idx + ':' + !!train.standing + ':' + view.length;
            if (key === lastKey) return;
            lastKey = key;

            const railway = train.r;
            const color = colorOf((train.v || railway).color) || '#4db6ac';
            const n = view.length;
            const pos = i => ((i + 0.5) / n) * 100;
            // 列車所在位置：停站時在該站，行駛中在前一站與下一站之間
            const trainPos = train.standing ? pos(cur) : (pos(cur) + pos(Math.min(cur + 1, n - 1))) / 2;

            const dest = map.getLocalizedDestinationTitle ? map.getLocalizedDestinationTitle(train.ds, train.d) : '';
            const name = map.getLocalizedTrainNameOrRailwayTitle ? map.getLocalizedTrainNameOrRailwayTitle(train.nm, railway) : '';
            const type = map.getLocalizedTrainTypeTitle ? map.getLocalizedTrainTypeTitle(train.y) : '';

            let html = `<div class="ks-head"><i style="background:${color}"></i>${name}<small>${type}</small><small>${dest}</small><small style="margin-left:auto">${train.n || ''}</small></div>`;
            html += '<div class="ks-track"><div class="bg"></div>';
            html += `<div class="fg" style="left:${trainPos}%;background:${color}"></div>`;
            html += `<div class="arrow" style="left:${trainPos}%"></div>`;
            view.forEach((s, i) => {
                const past = train.standing ? i < cur : i <= cur;
                const now = train.standing && i === cur;
                const xf = past ? [] : transferColors(s, railway);
                html += `<div class="ks-st${past ? ' past' : ''}${now ? ' now' : ''}" style="left:${pos(i)}%">` +
                    (xf.length ? `<div class="xf">${xf.map(c => `<b style="background:${c}"></b>`).join('')}</div>` : '') +
                    `<div class="dot"></div><div class="ja${title(s, 'ja').length > 4 ? ' long' : ''}">${title(s, 'ja')}</div><div class="en">${title(s, 'en')}</div></div>`;
            });
            html += '</div>';
            strip.innerHTML = html;
        }

        function sync() {
            const t = map.trackedObject;
            const tracking = t && t.type === 'train';
            const mode = map.getTrackingMode ? map.getTrackingMode() : '';
            buttons.scenery.classList.toggle('on', tracking && mode === 'drone');
            buttons.passenger.classList.toggle('on', tracking && mode === 'front');
            buttons.overview.classList.toggle('on', tracking && mode === 'bird');
            buttons.train.classList.toggle('on', stripOn);
            buttons.close.style.display = tracking ? '' : 'none';
            if (tracking && stripOn) {
                strip.classList.add('show');
                try {
                    renderStrip(t);
                } catch (e) {
                    console.warn('[kansha-ui]', e);
                }
            } else {
                strip.classList.remove('show');
                lastKey = '';
            }
        }

        map.on('selection', sync);
        map.on('deselection', () => setTimeout(sync, 0));
        map.on('trackingmode', sync);
        setInterval(sync, 1000);
        sync();
        return {sync};
    };
})();
