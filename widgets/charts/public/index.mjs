const homeyApi = async (homey, path) => 
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
(await homey.api('GET', path));
const ZERO_DECIMALS = 0;
const FONT_SIZE_VERY_SMALL = '12px';
const NEXT_TIMEOUT = 60_000;
const HOUR_ONE = 1;
const MINUTE_FIVE = 5;
const TIME_ZERO = 0;
const chartsWithDays = new Set([
    'operation_modes',
    'temperatures',
]);
const hourlyCharts = new Set([
    'hourly_temperatures',
    'signal',
]);
const colors = [
    '#1F77B4',
    '#D62728',
    '#2CA02C',
    '#FF7F0E',
    '#9467BD',
    '#FFDB58',
    '#17BECF',
    '#E377C2',
    '#7F7F7F',
    '#393B79',
    '#E7BA52',
];
const hidden = new Set([
    'FlowBoiler',
    'FlowZone1',
    'FlowZone2',
    'MixingTankWater',
    'ReturnBoiler',
    'ReturnZone1',
    'ReturnZone2',
]);
const styleCache = {};
let myChart = null;
let options = {};
let timeout = null;
const getElement = (id, elementConstructor, elementType) => {
    const element = document.querySelector(`#${id}`);
    if (!(element instanceof elementConstructor)) {
        throw new TypeError(`Element with id \`${id}\` is not a ${elementType}`);
    }
    return element;
};
const getDivElement = (id) => getElement(id, HTMLDivElement, 'div');
const getSelectElement = (id) => getElement(id, HTMLSelectElement, 'select');
const zoneElement = getSelectElement('zones');
const getZoneId = (id, model) => `${model}_${String(id)}`;
const getZonePath = () => zoneElement.value.replace('_', '/');
const getStyle = (property) => {
    styleCache[property] ??= getComputedStyle(document.documentElement)
        .getPropertyValue(property)
        .trim();
    return styleCache[property];
};
const normalizeSeriesName = (name) => name.replace('Temperature', '');
const getChartLineOptions = ({ labels: categories, series, unit }, height) => {
    const colorLight = getStyle('--homey-text-color-light');
    const axisColor = { color: colorLight, show: true };
    const axisStyle = { axisBorder: axisColor, axisTicks: axisColor };
    const fontStyle = {
        fontSize: FONT_SIZE_VERY_SMALL,
        fontWeight: getStyle('--homey-font-weight-regular'),
    };
    const style = { ...fontStyle, colors: colorLight };
    return {
        chart: { height, toolbar: { show: false }, type: 'line' },
        colors,
        grid: {
            borderColor: colorLight,
            strokeDashArray: 3,
            xaxis: { lines: { show: false } },
        },
        legend: {
            ...fontStyle,
            labels: { colors: colorLight },
            markers: { shape: 'square', strokeWidth: 0 },
        },
        series: series.map(({ data, name: seriesName }) => {
            const name = normalizeSeriesName(seriesName);
            return { data, hidden: hidden.has(name), name };
        }),
        stroke: { curve: 'smooth' },
        title: {
            offsetX: 5,
            style: { ...fontStyle, color: colorLight },
            text: unit,
        },
        xaxis: {
            ...axisStyle,
            categories,
            labels: { rotate: 0, style },
            tickAmount: 3,
        },
        yaxis: {
            ...axisStyle,
            labels: { style, formatter: (value) => value.toFixed(ZERO_DECIMALS) },
            ...(unit === 'dBm' ? { max: 0, min: -100 } : undefined),
        },
    };
};
const getChartPieOptions = ({ labels, series }, height) => ({
    chart: { height, toolbar: { show: false }, type: 'pie' },
    colors,
    dataLabels: {
        dropShadow: { enabled: false },
        style: {
            colors: [getStyle('--homey-text-color')],
            fontSize: getStyle('--homey-font-size-small'),
            fontWeight: getStyle('--homey-font-weight-bold'),
        },
    },
    labels: labels.map((label) => label
        .replace('Actual', '')
        .replace('FansStopped', 'Stop')
        .replace('Mode', '')
        .replace('Operation', '')
        .replace('PowerOff', 'Off')
        .replace('Power', 'Off')
        .replace('Prevention', '')
        .replace(/(?<mode>.+)Ventilation$/u, '$<mode>')),
    legend: {
        fontSize: FONT_SIZE_VERY_SMALL,
        fontWeight: getStyle('--homey-font-weight-regular'),
        labels: { colors: getStyle('--homey-text-color-light') },
        markers: { shape: 'square', strokeWidth: 0 },
    },
    series,
    stroke: { show: false },
});
const getChartOptions = (data, height) => 'unit' in data ?
    getChartLineOptions(data, height)
    : getChartPieOptions(data, height);
