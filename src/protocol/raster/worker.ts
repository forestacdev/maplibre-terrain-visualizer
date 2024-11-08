import fsSource from './shader/fragment.glsl?raw';
import vsSource from './shader/vertex.glsl?raw';
import type { DemEntry } from '../../utils';
import chroma from 'chroma-js';

let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let positionBuffer: WebGLBuffer | null = null;
let heightMapLocation: WebGLUniformLocation | null = null;
let demTypeLocation: WebGLUniformLocation | null = null;

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
    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    heightMapLocation = gl.getUniformLocation(program, 'heightMap');
    demTypeLocation = gl.getUniformLocation(program, 'demType');
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
    type: '1f' | '1i' | '4fv' | '3fv'; // 具体的な型指定
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
    const { center, left, right, top, bottom, tileId, z, maxzoom, demTypeNumber, uniformsData, evolutionColorArray, slopeCorlorArray, aspectColorArray, floodingImage, onlyCenter } = e.data;
    try {
        if (!gl) {
            initWebGL(canvas);
        }

        if (!gl || !program || !positionBuffer) {
            throw new Error('WebGL initialization failed');
        }

        const { evolution, slope, shadow, aspect, curvature, edge, contour, flooding } = uniformsData as DemEntry['uniformsData'];

        const lightDirection = calculateLightDirection(shadow.option.azimuth.value, shadow.option.altitude.value);

        const uniforms: Uniforms = {
            onlyCenter: { type: '1i', value: onlyCenter ? 1 : 0 },
            zoomLevel: { type: '1f', value: z },
            maxzoom: { type: '1f', value: maxzoom },
            evolutionMode: { type: '1i', value: evolution.option.visible.value ? 1 : 0 },
            slopeMode: { type: '1i', value: slope.option.visible.value ? 1 : 0 },
            shadowMode: { type: '1i', value: shadow.option.visible.value ? 1 : 0 },
            aspectMode: { type: '1i', value: aspect.option.visible.value ? 1 : 0 },
            curvatureMode: { type: '1i', value: curvature.option.visible.value ? 1 : 0 },
            edgeMode: { type: '1i', value: edge.option.visible.value ? 1 : 0 },
            contourMode: { type: '1i', value: contour.option.visible.value ? 1 : 0 },
            floodingMode: { type: '1i', value: flooding.option.visible.value ? 1 : 0 },
            evolutionAlpha: { type: '1f', value: evolution.option.opacity.value },
            slopeAlpha: { type: '1f', value: slope.option.opacity.value },
            shadowStrength: { type: '1f', value: shadow.option.opacity.value },
            aspectAlpha: { type: '1f', value: aspect.option.opacity.value },
            curvatureAlpha: { type: '1f', value: curvature.option.opacity.value },
            edgeAlpha: { type: '1f', value: edge.option.opacity.value },
            contourAlpha: { type: '1f', value: contour.option.opacity.value },
            floodingAlpha: { type: '1f', value: flooding.option.opacity.value },
            ridgeColor: { type: '4fv', value: chroma(curvature.option.ridgeColor.value).gl() },
            valleyColor: { type: '4fv', value: chroma(curvature.option.valleyColor.value).gl() },
            edgeColor: { type: '4fv', value: chroma(edge.option.edgeColor.value).gl() },
            shadowColor: { type: '4fv', value: chroma(shadow.option.shadowColor.value).gl() },
            highlightColor: { type: '4fv', value: chroma(shadow.option.highlightColor.value).gl() },
            contourColor: { type: '4fv', value: chroma(contour.option.contourColor.value).gl() },
            ambient: { type: '1f', value: shadow.option.ambient.value },
            ridgeThreshold: { type: '1f', value: curvature.option.ridgeThreshold.value },
            valleyThreshold: { type: '1f', value: curvature.option.valleyThreshold.value },
            userDefinedIntensity: { type: '1f', value: edge.option.edgeIntensity.value },
            maxHeight: { type: '1f', value: evolution.option.maxHeight.value },
            minHeight: { type: '1f', value: evolution.option.minHeight.value },
            contourMaxHeight: { type: '1f', value: contour.option.maxHeight.value },
            lightDirection: { type: '3fv', value: lightDirection },
            contourCount: { type: '1f', value: contour.option.contourCount.value },
            waterLevel: { type: '1f', value: flooding.option.waterLevel.value },
        };

        setUniforms(gl, program, uniforms);

        // テクスチャ
        bindTextures(gl, program, {
            heightMap: { image: center, type: 'height' },
            heightMapLeft: { image: left, type: 'height' },
            heightMapRight: { image: right, type: 'height' },
            heightMapTop: { image: top, type: 'height' },
            heightMapBottom: { image: bottom, type: 'height' },
            ...(evolution.option.visible.value ? { u_evolutionMap: { image: evolutionColorArray, type: 'colormap' } } : {}),
            ...(slope.option.visible.value ? { u_slopeMap: { image: slopeCorlorArray, type: 'colormap' } } : {}),
            ...(aspect.option.visible.value ? { u_aspectMap: { image: aspectColorArray, type: 'colormap' } } : {}),
            ...(flooding.option.visible.value ? { u_floodingImage: { image: floodingImage, type: 'height' } } : {}),
        });

        gl.uniform1i(heightMapLocation, 0);
        gl.uniform1f(demTypeLocation, demTypeNumber); // demTypeを設定

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
