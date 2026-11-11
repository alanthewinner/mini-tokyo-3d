// 從 ODPT 抓站號（odpt:stationCode）、平假名讀音（ja-Hrkt）、路線代號（odpt:lineCode），
// 輸出 public/station-meta.json 給看車 PIDS 用。
//
//   npm run station-meta
//
// 需要 .env 裡的 MT3D_SECRET_ODPT（https://developer.odpt.org/），
// MT3D_SECRET_CHALLENGE（https://developer-tokyochallenge.odpt.org/）有的話會補抓 JR 等 Challenge 資料。
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config();

const ENDPOINTS = [
    {base: 'https://api.odpt.org/api/v4/', key: process.env.MT3D_SECRET_ODPT},
    {base: 'https://api-challenge.odpt.org/api/v4/', key: process.env.MT3D_SECRET_CHALLENGE}
].filter(e => e.key);

if (!ENDPOINTS.length) {
    console.error('沒有 MT3D_SECRET_ODPT / MT3D_SECRET_CHALLENGE，抓不了。先去 .env 填 key。');
    process.exit(1);
}

const railways = JSON.parse(fs.readFileSync('data/railways.json', 'utf8'));
const operators = [...new Set(railways.map(r => r.id.split('.')[0]))];
const wantedStations = new Set(railways.flatMap(r => r.stations));
const wantedRailways = new Set(railways.map(r => r.id));
const strip = id => id.replace(/^odpt\.\w+:/, '');

async function get(endpoint, type, operator) {
    const url = `${endpoint.base}${type}?odpt:operator=odpt.Operator:${operator}&acl:consumerKey=${endpoint.key}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
}

const meta = {stations: {}, lines: {}, generated: new Date().toISOString()};
const found = {stations: 0, codes: 0, kana: 0, lines: 0};

for (const operator of operators) {
    let got = false;
    for (const endpoint of ENDPOINTS) {
        const [rails, stations] = await Promise.all([
            get(endpoint, 'odpt:Railway', operator),
            get(endpoint, 'odpt:Station', operator)
        ]);
        if (!rails.length && !stations.length) continue;
        got = true;
        for (const r of rails) {
            const id = strip(r['owl:sameAs'] || '');
            if (wantedRailways.has(id) && r['odpt:lineCode']) {
                meta.lines[id] = {code: r['odpt:lineCode']};
                found.lines++;
            }
            for (const o of r['odpt:stationOrder'] || []) {
                const sid = strip(o['odpt:station'] || '');
                const kana = o['odpt:stationTitle'] && o['odpt:stationTitle']['ja-Hrkt'];
                if (wantedStations.has(sid) && kana) {
                    (meta.stations[sid] = meta.stations[sid] || {}).kana = kana;
                }
            }
        }
        for (const s of stations) {
            const sid = strip(s['owl:sameAs'] || '');
            if (!wantedStations.has(sid)) continue;
            const m = meta.stations[sid] = meta.stations[sid] || {};
            if (s['odpt:stationCode']) m.code = s['odpt:stationCode'];
            const kana = s['odpt:stationTitle'] && s['odpt:stationTitle']['ja-Hrkt'];
            if (kana && !m.kana) m.kana = kana;
        }
        break;
    }
    console.log(`${got ? '✓' : '✗'} ${operator}`);
}

for (const m of Object.values(meta.stations)) {
    found.stations++;
    if (m.code) found.codes++;
    if (m.kana) found.kana++;
}
fs.writeFileSync('public/station-meta.json', JSON.stringify(meta));
console.log(`寫入 public/station-meta.json：${found.stations} 站（站號 ${found.codes}、假名 ${found.kana}）、路線代號 ${found.lines} 條`);
