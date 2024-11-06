import { demEntry } from '../utils';

export const DEBUG_Z = 11;
export const DEBUG_X = 1813;
export const DEBUG_Y = 808;
export const HAS_DEBUG_TILE = false;

export const debugTileImage = (tileUrl: string, buffer: ArrayBuffer) => {
    const debugTileId = demEntry.url.replace('{x}', DEBUG_X.toString()).replace('{y}', DEBUG_Y.toString()).replace('{z}', DEBUG_Z.toString());
    console.info(tileUrl, debugTileId);
    if (tileUrl !== debugTileId) {
        return;
    }

    console.info('Debug tile:', tileUrl);
    const debugCanvas = document.getElementById('debugCanvas') as HTMLCanvasElement;
    // const debugCanvas = document.createElement('canvas');
    debugCanvas.width = 256;
    debugCanvas.height = 256;

    const ctx = debugCanvas.getContext('2d') as CanvasRenderingContext2D;
    const blob = new Blob([buffer], { type: 'image/png' });
    const img = new Image();

    img.onload = () => {
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(img, 0, 0);

        // ダウンロード
        // const a = document.createElement('a');
        // a.href = debugCanvas.toDataURL();
        // a.download = `debug_${debugTileId}`;
        // a.click();
    };

    const url = URL.createObjectURL(blob);
    img.src = url;
};
