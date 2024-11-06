export class TileCache {
    private static instance: TileCache;
    private cache: Map<string, ImageBitmap>;
    private cacheSizeLimit: number;
    private cacheOrder: string[];

    private constructor(cacheSizeLimit = 500) {
        this.cache = new Map();
        this.cacheSizeLimit = cacheSizeLimit;
        this.cacheOrder = [];
    }

    // TileCache のインスタンスを取得する静的メソッド
    public static getInstance(cacheSizeLimit = 500): TileCache {
        if (!TileCache.instance) {
            TileCache.instance = new TileCache(cacheSizeLimit);
        }
        return TileCache.instance;
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
                console.error(`Failed to load image from ${src}: ${error}`);
                // 他のエラー時にはプレースホルダー画像を返す
                return await createImageBitmap(new ImageData(1, 1));
            }
        }
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
