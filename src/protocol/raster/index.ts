import { DEM_DATA_TYPE, demEntry, textureData, tileOptions } from '../../utils';
import type { DemDataTypeKey, textureDataKey } from '../../utils';
import { TileCache, ColorMapCache, TextureCache } from '../image';
import { HAS_DEBUG_TILE, debugTileImage } from '../debug';

type TileImageData = { [position: string]: { tileId: string; image: ImageBitmap } };

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
    private tileCache: TileCache;
    private colorMapCache: ColorMapCache;
    private textureCache: TextureCache;

    constructor(worker: Worker) {
        this.worker = worker;
        this.pendingRequests = new Map();
        this.tileCache = TileCache.getInstance(); // シングルトンインスタンスの取得
        this.colorMapCache = new ColorMapCache();
        this.textureCache = new TextureCache();
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
    }

    private async getAdjacentTilesWithImages(
        x: number,
        y: number,
        z: number,
        baseurl: string,
        controller: AbortController,
        onlyCenter: boolean, // 新しいオプション引数
    ): Promise<TileImageData> {
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

                let imageData;

                if (position === 'center' || !onlyCenter) {
                    // 中心画像を取得、または onlyCenter が false の場合は通常通り画像を取得
                    if (this.tileCache.has(imageUrl)) {
                        imageData = this.tileCache.get(imageUrl) as ImageBitmap;
                        if (position === 'center') this.tileCache.updateOrder(imageUrl); // 中央のみキャッシュの順序を更新
                    } else {
                        imageData = await this.tileCache.loadImage(imageUrl, controller.signal);
                        if (position === 'center') this.tileCache.add(imageUrl, imageData); // 中央のみキャッシュに追加
                    }
                } else {
                    // onlyCenter が true の場合、他の位置には空の画像を使用
                    imageData = await createImageBitmap(new ImageData(1, 1)); // 空の画像を生成する関数を利用
                }

                result[position] = { tileId: imageUrl, image: imageData };
            }),
        );

        return result;
    }

    request = async (url: URL, controller: AbortController): Promise<{ data: Uint8Array }> => {
        try {
            // タイル座標からIDとURLを生成
            const x = parseInt(url.searchParams.get('x') || '0', 10);
            const y = parseInt(url.searchParams.get('y') || '0', 10);
            const z = parseInt(url.searchParams.get('z') || '0', 10);
            const demType = url.searchParams.get('demType') as DemDataTypeKey;
            const maxzoom = url.searchParams.get('maxzoom') as string;
            const baseUrl = demEntry.url;

            const onlyCenter = tileOptions.normalMapQuality.value === '中心タイルのみ';

            // 画像の取得
            const images = await this.getAdjacentTilesWithImages(x, y, z, baseUrl, controller, onlyCenter);
            const floodingImage = await this.textureCache.loadImage(demEntry.uniformsData.flooding.option.texture.value);

            // 中央タイルの処理結果を返す（配列の最初の要素が中央タイル）
            return this.processImage(images, demType, z.toString(), maxzoom, floodingImage, onlyCenter, controller);
        } catch (error) {
            return Promise.reject(error);
        }
    };

    private processImage(
        images: TileImageData,
        demType: string,
        z: string,
        maxzoom: string,
        floodingImage: ImageBitmap,
        onlyCenter: boolean,
        controller: AbortController,
    ): Promise<{ data: Uint8Array }> {
        return new Promise((resolve, reject) => {
            const center = images.center; // 中央のタイル
            const tileId = center.tileId; // ワーカー用ID
            const left = images.left; // 左のタイル
            const right = images.right; // 右のタイル
            const top = images.top; // 上のタイル
            const bottom = images.bottom; // 下のタイル
            this.pendingRequests.set(tileId, { resolve, reject, controller });

            const demTypeNumber = DEM_DATA_TYPE[demType as DemDataTypeKey];

            const evolutionColorArray = this.colorMapCache.createColorArray(demEntry.uniformsData.evolution.option.colorMap.value, demEntry.uniformsData.evolution.option.colorMap.reverse);
            const slopeCorlorArray = this.colorMapCache.createColorArray(demEntry.uniformsData.slope.option.colorMap.value, demEntry.uniformsData.slope.option.colorMap.reverse);
            const aspectColorArray = this.colorMapCache.createColorArray(demEntry.uniformsData.aspect.option.colorMap.value, demEntry.uniformsData.aspect.option.colorMap.reverse);

            this.worker.postMessage({
                tileId,
                center: center.image,
                left: left.image,
                right: right.image,
                top: top.image,
                bottom: bottom.image,
                z,
                maxzoom,
                demTypeNumber,
                uniformsData: demEntry.uniformsData,
                evolutionColorArray,
                slopeCorlorArray,
                aspectColorArray,
                floodingImage,
                onlyCenter,
            });
        });
    }

    // 全てのリクエストをキャンセル
    cancelAllRequests() {
        if (this.pendingRequests.size > 0) {
            this.pendingRequests.forEach(({ reject, controller }) => {
                controller.abort(); // AbortControllerをキャンセル
                reject(new Error('Request cancelled'));
            });
        }

        console.info('All requests have been cancelled.');
        this.pendingRequests.clear();
    }

    // タイルキャッシュをクリア
    clearCache() {
        this.tileCache.clear();
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
        } else {
            console.warn(`No pending request found for tile ${id}`);
        }

        if (import.meta.env.MODE === 'development' && HAS_DEBUG_TILE) {
            debugTileImage(id, buffer);
        }
    };

    private handleError(e: ErrorEvent) {
        console.error('Worker error:', e);
        this.pendingRequests.forEach((request) => {
            request.reject(new Error('Worker error occurred'));
        });
        this.pendingRequests.clear();
    }
}

class WorkerProtocolPool {
    private workers: WorkerProtocol[] = [];
    private workerIndex = 0;
    private poolSize: number;

    constructor(poolSize: number = 4) {
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
    request = async (url: URL, controller: AbortController): Promise<{ data: Uint8Array }> => {
        const worker = this.getNextWorker();
        return worker.request(url, controller);
    };

    // 全てのリクエストをキャンセル
    cancelAllRequests() {
        this.workers.forEach((worker) => worker.cancelAllRequests());
    }

    // 全てのタイルキャッシュをクリア
    clearCache() {
        this.workers.forEach((worker) => worker.clearCache());
    }
}

const workerProtocolPool = new WorkerProtocolPool(4); // 4つのワーカースレッドを持つプールを作成

export const demProtocol = (protocolName: string) => {
    return {
        protocolName,
        request: (params: { url: string }, abortController: AbortController) => {
            const urlWithoutProtocol = params.url.replace(`${protocolName}://`, '');
            const url = new URL(urlWithoutProtocol);
            return workerProtocolPool.request(url, abortController);
        },
        cancelAllRequests: () => workerProtocolPool.cancelAllRequests(),
        clearCache: () => workerProtocolPool.clearCache(),
    };
};
