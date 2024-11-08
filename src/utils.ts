import { SourceSpecification } from 'maplibre-gl';

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

type BooleanParameter = {
    name: string;
    value: boolean;
};

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
    reverse: boolean;
    selection: ColorMapType[];
};

export const textureData = {
    water: 'water-bg-pattern-03.jpg',
    magma: 'magma-bg-pattern.jpg',
} as const;

export type textureDataKey = keyof typeof textureData;

type TextureParameter = {
    name: string;
    value: textureDataKey; // valueはtextureDataのkeyのみを受け入れる
    selection: textureDataKey[];
};

export type DemEntry = {
    id: string;
    tileId: string;
    uniformsData: {
        evolution: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                maxHeight: NumberParameter;
                minHeight: NumberParameter;
                colorMap: colorMapParameter;
            };
        };
        shadow: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                shadowColor: ColorParameter;
                highlightColor: ColorParameter;
                ambient: NumberParameter;
                azimuth: NumberParameter;
                altitude: NumberParameter;
            };
        };
        aspect: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                colorMap: colorMapParameter;
            };
        };
        slope: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                colorMap: colorMapParameter;
            };
        };
        curvature: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                ridgeThreshold: NumberParameter;
                ridgeColor: ColorParameter;
                valleyThreshold: NumberParameter;
                valleyColor: ColorParameter;
            };
        };
        edge: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                edgeIntensity: NumberParameter;
                edgeColor: ColorParameter;
            };
        };
        contour: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                contourCount: NumberParameter;
                maxHeight: NumberParameter;
                contourColor: ColorParameter;
            };
        };
        flooding: {
            name: string;
            showMenu: boolean;
            option: {
                visible: BooleanParameter;
                opacity: NumberParameter;
                waterLevel: NumberParameter;
                texture: TextureParameter;
            };
        };
    };
    name: string;
    demType: DemDataTypeKey;
    url: string;
    attribution: string;
    sourceMinZoom: number;
    sourceMaxZoom: number;
    layerMinZoom?: number;
    layerMaxZoom?: number;
    bbox: [number, number, number, number]; // バウンディングボックス
};

export type DemLayer = {
    id: string;
    name: string;
    tiles: string[];
    tileSize: number;
    minzoom: number;
    maxzoom: number;
    bbox: [number, number, number, number];
    attribution: string;
    demType: DemDataTypeKey;
};

export const DEM_DATA_TYPE = {
    mapbox: 0.0,
    gsi: 1.0,
    terrarium: 2.0,
} as const;

export type DemDataType = typeof DEM_DATA_TYPE;
export type DemDataTypeKey = keyof DemDataType;

