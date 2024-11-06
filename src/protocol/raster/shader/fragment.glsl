#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#define GLSLIFY 1
#endif

uniform sampler2D heightMap;
uniform sampler2D heightMapLeft;
uniform sampler2D heightMapRight;
uniform sampler2D heightMapTop;
uniform sampler2D heightMapBottom;

uniform float demType; // mapbox(0.0), gsi(1.0)
uniform float zoomLevel;
uniform float maxzoom;

uniform bool  slopeMode;
uniform bool  evolutionMode;
uniform bool  shadowMode;
uniform bool  aspectMode;
uniform bool  curvatureMode;
uniform bool  edgeMode;
uniform bool  contourMode;
uniform bool  floodingMode;

uniform sampler2D u_evolutionMap;
uniform sampler2D u_slopeMap;
uniform sampler2D u_aspectMap;
uniform sampler2D u_floodingImage;

uniform float evolutionAlpha;
uniform float slopeAlpha;
uniform float aspectAlpha;
uniform float curvatureAlpha;
uniform float edgeAlpha;
uniform float shadowStrength;
uniform float ambient;
uniform float contourAlpha;
uniform float floodingAlpha;

uniform vec4 shadowColor;
uniform vec4 highlightColor;
uniform vec4 ridgeColor;
uniform vec4 valleyColor;
uniform vec4 edgeColor;
uniform vec4 contourColor;

uniform float ridgeThreshold;
uniform float valleyThreshold;
uniform float userDefinedIntensity;
uniform float contourCount;
uniform float waterLevel;

uniform float maxHeight;
uniform float minHeight;
uniform float contourMaxHeight;
uniform vec3 lightDirection;
in vec2 vTexCoord;
out vec4 fragColor;





// 高さ変換関数
float convertToHeight(vec4 color) {
    vec3 rgb = color.rgb * 255.0;

    if (demType == 0.0) {  // mapbox (TerrainRGB)
        // dot関数で計算を効率化
        return -10000.0 + dot(rgb, vec3(256.0 * 256.0, 256.0, 1.0)) * 0.1;

    } else if (demType == 1.0) {  // gsi (地理院標高タイル)
        // dot関数でRGBの値をまとめて計算
        float total = dot(rgb, vec3(65536.0, 256.0, 1.0));
        return mix(total, total - 16777216.0, step(8388608.0, total)) * 0.01;

    } else if (demType == 2.0) {  // terrarium (Terrarium-RGB)
        // 標高 = (R値 * 256 + G値 + B値 / 256) - 32768
        return (rgb.r * 256.0 + rgb.g + rgb.b / 256.0) - 32768.0;
    }
}

// カラーマップ取得関数
vec4 getColorFromMap(sampler2D map, float value) {
    return vec4(texture(map, vec2(value, 0.5)).rgb, 1.0);
}


const mat3 conv_c = mat3(vec3(0,-1, 0),vec3(-1, 4,-1), vec3(0,-1, 0));


float conv(mat3 a, mat3 b){
  return dot(a[0],b[0]) + dot(a[1],b[1]) + dot(a[2],b[2]);
}



struct TerrainData {
    vec3 normal;
    float curvature;
};
mat3 heightMatrix;

