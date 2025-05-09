import fsSource from './shader/fragment.glsl?raw';
import vsSource from './shader/vertex.glsl?raw';
import type { DemEntry } from '../../utils';
import chroma from 'chroma-js';

let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;

const calculateLightDirection = (azimuth: number, altitude: number) => {
    // 方位角と高度をラジアンに変換
    const azimuthRad = (azimuth * Math.PI) / 180;
    const altitudeRad = (altitude * Math.PI) / 180;

    // 光の方向ベクトルを計算
    const x = Math.cos(altitudeRad) * Math.sin(azimuthRad);
    const y = Math.sin(altitudeRad);
    const z = -Math.cos(altitudeRad) * Math.cos(azimuthRad); // 北がZ軸の負の方向

    return [x, y, z];
};

const initWebGL = (canvas: OffscreenCanvas) => {
    gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL not supported');
    }

    const loadShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) {
            console.error('Unable to create shader');
            return null;
        }
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) {
        throw new Error('Failed to load shaders');
    }

    program = gl.createProgram();
    if (!program) {
        throw new Error('Failed to create program');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        throw new Error('Failed to link program');
    }

    gl.useProgram(program);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
};

const canvas = new OffscreenCanvas(256, 256);

const bindTextures = (gl: WebGL2RenderingContext, program: WebGLProgram, textures: { [name: string]: { image: ImageBitmap | Uint8Array; type: 'height' | 'colormap' } }) => {
    let textureUnit = gl.TEXTURE0;

    Object.entries(textures).forEach(([uniformName, { image, type }]) => {
        // テクスチャをバインド
        const texture = gl.createTexture();
        gl.activeTexture(textureUnit); // 現在のテクスチャユニットをアクティブ
        gl.bindTexture(gl.TEXTURE_2D, texture);

        const location = gl.getUniformLocation(program, uniformName);
        gl.uniform1i(location, textureUnit - gl.TEXTURE0);

        if (type === 'height') {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as ImageBitmap);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, image as Uint8Array);
        }

        // ラッピングとフィルタリングの設定
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        textureUnit += 1; // 次のテクスチャユニットへ
    });
};

type UniformValue = {
    type: '1f' | '1i' | '4fv' | '3fv'; // 型指定
    value: number | Float32Array | Int32Array | number[];
};

type Uniforms = {
    [name: string]: UniformValue;
};

const setUniforms = (gl: WebGL2RenderingContext, program: WebGLProgram, uniforms: Uniforms): void => {
    for (const [name, { type, value }] of Object.entries(uniforms)) {
        const location = gl.getUniformLocation(program, name);
        if (location !== null) {
            (gl as any)[`uniform${type}`](location, value);
        }
    }
};

