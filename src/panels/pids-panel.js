import {createElement} from '../helpers/helpers';

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

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
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

/**
 * Creates an in-train passenger information display (PIDS) styled after the
 * LCD screens in Tokyo Metro cars. It shows the next stop, upcoming stops with
 * minutes to arrival and transfer lines for the tracked train.
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
            dict = map.dict,
            now = map.clock.getTimeOffset(),
            delay = train.delay || 0,
            index = me._offset + train.timetableIndex,
            moving = !!train.arrivalStation,
            targetIndex = Math.min(moving ? index + 1 : index, stops.length - 1),
            target = stops[targetIndex],
            remaining = target.time + delay - now;
        let mode = 'stopped';

        if (moving) {
            mode = train._t >= 0.7 || remaining <= ARRIVING_THRESHOLD ? 'arriving' : 'next';
        }

        const transfers = me._getTransfers(target.station, target.railway),
            pages = ['route'],
            names = me._getStationNames(target.station),
            elapsed = performance.now();

        if (moving && transfers.length) {
            pages.push('transfers');
        }
        if (mode === 'arriving') {
            pages.push('step');
        }

        const page = pages[Math.floor(elapsed / PAGE_DURATION) % pages.length],
            name = names[Math.floor(elapsed / NAME_DURATION) % names.length],
            minutes = stops.slice(index, index + MAX_STOPS).map(({time}) =>
                Math.max(0, Math.round((time + delay - now) / 60000))),
            key = [target.station.id, mode, page, name, map.lang, ...minutes].join();

        if (key === me._lastKey) {
            return;
        }
        me._lastKey = key;

        const container = me._container,
            color = target.railway.color;

        container.style.setProperty('--pids-color', color);
        container.querySelector('.pids-header').innerHTML = me._renderHeader(train, target, mode, name);
        container.querySelector('.pids-body').innerHTML =
            page === 'route' ? me._renderRoute(stops.slice(index, index + MAX_STOPS), minutes, index === targetIndex) :
            page === 'transfers' ? me._renderTransfers(transfers) :
            me._renderWatchStep();
        container.querySelector('.pids-footer').innerHTML = escapeHTML(dict['pids-note']);
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

    _renderHeader(train, target, mode, title) {
        const map = this._map,
            dict = map.dict,
            {station, railway} = target,
            code = getStationCode(station),
            label = mode === 'arriving' ? dict['pids-arriving'] : mode === 'next' ? dict['pids-next'] : '';

        return [
            '<div class="pids-header-top">',
            `<span class="pids-destination">${escapeHTML(map.getLocalizedDestinationTitle(train.ds, train.d))}</span>`,
            `<span class="pids-railway">${escapeHTML(map.getLocalizedRailwayTitle(railway))}</span>`,
            '</div>',
            '<div class="pids-header-main">',
            `<div class="pids-label">${escapeHTML(label)}</div>`,
            `<div class="pids-badge">${code ? `<span>${code.letter}</span><span>${code.number}</span>` : ''}</div>`,
            '<div class="pids-station">',
            `<div class="pids-station-title">${escapeHTML(title)}</div>`,
            '</div>',
            '</div>'
        ].join('');
    }

    _renderRoute(stops, minutes, standing) {
        const me = this,
            map = me._map,
            dict = map.dict;

        return [
            '<div class="pids-route">',
            '<div class="pids-route-bar"></div>',
            ...stops.map(({station, railway}, i) => {
                const code = getStationCode(station),
                    transfers = me._getTransfers(station, railway).slice(0, 3),
                    current = i === 0;

                return [
                    `<div class="pids-stop${current ? ' current' : ''}">`,
                    '<div class="pids-stop-transfers">',
                    ...transfers.map(r =>
                        `<div><span style="background-color: ${r.color};"></span>${escapeHTML(map.getLocalizedRailwayTitle(r))}</div>`),
                    '</div>',
                    '<div class="pids-stop-minutes">',
                    current ? `<div class="pids-chevron${standing ? ' standing' : ''}"></div>` :
                    `${minutes[i]}${i === stops.length - 1 ? `<small>${escapeHTML(dict['pids-min'])}</small>` : ''}`,
                    '</div>',
                    `<div class="pids-stop-code">${code ? `${code.letter}-${code.number}` : ''}</div>`,
                    me._renderStopTitle(map.getLocalizedStationTitle(station)),
                    '</div>'
                ].join('');
            }),
            '</div>'
        ].join('');
    }

    _renderStopTitle(title) {
        // Stack CJK characters one per line like the real displays, and fall
        // back to sideways vertical text for Latin script
        if (/^[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]+$/.test(title)) {
            return `<div class="pids-stop-title cjk">${[...title].map(c => `<span>${escapeHTML(c)}</span>`).join('')}</div>`;
        }
        return `<div class="pids-stop-title">${escapeHTML(title)}</div>`;
    }

    _renderWatchStep() {
        const dict = this._map.dict,
            english = 'Watch your step';

        return [
            '<div class="pids-step">',
            '<div class="pids-step-door"><div></div><div></div></div>',
            '<div class="pids-step-text">',
            `<div>${escapeHTML(dict['pids-watch-step'])}</div>`,
            dict['pids-watch-step'] !== english ? `<div lang="en">${english}</div>` : '',
            '</div>',
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
