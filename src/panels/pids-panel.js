import {createElement, loadJSON, resolveAssetUrl} from '../helpers/helpers';
import {
    PIDS_AS_OF, PIDS_CAR_COUNT, PIDS_CAR_NUMBER, PIDS_CURVES, PIDS_LINE_MARKS, PIDS_NOTES, PIDS_REFERENCE_TERMINAL, PIDS_STATIONS
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
    ARRIVING_THRESHOLD = 45000,
    SWAP_DURATION = 1000,
    ANNOUNCE_PATH = 'assets/announce/',
    SOUND_STORAGE_KEY = 'mt3d:pids-sound';

// Announcement clips are optional local files listed in a manifest next to
// them; they are not part of the repository
let announceManifest;

function loadAnnounceManifest() {
    if (!announceManifest) {
        announceManifest = Promise.resolve()
            .then(() => loadJSON(resolveAssetUrl(`${ANNOUNCE_PATH}manifest.json`)))
            .then(manifest => new Set(Object.keys(manifest)))
            .catch(() => new Set());
    }
    return announceManifest;
}

function getSoundSetting() {
    try {
        return localStorage.getItem(SOUND_STORAGE_KEY) === 'on';
    } catch (e) {
        return false;
    }
}

function setSoundSetting(on) {
    try {
        localStorage.setItem(SOUND_STORAGE_KEY, on ? 'on' : 'off');
    } catch (e) {
        // Ignore storage errors
    }
}

// English strings for the pages and labels that switch to English while the
// header shows the English station name
const EN = {
    'pids-for': 'For $1',
    'pids-next': 'Next',
    'pids-arriving': 'Arriving at',
    'pids-next-terminal': 'Next is the last stop',
    'pids-arriving-terminal': 'Arriving at the last stop',
    'pids-terminal': 'Last stop',
    'pids-min': 'min',
    'pids-note': 'Estimated time required.'
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
 * Returns the HTML for a line symbol: a ring with a letter for Tokyo Metro and
 * Toei lines, a rounded square with the code for other operators, or a plain
 * colored dot if the line has no symbol.
 * @param {Railway} railway - The railway
 * @param {Station} station - A station of the railway, used for its code
 * @returns {string} HTML string
 */
function renderLineMark(railway, station) {
    const code = PIDS_LINE_MARKS[railway.id] || (getStationCode(station || {}) || {}).letter,
        ring = /^(TokyoMetro|Toei)\./.test(railway.id) && code && code.length === 1;

    return `<span class="pids-line ${code ? ring ? 'ring' : 'square' : 'dot'}" style="--line-color: ${railway.color};">${code ? escapeHTML(code) : ''}</span>`;
}

function renderStationNumber(station, color) {
    const code = getStationCode(station);

    return code ?
        `<span class="pids-station-number" style="--line-color: ${color};"><b>${code.letter}</b>${code.number}</span>` :
        '';
}

/**
 * Replaces the content of an element with an animation: the old content
 * leaves while the new content enters. Does nothing if the content is the
 * same.
 * @param {HTMLElement} element - The element
 * @param {string} html - The new content
 */
function swap(element, html) {
    if (element._html === html) {
        return;
    }

    const animate = element._html !== undefined;

    element._html = html;
    for (const child of [...element.children]) {
        if (!animate) {
            child.remove();
        } else if (!child.classList.contains('out')) {
            child.classList.remove('in');
            child.classList.add('out');
            setTimeout(() => child.remove(), SWAP_DURATION);
        }
    }
    createElement('div', {
        className: `pids-swap-item${animate ? ' in' : ''}`,
        innerHTML: html
    }, element);
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
                '<div class="pids-sound-button" hidden></div>',
                '<div class="pids-header">',
                '<div class="pids-header-top">',
                '<div class="pids-destination pids-swap"></div>',
                '<div class="pids-car"></div>',
                '</div>',
                '<div class="pids-header-main">',
                '<div class="pids-label pids-swap"></div>',
                '<div class="pids-badge-slot pids-swap"></div>',
                '<div class="pids-station pids-swap"></div>',
                '</div>',
                '</div>',
                '<div class="pids-rule"></div>',
                '<div class="pids-body"></div>',
                '<div class="pids-footer"></div>'
            ].join('')
        }, map.container);

        container.querySelector('.pids-close-button').addEventListener('click', () => {
            me.remove();
        });

        const soundButton = container.querySelector('.pids-sound-button');

        me._sound = getSoundSetting();
        soundButton.classList.toggle('on', me._sound);
        soundButton.addEventListener('click', () => {
            me._sound = !me._sound;
            setSoundSetting(me._sound);
            soundButton.classList.toggle('on', me._sound);
            if (me._sound) {
                // Play the announcement for the current situation right away
                me._playAnnouncement(me._announceKey);
            } else {
                me._stopAnnouncement();
            }
        });
        loadAnnounceManifest().then(clips => {
            me._clips = clips;
            soundButton.hidden = !clips.size;
        });

        me._update();
        me._interval = setInterval(() => me._update(), 250);

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
        me._stopAnnouncement();
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

    /**
     * Returns the lines you can change to at a station, each with the station
     * of that line.
     * @param {Station} station - The station
     * @param {Railway} railway - The railway of the train
     * @returns {Array<Object>} Transfers with railway and station
     */
    _getTransfers(station, railway) {
        const map = this._map,
            group = map.stationGroupLookup.get(station.group),
            seen = new Set([railway]),
            transfers = [];

        for (const s of group ? group.stations : []) {
            if (s.railway && !seen.has(s.railway)) {
                seen.add(s.railway);
                transfers.push({railway: s.railway, station: s});
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
            // The sway warning is shown once when entering a curved section,
            // then the display goes back to its usual rotation
            const section = sectionIds.join('>');

            if (curve && me._curveSection !== section) {
                me._curveSection = section;
                me._curveUntil = performance.now() + PAGE_DURATION;
            }
            if (curve && performance.now() < me._curveUntil) {
                pages.push('curve');
            } else {
                pages.push('route');
                if (transfers.length) {
                    pages.push('transfers');
                }
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
            dict = name === target.station.title.en && map.lang !== 'en' ? EN : map.dict,
            container = me._container;

        // Announcements are recorded for one direction, so skip them when the
        // diagrams are mirrored
        const announceKey = me._isMirrored(stops, index) ? undefined :
            origin ? `${stops[0].station.id}.origin` : `${target.station.id}.${mode}`;

        if (announceKey !== me._announceKey) {
            me._announceKey = announceKey;
            if (me._sound) {
                me._playAnnouncement(announceKey);
            }
        }

        container.style.setProperty('--pids-color', target.railway.color);
        me._updateHeader(train, target, mode, terminal, origin, origin ? getTitle(stops[stops.length - 1].station, dict === EN ? 'en' : map.lang) : name, dict);

        const minutes = stops.slice(routeStart, routeStart + MAX_STOPS).map(({time}) =>
                Math.max(0, Math.round((time + delay - now) / 60000))),
            key = [target.station.id, mode, page, map.lang, index, ...minutes].join();

        if (key === me._lastKey) {
            return;
        }
        me._lastKey = key;

        const body = container.querySelector('.pids-body');
        let footer = '';

        body.className = `pids-body pids-page-${page}`;

        if (page === 'route' || page === 'route-en') {
            const lang = page === 'route-en' ? 'en' : map.lang;

            body.innerHTML = me._renderRoute(stops.slice(routeStart, routeStart + MAX_STOPS), minutes, index - routeStart, !moving, lang);
            footer = escapeHTML(page === 'route-en' ? EN['pids-note'] : map.dict['pids-note']);
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

    /**
     * Updates the header in place so that changes animate like the real
     * displays: the station name flips and the labels cross-fade.
     * @param {Train} train - The train
     * @param {Object} target - The stop the header is about
     * @param {string} mode - 'next', 'arriving' or 'stopped'
     * @param {boolean} terminal - True if the stop is the last one
     * @param {boolean} origin - True if the train is waiting at its origin
     * @param {string} title - The station name to show
     * @param {Object} dict - Strings for the labels
     */
    _updateHeader(train, target, mode, terminal, origin, title, dict) {
        const me = this,
            map = me._map,
            header = me._container.querySelector('.pids-header'),
            suffix = terminal ? '-terminal' : '',
            label = origin ? '' :
            mode === 'arriving' ? dict[`pids-arriving${suffix}`] :
            mode === 'next' ? dict[`pids-next${suffix}`] :
            terminal ? dict['pids-terminal'] : '',
            lang = dict === EN ? 'en' : map.lang,
            destination = train.ds ? train.ds.map(s => getTitle(s, lang)).join(map.dict.and) :
            map.getLocalizedRailDirectionTitle(train.d),
            [before, after] = dict['pids-for'].split('$1'),
            car = `<span>${PIDS_CAR_NUMBER}</span><small>${escapeHTML(lang === 'en' ? 'Car No.' : map.dict['pids-car'])}</small>`,
            carElement = header.querySelector('.pids-car');

        header.querySelector('.pids-header-main').classList.toggle('origin', origin);
        swap(header.querySelector('.pids-destination'), origin ? '' : escapeHTML(dict['pids-for'].replace('$1', destination)));
        swap(header.querySelector('.pids-label'), escapeHTML(label));
        swap(header.querySelector('.pids-badge-slot'), me._renderBadge(origin ? me._stops[me._stops.length - 1].station : target.station));
        swap(header.querySelector('.pids-station'), origin ? [
            before.trim() ? `<span class="pids-for">${escapeHTML(before.trim())}</span>` : '',
            `<span class="pids-station-title${isCJK(title) ? '' : ' latin'}">${escapeHTML(title)}</span>`,
            after.trim() ? `<span class="pids-for">${escapeHTML(after.trim())}</span>` : ''
        ].join('') : `<div class="pids-station-title${isCJK(title) ? '' : ' latin'}">${escapeHTML(title)}</div>`);
        if (carElement._html !== car) {
            carElement._html = carElement.innerHTML = car;
        }
    }

    _playAnnouncement(key) {
        const me = this;

        me._stopAnnouncement();
        if (!key || !me._clips || !me._clips.has(key)) {
            return;
        }

        const audio = me._audio = new Audio(resolveAssetUrl(`${ANNOUNCE_PATH}${key}.mp3`));

        audio.play().catch(() => {
            // Autoplay can be blocked until the user interacts with the page
        });
    }

    _stopAnnouncement() {
        const audio = this._audio;

        if (audio) {
            audio.pause();
            delete this._audio;
        }
    }

    _renderBadge(station) {
        const code = getStationCode(station);

        return `<div class="pids-badge">${code ? `<span>${code.letter}</span><span>${code.number}</span>` : ''}</div>`;
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
            min = lang === map.lang ? map.dict['pids-min'] : EN['pids-min'];

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
                    ...transfers.map(t =>
                        `<div>${renderLineMark(t.railway, t.station)}${escapeHTML(getTitle(t.railway, lang))}</div>`),
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
            ...transfers.slice(0, 6).map(t => [
                '<div class="pids-map-transfer">',
                renderLineMark(t.railway, t.station),
                `<div>${escapeHTML(getTitle(t.railway, 'ja'))}<small>${escapeHTML(getTitle(t.railway, 'en'))}</small></div>`,
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
            `<div class="pids-xfer-band">のりかえ / Transfer${map.lang === 'ja' || map.lang === 'en' ? '' : ` / ${escapeHTML(map.dict['pids-transfer'])}`}</div>`,
            '<div class="pids-xfer-list">',
            ...transfers.slice(0, 8).map(({railway, station}) => [
                '<div class="pids-xfer">',
                renderLineMark(railway, station),
                `<div class="pids-xfer-line">${escapeHTML(getTitle(railway, map.lang))}<small>${escapeHTML(getTitle(railway, map.lang === 'en' ? 'ja' : 'en'))}</small></div>`,
                renderStationNumber(station, railway.color),
                `<div class="pids-xfer-station">${escapeHTML(getTitle(station, map.lang))}<small>${escapeHTML(getTitle(station, map.lang === 'en' ? 'ja' : 'en'))}</small></div>`,
                '</div>'
            ].join('')),
            '</div>'
        ].join('');
    }

}