self.onmessage = async (e) => {
    const { center, left, right, top, bottom, tileId, z, maxzoom, demTypeNumber, uniformsData, elevationColorArray, slopeCorlorArray, aspectColorArray, floodingImage, onlyCenter } = e.data;
    try {
        if (!gl) {
            initWebGL(canvas);
        }

        if (!gl || !program || !positionBuffer) {
            throw new Error('WebGL initialization failed');
        }

        const { elevation, slope, shadow, aspect, curvature, edge, contour, flooding } = uniformsData as DemEntry['uniformsData'];

        const lightDirection = calculateLightDirection(shadow.option.azimuth.value, shadow.option.altitude.value);

        const uniforms: Uniforms = {
            u_dem_type: { type: '1f', value: demTypeNumber },
            u_only_center: { type: '1i', value: onlyCenter ? 1 : 0 },
            u_zoom_level: { type: '1f', value: z },
            u_max_zoom: { type: '1f', value: maxzoom },
            u_elevation_mode: { type: '1i', value: elevation.option.visible.value ? 1 : 0 },
            u_slope_mode: { type: '1i', value: slope.option.visible.value ? 1 : 0 },
            u_shadow_mode: { type: '1i', value: shadow.option.visible.value ? 1 : 0 },
            u_aspect_mode: { type: '1i', value: aspect.option.visible.value ? 1 : 0 },
            u_curvature_mode: { type: '1i', value: curvature.option.visible.value ? 1 : 0 },
            u_edge_mode: { type: '1i', value: edge.option.visible.value ? 1 : 0 },
            u_contour_mode: { type: '1i', value: contour.option.visible.value ? 1 : 0 },
            u_flooding_mode: { type: '1i', value: flooding.option.visible.value ? 1 : 0 },
            u_elevation_alpha: { type: '1f', value: elevation.option.opacity.value },
            u_slope_alpha: { type: '1f', value: slope.option.opacity.value },
            u_shadow_strength: { type: '1f', value: shadow.option.opacity.value },
            u_aspect_alpha: { type: '1f', value: aspect.option.opacity.value },
            u_curvature_alpha: { type: '1f', value: curvature.option.opacity.value },
            u_edge_alpha: { type: '1f', value: edge.option.opacity.value },
            u_contour_alpha: { type: '1f', value: contour.option.opacity.value },
            u_flooding_alpha: { type: '1f', value: flooding.option.opacity.value },
            u_ridge_color: { type: '4fv', value: chroma(curvature.option.ridgeColor.value).gl() },
            u_valley_color: { type: '4fv', value: chroma(curvature.option.valleyColor.value).gl() },
            u_edge_color: { type: '4fv', value: chroma(edge.option.edgeColor.value).gl() },
            u_shadow_color: { type: '4fv', value: chroma(shadow.option.shadowColor.value).gl() },
            u_highlight_color: { type: '4fv', value: chroma(shadow.option.highlightColor.value).gl() },
            u_contour_color: { type: '4fv', value: chroma(contour.option.contourColor.value).gl() },
            u_ambient: { type: '1f', value: shadow.option.ambient.value },
            u_ridge_threshold: { type: '1f', value: curvature.option.ridgeThreshold.value },
            u_valley_threshold: { type: '1f', value: curvature.option.valleyThreshold.value },
            u_edge_intensity: { type: '1f', value: edge.option.edgeIntensity.value },
            u_max_height: { type: '1f', value: elevation.option.maxHeight.value },
            u_min_height: { type: '1f', value: elevation.option.minHeight.value },
            u_contour_max_height: { type: '1f', value: contour.option.maxHeight.value },
            u_light_direction: { type: '3fv', value: lightDirection },
            u_contour_count: { type: '1f', value: contour.option.contourCount.value },
            u_water_level: { type: '1f', value: flooding.option.waterLevel.value },
        };

        setUniforms(gl, program, uniforms);

        // テクスチャ
        bindTextures(gl, program, {
            u_height_map_center: { image: center, type: 'height' },
            u_height_map_left: { image: left, type: 'height' },
            u_height_map_right: { image: right, type: 'height' },
            u_height_map_top: { image: top, type: 'height' },
            u_height_map_bottom: { image: bottom, type: 'height' },
            ...(elevation.option.visible.value ? { u_elevationMap: { image: elevationColorArray, type: 'colormap' } } : {}),
            ...(slope.option.visible.value ? { u_slopeMap: { image: slopeCorlorArray, type: 'colormap' } } : {}),
            ...(aspect.option.visible.value ? { u_aspectMap: { image: aspectColorArray, type: 'colormap' } } : {}),
            ...(flooding.option.visible.value ? { u_floodingImage: { image: floodingImage, type: 'height' } } : {}),
        });

        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        const blob = await canvas.convertToBlob();
        if (!blob) {
            throw new Error('Failed to convert canvas to blob');
        }

        const buffer = await blob.arrayBuffer();
        self.postMessage({ id: tileId, buffer });
    } catch (error) {
        if (error instanceof Error) {
            self.postMessage({ id: tileId, error: error.message });
        }
    }
};
