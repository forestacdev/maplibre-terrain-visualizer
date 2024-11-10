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

export type UniformsData = {
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
};

export const uniformsData: UniformsData = {
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
