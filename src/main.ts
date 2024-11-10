import './style.css'; // CSSファイルのimport
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { GUI } from 'lil-gui';
import chroma from 'chroma-js';
import colormap from 'colormap';

import type { RasterTileSource } from 'maplibre-gl';
import debounce from 'lodash.debounce';

const COLOR_MAP_TYPE = [
    'jet',
    'hsv',
    'hot',
    'spring',
    'summer',
    'autumn',
    'winter',
    'bone',
    'copper',
    'greys',
    'yignbu',
    'greens',
    'yiorrd',
    'bluered',
    'rdbu',
    'picnic',
    'rainbow',
    'portland',
    'blackbody',
    'earth',
    'electric',
    'viridis',
    'inferno',
    'magma',
    'plasma',
    'warm',
    'cool',
    'rainbow-soft',
    'bathymetry',
    'cdom',
    'chlorophyll',
    'density',
    'freesurface-blue',
    'freesurface-red',
    'oxygen',
    'par',
    'phase',
    'salinity',
    'temperature',
    'turbidity',
    'velocity-blue',
    'velocity-green',
    'cubehelix',
] as const;

export type ColorMapType = (typeof COLOR_MAP_TYPE)[number];
const mutableColorMapType: ColorMapType[] = [...COLOR_MAP_TYPE];

type NumberParameter = {
    name: string;
    value: number;
    min: number;
    max: number;
    step: number;
};

type ColorParameter = {
    name: string;
    value: string;
};

export type colorMapParameter = {
    name: string;
    value: ColorMapType;
    selection: ColorMapType[];
};

export type UniformsData = {
    evolution: {
        opacity: NumberParameter;
        maxHeight: NumberParameter;
        minHeight: NumberParameter;
        colorMap: colorMapParameter;
    };
    shadow: {
        opacity: NumberParameter;
        shadowColor: ColorParameter;
        highlightColor: ColorParameter;
        ambient: NumberParameter;
        azimuth: NumberParameter;
        altitude: NumberParameter;
    };
    edge: {
        opacity: NumberParameter;
        edgeIntensity: NumberParameter;
        edgeColor: ColorParameter;
    };
};

export const uniformsData: UniformsData = {
    evolution: {
        opacity: {
            name: '透過度',
            value: 1.0,
            min: 0,
            max: 1,
            step: 0.01,
        },
        maxHeight: {
            name: '最大標高',
            value: 2500,
            min: -10000,
            max: 10000,
            step: 0.1,
        },
        minHeight: {
            name: '最小標高',
            value: 500,
            min: -10000,
            max: 10000,
            step: 0.1,
        },
        colorMap: {
            name: 'カラーマップ',
            value: 'phase',
            selection: mutableColorMapType,
        },
    },
    shadow: {
        opacity: {
            name: '透過度',
            value: 0.8,
            min: 0,
            max: 1,
            step: 0.01,
        },
        shadowColor: {
            name: '陰影色',
            value: '#000000',
        },
        highlightColor: {
            name: 'ハイライト色',
            value: '#00ff9d',
        },
        ambient: {
            name: '環境光',
            value: 0.3,
            min: 0,
            max: 1,
            step: 0.01,
        },
        azimuth: {
            name: '方位',
            value: 0,
            min: 0,
            max: 360,
            step: 1,
        },
        altitude: {
            name: '高度',
            value: 30,
            min: 0,
            max: 90,
            step: 1,
        },
    },
    edge: {
        opacity: {
            name: '透過度',
            value: 0.9,
            min: 0,
            max: 1,
            step: 0.01,
        },
        edgeIntensity: {
            name: 'エッジ強度',
            value: 0.4,
            min: 0,
            max: 2,
            step: 0.01,
        },
        edgeColor: {
            name: 'エッジ色',
            value: '#ffffff',
        },
    },
};

export const isColorMapParameter = (param: any): param is colorMapParameter => {
    return typeof param === 'object' && typeof param.name === 'string' && typeof param.value === 'string' && typeof param.reverse === 'boolean' && Array.isArray(param.selection);
};

type TileImageData = { [position: string]: { tileId: string; image: ImageBitmap } };
// タイル画像
export class TileImageManager {
    private static instance: TileImageManager;
    private cache: Map<string, ImageBitmap>;
    private cacheSizeLimit: number;
    private cacheOrder: string[];

    private constructor(cacheSizeLimit = 500) {
        this.cache = new Map();
        this.cacheSizeLimit = cacheSizeLimit;
        this.cacheOrder = [];
    }