TerrainData calculateTerrainData(vec2 uv) {
    vec2 pixelSize = vec2(1.0) / 256.0;
    uv = clamp(uv, vec2(0.0), vec2(1.0) - pixelSize);

    TerrainData data;
     // インデックス番号の9マス: 
    // [0][0] [0][1] [0][2]
    // [1][0] [1][1] [1][2]
    // [2][0] [2][1] [2][2]


   // 高さマップデータの取得、端の場合は隣接テクスチャからサンプル
   // 左上
    heightMatrix[0][0] = convertToHeight(
        (uv.x <= pixelSize.x && uv.y <= pixelSize.y) ? texture(heightMapLeft, uv + vec2(1.0 - pixelSize.x, 1.0 - pixelSize.y)) :
        (uv.y <= pixelSize.y) ? texture(heightMapTop, uv + vec2(-pixelSize.x, 1.0 - pixelSize.y)) :
        (uv.x <= pixelSize.x) ? texture(heightMapLeft, uv + vec2(1.0 - pixelSize.x, -pixelSize.y)) :
        texture(heightMap, uv + vec2(-pixelSize.x, -pixelSize.y))
    );

    // 上
    heightMatrix[0][1] = convertToHeight(
        (uv.y <= pixelSize.y) ? texture(heightMapTop, uv + vec2(0.0, 1.0 - pixelSize.y)) :
        texture(heightMap, uv + vec2(0.0, -pixelSize.y))
    );

    // 右上
    heightMatrix[0][2] = convertToHeight(
        (uv.x >= 1.0 - pixelSize.x && uv.y <= pixelSize.y) ? texture(heightMapRight, uv + vec2(-1.0 + pixelSize.x, 1.0 - pixelSize.y)) :
        (uv.y <= pixelSize.y) ? texture(heightMapTop, uv + vec2(pixelSize.x, 1.0 - pixelSize.y)) :
        (uv.x >= 1.0 - pixelSize.x) ? texture(heightMapRight, uv + vec2(-1.0 + pixelSize.x, -pixelSize.y)) :
        texture(heightMap, uv + vec2(pixelSize.x, -pixelSize.y))
    );

    // 左
    heightMatrix[1][0] = convertToHeight(
        (uv.x <= pixelSize.x) ? texture(heightMapLeft, uv + vec2(1.0 - pixelSize.x, 0.0)) :
        texture(heightMap, uv + vec2(-pixelSize.x, 0.0))
    );

    // 中央
    heightMatrix[1][1] = convertToHeight(texture(heightMap, uv));

    // 右
    heightMatrix[1][2] = convertToHeight(
        (uv.x >= 1.0 - pixelSize.x) ? texture(heightMapRight, uv + vec2(-1.0 + pixelSize.x, 0.0)) :
        texture(heightMap, uv + vec2(pixelSize.x, 0.0))
    );

    // 左下
    heightMatrix[2][0] = convertToHeight(
        (uv.x <= pixelSize.x && uv.y >= 1.0 - pixelSize.y) ? texture(heightMapLeft, uv + vec2(1.0 - pixelSize.x, -1.0 + pixelSize.y)) :
        (uv.y >= 1.0 - pixelSize.y) ? texture(heightMapBottom, uv + vec2(-pixelSize.x, -1.0 + pixelSize.y)) :
        (uv.x <= pixelSize.x) ? texture(heightMapLeft, uv + vec2(1.0 - pixelSize.x, pixelSize.y)) :
        texture(heightMap, uv + vec2(-pixelSize.x, pixelSize.y))
    );

    // 下
    heightMatrix[2][1] = convertToHeight(
        (uv.y >= 1.0 - pixelSize.y) ? texture(heightMapBottom, uv + vec2(0.0, -1.0 + pixelSize.y)) :
        texture(heightMap, uv + vec2(0.0, pixelSize.y))
    );

    // 右下
    heightMatrix[2][2] = convertToHeight(
        (uv.x >= 1.0 - pixelSize.x && uv.y >= 1.0 - pixelSize.y) ? texture(heightMapRight, uv + vec2(-1.0 + pixelSize.x, -1.0 + pixelSize.y)) :
        (uv.y >= 1.0 - pixelSize.y) ? texture(heightMapBottom, uv + vec2(pixelSize.x, -1.0 + pixelSize.y)) :
        (uv.x >= 1.0 - pixelSize.x) ? texture(heightMapRight, uv + vec2(-1.0 + pixelSize.x, pixelSize.y)) :
        texture(heightMap, uv + vec2(pixelSize.x, pixelSize.y))
    );

    // NOTE:debug
    // 左上
    // heightMatrix[0][0] = convertToHeight(texture(heightMap, uv + vec2(-pixelSize.x, -pixelSize.y)));
    // // 上
    // heightMatrix[0][1] = convertToHeight(texture(heightMap, uv + vec2(0.0, -pixelSize.y)));
    // // 右上
    // heightMatrix[0][2] = convertToHeight(texture(heightMap,uv + vec2(pixelSize.x, -pixelSize.y)));
    // // 左
    // heightMatrix[1][0] = convertToHeight(texture(heightMap, uv + vec2(-pixelSize.x, 0.0)));
    // // 中央
    // heightMatrix[1][1] = convertToHeight(texture(heightMap, uv));
    // // 右
    // heightMatrix[1][2] = convertToHeight(texture(heightMap,uv + vec2(pixelSize.x, 0.0)));
    // // 左下
    // heightMatrix[2][0] = convertToHeight(texture(heightMap, uv + vec2(-pixelSize.x, pixelSize.y)));
    // // 下
    // heightMatrix[2][1] = convertToHeight(texture(heightMap, uv + vec2(0.0, pixelSize.y)));
    // // 右下
    // heightMatrix[2][2] = convertToHeight(texture(heightMap, uv + vec2(pixelSize.x, pixelSize.y)));

    // 法線の計算
    data.normal.x = (heightMatrix[0][0] + heightMatrix[0][1] + heightMatrix[0][2]) - 
                    (heightMatrix[2][0] + heightMatrix[2][1] + heightMatrix[2][2]);
    data.normal.y = (heightMatrix[0][0] + heightMatrix[1][0] + heightMatrix[2][0]) - 
                    (heightMatrix[0][2] + heightMatrix[1][2] + heightMatrix[2][2]);
    data.normal.z = 2.0 * pixelSize.x * 256.0; // スケーリング係数
    data.normal = normalize(data.normal);

    // 曲率の計算
    data.curvature = conv(conv_c, heightMatrix);

    return data;
}

