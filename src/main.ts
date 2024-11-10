import './style.css'; // CSSファイルのimport
import maplibregl from 'maplibre-gl';
import type { RasterTileSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GUI } from 'lil-gui';
import { demEntry, demLayers, isBBoxOverlapping, isColorMapParameter, isTextureParameter } from './utils';
import { webglProtocol } from './protocol/raster';
import chroma from 'chroma-js';
import colormap from 'colormap';
import debounce from 'lodash.debounce';
import { backgroundSources, tileOptions } from './utils';

const protocol = webglProtocol('webgl');
maplibregl.addProtocol('webgl', protocol.request);

// 地図の表示
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            custom: {
                type: 'raster',
                tiles: [`webgl://https://rinya-tochigi.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png?x={x}&y={y}&z={z}`],
                tileSize: 256,
                minzoom: demEntry.sourceMinZoom,
                maxzoom: demEntry.sourceMaxZoom,
                attribution: demEntry.attribution,
                bounds: demEntry.bbox,
            },
        },
        layers: [
            {
                id: 'custom_layer',
                source: 'custom',
                type: 'raster',
                maxzoom: 24,
            },
        ],
    },
    center: [139.53764, 36.76931],
    zoom: 14,
    maxPitch: 85,
    hash: true,
    renderWorldCopies: false,
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');
// 現在地
map.addControl(
    new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true,
        },
        trackUserLocation: true,
    }),
    'top-right',
);

// スケールバーの追加
map.addControl(
    new maplibregl.ScaleControl({
        maxWidth: 200, // スケールの最大幅
        unit: 'metric', // 単位
    }),
    'bottom-left',
);

const reloadTiles = debounce(() => {
    // protocol.cancelAllRequests();
    const _source = map.getSource('custom') as RasterTileSource;
    _source.setTiles([`webgl://https://rinya-tochigi.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png?x={x}&y={y}&z={z}`]);
}, 100);

const gui = new GUI({
    title: 'コントロール',
    container: document.getElementById('gui') as HTMLElement,
    width: window.innerWidth < 768 ? window.innerWidth - 50 : 350,
});

// 画面サイズに応じてGUIを折りたたむ
if (window.innerWidth < 768) {
    gui.close();
}

gui.add(
    demEntry,
    'name',
    demLayers.map((layer) => layer.name),
)
    .name('地形データ')
    .onChange((value: string) => {
        const layer = demLayers.find((layer) => layer.name === value);
        if (layer) {
            demEntry.url = layer.tiles[0];
            demEntry.demType = layer.demType;
            demEntry.sourceMinZoom = layer.minzoom;
            demEntry.sourceMaxZoom = layer.maxzoom;
            demEntry.bbox = layer.bbox;
        }
    });

const createColors = (colorMap: string, reverse: boolean = false): string => {
    const options = {
        colormap: colorMap, // colormap でサポートされているカラースケール名
        nshades: 100, // 色の段階数
        format: 'hex', // 色のフォーマット ('hex', 'rgb', 'rgba' など)
        alpha: 1, // 透明度
    };

    const colorArray = colormap(options as any);
    if (reverse) {
        colorArray.reverse();
    }

    const scale = chroma.scale(colorArray as any).colors(100);

    // グラデーション用のカラーを文字列として連結
    return scale.map((color) => color).join(', ');
};

// コントロールの制御
const enableAllControllers = (controllers: Array<any>, activeController: any, value: boolean) => {
    controllers.forEach((controller) => {
        if (controller !== activeController) {
            value ? controller.show() : controller.hide();
        }
    });
};

// 背景地図の切り替え
gui.add(
    {
        background: 'mierune_mono',
    },
    'background',
    Object.keys(backgroundSources).map((name) => name),
)
    .name('背景地図')
    .onChange((value: string) => {
        const sourceData = backgroundSources[value];

        map.removeLayer('background_layer');
        map.removeSource('background');

        map.addSource('background', {
            ...sourceData,
        });
        map.addLayer(
            {
                id: 'background_layer',
                source: 'background',
                type: 'raster',
            },
            'custom_layer',
        );
    });

gui.add(tileOptions.normalMapQuality, 'value', tileOptions.normalMapQuality.selection).name(tileOptions.normalMapQuality.name).onChange(reloadTiles);