    // TileImageManager のインスタンスを取得する静的メソッド
    public static getInstance(cacheSizeLimit = 500): TileImageManager {
        if (!TileImageManager.instance) {
            TileImageManager.instance = new TileImageManager(cacheSizeLimit);
        }
        return TileImageManager.instance;
    }

    public async loadImage(src: string, signal: AbortSignal): Promise<ImageBitmap> {
        try {
            const response = await fetch(src, { signal });
            if (!response.ok) {
                throw new Error('Failed to fetch image');
            }
            return await createImageBitmap(await response.blob());
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // リクエストがキャンセルされた場合はエラーをスロー
                throw error;
            } else {
                // 他のエラー時には空の画像を返す
                return await createImageBitmap(new ImageData(1, 1));
            }
        }
    }

    public async getAdjacentTilesWithImages(x: number, y: number, z: number, baseurl: string, controller: AbortController): Promise<TileImageData> {
        const positions = [
            { position: 'center', dx: 0, dy: 0 },
            { position: 'left', dx: -1, dy: 0 },
            { position: 'right', dx: 1, dy: 0 },
            { position: 'top', dx: 0, dy: -1 },
            { position: 'bottom', dx: 0, dy: 1 },
        ];

        const result: TileImageData = {};

        await Promise.all(
            positions.map(async ({ position, dx, dy }) => {
                const tileX = x + dx;
                const tileY = y + dy;
                const imageUrl = baseurl.replace('{x}', tileX.toString()).replace('{y}', tileY.toString()).replace('{z}', z.toString());

                const imageData = await this.loadImage(imageUrl, controller.signal);

                result[position] = { tileId: imageUrl, image: imageData };
            }),
        );

        return result;
    }

    add(tileId: string, image: ImageBitmap): void {
        if (this.cacheOrder.length >= this.cacheSizeLimit) {
            const oldestTileId = this.cacheOrder.shift();
            if (oldestTileId) {
                this.cache.delete(oldestTileId);
            }
        }
        this.cache.set(tileId, image);
        this.cacheOrder.push(tileId);
    }

    get(tileId: string): ImageBitmap | undefined {
        return this.cache.get(tileId);
    }

    has(tileId: string): boolean {
        return this.cache.has(tileId);
    }

    updateOrder(tileId: string): void {
        const index = this.cacheOrder.indexOf(tileId);
        if (index > -1) {
            this.cacheOrder.splice(index, 1);
            this.cacheOrder.push(tileId);
        }
    }

    clear(): void {
        this.cache.clear();
        this.cacheOrder = [];
    }
}

// カラーマップ
export class ColorMapManager {
    private cache: Map<string, Uint8Array>;
    public constructor() {
        this.cache = new Map();
    }
    public createColorArray(colorMapName: string): Uint8Array {
        const cacheKey = `${colorMapName}`;

        if (this.has(cacheKey)) {
            return this.get(cacheKey) as Uint8Array;
        }

        const width = 256;
        const pixels = new Uint8Array(width * 3); // RGBのみの3チャンネルデータ

        // オプションオブジェクトを作成
        const options = {
            colormap: colorMapName,
            nshades: width,
            format: 'rgb', // RGBAからRGBに変更
            alpha: 1,
        };

        let colors = colormap(options as any);

        // RGBデータの格納
        let ptr = 0;
        for (let i = 0; i < width; i++) {
            const color = colors[i] as number[];
            pixels[ptr++] = color[0];
            pixels[ptr++] = color[1];
            pixels[ptr++] = color[2];
        }

        // キャッシュに格納して再利用可能にする
        this.cache.set(cacheKey, pixels);

        return pixels;
    }

    add(cacheKey: string, pixels: Uint8Array): void {
        this.cache.set(cacheKey, pixels);
    }

    get(cacheKey: string): Uint8Array | undefined {
        return this.cache.get(cacheKey);
    }

    has(cacheKey: string): boolean {
        return this.cache.has(cacheKey);
    }
}

class WorkerProtocol {
    private worker: Worker;
    private pendingRequests: Map<
        string,
        {
            resolve: (value: { data: Uint8Array } | PromiseLike<{ data: Uint8Array }>) => void;
            reject: (reason?: Error) => void;
            controller: AbortController;
        }
    >;
    private tileCache: TileImageManager;
    private colorMapCache: ColorMapManager;

    constructor(worker: Worker) {
        this.worker = worker;
        this.pendingRequests = new Map();
        this.tileCache = TileImageManager.getInstance(); // シングルトンインスタンスの取得
        this.colorMapCache = new ColorMapManager();
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
    }

