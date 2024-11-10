import { uniformsData } from '../../utils';
import { TileImageManager, ColorMapManager } from '../image';

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

            const evolutionColorArray = this.colorMapCache.createColorArray(uniformsData.evolution.option.colorMap.value, uniformsData.evolution.option.colorMap.reverse);

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