// 傾斜量を計算する関数
float calculateSlope(vec3 normal) {
    // 法線ベクトルのZ成分から傾斜角を計算
    float slope = acos(normal.z);
    // ラジアンから度に変換
    return degrees(slope);
}

// 等高線を生成する関数 
float createContours(float height) {
    float palNum = contourCount; // 等高線の数
    const float smoothFactor = 0.5; // 滑らかさの制御

    // スムーズな等高線の生成
    float n = height;
    float contour = n * (1.0 - smoothFactor) + clamp(floor(n * (palNum - 0.001)) / (palNum - 1.0), 0.0, 1.0) * smoothFactor;

    return contour;
}

void main() {
    vec2 uv = vTexCoord;
    vec4 color = texture(heightMap, uv);


    if (!evolutionMode && !slopeMode && !shadowMode && !aspectMode && !curvatureMode && !edgeMode && !contourMode && !floodingMode) {
        fragColor = vec4(0.0);
        return;
    }

    vec4 finalColor = vec4(0.0, 0.0,0.0,0.0);
    bool needNormal = (slopeMode || aspectMode || shadowMode || edgeMode);
    bool needCurvature = (curvatureMode);

    TerrainData terrainData;
    if (needNormal || needCurvature) {
        terrainData = calculateTerrainData(uv);
    }


    if (evolutionMode) {
        float height = convertToHeight(color);
        float normalizedHeight = clamp((height - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
        vec4 terrainColor = getColorFromMap(u_evolutionMap, normalizedHeight);
        finalColor = mix(finalColor, terrainColor, evolutionAlpha);
    }

    if (needNormal) {
        vec3 normal = terrainData.normal;

        if (slopeMode) {
            float slope = calculateSlope(normal);
            float normalizedSlope = clamp(slope / 90.0, 0.0, 1.0);
            vec4 slopeColor = getColorFromMap(u_slopeMap, normalizedSlope);
            finalColor = mix(finalColor, slopeColor, slopeAlpha);
           // NOTE: 放線のデバッグ
            // vec3 normalizedColor = (normal + 1.0) * 0.5;
            // finalColor = vec4(normalizedColor, 1.0);
        }

        if (aspectMode) {
            float aspect = atan(normal.y, normal.x);
            float normalizedAspect = (aspect + 3.14159265359) / (2.0 * 3.14159265359);
            vec4 aspectColor = getColorFromMap(u_aspectMap, normalizedAspect);
            finalColor = mix(finalColor, aspectColor, aspectAlpha);
        }

        if (shadowMode) {
            vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0)); // 視線ベクトル
            float highlightStrength = 0.5; // ハイライトの強度
            // 拡散光の計算
            float diffuse = max(dot(normal, lightDirection), 0.0);

            // 環境光と拡散光の合成
            float shadowFactor = ambient + (1.0 - ambient) * diffuse;
            float shadowAlpha = (1.0 - shadowFactor) * shadowStrength;

            // ハイライトの計算
            vec3 reflectDir = reflect(-lightDirection, normal); // 反射ベクトル
            float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 16.0); // スペキュラ成分（光沢の鋭さ）
            vec3 finalHighlight = highlightStrength * spec * highlightColor.rgb; // ハイライトの最終的な強度と色

            // ハイライトと影を重ねる
            finalColor.rgb = mix(finalColor.rgb, shadowColor.rgb, shadowAlpha); // 影の適用
            finalColor.rgb += finalHighlight; // ハイライトの適用
            finalColor.a = finalColor.a * (1.0 - shadowAlpha) + shadowAlpha;
        }
    }

    if (needCurvature) {
        float z = 10.0 * exp2(14.0 - zoomLevel); // ズームレベルに基づくスケーリング係数

        if (color.a == 0.0) {
            fragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }

        float curvature = terrainData.curvature;
        float scaledCurvature = terrainData.curvature / z;
        float normalizedCurvature = clamp((scaledCurvature + 1.0) / 2.0, 0.0, 1.0);

        vec4 curvatureColor = vec4(0.0);  // デフォルトで透明

        // 山の稜線の処理
        if (normalizedCurvature >= ridgeThreshold) {
            float intensity = (normalizedCurvature - ridgeThreshold) / (1.0 - ridgeThreshold);
            curvatureColor = vec4(ridgeColor.rgb, intensity * curvatureAlpha);
        }
        // 谷の処理
        else if (normalizedCurvature <= valleyThreshold) {
            float intensity = (valleyThreshold - normalizedCurvature) / valleyThreshold;
            curvatureColor = vec4(valleyColor.rgb, intensity * curvatureAlpha);
        }

        // アルファブレンディング
        finalColor.rgb = mix(finalColor.rgb, curvatureColor.rgb, curvatureColor.a);
        finalColor.a = max(finalColor.a, curvatureColor.a);
    }


    if(edgeMode) {


        vec2 e = vec2(1.5/256.0, 0);
        float edgeX = abs(heightMatrix[1][2] - heightMatrix[1][0]); // 左右の高さ差
        float edgeY = abs(heightMatrix[2][1] - heightMatrix[0][1]); // 上下の高さ差
        
        float z = 0.5 * exp2(zoomLevel - 17.0);
        float edgeIntensity = z;
        
        float edgeStrength = (edgeX + edgeY) * edgeIntensity * userDefinedIntensity;
        
        // エッジの透明度を考慮したブレンディング
        vec4 edge = vec4(edgeColor.rgb, clamp(edgeStrength, 0.0, 0.8) * edgeAlpha);
        
        // アルファブレンディング
        finalColor.rgb = mix(finalColor.rgb, edge.rgb, edge.a);
        finalColor.a = max(finalColor.a, edge.a);
    }

    if (contourMode) {
              // 等高線の生成
        float height = convertToHeight(color);
        float normalizedHeight = clamp((height - 0.0) / (contourMaxHeight - 0.0), 0.0, 1.0);
        float contourLines = createContours(normalizedHeight);

        vec2 texelSize = 1.0 / vec2(256.0, 256.0);
        float heightRight = createContours(clamp(convertToHeight(texture(heightMap, uv + vec2(texelSize.x, 0.0))) / contourMaxHeight, 0.0, 1.0));
        float heightUp = createContours(clamp(convertToHeight(texture(heightMap, uv + vec2(0.0, texelSize.y))) / contourMaxHeight, 0.0, 1.0));

        // 境界を計算
        float edgeThreshold = 0.01; // 境界を検出するためのしきい値
        float edge = step(edgeThreshold, abs(contourLines - heightRight)) + step(edgeThreshold, abs(contourLines - heightUp));

        // 最終的な色の計算
        vec3 col = finalColor.rgb;
        vec3 outlineColor = contourColor.rgb; // アウトラインの色（黒）

         // アウトラインを追加し、ライン以外は透明にする
        if (edge > 0.0) {
            vec4 finalContourColor = vec4(outlineColor, contourAlpha);
            finalColor.a = max(finalColor.a, finalContourColor.a);
            finalColor.rgb = mix(finalColor.rgb, finalContourColor.rgb, finalContourColor.a);
        }

    }


   if (floodingMode) {
    float height = convertToHeight(color);
    vec4 floodingColor = vec4(0.0, 0.0, 1.0, floodingAlpha); // デフォルトの浸水色

        if (height < waterLevel) {
            // 浸水箇所のテクスチャから色を取得し、floodingAlpha を適用
            floodingColor = vec4(texture(u_floodingImage, uv).rgb, floodingAlpha);

            // アルファブレンドによる最終的な色の適用
            finalColor.rgb = mix(finalColor.rgb, floodingColor.rgb, floodingColor.a);
            finalColor.a = mix(finalColor.a, floodingColor.a, floodingAlpha); // アルファもブレンド
        }
    }


    fragColor = finalColor;

}