    async request(url: URL, controller: AbortController): Promise<{ data: Uint8Array }> {
        // タイル座標からIDとURLを生成
        const x = parseInt(url.searchParams.get('x') || '0', 10);
        const y = parseInt(url.searchParams.get('y') || '0', 10);
        const z = parseInt(url.searchParams.get('z') || '0', 10);
        const baseUrl = 'https://rinya-tochigi.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png';

        // 画像の取得
        const images = await this.tileCache.getAdjacentTilesWithImages(x, y, z, baseUrl, controller);

        return new Promise((resolve, reject) => {
            const center = images.center; // 中央のタイル
            const tileId = center.tileId; // ワーカー用ID
            const left = images.left; // 左のタイル
            const right = images.right; // 右のタイル
            const top = images.top; // 上のタイル
            const bottom = images.bottom; // 下のタイル
            this.pendingRequests.set(tileId, { resolve, reject, controller });

            const evolutionColorArray = this.colorMapCache.createColorArray('cool');

            this.worker.postMessage({
                tileId,
                center: center.image,
                left: left.image,
                right: right.image,
                top: top.image,
                bottom: bottom.image,
                z,
                uniformsData: uniformsData,
                evolutionColorArray,
            });
        });
    }

    private handleMessage = (e: MessageEvent) => {
        const { id, buffer, error } = e.data;
        const request = this.pendingRequests.get(id);
        if (error) {
            console.error(`Error processing tile ${id}:`, error);
            if (request) {
                request.reject(new Error(error));
                this.pendingRequests.delete(id);
            }
        } else if (request) {
            request.resolve({ data: buffer });
            this.pendingRequests.delete(id);
        }
    };

    private handleError(e: ErrorEvent) {
        console.error('Worker error:', e);
        this.pendingRequests.forEach((request) => {
            request.reject(new Error('Worker error occurred'));
        });
        this.pendingRequests.clear();
    }

    // // 全てのリクエストをキャンセル
    // cancelAllRequests() {
    //     if (this.pendingRequests.size > 0) {
    //         this.pendingRequests.forEach(({ reject, controller }) => {
    //             controller.abort(); // AbortControllerをキャンセル
    //             reject(new Error('Request cancelled'));
    //         });
    //     }

    //     console.info('All requests have been cancelled.');
    //     this.pendingRequests.clear();
    // }

    // // タイルキャッシュをクリア
    // clearCache() {
    //     this.tileCache.clear();
    // }
}

class WorkerProtocolPool {
    private workers: WorkerProtocol[] = [];
    private workerIndex = 0;
    private poolSize: number;

    constructor(poolSize: number) {
        this.poolSize = poolSize;

        // 指定されたプールサイズのワーカープロトコルを作成
        for (let i = 0; i < poolSize; i++) {
            const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
            this.workers.push(new WorkerProtocol(worker));
        }
    }

    // ラウンドロビン方式で次のワーカーを取得
    private getNextWorker(): WorkerProtocol {
        const worker = this.workers[this.workerIndex];
        this.workerIndex = (this.workerIndex + 1) % this.poolSize;
        return worker;
    }

    // タイルリクエストを処理する
    async request(url: URL, controller: AbortController): Promise<{ data: Uint8Array }> {
        const worker = this.getNextWorker();
        return worker.request(url, controller);
    }

    // // 全てのリクエストをキャンセル
    // cancelAllRequests() {
    //     this.workers.forEach((worker) => worker.cancelAllRequests());
    // }

    // // 全てのタイルキャッシュをクリア
    // clearCache() {
    //     this.workers.forEach((worker) => worker.clearCache());
    // }
}

// const coreCount = navigator.hardwareConcurrency || 4;
// const optimalThreads = Math.max(1, Math.floor(coreCount * 0.75));
const workerProtocolPool = new WorkerProtocolPool(4); // 4つのワーカースレッドを持つプールを作成

export const webglProtocol = (protocolName: string) => {
    return {
        request: (params: { url: string }, abortController: AbortController) => {
            const urlWithoutProtocol = params.url.replace(`${protocolName}://`, '');
            const url = new URL(urlWithoutProtocol);
            return workerProtocolPool.request(url, abortController);
        },
        // cancelAllRequests: () => workerProtocolPool.cancelAllRequests(),
        // clearCache: () => workerProtocolPool.clearCache(),
    };
};

const protocol = webglProtocol('webgl');
maplibregl.addProtocol('webgl', protocol.request);