const terrainParams = {
    exaggeration: 1,
};

// 3D表示のコントロール
gui.add({ value: false }, 'value')
    .name('3D表示')
    .onChange((value: boolean) => {
        if (value) {
            map.setTerrain({
                source: 'terrain',
                exaggeration: terrainParams.exaggeration,
            });
            if (map.getPitch() === 0) {
                map.easeTo({ pitch: 60 });
            }
        } else {
            map.setTerrain(null);
            map.easeTo({ pitch: 0 });
        }
    });

// 各プロパティに対応するフォルダを作成
Object.entries(demEntry.uniformsData).forEach(([_key, data]) => {
    let _folder: any;
    _folder = gui.addFolder(data.name);

    data.showMenu ? _folder.open() : _folder.close();

    // パラメータを保持しておくための配列
    const paramControllers: Array<any> = [];

    Object.entries(data.option).forEach(([_prop, paramData]) => {
        const div = document.createElement('div');
        let controller: any;

        if (typeof paramData === 'boolean') {
            // _folder.add(paramData, prop).name(data.option[prop].name).onChange(reloadTiles);
        } else if (typeof paramData !== 'string' && typeof paramData !== 'boolean' && 'value' in paramData) {
            if (typeof paramData.value === 'boolean') {
                controller = _folder
                    .add(paramData, 'value')
                    .name(paramData.name)
                    .onChange((value: boolean) => {
                        reloadTiles();
                        enableAllControllers(paramControllers, controller, value);
                    });
            } else if (typeof paramData.value === 'number') {
                controller = _folder.add(paramData, 'value', paramData.min, paramData.max, paramData.step).name(paramData.name).onChange(reloadTiles);
            } else if (typeof paramData.value === 'string') {
                if (isColorMapParameter(paramData)) {
                    controller = _folder
                        .add(paramData, 'value', paramData.selection)
                        .name(paramData.name)
                        .onChange((value: string) => {
                            div.style.background = `linear-gradient(to right, ${createColors(value, paramData.reverse)})`;
                            reloadTiles();
                        });
                    const children = _folder.$children.querySelector('.option');
                    if (children) {
                        // 小要素の追加
                        div.style.height = '20px';
                        div.style.width = '300px';
                        div.style.background = `linear-gradient(to right, ${createColors(paramData.value, paramData.reverse)})`;
                        // 選択肢の追加
                        children.appendChild(div);
                    }

                    // カラーランプの反転チェックボックスの追加
                    const reverseController = _folder
                        .add(paramData, 'reverse')
                        .name('カラーランプの反転')
                        .onChange(() => {
                            div.style.background = `linear-gradient(to right, ${createColors(paramData.value, paramData.reverse)})`;
                            reloadTiles();
                        });

                    paramControllers.push(reverseController);
                    if (!data.showMenu) {
                        reverseController.hide();
                    }
                } else if (isTextureParameter(paramData)) {
                    controller = _folder
                        .add(paramData, 'value', paramData.selection)
                        .name(paramData.name)
                        .onChange(() => {
                            reloadTiles();
                        });
                } else {
                    controller = _folder.addColor(paramData, 'value').name(paramData.name).onChange(reloadTiles);
                }
            }
        }

        // controller が存在する場合は配列に保持
        if (controller) {
            paramControllers.push(controller);
            if (!data.showMenu && controller.object.name !== '表示') {
                controller.hide();
            }
        }
    });
});

const other = gui.addFolder('その他').close();

other
    .add(
        {
            export: () => {
                // レンダリングが完了してからエクスポート
                map.once('render', () => {
                    const canvas = map.getCanvas();
                    const link = document.createElement('a');
                    link.download = 'map.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                });

                map.triggerRepaint();
            },
        },
        'export',
    )
    .name('PNGエクスポート');

other
    .add(
        {
            link: () => {
                window.open('https://github.com/forestacdev/maplibre-terrain-visualizer', '_blank', 'noopener,noreferrer'); // ここにリンクを追加
            },
        },
        'link',
    )
    .name('github');

if (import.meta.env.DEV) {
    const debugControl = gui.addFolder('debug');

    // タイルの境界線を表示
    debugControl.add(map, 'showTileBoundaries').name('タイルの境界線を表示');
}
