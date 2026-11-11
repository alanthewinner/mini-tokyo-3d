/*
 * 看車 PIDS v3 — 參考日本地下鐵車內 LCD 的畫面流程（不含任何公司 logo）
 *
 * 上方：行先小條＋號車牌／狀態（つぎは・まもなく・ただいま）＋站號圈＋大站名（漢字→ひらがな→English）
 *       行駛途中切成「目的地模式」：站號圈＋「渋谷 ゆき」／「For Shibuya」
 * 下方頁面：
 *   route    粗箭頭路線條（分鐘框、站號、直書站名、上方轉乘；英文版站名旋轉）
 *   overview 到終點的全線縮小版
 *   xfer     のりかえ / Transfer
 *   caution  電車の揺れにご注意（前方轉彎角度大才出現）
 *   platform 月台圖：出口推算靠第幾節（無資料→示意）
 *   doors    開門側（資料沒有→亂數示意，標イメージ）
 *
 * kanshaPIDS(map, container) -> {update(train|null, visible)}
 * 站號／平假名／路線代號來自 station-meta.json（npm run station-meta）。
 */
(function () {
    const T = {
        next: {ja: 'つぎは', kana: 'つぎは', en: 'Next'},
        soon: {ja: 'まもなく', kana: 'まもなく', en: 'Soon'},
        now: {ja: 'ただいま', kana: 'ただいま', en: 'Now at'},
        delay: n => `この電車は約${n}分遅れて運転しています　　This train is running about ${n} min late`
    };

    const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&family=Roboto+Condensed:wght@700&display=swap');
.kp{--c:#f39700;--cl:#ffd36b;--cd:#d36f00;position:absolute;right:16px;bottom:28px;width:min(720px,54vw);aspect-ratio:16/9;z-index:6;
  background:#3b3b3b;border-radius:12px;padding:1.4cqw;box-sizing:border-box;box-shadow:0 8px 28px rgba(0,0,0,.5);
  display:none;container-type:inline-size;font-family:"Noto Sans JP",system-ui,sans-serif;color:#111}
.kp.show{display:block;animation:kp-on .45s ease-out}
@keyframes kp-on{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.kp-scr{position:relative;width:100%;height:100%;background:#fff;overflow:hidden}
.kp-en{font-family:"Roboto Condensed","Noto Sans",system-ui,sans-serif}
/* ---- 上方 ---- */
.kp-top{position:absolute;left:0;right:0;top:0;height:5.6cqw;background:linear-gradient(#fff 0,#fff 40%,#ececec 60%,#f6f6f6 100%)}
.kp-ds{position:absolute;left:3.4cqw;top:.5cqw;font-weight:900;font-size:3.6cqw;letter-spacing:.06em;color:#333;white-space:nowrap}
.kp-car{position:absolute;right:1cqw;top:.5cqw;display:flex;align-items:flex-end;gap:.5cqw;font-weight:700;font-size:1.4cqw;color:#333}
.kp-car b{display:flex;align-items:center;justify-content:center;width:5cqw;height:5cqw;border-radius:.8cqw;color:#fff;font:700 4cqw/1 "Roboto Condensed",sans-serif;
  background:linear-gradient(#5b5b5b,#262626 55%,#3a3a3a);box-shadow:inset 0 .2cqw 0 rgba(255,255,255,.3)}
.kp-car.en{flex-direction:row-reverse;align-items:flex-start}.kp-car.en span{margin-top:1cqw;font-size:1.6cqw;font-family:"Roboto Condensed",sans-serif;color:#555}
.kp-main{position:absolute;left:0;right:0;top:5.6cqw;height:10.8cqw;background:linear-gradient(#fff,#fff 70%,#f3f3f3)}
.kp-rule{position:absolute;left:0;right:0;top:16.4cqw;height:.7cqw;background:linear-gradient(var(--c),var(--cd));z-index:2}
.kp-label{position:absolute;left:3.4cqw;bottom:.8cqw;font-weight:900;font-size:4.6cqw;line-height:1;white-space:nowrap}
.kp-label.en{font-size:5cqw}
.kp-label small{display:block;font-size:2.4cqw;margin-bottom:.4cqw}
.kp-label.blink{animation:kp-blink 1.1s steps(1) infinite}
@keyframes kp-blink{60%{opacity:.2}}
.kp-badge{position:absolute;top:.4cqw;width:11cqw;height:11cqw;border-radius:50%;background:#fff;border:1.4cqw solid var(--c);box-sizing:border-box;z-index:1;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font:900 3.6cqw/1 "Noto Sans JP",sans-serif}
.kp-badge b{font-size:4.6cqw;font-weight:900}
.kp-badge.none{display:none}
.kp-name{position:absolute;left:32cqw;right:3cqw;top:0;bottom:0;display:flex;align-items:center;justify-content:center}
.kp-name span{font-weight:900;font-size:9.4cqw;line-height:1;white-space:nowrap;animation:kp-up .4s cubic-bezier(.2,.8,.2,1)}
.kp-name span.s2{letter-spacing:.5em;margin-right:-.5em}.kp-name span.s3{letter-spacing:.12em}
.kp-name span.l{font-size:7.4cqw}.kp-name span.xl{font-size:5.6cqw}
.kp-name span.kp-en{font-weight:700;font-size:8.6cqw}.kp-name span.kp-en.l{font-size:6.8cqw}.kp-name span.kp-en.xl{font-size:5cqw}
.kp-yuki{position:absolute;right:1.6cqw;bottom:.6cqw;font-weight:900;font-size:6cqw;line-height:1}
.kp-for{position:absolute;left:2.4cqw;bottom:.8cqw;font:700 6cqw/1 "Roboto Condensed",sans-serif}
@keyframes kp-up{from{opacity:0;transform:translateY(30%)}to{opacity:1;transform:none}}
/* ---- 下方 ---- */
.kp-body{position:absolute;left:0;right:0;top:17.1cqw;bottom:0;overflow:hidden}
.kp-page{position:absolute;inset:0;animation:kp-in .45s cubic-bezier(.2,.8,.2,1)}
@keyframes kp-in{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.kp-foot{position:absolute;right:2cqw;bottom:.8cqw;font-weight:700;font-size:1.6cqw;color:#222}
.kp-note{position:absolute;left:2cqw;bottom:.8cqw;font-weight:700;font-size:1.3cqw;color:#666}
.kp-note.img{color:#c62828}
.kp-ticker{position:absolute;left:0;right:0;bottom:0;height:3.4cqw;background:#c62828;color:#fff;font-weight:700;font-size:1.9cqw;
  display:none;align-items:center;overflow:hidden;white-space:nowrap;z-index:5}
.kp-ticker.on{display:flex}
.kp-ticker span{display:inline-block;padding-left:100%;animation:kp-scroll 18s linear infinite}
@keyframes kp-scroll{to{transform:translateX(-100%)}}
/* 路線徽章 */
.kp-lb{flex:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;background:#fff;border:.32cqw solid;border-radius:50%;
  font:700 1cqw/1 "Roboto Condensed",sans-serif;width:2cqw;height:2cqw;color:#222}
.kp-lb.sq{border-radius:.35cqw;width:2.3cqw}
.kp-lb.nc{background:currentColor}
/* route */
.kp-band{position:absolute;left:0;top:11.3cqw;height:4.4cqw;background:linear-gradient(var(--cl),var(--c) 45%,var(--cd));
  clip-path:polygon(0 0,calc(100% - 3cqw) 0,100% 50%,calc(100% - 3cqw) 100%,0 100%)}
.kp-col{position:absolute;top:0;bottom:0;width:10cqw;transform:translateX(-50%)}
.kp-min{position:absolute;left:50%;top:11.7cqw;width:4.6cqw;height:3.6cqw;margin-left:-2.3cqw;background:linear-gradient(#f4f4f4,#d9d9d9);
  display:flex;align-items:center;justify-content:center;font:700 3.2cqw/1 "Roboto Condensed",sans-serif;animation:kp-up .35s both}
.kp-chev{position:absolute;left:50%;top:11.3cqw;width:4.6cqw;height:4.4cqw;margin-left:-2.3cqw}
.kp-chev::before{content:"";position:absolute;inset:0;background:rgba(255,255,255,.55)}
.kp-chev i{position:absolute;left:.9cqw;top:0;width:2.8cqw;height:4.4cqw;background:linear-gradient(#ff5a4f,#c40000);
  clip-path:polygon(0 0,45% 0,100% 50%,45% 100%,0 100%,52% 50%);animation:kp-chv 1.6s steps(1) infinite}
.kp-chev.en i{background:linear-gradient(#5a7bff,#0019c4)}
@keyframes kp-chv{50%{filter:brightness(1.35)}}
.kp-code{position:absolute;left:0;right:0;top:16cqw;text-align:center;font:700 2.2cqw/1 "Roboto Condensed",sans-serif;letter-spacing:.05em}
.kp-rl{position:absolute;left:0;right:0;top:18.6cqw;height:.45cqw;background:var(--c)}
.kp-vn{position:absolute;left:50%;top:19.6cqw;transform:translateX(-50%);writing-mode:vertical-rl;text-orientation:upright;font-weight:900;font-size:3cqw;
  line-height:1;letter-spacing:.05em;white-space:nowrap;animation:kp-up .35s both}
.kp-vn.s2{letter-spacing:1.9em}.kp-vn.sm{font-size:2.3cqw;letter-spacing:0}
.kp-vn.kp-en{text-orientation:mixed;font-weight:700;font-size:2.7cqw;letter-spacing:0;white-space:nowrap;line-height:1}
.kp-vn.kp-en.sm{font-size:2.1cqw}.kp-vn.kp-en.xs{font-size:1.75cqw}
.kp-xs{position:absolute;left:1cqw;bottom:calc(100% - 11cqw);width:11cqw;font-weight:700;font-size:1.5cqw;line-height:1.25}
.kp-xs div{display:flex;flex-wrap:wrap;align-items:center;gap:.25cqw;white-space:nowrap;margin-top:.25cqw}
.kp-xs em{margin-left:.15cqw}
.kp-xs em{font-style:normal;overflow:hidden;text-overflow:ellipsis}
/* overview */
.kp-ob{position:absolute;left:0;top:9.4cqw;height:2.4cqw;background:linear-gradient(var(--cl),var(--c) 50%,var(--cd));
  clip-path:polygon(0 0,calc(100% - 1.6cqw) 0,100% 50%,calc(100% - 1.6cqw) 100%,0 100%)}
.kp-oc{position:absolute;top:0;bottom:0;width:5cqw;transform:translateX(-50%)}
.kp-om{position:absolute;left:50%;top:5.6cqw;margin-left:-1.5cqw;width:3cqw;height:2.6cqw;background:#e4e4e4;display:flex;align-items:center;justify-content:center;
  font:700 1.8cqw/1 "Roboto Condensed",sans-serif}
.kp-od{position:absolute;left:50%;top:9.7cqw;width:1.8cqw;height:1.8cqw;margin-left:-.9cqw;border-radius:50%;background:#fff}
.kp-od.end{border:.35cqw solid var(--c);box-sizing:border-box}
.kp-ochev{position:absolute;left:50%;top:9.1cqw;width:1.8cqw;height:3cqw;margin-left:-.9cqw;background:#d50000;clip-path:polygon(0 0,45% 0,100% 50%,45% 100%,0 100%,52% 50%)}
.kp-ocode{position:absolute;left:0;right:0;top:12.4cqw;text-align:center;font:700 1.45cqw/1 "Roboto Condensed",sans-serif}
.kp-orl{position:absolute;left:2cqw;right:2cqw;top:14.4cqw;height:.3cqw;background:var(--c)}
.kp-ovn{position:absolute;left:50%;top:15.2cqw;transform:translateX(-50%);writing-mode:vertical-rl;text-orientation:upright;font-weight:900;font-size:2.4cqw;line-height:1.05;white-space:nowrap}
.kp-ovn.s2{letter-spacing:2.2em}.kp-ovn.sm{font-size:1.9cqw}
/* xfer */
.kp-xfh{position:absolute;left:0;right:0;top:0;height:5cqw;background:linear-gradient(#f2f2f2,#e2e2e2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:2.8cqw}
.kp-xfl{position:absolute;left:5cqw;right:4cqw;top:6.6cqw;bottom:2cqw;display:grid;grid-template-columns:1fr 1fr;align-content:start;gap:1.4cqw 3cqw}
.kp-xfl>div{display:flex;align-items:center;gap:1.4cqw;animation:kp-up .4s both}
.kp-xfl .kp-lb{width:5.4cqw;height:5.4cqw;border-width:.8cqw;font-size:2.4cqw}.kp-xfl .kp-lb.sq{width:6cqw;border-radius:.8cqw}
.kp-xfl b{display:block;font-size:3.2cqw;line-height:1.15;white-space:nowrap}
.kp-xfl small{display:block;font:700 2.1cqw/1.2 "Roboto Condensed",sans-serif;white-space:nowrap}
.kp-xfl.dense .kp-lb{width:4cqw;height:4cqw;font-size:1.8cqw}.kp-xfl.dense .kp-lb.sq{width:4.6cqw}.kp-xfl.dense b{font-size:2.4cqw}.kp-xfl.dense small{font-size:1.6cqw}
/* caution */
.kp-cau{position:absolute;inset:0;background:#fff}
.kp-cau::before,.kp-cau::after{content:"";position:absolute;left:0;right:0;height:6cqw}
.kp-cau::before{top:0;background:linear-gradient(#ffc21a,#fff)}
.kp-cau::after{bottom:0;background:linear-gradient(#fff,#ffc21a)}
.kp-cau svg{position:absolute;left:50%;top:5cqw;width:26cqw;height:24cqw;margin-left:-13cqw;opacity:.1}
.kp-cau h3{position:absolute;left:0;right:0;top:6cqw;margin:0;text-align:center;font-weight:900;font-size:6cqw;color:#e8150c;animation:kp-up .4s both}
.kp-cau p{position:absolute;left:12cqw;right:10cqw;margin:0;font-weight:700}
.kp-cau .j{top:14.5cqw;font-size:3cqw;line-height:1.3}
.kp-cau .e{top:23cqw;bottom:6cqw;padding-top:.8cqw;font:500 3cqw/1 "Noto Sans",system-ui,sans-serif;color:#1f2ee8;left:0;right:0;padding-left:12cqw;
  background:linear-gradient(#ececf2,#fff)}
/* platform */
.kp-pxl{position:absolute;left:3cqw;right:3cqw;top:.8cqw;height:8.6cqw;display:flex;flex-wrap:wrap;align-content:flex-start;gap:.6cqw 2.4cqw}
.kp-pxl>div{display:flex;align-items:center;gap:.6cqw;white-space:nowrap}
.kp-pxl .kp-lb{width:3.6cqw;height:3.6cqw;border-width:.55cqw;font-size:1.6cqw}.kp-pxl .kp-lb.sq{width:4cqw;border-radius:.5cqw}
.kp-pxl b{display:block;font-size:2.3cqw;line-height:1.1}
.kp-pxl small{display:block;font:700 1.5cqw/1.1 "Roboto Condensed",sans-serif}
.kp-pfbg{position:absolute;left:0;right:0;top:0;height:16cqw;background:linear-gradient(#f0f0f6,#e9e9f2)}
.kp-brd{position:absolute;top:10cqw;transform:translateX(-50%);background:#ffc20e;border:.2cqw solid #b88a00;padding:.2cqw .9cqw .3cqw;display:flex;align-items:flex-end;gap:1cqw;
  white-space:nowrap;z-index:2;animation:kp-up .4s both}
.kp-brd .g b{display:block;font-weight:900;font-size:2.2cqw;line-height:1.1}.kp-brd .g small{display:block;font:700 1.3cqw/1.1 "Roboto Condensed",sans-serif}
.kp-brd .n{font:700 3.4cqw/1 "Roboto Condensed",sans-serif}
.kp-pf svg{position:absolute;inset:0;width:100%;height:100%}
.kp-car6{position:absolute;top:26.4cqw;height:4cqw;background:#fff;border:.3cqw solid #111;box-sizing:border-box;display:flex;align-items:center;justify-content:center;
  font:700 2.6cqw/1 "Roboto Condensed",sans-serif}
.kp-car6.f{border-top-right-radius:2cqw}.kp-car6.r{border-top-left-radius:2cqw}
.kp-car6.here{background:#e00;color:#fff}
.kp-cstripe{position:absolute;top:30.3cqw;height:.8cqw;background:var(--c)}
.kp-here{position:absolute;top:19cqw;transform:translateX(-50%);background:#e00;color:#fff;text-align:center;padding:.3cqw .9cqw;font-weight:900;font-size:2.4cqw;line-height:1;z-index:3}
.kp-here small{display:block;font:700 1.6cqw/1.1 "Roboto Condensed",sans-serif;margin-top:.2cqw}
.kp-here::after{content:"";position:absolute;left:50%;bottom:-1.2cqw;margin-left:-1.2cqw;border:1.2cqw solid transparent;border-bottom:0;border-top-color:#e00}
.kp-parrow{position:absolute;right:3cqw;top:26.2cqw;font:900 4.4cqw/1 system-ui,sans-serif}
/* doors */
.kp-dtx{position:absolute;left:0;right:0;top:0;height:6cqw;display:flex;align-items:center;justify-content:center;gap:1.2cqw;font-weight:500;font-size:3.1cqw;color:#2f4f9b;
  border-bottom:.3cqw solid #999;white-space:nowrap}
.kp-dtx .kp-en{font-family:"Noto Sans",system-ui,sans-serif}
.kp-dw{position:absolute;left:0;right:0;top:6.3cqw;bottom:0;background:linear-gradient(90deg,#e8e8e8,#f7f7f7 30%,#e0e0e0 33%,#fff 33%,#fff 67%,#e0e0e0 67%,#f7f7f7 70%,#e8e8e8)}
.kp-dl,.kp-dr{position:absolute;top:0;bottom:0;width:17cqw;background:linear-gradient(90deg,#d8d8d8,#f4f4f4 40%,#dedede);border-left:.5cqw solid #333;border-right:.5cqw solid #333;box-sizing:border-box}
.kp-dl{left:33%}.kp-dr{right:33%}
.kp-dw.open .kp-dl{animation:kp-dlo 1.4s .6s cubic-bezier(.4,0,.2,1) forwards}
.kp-dw.open .kp-dr{animation:kp-dro 1.4s .6s cubic-bezier(.4,0,.2,1) forwards}
@keyframes kp-dlo{to{transform:translateX(-100%)}}
@keyframes kp-dro{to{transform:translateX(100%)}}
.kp-dar{position:absolute;top:8cqw;width:12cqw;height:12cqw;background:linear-gradient(90deg,#ee6a1f 30%,rgba(238,106,31,0));opacity:0}
.kp-dar.l{left:7cqw;clip-path:polygon(0 50%,50% 0,50% 30%,100% 30%,100% 70%,50% 70%,50% 100%)}
.kp-dar.r{right:7cqw;transform:scaleX(-1);clip-path:polygon(0 50%,50% 0,50% 30%,100% 30%,100% 70%,50% 70%,50% 100%)}
.kp-dw.open .kp-dar{animation:kp-darf 1.2s 1.4s ease-in-out infinite}
@keyframes kp-darf{0%{opacity:0}30%,80%{opacity:1}100%{opacity:0}}
.kp-dw.shut .kp-dar{opacity:.25;filter:grayscale(1)}
.kp-dws{position:absolute;left:33%;right:33%;top:15cqw;text-align:center;color:#d40000;font-weight:900;font-size:2.8cqw;line-height:1.35;z-index:1}
.kp-dws b{display:block;font:700 2.6cqw "Roboto Condensed",sans-serif;letter-spacing:.06em}
.kp-dws i{display:block;margin:.6cqw auto 0;width:6cqw;height:5cqw;background:linear-gradient(#6f8fd6,rgba(111,143,214,0));clip-path:polygon(50% 0,100% 45%,70% 45%,70% 100%,30% 100%,30% 45%,0 45%)}
@media (max-width:600px){.kp{left:8px;right:8px;bottom:12px;width:auto}}`;

    const CAUTION_SVG = '<svg viewBox="0 0 100 90"><path d="M50 4L96 86H4z" fill="none" stroke="#000" stroke-width="7" stroke-linejoin="round"/><rect x="45" y="30" width="10" height="32" rx="4"/><circle cx="50" cy="74" r="6"/></svg>';
    const colorOf = c => (Array.isArray(c) ? c[0] : c) || '#f39700';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));

    function shade(hex, amt) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
        if (!m) return hex;
        const n = parseInt(m[1], 16);
        const f = c => Math.max(0, Math.min(255, Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt))));
        return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
    }

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
        root.innerHTML = '<div class="kp-scr"><div class="kp-top"><div class="kp-ds"></div><div class="kp-car"></div></div>' +
            '<div class="kp-main"><div class="kp-label"></div><div class="kp-for kp-en"></div><div class="kp-badge none"></div>' +
            '<div class="kp-name"></div><div class="kp-yuki"></div></div><div class="kp-rule"></div>' +
            '<div class="kp-body"></div><div class="kp-ticker"><span></span></div></div>';
        container.appendChild(root);
        const $ = s => root.querySelector(s);
        const el = {
            ds: $('.kp-ds'), car: $('.kp-car'), label: $('.kp-label'), forEl: $('.kp-for'), badge: $('.kp-badge'),
            name: $('.kp-name'), yuki: $('.kp-yuki'), body: $('.kp-body'), ticker: $('.kp-ticker')
        };

        let train = null, visible = false, seqKey = '', st = null, seq = [], page = 0, pageT = 0, tickKey = '';

        // ---------- 資料 helpers ----------
        const now = () => (map.clock ? map.clock.getTimeOffset() : 0);
        const sMeta = s => (s && meta.stations[s.id]) || {};
        const isEn = lang => lang === 'en';
        function sName(s, lang) {
            if (!s) return '';
            if (lang === 'kana') return sMeta(s).kana || sName(s, 'ja');
            const t = s.title || {};
            return t[lang] || t.en || t.ja || '';
        }
        const tTitle = (o, lang) => (o && o.title ? o.title[lang] || o.title.en || o.title.ja || '' : '');
        function splitCode(code) {
            const m = /^([A-Za-z]+)-?(\d+)$/.exec(code || '');
            return m ? {line: m[1].toUpperCase(), num: m[2]} : null;
        }
        function codeLabel(s) {
            const c = splitCode(sMeta(s).code);
            return c ? `${c.line}-${c.num}` : (sMeta(s).code || '');
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
        function curIndex(stations) {
            const i = stations.indexOf(train.departureStation);
            return i < 0 ? 0 : i;
        }
        function minutesTo(gi, arr, dep) {
            const tm = arr[gi] !== undefined ? arr[gi] : dep[gi];
            return tm === undefined ? null : Math.max(1, Math.ceil((tm + (train.delay || 0) - now()) / 60000));
        }
        function transfers(station) {
            const g = station && map.stationGroupLookup && map.stationGroupLookup.get(station.group);
            const seen = new Set(), out = [];
            for (const s of g ? g.stations.concat(g.hidden || []) : []) {
                const r = s && s.railway;
                if (!r || r === train.r || seen.has(r.id)) continue;
                seen.add(r.id);
                out.push(r);
            }
            return out;
        }
        // 轉乘清單：JR 各線合併成一筆「JR線」＋多個代號徽章（跟實車一樣）
        function xferGroups(station) {
            const out = [], jr = [];
            for (const r of transfers(station)) {
                if (/^JR-/.test(r.id) && !/Shinkansen/i.test(r.id)) jr.push(r);
                else out.push({rails: [r], ja: tTitle(r, 'ja'), en: tTitle(r, 'en')});
            }
            if (jr.length) {
                const coded = jr.filter(r => meta.lines[r.id] && meta.lines[r.id].code);
                out.unshift({rails: (coded.length ? coded : jr).slice(0, 4), ja: 'JR線', en: 'JR Line'});
            }
            return out;
        }
        function badges(g) {
            return g.rails.map(lineBadge).join('');
        }
        function lineBadge(r) {
            const c = colorOf(r.color), code = meta.lines[r.id] && meta.lines[r.id].code;
            if (!code) return `<span class="kp-lb nc" style="color:${c};border-color:${c}"></span>`;
            return `<span class="kp-lb${code.length > 1 ? ' sq' : ''}" style="border-color:${c}">${esc(code.slice(0, 2))}</span>`;
        }
        function dest() {
            const {stations} = stopList();
            return (train.ds && train.ds[0]) || stations[stations.length - 1];
        }
        function computeState() {
            const {stations} = stopList();
            if (train.standing || !train.arrivalStation) {
                return {phase: 'now', target: train.departureStation, last: stations[stations.length - 1] === train.departureStation};
            }
            const eta = train.arrivalTime !== undefined ? (train.arrivalTime + (train.delay || 0) - now()) / 1000 : Infinity;
            return {phase: eta <= 45 ? 'soon' : 'next', target: train.arrivalStation, eta, last: stations[stations.length - 1] === train.arrivalStation};
        }
        // 前方轉彎角度（度）：用站點座標估
        function turnAngle() {
            const {stations} = stopList(), i = stations.indexOf(st.target);
            const a = stations[i - 1], b = stations[i], c = stations[i + 1];
            if (!a || !b || !c || !a.coord || !b.coord || !c.coord) return 0;
            const k = Math.cos(b.coord[1] * Math.PI / 180);
            const v1 = [(b.coord[0] - a.coord[0]) * k, b.coord[1] - a.coord[1]];
            const v2 = [(c.coord[0] - b.coord[0]) * k, c.coord[1] - b.coord[1]];
            const d = Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]);
            return Math.abs(d * 180 / Math.PI);
        }
        function nameCls(s, lang) {
            if (isEn(lang)) return `kp-en${s.length > 13 ? ' xl' : s.length > 9 ? ' l' : ''}`;
            const n = s.length;
            return n <= 2 ? 's2' : n === 3 ? 's3' : n > 6 ? 'xl' : n > 4 ? 'l' : '';
        }

        // ---------- 頁面流程 ----------
        function buildSeq() {
            const {stations} = stopList();
            const remain = stations.length - curIndex(stations);
            const hasXf = transfers(st.target).length > 0;
            if (st.phase === 'now') {
                return [
                    {head: 'stn', lang: 'ja', body: 'route', ms: 5000},
                    {head: 'stn', lang: 'kana', body: 'route', ms: 3500},
                    {head: 'stn', lang: 'en', body: 'route', ms: 4500}
                ];
            }
            if (st.phase === 'soon') {
                return [
                    {head: 'stn', lang: 'ja', body: 'platform', ms: 6000},
                    {head: 'stn', lang: 'kana', body: 'platform', ms: 3500},
                    {head: 'stn', lang: 'en', body: 'platform', ms: 4000},
                    {head: 'stn', lang: 'ja', body: 'doors', ms: 5000},
                    {head: 'stn', lang: 'en', body: 'doors', ms: 4000}
                ];
            }
            const s = [
                {head: 'dest', lang: 'ja', body: 'route', ms: 5000},
                {head: 'dest', lang: 'kana', body: 'route', ms: 3500},
                {head: 'dest', lang: 'en', body: 'route', ms: 5000}
            ];
            if (remain > 8) s.push({head: 'dest', lang: 'ja', body: 'overview', ms: 7000});
            s.push({head: 'stn', lang: 'ja', body: hasXf ? 'xfer' : 'route', ms: 5000});
            s.push({head: 'stn', lang: 'kana', body: hasXf ? 'xfer' : 'route', ms: 3500});
            if (turnAngle() > 28) s.push({head: 'stn', lang: 'ja', body: 'caution', ms: 6000});
            s.push({head: 'stn', lang: 'en', body: hasXf ? 'xfer' : 'route', ms: 4500});
            return s;
        }

        // ---------- 上方 ----------
        function renderHead(p) {
            const lang = p.lang, en = isEn(lang), d = dest();
            const carNo = 1; // 乘客視角在車頭 = 1 號車
            el.car.className = `kp-car${en ? ' en' : ''}`;
            el.car.innerHTML = `<b>${carNo}</b><span>${en ? 'Car No.' : '号車'}</span>`;
            let badgeStation;
            if (p.head === 'dest') {
                el.ds.textContent = '';
                el.label.innerHTML = '';
                el.forEl.textContent = en ? 'For' : '';
                el.yuki.textContent = en ? '' : 'ゆき';
                badgeStation = d;
                const nm = sName(d, lang);
                el.name.innerHTML = `<span class="${nameCls(nm, lang)}">${esc(nm)}</span>`;
            } else {
                el.ds.innerHTML = en ? `<span class="kp-en">For ${esc(sName(d, 'en'))}</span>` : `${esc(sName(d, lang))}　ゆき`;
                el.forEl.textContent = '';
                el.yuki.textContent = '';
                const lab = T[st.phase][lang];
                el.label.className = `kp-label${en ? ' kp-en en' : ''}${st.phase === 'soon' ? ' blink' : ''}`;
                el.label.innerHTML = st.last && st.phase !== 'now' ? `<small>${en ? 'Last Stop' : '終点'}</small>${lab}` : lab;
                badgeStation = st.target;
                const nm = sName(st.target, lang);
                el.name.innerHTML = `<span class="${nameCls(nm, lang)}">${esc(nm)}</span>`;
            }
            const c = splitCode(sMeta(badgeStation).code);
            el.badge.className = `kp-badge${c ? '' : ' none'}`;
            el.badge.style.left = p.head === 'dest' ? (en ? '13cqw' : '15cqw') : (en ? '16cqw' : '23.5cqw');
            el.badge.innerHTML = c ? `${esc(c.line)}<b>${esc(c.num)}</b>` : '';
            el.name.style.left = c ? (p.head === 'stn' && !en ? '36cqw' : '32cqw') : '26cqw';
        }

        // ---------- 下方各頁 ----------
        function routePage(lang) {
            const en = isEn(lang), {stations, arr, dep} = stopList(), idx = curIndex(stations);
            const view = stations.slice(idx, idx + 8), n = view.length;
            const x = i => 10 + i * (78 / 7);
            let h = `<div class="kp-page"><div class="kp-band" style="width:${x(n - 1) + 8.5}%"></div>`;
            view.forEach((s, i) => {
                const nm = en ? sName(s, 'en') : sName(s, 'ja');
                const xs = xferGroups(s).slice(0, 4);
                const m = i > 0 ? minutesTo(idx + i, arr, dep) : null;
                const vcls = en ? `kp-en${nm.length > 13 ? ' xs' : nm.length > 9 ? ' sm' : ''}` : nm.length <= 2 ? 's2' : nm.length > 5 ? 'sm' : '';
                h += `<div class="kp-col" style="left:${x(i)}%">` +
                    (xs.length ? `<div class="kp-xs">${xs.map(g => `<div>${badges(g)}<em>${esc(en ? g.en : g.ja)}</em></div>`).join('')}</div>` : '') +
                    (i === 0 ? `<div class="kp-chev${en ? ' en' : ''}"><i></i></div>` :
                        m !== null ? `<div class="kp-min" style="animation-delay:${i * 50}ms">${m}</div>` : '') +
                    `<div class="kp-code">${esc(codeLabel(s))}</div>` +
                    `<div class="kp-vn ${vcls}" style="animation-delay:${i * 50}ms">${esc(nm)}</div></div>`;
            });
            h += '<div class="kp-rl"></div>' +
                `<div class="kp-min" style="left:${x(n - 1) + 5.2}%;top:12.6cqw;width:auto;background:none;font-size:2cqw;color:#fff;animation:none">${en ? 'min' : '分'}</div>`;
            h += `<div class="kp-foot">${en ? '<span class="kp-en">Times are approximate.</span>' : '※運転状況により、時間は前後します。'}</div>`;
            return h + '</div>';
        }

        function overviewPage() {
            const {stations, arr, dep} = stopList(), idx = curIndex(stations);
            const view = stations.slice(idx, idx + 22), n = view.length;
            const x = i => 5 + i * (88 / Math.max(1, n - 1));
            let h = `<div class="kp-page"><div class="kp-ob" style="width:${x(n - 1) - 1.6}%"></div><div class="kp-orl"></div>`;
            view.forEach((s, i) => {
                const nm = sName(s, 'ja'), m = i > 0 ? minutesTo(idx + i, arr, dep) : null;
                h += `<div class="kp-oc" style="left:${x(i)}%">` +
                    (m !== null ? `<div class="kp-om">${m}</div>` : '') +
                    (i === 0 ? '<div class="kp-ochev"></div>' : `<div class="kp-od${i === n - 1 ? ' end' : ''}"></div>`) +
                    `<div class="kp-ocode">${esc(codeLabel(s))}</div>` +
                    `<div class="kp-ovn${nm.length <= 2 ? ' s2' : nm.length > 5 ? ' sm' : ''}">${esc(nm)}</div></div>`;
            });
            h += `<div class="kp-om" style="left:${x(n - 1) + 2.4}%;background:none;font-size:1.6cqw">分</div>`;
            return h + '<div class="kp-foot">※運転状況により、時間は前後します。</div></div>';
        }

        function xferPage(lang) {
            const en = isEn(lang), list = xferGroups(st.target).slice(0, 10);
            return `<div class="kp-page"><div class="kp-xfh">${en ? '<span class="kp-en">Transfer</span>' : 'のりかえ / <span class="kp-en">Transfer</span>'}</div>` +
                `<div class="kp-xfl${list.length > 6 ? ' dense' : ''}">` +
                list.map((g, i) => `<div style="animation-delay:${80 + i * 60}ms"><span style="display:flex;gap:.5cqw">${badges(g)}</span><span>` +
                    (en ? `<b class="kp-en">${esc(g.en)}</b>` : `<b>${esc(g.ja)}</b><small>${esc(g.en)}</small>`) +
                    '</span></div>').join('') + '</div></div>';
        }

        function cautionPage() {
            return `<div class="kp-page kp-cau">${CAUTION_SVG}<h3>電車の揺れにご注意！</h3>` +
                '<p class="j">この先はカーブがあり、電車が揺れることがあります。<br>つり革や手すりにおつかまりください。</p>' +
                '<p class="e">The train may sway on curves ahead.<br>Please hold on to a strap or handrail.</p></div>';
        }

        // 月台圖：出口座標投影到行進方向推算各出口靠第幾節（0 = 最後面，畫在左邊）
        function platformData() {
            const s = st.target, {stations} = stopList(), i = stations.indexOf(s);
            const n = Math.min(12, Math.max(2, +train.carComposition || +train.r.carComposition || 8));
            const prev = stations[i - 1] || null, next = stations[i + 1];
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
                    const car = Math.min(n - 1, Math.max(0, Math.floor((off + half) / 20)));
                    const gr = groups.get(car) || {car, exits: [], fac: new Set()};
                    gr.exits.push(e);
                    (e.facilities || ['stairs']).forEach(f => gr.fac.add(f));
                    groups.set(car, gr);
                }
                // 相鄰車廂合併，最多 3 塊看板
                const list = [...groups.values()].sort((a, b) => a.car - b.car), merged = [];
                for (const g of list) {
                    const m = merged[merged.length - 1];
                    if (m && g.car - m.lastCar <= 1) {
                        m.exits.push(...g.exits);
                        g.fac.forEach(f => m.fac.add(f));
                        m.lastCar = g.car;
                    } else {
                        merged.push(Object.assign(g, {lastCar: g.car}));
                    }
                }
                merged.sort((a, b) => b.exits.length - a.exits.length);
                return {n, kind: 'est', groups: merged.slice(0, 3).sort((a, b) => a.car - b.car)};
            }
            const rnd = hash(s.id || sName(s, 'en'));
            const names = [['北口', 'North'], ['南口', 'South'], ['中央口', 'Central'], ['東口', 'East'], ['西口', 'West']];
            const used = [], groups = [];
            let guard = 0;
            while (groups.length < 2 && guard++ < 50) {
                const car = Math.floor(rnd() * n);
                if (used.some(u => Math.abs(u - car) < 3)) continue;
                used.push(car);
                const fac = new Set(['stairs']);
                if (rnd() > 0.5) fac.add('elevator');
                groups.push({car, fake: names.splice(Math.floor(rnd() * names.length), 1)[0], fac});
            }
            return {n, kind: 'img', groups: groups.sort((a, b) => a.car - b.car)};
        }

        function exitText(ex) {
            const names = ex.filter(e => !/\.EV[^.]*$/.test(e.id || '')).map(e => (e.title && (e.title.ja || e.title.en)) || '').filter(Boolean);
            if (!names.length) return '';
            if (names.every(t => /^\d+$/.test(t))) {
                const nums = [...new Set(names.map(Number))].sort((a, b) => a - b), parts = [];
                for (let i = 0; i < nums.length; i++) {
                    let j = i;
                    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
                    parts.push(j - i >= 2 ? `${nums[i]}~${nums[j]}` : nums.slice(i, j + 1).join('・'));
                    i = j;
                }
                return parts.join('・');
            }
            return names.slice(0, 3).join('・') + (names.length > 3 ? '…' : '');
        }

        function platformPage() {
            const d = platformData(), n = d.n;
            const L0 = 14, W = 70, cw = W / n, cx = c => L0 + cw * (c + 0.5);
            const xs = xferGroups(st.target).slice(0, 6);
            let h = '<div class="kp-page kp-pf"><div class="kp-pfbg"></div>';
            if (xs.length) {
                h += `<div class="kp-pxl">${xs.map(g => `<div>${badges(g)}<span><b>${esc(g.ja)}</b><small>${esc(g.en)}</small></span></div>`).join('')}</div>`;
            }
            // 線稿：看板引線＋大廳線＋樓梯（＋電梯）
            let svg = '<svg viewBox="0 0 100 36" preserveAspectRatio="none">';
            d.groups.forEach(g => {
                const x = cx(g.car), dirR = g.car < n / 2;
                const x2 = x + (dirR ? 1 : -1) * Math.min(cw * 0.9, 6);
                svg += `<line x1="${x}" y1="15.5" x2="${x}" y2="21.5" stroke="#777" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
                svg += `<line x1="${x - (dirR ? 4 : -4)}" y1="22" x2="${x}" y2="22" stroke="#111" stroke-width="2.2" vector-effect="non-scaling-stroke"/>`;
                const steps = 6;
                let path = `M${x} 22`;
                for (let i = 1; i <= steps; i++) {
                    const px = x + (x2 - x) * i / steps;
                    path += ` L${px} ${22 + 4.4 * (i - 1) / steps} L${px} ${22 + 4.4 * i / steps}`;
                }
                svg += `<path d="${path}" fill="none" stroke="#111" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
                if (g.fac.has('elevator')) {
                    const ex = x - (dirR ? 3.4 : -2.2);
                    svg += `<rect x="${ex}" y="19.5" width="1.6" height="11" fill="#aaa" stroke="#555" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
                }
            });
            h += svg + '</svg>';
            d.groups.forEach((g, i) => {
                const x = Math.min(84, Math.max(16, cx(g.car)));
                let gate, gateEn, ex = '';
                if (g.fake) {
                    gate = `${g.fake[0]}改札`;
                    gateEn = `${g.fake[1]} Gate`;
                } else {
                    ex = exitText(g.exits);
                    gate = ex ? '改札' : 'エレベーター';
                    gateEn = ex ? 'Gate' : 'Elevator';
                }
                h += `<div class="kp-brd" style="left:${x}%;animation-delay:${i * 90}ms"><span class="g"><b>${esc(gate)}</b><small>${esc(gateEn)}</small></span>` +
                    (ex ? `<span class="g"><b>出口</b><small>Exit</small></span><span class="n">${esc(ex)}</span>` : '') + '</div>';
            });
            // 車廂：左邊最後、右邊車頭（1 號車）
            for (let c = 0; c < n; c++) {
                h += `<div class="kp-car6${c === 0 ? ' r' : ''}${c === n - 1 ? ' f here' : ''}" style="left:${L0 + cw * c}%;width:${cw}%">${n - c}</div>`;
            }
            h += `<div class="kp-cstripe" style="left:${L0}%;width:${W}%"></div>`;
            h += `<div class="kp-here" style="left:${cx(n - 1)}%">現在地<small>You are here</small></div><div class="kp-parrow">→</div>`;
            h += d.kind === 'est' ?
                '<div class="kp-note">※出口の位置から推算した目安です</div>' :
                '<div class="kp-note img">※イメージです（この駅の出口データなし）</div>';
            return h + '</div>';
        }

        function doorsPage(lang) {
            const en = isEn(lang);
            const thisSide = hash(`${st.target.id}|${train.d ? train.d.id : ''}`)() > 0.5;
            const txt = thisSide ?
                ['こちら側のドアが開きます', 'Doors on this side will open.'] :
                ['反対側のドアが開きます', 'Doors on the opposite side will open.'];
            return `<div class="kp-page"><div class="kp-dtx">${en ? `<span class="kp-en">${txt[1]}</span>` : `${txt[0]} / <span class="kp-en">${txt[1]}</span>`}</div>` +
                `<div class="kp-dw ${thisSide ? 'open' : 'shut'}"><div class="kp-dar l"></div><div class="kp-dar r"></div>` +
                '<div class="kp-dws">足元にご注意ください<b>WATCH YOUR STEP</b><i></i></div>' +
                '<div class="kp-dl"></div><div class="kp-dr"></div></div>' +
                '<div class="kp-note img" style="z-index:3">※開くドアはイメージです</div></div>';
        }

        function renderBody(p) {
            const fn = {route: routePage, overview: overviewPage, xfer: xferPage, caution: cautionPage, platform: platformPage, doors: doorsPage}[p.body];
            el.body.innerHTML = fn(p.lang);
        }

        function render() {
            const p = seq[page];
            renderHead(p);
            renderBody(p);
        }

        function tick() {
            if (!visible || !train) return;
            const t = performance.now(), s = computeState();
            const key = `${train.id}|${s.phase}|${s.target && s.target.id}`;
            st = s;
            if (key !== seqKey) {
                // 狀態一變（例如進入まもなく）立刻從頭播
                seqKey = key;
                const c = colorOf((train.v || train.r).color);
                root.style.setProperty('--c', c);
                root.style.setProperty('--cl', shade(c, 0.45));
                root.style.setProperty('--cd', shade(c, -0.18));
                seq = buildSeq();
                page = 0;
                pageT = t;
                render();
            } else if (t - pageT > seq[page].ms) {
                page = (page + 1) % seq.length;
                pageT = t;
                render();
            }
            const dm = Math.floor((train.delay || 0) / 60000), tk = dm >= 1 ? T.delay(dm) : '';
            if (tk !== tickKey) {
                tickKey = tk;
                el.ticker.classList.toggle('on', !!tk);
                el.ticker.firstChild.textContent = tk;
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
