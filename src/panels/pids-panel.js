import {createElement} from '../helpers/helpers';
import {
    PIDS_AS_OF, PIDS_CAR_COUNT, PIDS_CAR_NUMBER, PIDS_CURVES, PIDS_NOTES, PIDS_REFERENCE_TERMINAL, PIDS_STATIONS
} from './pids-data';

// Fallback line letters for railways without station codes in the data whose
// station order matches the official station numbering (number = index + 1)
const NUMBERED_LINES = {
    'Toei.Asakusa': 'A',
    'Toei.Mita': 'I',
    'Toei.Shinjuku': 'S'
};

const MAX_STOPS = 8,
    PAGE_DURATION = 6000,
    NAME_DURATION = 3000,
    ARRIVING_THRESHOLD = 45000;

// Strings for the English route page that alternates with the Japanese one
const EN = {
    min: 'min',
    note: 'Estimated time required.'
};

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

function isCJK(text) {
    return /^[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]+$/.test(text);
}

function getStationCode(station) {
    const match = /^([A-Za-z]+)(\d+)$/.exec(station.code || '');

    if (match) {
        return {letter: match[1], number: match[2]};
    }

    const railway = station.railway,
        letter = railway && NUMBERED_LINES[railway.id];

    if (letter) {
        const index = railway.stations.indexOf(station);

        if (index >= 0) {
            return {letter, number: `0${index + 1}`.slice(-2)};
        }
    }
}

function getTitle(object, lang) {
    const title = object.title || {};

    return title[lang] || title.en;
}

/**
 * Creates an in-train passenger information display (PIDS) modeled on the LCD
 * screens in Tokyo Metro cars. It shows the next stop, upcoming stops with
 * minutes to arrival, transfer lines and, where the station details are known,
 * the platform diagram, door side and sway warnings.
 */
export default class {

    constructor(options) {
        this._options = Object.assign({}, options);
    }

    addTo(map) {
        const me = this;

        me._map = map;

        const container = me._container = createElement('div', {
            className: 'pids closed',
            innerHTML: [
                '<div class="pids-close-button"></div>',
                '<div class="pids-header"></div>',
                '<div class="pids-rule"></div>',
                '<div class="pids-body"></div>',
                '<div class="pids-footer"></div>'
            ].join('')
        }, map.container);

        container.querySelector('.pids-close-button').addEventListener('click', () => {
            me.remove();
        });

        me._update();
        me._interval = setInterval(() => me._update(), 500);

        requestAnimationFrame(() => {
            container.classList.remove('closed');
        });

        return me;
    }

    remove() {
        const me = this,
            container = me._container;

        if (!container) {
            return me;
        }
        clearInterval(me._interval);
        container.classList.add('closed');
        delete me._container;
        delete me._map;
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 300);