// 地図の表示
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
            webgl: {
                type: 'raster',
                tiles: [`webgl://https://rinya-tochigi.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png?x={x}&y={y}&z={z}`],
                tileSize: 256,
                minzoom: 2,
                maxzoom: 18,
                attribution: '栃木県',
                bounds: [139.326731, 36.199924, 140.291983, 37.155039],
            },
        },
        layers: [
            {
                id: 'webgl_layer',
                source: 'webgl',
                type: 'raster',
                maxzoom: 24,
            },
        ],
    },
    center: [139.50785, 36.7751],
    zoom: 13.5,
    // hash: true,
    renderWorldCopies: false,
});

// コントロール系

const gui = new GUI({
    title: 'コントロール',
    container: document.getElementById('gui') as HTMLElement,
    width: window.innerWidth < 768 ? window.innerWidth - 50 : 350,
});

// const createColors = (colorMap: string): string => {
//     const options = {
//         colormap: colorMap, // colormap でサポートされているカラースケール名
//         nshades: 100, // 色の段階数
//         format: 'hex', // 色のフォーマット ('hex', 'rgb', 'rgba' など)
//         alpha: 1, // 透明度
//     };

//     const colorArray = colormap(options as any);

//     const scale = chroma.scale(colorArray as any).colors(100);

//     // グラデーション用のカラーを文字列として連結
//     return scale.map((color) => color).join(', ');
// };

// // コントロールの制御
// const enableAllControllers = (controllers: Array<any>, activeController: any, value: boolean) => {
//     controllers.forEach((controller) => {
//         if (controller !== activeController) {
//             value ? controller.show() : controller.hide();
//         }
//     });
// };

// // 各プロパティに対応するフォルダを作成
// Object.entries(uniformsData).forEach(([_key, data]) => {
//     let _folder: any;
//     _folder = gui.addFolder(data.name);

//     data.showMenu ? _folder.open() : _folder.close();

//     // パラメータを保持しておくための配列
//     const paramControllers: Array<any> = [];

//     Object.entries(data.option).forEach(([_prop, paramData]) => {
//         const div = document.createElement('div');
//         let controller: any;

//         if (typeof paramData === 'boolean') {
//             // _folder.add(paramData, prop).name(data.option[prop].name).onChange(reloadTiles);
//         } else if (typeof paramData !== 'string' && typeof paramData !== 'boolean' && 'value' in paramData) {
//             if (typeof paramData.value === 'boolean') {
//                 controller = _folder
//                     .add(paramData, 'value')
//                     .name(paramData.name)
//                     .onChange((value: boolean) => {
//                         reloadTiles();
//                         enableAllControllers(paramControllers, controller, value);
//                     });
//             } else if (typeof paramData.value === 'number') {
//                 controller = _folder.add(paramData, 'value', paramData.min, paramData.max, paramData.step).name(paramData.name).onChange(reloadTiles);
//             } else if (typeof paramData.value === 'string') {
//                 if (isColorMapParameter(paramData)) {
//                     controller = _folder
//                         .add(paramData, 'value', paramData.selection)
//                         .name(paramData.name)
//                         .onChange((value: string) => {
//                             div.style.background = `linear-gradient(to right, ${createColors(value)})`;
//                             reloadTiles();
//                         });
//                     const children = _folder.$children.querySelector('.option');
//                     if (children) {
//                         // 小要素の追加
//                         div.style.height = '20px';
//                         div.style.width = '300px';
//                         div.style.background = `linear-gradient(to right, ${createColors(paramData.value)})`;
//                         // 選択肢の追加
//                         children.appendChild(div);
//                     }

//                     // カラーランプの反転チェックボックスの追加
//                     const reverseController = _folder
//                         .add(paramData, 'reverse')
//                         .name('カラーランプの反転')
//                         .onChange(() => {
//                             div.style.background = `linear-gradient(to right, ${createColors(paramData.value)})`;
//                             reloadTiles();
//                         });

//                     paramControllers.push(reverseController);
//                     if (!data.showMenu) {
//                         reverseController.hide();
//                     }
//                 } else {
//                     controller = _folder.addColor(paramData, 'value').name(paramData.name).onChange(reloadTiles);
//                 }
//             }
//         }

//         // controller が存在する場合は配列に保持
//         if (controller) {
//             paramControllers.push(controller);
//             if (!data.showMenu && controller.object.name !== '表示') {
//                 controller.hide();
//             }
//         }
//     });
// });

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