export const demLayers: DemLayer[] = [
    {
        id: 'dem_10b',
        name: '基盤地図情報数値標高モデル DEM10B',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 14,
        attribution: '国土地理院',
        bbox: [122.935, 20.425, 153.986, 45.551],
        demType: 'gsi',
    },
    {
        id: 'dem_5a',
        name: '基盤地図情報数値標高モデル DEM5A',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 15,
        attribution: '国土地理院',
        bbox: [122.935, 20.425, 153.986, 45.551],
        demType: 'gsi',
    },
    {
        id: 'dem_5b',
        name: '基盤地図情報数値標高モデル DEM5B',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/dem5b_png/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 15,
        attribution: '国土地理院',
        bbox: [122.935, 20.425, 153.986, 45.551],
        demType: 'gsi',
    },
    {
        id: 'dem_5c',
        name: '基盤地図情報数値標高モデル DEM5C',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/dem5c_png/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 15,
        attribution: '国土地理院',
        bbox: [122.935, 20.425, 153.986, 45.551],
        demType: 'gsi',
    },
    {
        id: 'tochigi_dem',
        name: '栃木県 数値標高モデル(DEM)0.5m',
        tiles: ['https://rinya-tochigi.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        bbox: [139.326731, 36.199924, 140.291983, 37.155039],
        attribution: '栃木県',
        demType: 'mapbox',
    },
    {
        id: 'kochi_dem',
        name: '高知県 数値標高モデル(DEM)0.5m',
        tiles: ['https://rinya-kochi.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        bbox: [132.479888, 32.702505, 134.31367, 33.882997],
        attribution: '高知県',
        demType: 'mapbox',
    },
    // {
    //     id: 'hyougo_dem',
    //     name: '兵庫県 数値標高モデル(DEM)0.5m',
    //     tiles: ['https://rinya-hyogo.geospatial.jp/2023/rinya/tile/terrainRGB/{z}/{x}/{y}.png'],
    //     tileSize: 256,
    //     minzoom: 2,
    //     maxzoom: 18,
    //     bbox: [134.252809, 34.156129, 135.468591, 35.674667],
    //     attribution: '兵庫県',

    //     demType: 'mapbox',
    // },
    {
        id: 'hyougo_dem',
        name: '兵庫県 DEM 1m',
        tiles: ['https://tiles.gsj.jp/tiles/elev/hyogodem/{z}/{y}/{x}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 17,
        bbox: [134.252809, 34.156129, 135.468591, 35.674667],
        attribution: '兵庫県',
        demType: 'gsi',
    },
    {
        id: 'hyougo_dsm',
        name: '兵庫県 DSM 1m',
        tiles: ['https://tiles.gsj.jp/tiles/elev/hyogodsm/{z}/{y}/{x}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 17,
        bbox: [134.252809, 34.156129, 135.468591, 35.674667],
        attribution: '兵庫県',
        demType: 'gsi',
    },
    {
        id: 'tokyo',
        name: '東京都',
        tiles: ['https://tiles.gsj.jp/tiles/elev/tokyo/{z}/{y}/{x}.png'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 19,
        bbox: [138.942922, 32.440258, 139.861054, 35.898368],
        attribution: '産総研シームレス標高タイル',
        demType: 'gsi',
    },

    {
        id: 'astergdemv3',
        name: 'ASTER全球3次元地形データ',
        tiles: ['https://tiles.gsj.jp/tiles/elev/astergdemv3/{z}/{y}/{x}.png'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 12,
        attribution: '産総研シームレス標高タイル',
        bbox: [-180, -85.051129, 180, 85.051129],
        demType: 'gsi',
    },
    {
        id: 'gebco',
        name: 'GEBCO Grid',
        tiles: ['https://tiles.gsj.jp/tiles/elev/gebco/{z}/{y}/{x}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 9,
        attribution: '産総研シームレス標高タイル',
        bbox: [-180, -85.051129, 180, 85.051129],
        demType: 'gsi',
    },
    {
        id: 'tilezen',
        name: 'Tilezen Joerd',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 15,
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Tilezen Joerd: Attribution</a>',
        bbox: [-180, -85.051129, 180, 85.051129],
        demType: 'terrarium',
    },
    {
        id: 'lakedepth',
        name: '湖水深タイル',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/lakedepth/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 14,
        attribution: '国土地理院',
        bbox: [122.935, 20.425, 153.986, 45.551],
        demType: 'gsi',
    },
    {
        id: 'gsigeoid',
        name: 'ジオイド・モデル「日本のジオイド2011」',
        tiles: ['https://tiles.gsj.jp/tiles/elev/gsigeoid/{z}/{y}/{x}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 8,
        attribution: '産総研シームレス標高タイル',
        bbox: [120, 20, 150, 50],
        demType: 'gsi',
    },
    // {
    //     id: 'mixed',
    //     name: '統合DEM',
    //     tiles: ['https://tiles.gsj.jp/tiles/elev/mixed/{z}/{y}/{x}.png'],
    //     tileSize: 256,
    //     minzoom: 0,
    //     maxzoom: 15,
    //     attribution: '産総研シームレス標高タイル',
    //     bbox: [-180, -85.051129, 180, 85.051129],
    //     demType: 'gsi',
    // },
];

export const tileOptions = {
    normalMapQuality: {
        name: '法線計算の精度',
        value: '隣接タイル込み',
        selection: ['隣接タイル込み', '中心タイルのみ'],
    },
};

export const demEntry: DemEntry = {
    id: 'custom-rgb-dem',
    tileId: demLayers[0].id,
    name: demLayers[0].name,
    demType: demLayers[0].demType,
    uniformsData: {
        shadow: {
            name: '陰影',
            showMenu: true,
            option: {
                visible: {
                    name: '表示',
                    value: true,
                },
                opacity: {
                    name: '透過度',
                    value: 0.7,
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
                    value: '#ff3300',
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
        },
        edge: {
            name: 'エッジ',
            showMenu: true,
            option: {
                visible: {
                    name: '表示',
                    value: true,
                },
                opacity: {
                    name: '透過度',
                    value: 0.8,
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
                    value: '#00fbff',
                },
            },
        },
        evolution: {
            name: '標高',
            showMenu: true,
            option: {
                visible: {
                    name: '表示',
                    value: true,
                },
                opacity: {
                    name: '透過度',
                    value: 0.8,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                maxHeight: {
                    name: '最大標高',
                    value: 4000,
                    min: -10000,
                    max: 10000,
                    step: 0.1,
                },
                minHeight: {
                    name: '最小標高',
                    value: 0,
                    min: -10000,
                    max: 10000,
                    step: 0.1,
                },
                colorMap: {
                    name: 'カラーマップ',
                    value: 'cool',
                    reverse: false,
                    selection: mutableColorMapType,
                },
            },
        },
        slope: {
            name: '傾斜量',
            showMenu: false,
            option: {
                visible: {
                    name: '表示',
                    value: false,
                },
                opacity: {
                    name: '透過度',
                    value: 0.8,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                colorMap: {
                    name: 'カラーマップ',
                    value: 'summer',
                    reverse: false,
                    selection: mutableColorMapType,
                },
            },
        },
        aspect: {
            name: '傾斜方位',
            showMenu: false,
            option: {
                visible: {
                    name: '表示',
                    value: false,
                },
                opacity: {
                    name: '透過度',
                    value: 0.8,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                colorMap: {
                    name: 'カラーマップ',
                    value: 'rainbow-soft',
                    reverse: false,
                    selection: mutableColorMapType,
                },
            },
        },
        curvature: {
            name: '曲率',
            showMenu: false,
            option: {
                visible: {
                    name: '表示',
                    value: false,
                },
                opacity: {
                    name: '透過度',
                    value: 1.0,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                ridgeThreshold: {
                    name: '尾根閾値',
                    value: 0.5,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                ridgeColor: {
                    name: '尾根色',
                    value: '#ff1f1f',
                },
                valleyThreshold: {
                    name: '谷閾値',
                    value: 0.5,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                valleyColor: {
                    name: '谷色',
                    value: '#3c60ff',
                },
            },
        },
        contour: {
            name: '等高線',
            showMenu: false,
            option: {
                visible: {
                    name: '表示',
                    value: false,
                },
                opacity: {
                    name: '透過度',
                    value: 0.7,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                contourCount: {
                    name: '本数',
                    value: 30,
                    min: 1,
                    max: 50,
                    step: 1,
                },
                maxHeight: {
                    name: '最大標高',
                    value: 4000,
                    min: 0,
                    max: 10000,
                    step: 0.1,
                },
                contourColor: {
                    name: '色',
                    value: '#000000',
                },
            },
        },
        flooding: {
            name: '浸水',
            showMenu: false,
            option: {
                visible: {
                    name: '表示',
                    value: false,
                },
                opacity: {
                    name: '透過度',
                    value: 0.5,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                waterLevel: {
                    name: '水位',
                    value: 100,
                    min: -10000,
                    max: 10000,
                    step: 0.1,
                },
                texture: {
                    name: 'テクスチャ',
                    value: 'water',
                    selection: Object.keys(textureData) as (keyof typeof textureData)[],
                },
            },
        },
    },
    url: demLayers[0].tiles[0],
    sourceMaxZoom: demLayers[0].maxzoom,
    sourceMinZoom: demLayers[0].minzoom,
    attribution: demLayers[0].attribution,
    bbox: demLayers[0].bbox,
};

export const backgroundSources: { [_: string]: SourceSpecification } = {
    'MIERUNE mono': {
        type: 'raster',
        tiles: ['https://tile.mierune.co.jp/mierune_mono/{z}/{x}/{y}.png'],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 18,
        attribution:
            '<a href="https://mierune.co.jp">MIERUNE Inc.</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
    },
    '国土地理院 全国最新写真': {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
        minzoom: 0,
        maxzoom: 19,
        tileSize: 256,
        attribution: '地理院タイル',
    },
    '国土地理院 淡色地図': {
        type: 'raster',
        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
        minzoom: 0,
        maxzoom: 19,
        tileSize: 256,
        attribution: '地理院タイル',
    },
    'Open Street Map': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        minzoom: 0,
        maxzoom: 19,
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
    },
};

type BBox = [number, number, number, number];
export const isBBoxOverlapping = (bbox1: BBox, bbox2: BBox): boolean => {
    const [minX1, minY1, maxX1, maxY1] = bbox1;
    const [minX2, minY2, maxX2, maxY2] = bbox2;
    return minX1 < maxX2 && maxX1 > minX2 && minY1 < maxY2 && maxY1 > minY2;
};

export const isColorMapParameter = (param: any): param is colorMapParameter => {
    return typeof param === 'object' && typeof param.name === 'string' && typeof param.value === 'string' && typeof param.reverse === 'boolean' && Array.isArray(param.selection);
};

export const isTextureParameter = (param: any): param is TextureParameter => {
    return typeof param === 'object' && typeof param.name === 'string' && typeof param.value === 'string' && Array.isArray(param.selection);
};
