import colormap from 'colormap';
import type { textureDataKey } from '../utils';
import { textureData } from '../utils';

type TileImageData = { [position: string]: { tileId: string; image: ImageBitmap } };
// タイル画像のキャッシュ
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

    private async loadImage(src: string, signal: AbortSignal): Promise<ImageBitmap> {
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

    public async getAdjacentTilesWithImages(
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
                    if (this.has(imageUrl)) {
                        imageData = this.get(imageUrl) as ImageBitmap;
                        if (position === 'center') this.updateOrder(imageUrl); // 中央のみキャッシュの順序を更新
                    } else {
                        imageData = await this.loadImage(imageUrl, controller.signal);
                        if (position === 'center') this.add(imageUrl, imageData); // 中央のみキャッシュに追加
                    }
                } else {
                    // onlyCenter が true の場合、他の位置には空の画像を使用
                    imageData = await createImageBitmap(new ImageData(1, 1));
                }

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

// カラーマップのキャッシュ
export class ColorMapCache {
    private cache: Map<string, Uint8Array>;
    public constructor() {
        this.cache = new Map();
    }
    public createColorArray(colorMapName: string, reverse: boolean = false): Uint8Array {
        // reverse フラグを含めてキャッシュキーを作成
        const cacheKey = `${colorMapName}_${reverse ? 'reversed' : 'normal'}`;

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

        // reverse が true の場合、色の配列を反転
        if (reverse) {
            colors = colors.reverse();
        }

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

// テクスチャのキャッシュ
export class TextureCache {
    private cache: Map<string, ImageBitmap>;

    public constructor() {
        this.cache = new Map();
    }

    public async loadImage(key: textureDataKey): Promise<ImageBitmap> {
        const path = textureData[key];

        if (this.has(key)) {
            return this.get(key) as ImageBitmap;
        }

        const imageData = await fetch(path)
            .then((response) => response.blob())
            .then((blob) => createImageBitmap(blob));
        this.cache.set(key, imageData);

        return imageData;
    }

    add(cacheKey: string, image: ImageBitmap): void {
        this.cache.set(cacheKey, image);
    }

    get(cacheKey: string): ImageBitmap | undefined {
        return this.cache.get(cacheKey);
    }

    has(cacheKey: string): boolean {
        return this.cache.has(cacheKey);
    }
}