        return me;
    }

    isOpen() {
        return !!this._container;
    }

    /**
     * Flattens the train's timetable chain (including through services) into
     * a list of stops. Mirrors the logic of TrainPanel so that indices line up
     * with train.timetableIndex.
     * @param {Train} train - The train to build stops for
     * @returns {Array<Object>} Stops with station, railway and time
     */
    _buildStops(train) {
        const timetables = [],
            stops = [];
        let lastArrivalTime;

        this._timetable = train.timetable;

        for (let curr = train.timetable; curr; curr = curr.pt && curr.pt[0]) {
            timetables.unshift(curr);
        }
        for (let curr = train.timetable.nt && train.timetable.nt[0]; curr; curr = curr.nt && curr.nt[0]) {
            timetables.push(curr);
        }

        for (const curr of timetables) {
            const stations = curr.stations;

            if (curr === train.timetable) {
                this._offset = stops.length;
            }
            for (let i = 0, ilen = stations.length; i < ilen; i++) {
                const arrivalTime = curr.arrivalTimes[i] || lastArrivalTime,
                    departureTime = curr.departureTimes[i];

                if (i === ilen - 1 && curr.nt) {
                    lastArrivalTime = arrivalTime;
                    break;
                }
                lastArrivalTime = undefined;
                stops.push({
                    station: stations[i],
                    railway: curr.r,
                    time: arrivalTime !== undefined ? arrivalTime : departureTime
                });
            }
        }

        return stops;
    }

    _getTransfers(station, railway) {
        const map = this._map,
            group = map.stationGroupLookup.get(station.group),
            seen = new Set([railway]),
            transfers = [];

        for (const {railway: r} of group ? group.stations : []) {
            if (r && !seen.has(r)) {
                seen.add(r);
                transfers.push(r);
            }
        }

        return transfers;
    }

    /**
     * Returns the station names the header cycles through, like the real
     * displays do: the localized name, then the kana reading and English
     * for Japanese, or English and Japanese for other languages.
     * @param {Station} station - The station
     * @returns {Array<string>} Distinct station names in display order
     */
    _getStationNames(station) {
        const map = this._map,
            title = station.title,
            names = [map.getLocalizedStationTitle(station)].concat(
                map.lang === 'ja' ? [title['ja-Hrkt'], title.en] : [title.en, title.ja]
            );

        return names.filter((name, i) => name && names.indexOf(name) === i);
    }

    /**
     * Checks whether the platform diagrams need to be mirrored, which is the
     * case when the train runs away from the terminal they were drawn for.
     * @param {Array<Object>} stops - Stops of the train
     * @param {number} index - Index of the current stop
     * @returns {boolean} True if the diagrams should be mirrored
     */
    _isMirrored(stops, index) {
        const curr = stops[index],
            next = stops[index + 1] || curr,
            prev = stops[index + 1] ? curr : stops[index - 1] || curr,
            railway = curr.railway,
            terminal = PIDS_REFERENCE_TERMINAL[railway.id];

        if (!terminal) {
            return false;
        }

        const stations = railway.stations.map(({id}) => id),
            ref = stations.indexOf(terminal),
            from = stations.indexOf(prev.station.id),
            to = stations.indexOf(next.station.id);

        return from >= 0 && to >= 0 && Math.abs(to - ref) > Math.abs(from - ref);
    }

    _update() {
        const me = this,
            map = me._map,
            train = me._options.object;

        if (!map || train.timetableIndex === undefined) {
            return;
        }
        if (train.timetable !== me._timetable) {
            me._stops = me._buildStops(train);
        }

        const stops = me._stops,
            now = map.clock.getTimeOffset(),
            delay = train.delay || 0,
            index = me._offset + train.timetableIndex,
            moving = !!train.arrivalStation,
            targetIndex = Math.min(moving ? index + 1 : index, stops.length - 1),
            target = stops[targetIndex],
            remaining = target.time + delay - now,
            terminal = targetIndex === stops.length - 1,
            origin = !moving && index === 0,
            info = PIDS_STATIONS[target.station.id],
            sectionIds = [stops[index].station.id, target.station.id],
            curve = moving && PIDS_CURVES.some(([a, b]) => sectionIds.includes(a) && sectionIds.includes(b));
        let mode = 'stopped';

        if (moving) {
            mode = train._t >= 0.7 || remaining <= ARRIVING_THRESHOLD ? 'arriving' : 'next';
        }

        const transfers = me._getTransfers(target.station, target.railway),
            routeStart = Math.max(0, Math.min(index, stops.length - MAX_STOPS)),
            pages = [];

        if (origin) {
            pages.push('origin');
        } else if (mode === 'arriving') {
            if (info) {
                pages.push('map', 'door');
            }
            pages.push('route');
        } else if (mode === 'stopped') {
            if (!info || info.door === 'this') {
                pages.push('step');
            }
            pages.push('route');
            if (info) {
                pages.push('map');
            }
        } else {
            if (curve) {
                pages.push('curve');
            }
            pages.push('route');
            if (transfers.length) {
                pages.push('transfers');
            }
        }
        if (map.lang === 'ja') {
            const i = pages.lastIndexOf('route');

            if (i >= 0) {
                pages.splice(i + 1, 0, 'route-en');
            }
        }

        const elapsed = performance.now(),
            page = pages[Math.floor(elapsed / PAGE_DURATION) % pages.length],
            names = me._getStationNames(target.station),
            name = names[Math.floor(elapsed / NAME_DURATION) % names.length],
            minutes = stops.slice(routeStart, routeStart + MAX_STOPS).map(({time}) =>
                Math.max(0, Math.round((time + delay - now) / 60000))),
            key = [target.station.id, mode, page, name, map.lang, index, ...minutes].join();

        if (key === me._lastKey) {
            return;
        }
        me._lastKey = key;

        const container = me._container,
            body = container.querySelector('.pids-body');
        let footer = '';

        container.style.setProperty('--pids-color', target.railway.color);
        container.querySelector('.pids-header').innerHTML = origin ?
            me._renderOriginHeader(stops[stops.length - 1]) :
            me._renderHeader(train, target, mode, terminal, name);
        body.className = `pids-body pids-page-${page}`;

        if (page === 'route' || page === 'route-en') {
            const lang = page === 'route-en' ? 'en' : map.lang;

            body.innerHTML = me._renderRoute(stops.slice(routeStart, routeStart + MAX_STOPS), minutes, index - routeStart, !moving, lang);
            footer = escapeHTML(page === 'route-en' ? EN.note : map.dict['pids-note']);
        } else if (page === 'origin') {
            body.innerHTML = me._renderOrigin(stops, delay, now);
            footer = escapeHTML(map.dict['pids-note']);
        } else if (page === 'transfers') {
            body.innerHTML = me._renderTransfers(transfers);
        } else if (page === 'map') {
            body.innerHTML = me._renderMap(info, transfers, me._isMirrored(stops, index));
            footer = `${PIDS_AS_OF.ja}<br>${PIDS_AS_OF.en}`;
            me._layoutMap(body);
        } else if (page === 'door') {
            body.innerHTML = me._renderDoor(info.door);
        } else if (page === 'curve') {
            body.innerHTML = me._renderCurve();
        } else {
            body.innerHTML = me._renderWatchStep(!!info);
        }
        container.querySelector('.pids-footer').innerHTML = footer;
    }

    _renderBadge(station) {
        const code = getStationCode(station);

        return `<div class="pids-badge">${code ? `<span>${code.letter}</span><span>${code.number}</span>` : ''}</div>`;
    }

    _renderCarNumber() {
        return [
            '<div class="pids-car">',
            `<span>${PIDS_CAR_NUMBER}</span>`,
            `<small>${escapeHTML(this._map.dict['pids-car'])}</small>`,
            '</div>'
        ].join('');
    }

    _renderHeader(train, target, mode, terminal, title) {
        const map = this._map,
            dict = map.dict,
            suffix = terminal ? '-terminal' : '',
            label = mode === 'arriving' ? dict[`pids-arriving${suffix}`] :
            mode === 'next' ? dict[`pids-next${suffix}`] :
            terminal ? dict['pids-terminal'] : '',
            destination = train.ds ? map.getLocalizedStationTitle(train.ds) : map.getLocalizedRailDirectionTitle(train.d);

        return [
            '<div class="pids-header-top">',
            `<span class="pids-destination">${escapeHTML(dict['pids-for'].replace('$1', destination))}</span>`,
            this._renderCarNumber(),
            '</div>',
            '<div class="pids-header-main">',
            `<div class="pids-label">${escapeHTML(label)}</div>`,
            this._renderBadge(target.station),
            '<div class="pids-station">',
            `<div class="pids-station-title${isCJK(title) ? '' : ' latin'}">${escapeHTML(title)}</div>`,
            '</div>',
            '</div>'
        ].join('');
    }

    _renderOriginHeader(last) {
        const map = this._map,
            [before, after] = map.dict['pids-for'].split('$1');

        return [
            '<div class="pids-header-top">',
            '<span class="pids-destination"></span>',
            this._renderCarNumber(),
            '</div>',
            '<div class="pids-header-main origin">',
            this._renderBadge(last.station),
            '<div class="pids-station">',
            before.trim() ? `<span class="pids-for">${escapeHTML(before.trim())}</span>` : '',
            `<span class="pids-station-title">${escapeHTML(map.getLocalizedStationTitle(last.station))}</span>`,
            after.trim() ? `<span class="pids-for">${escapeHTML(after.trim())}</span>` : '',
            '</div>',
            '</div>'
        ].join('');
    }

    _renderStopTitle(title) {
        // Stack CJK characters one per line like the real displays, and fall
        // back to sideways vertical text for Latin script
        if (isCJK(title)) {
            return `<div class="pids-stop-title cjk">${[...title].map(c => `<span>${escapeHTML(c)}</span>`).join('')}</div>`;
        }
        return `<div class="pids-stop-title">${escapeHTML(title)}</div>`;
    }

    _renderRoute(stops, minutes, current, standing, lang) {
        const me = this,
            map = me._map,
            min = lang === map.lang ? map.dict['pids-min'] : EN.min;

        return [
            '<div class="pids-route">',
            '<div class="pids-route-bar"></div>',
            ...stops.map(({station, railway}, i) => {
                const code = getStationCode(station),
                    transfers = i >= current ? me._getTransfers(station, railway).slice(0, 3) : [],
                    passed = i < current || (i === current && !standing);

                return [
                    `<div class="pids-stop${passed ? ' passed' : ''}${i === current ? ' current' : ''}">`,
                    '<div class="pids-stop-transfers">',
                    ...transfers.map(r =>
                        `<div><span style="background-color: ${r.color};"></span>${escapeHTML(getTitle(r, lang))}</div>`),
                    '</div>',
                    '<div class="pids-stop-minutes">',
                    i === current ? `<div class="pids-chevron${standing ? ' standing' : ''}"></div>` :
                    i < current ? '' :
                    `${minutes[i]}${i === stops.length - 1 ? `<small>${escapeHTML(min)}</small>` : ''}`,
                    '</div>',
                    `<div class="pids-stop-code">${code ? `${code.letter}-${code.number}` : ''}</div>`,
                    me._renderStopTitle(getTitle(station, lang)),
                    '</div>'
                ].join('');
            }),
            '</div>'
        ].join('');
    }

    _renderOrigin(stops, delay, now) {
        const map = this._map;

        return [
            '<div class="pids-origin">',
            '<div class="pids-origin-bar"></div>',
            ...stops.map(({station, time}, i) => {
                const code = getStationCode(station),
                    title = map.getLocalizedStationTitle(station);

                return [
                    '<div class="pids-origin-stop">',
                    `<div class="pids-origin-minutes">${i ? Math.max(0, Math.round((time + delay - now) / 60000)) : ''}</div>`,
                    `<div class="pids-origin-dot${i ? '' : ' current'}"></div>`,
                    `<div class="pids-origin-code">${code ? `${code.letter}-${code.number}` : ''}</div>`,
                    isCJK(title) ?
                        `<div class="pids-origin-title cjk">${[...title].map(c => `<span>${escapeHTML(c)}</span>`).join('')}</div>` :
                        `<div class="pids-origin-title">${escapeHTML(title)}</div>`,
                    '</div>'
                ].join('');
            }),
            '</div>'
        ].join('');
    }

    _renderMap(info, transfers, mirrored) {
        const gates = info.gates.map(gate => Object.assign({}, gate, {x: mirrored ? 1 - gate.x : gate.x}))
                .sort((a, b) => a.x - b.x),
            note = PIDS_NOTES[info.note],
            cars = [];

        for (let i = PIDS_CAR_COUNT; i >= 1; i--) {
            cars.push(`<div class="pids-map-car${i === PIDS_CAR_NUMBER ? ' current' : ''}">${i}</div>`);
        }

        this._mapGates = gates;
        this._mapElevators = (info.elevators || []).map(x => (mirrored ? 1 - x : x));

        return [
            '<div class="pids-map">',
            '<div class="pids-map-top">',
            '<div class="pids-map-transfers">',
            ...transfers.slice(0, 6).map(r => [
                '<div class="pids-map-transfer">',
                `<span style="border-color: ${r.color};"></span>`,
                `<div>${escapeHTML(getTitle(r, 'ja'))}<small>${escapeHTML(getTitle(r, 'en'))}</small></div>`,
                '</div>'
            ].join('')),
            '</div>',
            '<div class="pids-map-gates">',
            ...gates.map(({ja, en, exits}) => [
                '<div class="pids-map-gate">',
                `<div class="pids-map-gate-name">${escapeHTML(ja)}<small>${escapeHTML(en)}</small></div>`,
                exits ? `<div class="pids-map-gate-exit">出口<small>Exit</small></div><div class="pids-map-gate-exits">${escapeHTML(exits)}</div>` : '',
                '</div>'
            ].join('')),
            '</div>',
            '</div>',
            '<div class="pids-map-platform">',
            '<svg class="pids-map-lines"></svg>',
            info.via ? `<div class="pids-map-via">${escapeHTML(info.via.ja)} <small>${escapeHTML(info.via.en)}</small></div>` : '',
            info.across ? `<div class="pids-map-across">${escapeHTML(info.across.ja)}<small>${escapeHTML(info.across.en)}</small></div>` : '',
            `<div class="pids-map-train">${cars.join('')}</div>`,
            '<div class="pids-map-here">現在地<small>You are here</small></div>',
            '<div class="pids-map-arrow"></div>',
            note ? `<div class="pids-map-note">${escapeHTML(note.ja)}</div>` : '',
            '</div>',
            '</div>'
        ].join('');
    }

    /**
     * Spreads the gate labels so they don't overlap and draws the lines from
     * each label down to where its stairs meet the platform, once the browser
     * has laid out the labels.
     * @param {HTMLElement} body - The PIDS body element
     */
    _layoutMap(body) {
        const gates = this._mapGates,
            elevators = this._mapElevators;

        requestAnimationFrame(() => {
            const train = body.querySelector('.pids-map-train'),
                svg = body.querySelector('.pids-map-lines'),
                here = body.querySelector('.pids-map-here');

            if (!train || !svg) {
                return;
            }

            const width = body.clientWidth,
                platform = body.querySelector('.pids-map-platform'),
                boxes = [...body.querySelectorAll('.pids-map-gate')],
                left = train.offsetLeft,
                trainWidth = train.offsetWidth,
                toX = x => left + Math.max(-0.12, Math.min(1.12, x)) * trainWidth,
                positions = boxes.map((box, i) => {
                    const w = box.offsetWidth;
                    return {w, l: toX(gates[i].x) - w / 2};
                });

            // Center each label over its stairs, then push overlapping labels
            // apart and back inside the display
            for (let i = 1; i < positions.length; i++) {
                const prev = positions[i - 1];
                positions[i].l = Math.max(positions[i].l, prev.l + prev.w + 4);
            }
            for (let i = positions.length - 1; i >= 0; i--) {
                const limit = i === positions.length - 1 ? width - 4 : positions[i + 1].l - 4;
                positions[i].l = Math.max(4, Math.min(positions[i].l, limit - positions[i].w));
            }
            boxes.forEach((box, i) => {
                box.style.left = `${positions[i].l}px`;
            });

            const carWidth = trainWidth / PIDS_CAR_COUNT,
                y = train.offsetTop - 2,
                lines = [];

            here.style.left = `${left + (PIDS_CAR_COUNT - PIDS_CAR_NUMBER + 0.5) * carWidth}px`;

            boxes.forEach((box, i) => {
                const fromX = positions[i].l + positions[i].w / 2,
                    x = toX(gates[i].x);

                lines.push(
                    `<polyline points="${fromX},0 ${fromX},10 ${x},10 ${x},${y}" />`,
                    `<path class="stairs" d="M${x - 5},${y - 1} h10 M${x - 5},${y - 4} h10 M${x - 5},${y - 7} h10" />`
                );
            });
            for (const e of elevators) {
                lines.push(`<rect class="elevator" x="${toX(e) - 6}" y="${y - 34}" width="12" height="34" />`);
            }
            svg.setAttribute('height', platform.offsetHeight);
            svg.innerHTML = lines.join('');
        });
    }

    _renderDoor(side) {
        const open = side === 'this';

        return [
            `<div class="pids-door${open ? '' : ' opposite'}">`,
            open ?
                '<div class="pids-door-title">こちら側のドアが開きます <span>/ Doors on this side will open.</span></div>' :
                '<div class="pids-door-title">反対側のドアが開きます<span>/ Doors on the opposite side will open.</span></div>',
            '<div class="pids-door-scene">',
            open ? '<div class="pids-door-arrow left"></div>' : '',
            '<div class="pids-door-leaves"><div></div><div></div></div>',
            open ? '<div class="pids-door-arrow right"></div>' : '<div class="pids-door-stop"></div>',
            '</div>',
            '</div>'
        ].join('');
    }

    _renderWatchStep(knownSide) {
        return [
            '<div class="pids-door step">',
            knownSide ? '<div class="pids-door-title">こちら側のドアが開きます <span>/ Doors on this side will open.</span></div>' : '',
            '<div class="pids-door-scene">',
            '<div class="pids-door-arrow left"></div>',
            '<div class="pids-door-opening">',
            '<div class="pids-step-text"><div>足元にご注意ください</div><div>WATCH YOUR STEP</div></div>',
            '<div class="pids-step-arrow"></div>',
            '</div>',
            '<div class="pids-door-arrow right"></div>',
            '</div>',
            '</div>'
        ].join('');
    }

    _renderCurve() {
        return [
            '<div class="pids-curve">',
            '<div class="pids-curve-title">電車の揺れにご注意！</div>',
            '<div class="pids-curve-text">これから先は、カーブが多く電車が揺れますのでご注意ください。</div>',
            '<div class="pids-curve-en">The train may rock due to curves on the way, please be careful.</div>',
            '</div>'
        ].join('');
    }

    _renderTransfers(transfers) {
        const map = this._map;

        return [
            `<div class="pids-transfers-title">${escapeHTML(map.dict['pids-transfer'])}</div>`,
            '<div class="pids-transfers">',
            ...transfers.map(r => [
                '<div class="pids-transfer">',
                `<span style="background-color: ${r.color};"></span>`,
                escapeHTML(map.getLocalizedRailwayTitle(r)),
                '</div>'
            ].join('')),
            '</div>'
        ].join('');
    }

}
