import { DEM_DATA_TYPE } from '../../utils';
import type { DemDataTypeKey } from '../../utils';
import { TileCache } from '../image';

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

    constructor(worker: Worker) {
        this.worker = worker;
        this.pendingRequests = new Map();
        this.tileCache = TileCache.getInstance(); // シングルトンインスタンスの取得
        this.worker.addEventListener('message', this.handleMessage);
        this.worker.addEventListener('error', this.handleError);
    }

    async request(url: URL, controller: AbortController): Promise<{ data: Uint8Array }> {
        try {
            const demType = url.searchParams.get('demType');
            const imageUrl = url.origin + url.pathname;
            let image;
            if (this.tileCache.has(imageUrl)) {
                image = this.tileCache.get(imageUrl);
                this.tileCache.updateOrder(imageUrl);
            } else {
                image = await this.tileCache.loadImage(imageUrl, controller.signal);
                this.tileCache.add(imageUrl, image);
            }

            return new Promise((resolve, reject) => {
                const demTypeNumber = DEM_DATA_TYPE[demType as DemDataTypeKey];
                this.pendingRequests.set(imageUrl, { resolve, reject, controller });
                this.worker.postMessage({ image, demTypeNumber, id: imageUrl });

                controller.signal.addEventListener('abort', () => {
                    this.pendingRequests.delete(imageUrl);
                    reject(new Error('Request aborted'));
                });
            });
        } catch (error) {
            return Promise.reject(error);
        }
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
    };

    private handleError = (e: ErrorEvent) => {
        console.error('Worker error:', e);
        this.pendingRequests.forEach((request) => {
            request.reject(new Error('Worker error occurred'));
        });
        this.pendingRequests.clear();
    };

    // タイルキャッシュをクリア
    clearCache() {
        this.tileCache.clear();
    }

    // 全てのリクエストをキャンセル;
    cancelAllRequests = () => {
        if (this.pendingRequests.size > 0) {
            this.pendingRequests.forEach(({ reject, controller }) => {
                controller.abort(); // AbortControllerをキャンセル
                reject(new Error('Request cancelled'));
            });
        }
        this.pendingRequests.clear();
    };
}

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const workerProtocol = new WorkerProtocol(worker);

export const terrainProtocol = (protocolName: string) => {
    return {
        protocolName,
        request: (params: { url: string }, abortController: AbortController) => {
            const urlWithoutProtocol = params.url.replace(`${protocolName}://`, '');
            const url = new URL(urlWithoutProtocol);
            return workerProtocol.request(url, abortController);
        },
        cancelAllRequests: () => workerProtocol.cancelAllRequests(),
        clearCache: () => workerProtocol.clearCache(),
    };
};