const getChartFunction = (homey, chart) => async (days) => homeyApi(homey, `/logs/${chart}/${getZonePath()}${chartsWithDays.has(chart) && days !== undefined ?
    `?${new URLSearchParams({
        days: String(days),
    })}`
    : ''}`);
const handleChartAndOptions = async (homey, { chart, days, height, }) => {
    const hiddenSeries = (options.series ?? []).map((serie) => typeof serie === 'number' || serie.hidden !== true ? null : serie.name);
    const newOptions = getChartOptions(await getChartFunction(homey, chart)(days), height);
    if (newOptions.chart?.type === 'pie' ||
        hiddenSeries.some((name) => name !== null &&
            !(newOptions.series ?? [])
                .map((serie) => (typeof serie === 'number' ? null : serie.name))
                .includes(name))) {
        myChart?.destroy();
        myChart = null;
    }
    return newOptions;
};
const getTimeout = (chart) => {
    if (hourlyCharts.has(chart)) {
        return NEXT_TIMEOUT;
    }
    const now = new Date();
    const next = new Date(now);
    next.setHours(next.getHours() + HOUR_ONE, MINUTE_FIVE, TIME_ZERO, TIME_ZERO);
    return next.getTime() - now.getTime();
};
const draw = async (homey, { chart, days, height, }) => {
    options = await handleChartAndOptions(homey, { chart, days, height });
    if (myChart) {
        await myChart.updateOptions(options);
    }
    else {
        // @ts-expect-error: imported by another script in `./index.html`
        myChart = new ApexCharts(getDivElement('chart'), options);
        await myChart.render();
    }
    await homey.setHeight(document.body.scrollHeight);
    timeout = setTimeout(() => {
        draw(homey, { chart, days, height }).catch(() => {
            //
        });
    }, getTimeout(chart));
};
const setDocumentLanguage = async (homey) => {
    document.documentElement.lang = String(await homey.api('GET', '/language'));
};
const createOptionElement = (selectElement, { id, label }) => {
    if (!selectElement.querySelector(`option[value="${id}"]`)) {
        selectElement.append(new Option(label, id));
    }
};
const generateZones = (zones) => {
    for (const { id, model, name: label } of zones) {
        createOptionElement(zoneElement, { id: getZoneId(id, model), label });
    }
};
const addEventListeners = (homey, config) => {
    zoneElement.addEventListener('change', () => {
        if (timeout) {
            clearTimeout(timeout);
        }
        draw(homey, config).catch(() => {
            //
        });
    });
};
const handleDefaultZone = (defaultZone) => {
    if (defaultZone) {
        const { id, model } = defaultZone;
        const value = getZoneId(id, model);
        if (document.querySelector(`#zones option[value="${value}"]`)) {
            zoneElement.value = value;
        }
    }
};
const fetchDevices = async (homey) => {
    const { chart, days, default_zone: defaultZone, height } = homey.getSettings();
    const devices = await homeyApi(homey, `/devices${chart === 'hourly_temperatures' ?
        `?${new URLSearchParams({
            type: '1',
        })}`
        : ''}`);
    if (devices.length) {
        addEventListeners(homey, { chart, days, height: Number(height) });
        generateZones(devices);
        handleDefaultZone(defaultZone);
        await draw(homey, { chart, days, height: Number(height) });
    }
};
// @ts-expect-error: read by another script in `./index.html`
// eslint-disable-next-line func-style
async function onHomeyReady(homey) {
    await setDocumentLanguage(homey);
    await fetchDevices(homey);
    homey.ready({ height: document.body.scrollHeight });
}
//# sourceMappingURL=index.mjs.map