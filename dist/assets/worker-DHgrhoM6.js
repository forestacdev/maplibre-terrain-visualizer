(function(){"use strict";var Gt=`#version 300 es
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

}`,It=`#version 300 es
in vec4 aPosition;
out vec2 vTexCoord;

void main() {
    gl_Position = aPosition;
    vTexCoord = vec2(aPosition.x * 0.5 + 0.5, aPosition.y * -0.5 + 0.5); // Y軸を反転
}`;const{min:Ot,max:jt}=Math;var J=(e,t=0,n=1)=>Ot(jt(t,e),n),we=e=>{e._clipped=!1,e._unclipped=e.slice(0);for(let t=0;t<=3;t++)t<3?((e[t]<0||e[t]>255)&&(e._clipped=!0),e[t]=J(e[t],0,255)):t===3&&(e[t]=J(e[t],0,1));return e};const Fe={};for(let e of["Boolean","Number","String","Function","Array","Date","RegExp","Undefined","Null"])Fe[`[object ${e}]`]=e.toLowerCase();function S(e){return Fe[Object.prototype.toString.call(e)]||"object"}var _=(e,t=null)=>e.length>=3?Array.prototype.slice.call(e):S(e[0])=="object"&&t?t.split("").filter(n=>e[0][n]!==void 0).map(n=>e[0][n]):e[0].slice(0),ee=e=>{if(e.length<2)return null;const t=e.length-1;return S(e[t])=="string"?e[t].toLowerCase():null};const{PI:ue,min:qe,max:Ze}=Math,O=e=>Math.round(e*100)/100,_e=e=>Math.round(e*100)/100,F=ue*2,Ce=ue/3,Xt=ue/180,Yt=180/ue;function We(e){return[...e.slice(0,3).reverse(),...e.slice(3)]}var w={format:{},autodetect:[]};class u{constructor(...t){const n=this;if(S(t[0])==="object"&&t[0].constructor&&t[0].constructor===this.constructor)return t[0];let o=ee(t),r=!1;if(!o){r=!0,w.sorted||(w.autodetect=w.autodetect.sort((a,i)=>i.p-a.p),w.sorted=!0);for(let a of w.autodetect)if(o=a.test(...t),o)break}if(w.format[o]){const a=w.format[o].apply(null,r?t:t.slice(0,-1));n._rgb=we(a)}else throw new Error("unknown format: "+t);n._rgb.length===3&&n._rgb.push(1)}toString(){return S(this.hex)=="function"?this.hex():`[${this._rgb.join(",")}]`}}const Ut="3.1.2",k=(...e)=>new u(...e);k.version=Ut;const te={aliceblue:"#f0f8ff",antiquewhite:"#faebd7",aqua:"#00ffff",aquamarine:"#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",black:"#000000",blanchedalmond:"#ffebcd",blue:"#0000ff",blueviolet:"#8a2be2",brown:"#a52a2a",burlywood:"#deb887",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",crimson:"#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkgray:"#a9a9a9",darkgreen:"#006400",darkgrey:"#a9a9a9",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",darkolivegreen:"#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",darkred:"#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",darkslateblue:"#483d8b",darkslategray:"#2f4f4f",darkslategrey:"#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",deeppink:"#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",dimgrey:"#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",floralwhite:"#fffaf0",forestgreen:"#228b22",fuchsia:"#ff00ff",gainsboro:"#dcdcdc",ghostwhite:"#f8f8ff",gold:"#ffd700",goldenrod:"#daa520",gray:"#808080",green:"#008000",greenyellow:"#adff2f",grey:"#808080",honeydew:"#f0fff0",hotpink:"#ff69b4",indianred:"#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",laserlemon:"#ffff54",lavender:"#e6e6fa",lavenderblush:"#fff0f5",lawngreen:"#7cfc00",lemonchiffon:"#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",lightcyan:"#e0ffff",lightgoldenrod:"#fafad2",lightgoldenrodyellow:"#fafad2",lightgray:"#d3d3d3",lightgreen:"#90ee90",lightgrey:"#d3d3d3",lightpink:"#ffb6c1",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",lightslategray:"#778899",lightslategrey:"#778899",lightsteelblue:"#b0c4de",lightyellow:"#ffffe0",lime:"#00ff00",limegreen:"#32cd32",linen:"#faf0e6",magenta:"#ff00ff",maroon:"#800000",maroon2:"#7f0000",maroon3:"#b03060",mediumaquamarine:"#66cdaa",mediumblue:"#0000cd",mediumorchid:"#ba55d3",mediumpurple:"#9370db",mediumseagreen:"#3cb371",mediumslateblue:"#7b68ee",mediumspringgreen:"#00fa9a",mediumturquoise:"#48d1cc",mediumvioletred:"#c71585",midnightblue:"#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",navajowhite:"#ffdead",navy:"#000080",oldlace:"#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",orangered:"#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",palegreen:"#98fb98",paleturquoise:"#afeeee",palevioletred:"#db7093",papayawhip:"#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",plum:"#dda0dd",powderblue:"#b0e0e6",purple:"#800080",purple2:"#7f007f",purple3:"#a020f0",rebeccapurple:"#663399",red:"#ff0000",rosybrown:"#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",salmon:"#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",seashell:"#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",slateblue:"#6a5acd",slategray:"#708090",slategrey:"#708090",snow:"#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",teal:"#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",violet:"#ee82ee",wheat:"#f5deb3",white:"#ffffff",whitesmoke:"#f5f5f5",yellow:"#ffff00",yellowgreen:"#9acd32"},Ft=/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,qt=/^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/,Ke=e=>{if(e.match(Ft)){(e.length===4||e.length===7)&&(e=e.substr(1)),e.length===3&&(e=e.split(""),e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]);const t=parseInt(e,16),n=t>>16,o=t>>8&255,r=t&255;return[n,o,r,1]}if(e.match(qt)){(e.length===5||e.length===9)&&(e=e.substr(1)),e.length===4&&(e=e.split(""),e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]+e[3]+e[3]);const t=parseInt(e,16),n=t>>24&255,o=t>>16&255,r=t>>8&255,a=Math.round((t&255)/255*100)/100;return[n,o,r,a]}throw new Error(`unknown hex color: ${e}`)},{round:he}=Math,Ve=(...e)=>{let[t,n,o,r]=_(e,"rgba"),a=ee(e)||"auto";r===void 0&&(r=1),a==="auto"&&(a=r<1?"rgba":"rgb"),t=he(t),n=he(n),o=he(o);let l="000000"+(t<<16|n<<8|o).toString(16);l=l.substr(l.length-6);let c="0"+he(r*255).toString(16);switch(c=c.substr(c.length-2),a.toLowerCase()){case"rgba":return`#${l}${c}`;case"argb":return`#${c}${l}`;default:return`#${l}`}};u.prototype.name=function(){const e=Ve(this._rgb,"rgb");for(let t of Object.keys(te))if(te[t]===e)return t.toLowerCase();return e},w.format.named=e=>{if(e=e.toLowerCase(),te[e])return Ke(te[e]);throw new Error("unknown color name: "+e)},w.autodetect.push({p:5,test:(e,...t)=>{if(!t.length&&S(e)==="string"&&te[e.toLowerCase()])return"named"}}),u.prototype.alpha=function(e,t=!1){return e!==void 0&&S(e)==="number"?t?(this._rgb[3]=e,this):new u([this._rgb[0],this._rgb[1],this._rgb[2],e],"rgb"):this._rgb[3]},u.prototype.clipped=function(){return this._rgb._clipped||!1};const U={Kn:18,labWhitePoint:"d65",Xn:.95047,Yn:1,Zn:1.08883,t0:.137931034,t1:.206896552,t2:.12841855,t3:.008856452,kE:216/24389,kKE:8,kK:24389/27,RefWhiteRGB:{X:.95047,Y:1,Z:1.08883},MtxRGB2XYZ:{m00:.4124564390896922,m01:.21267285140562253,m02:.0193338955823293,m10:.357576077643909,m11:.715152155287818,m12:.11919202588130297,m20:.18043748326639894,m21:.07217499330655958,m22:.9503040785363679},MtxXYZ2RGB:{m00:3.2404541621141045,m01:-.9692660305051868,m02:.055643430959114726,m10:-1.5371385127977166,m11:1.8760108454466942,m12:-.2040259135167538,m20:-.498531409556016,m21:.041556017530349834,m22:1.0572251882231791},As:.9414285350000001,Bs:1.040417467,Cs:1.089532651,MtxAdaptMa:{m00:.8951,m01:-.7502,m02:.0389,m10:.2664,m11:1.7135,m12:-.0685,m20:-.1614,m21:.0367,m22:1.0296},MtxAdaptMaI:{m00:.9869929054667123,m01:.43230526972339456,m02:-.008528664575177328,m10:-.14705425642099013,m11:.5183602715367776,m12:.04004282165408487,m20:.15996265166373125,m21:.0492912282128556,m22:.9684866957875502}},Zt=new Map([["a",[1.0985,.35585]],["b",[1.0985,.35585]],["c",[.98074,1.18232]],["d50",[.96422,.82521]],["d55",[.95682,.92149]],["d65",[.95047,1.08883]],["e",[1,1,1]],["f2",[.99186,.67393]],["f7",[.95041,1.08747]],["f11",[1.00962,.6435]],["icc",[.96422,.82521]]]);function q(e){const t=Zt.get(String(e).toLowerCase());if(!t)throw new Error("unknown Lab illuminant "+e);U.labWhitePoint=e,U.Xn=t[0],U.Zn=t[1]}function fe(){return U.labWhitePoint}const ke=(...e)=>{e=_(e,"lab");const[t,n,o]=e,[r,a,i]=Wt(t,n,o),[l,c,f]=Je(r,a,i);return[l,c,f,e.length>3?e[3]:1]},Wt=(e,t,n)=>{const{kE:o,kK:r,kKE:a,Xn:i,Yn:l,Zn:c}=U,f=(e+16)/116,h=.002*t+f,p=f-.005*n,d=h*h*h,g=p*p*p,y=d>o?d:(116*h-16)/r,z=e>a?Math.pow((e+16)/116,3):e/r,v=g>o?g:(116*p-16)/r,b=y*i,$=z*l,L=v*c;return[b,$,L]},ze=e=>{const t=Math.sign(e);return e=Math.abs(e),(e<=.0031308?e*12.92:1.055*Math.pow(e,1/2.4)-.055)*t},Je=(e,t,n)=>{const{MtxAdaptMa:o,MtxAdaptMaI:r,MtxXYZ2RGB:a,RefWhiteRGB:i,Xn:l,Yn:c,Zn:f}=U,h=l*o.m00+c*o.m10+f*o.m20,p=l*o.m01+c*o.m11+f*o.m21,d=l*o.m02+c*o.m12+f*o.m22,g=i.X*o.m00+i.Y*o.m10+i.Z*o.m20,y=i.X*o.m01+i.Y*o.m11+i.Z*o.m21,z=i.X*o.m02+i.Y*o.m12+i.Z*o.m22,v=(e*o.m00+t*o.m10+n*o.m20)*(g/h),b=(e*o.m01+t*o.m11+n*o.m21)*(y/p),$=(e*o.m02+t*o.m12+n*o.m22)*(z/d),L=v*r.m00+b*r.m10+$*r.m20,R=v*r.m01+b*r.m11+$*r.m21,P=v*r.m02+b*r.m12+$*r.m22,C=ze(L*a.m00+R*a.m10+P*a.m20),s=ze(L*a.m01+R*a.m11+P*a.m21),m=ze(L*a.m02+R*a.m12+P*a.m22);return[C*255,s*255,m*255]},Se=(...e)=>{const[t,n,o,...r]=_(e,"rgb"),[a,i,l]=Qe(t,n,o),[c,f,h]=Kt(a,i,l);return[c,f,h,...r.length>0&&r[0]<1?[r[0]]:[]]};function Kt(e,t,n){const{Xn:o,Yn:r,Zn:a,kE:i,kK:l}=U,c=e/o,f=t/r,h=n/a,p=c>i?Math.pow(c,1/3):(l*c+16)/116,d=f>i?Math.pow(f,1/3):(l*f+16)/116,g=h>i?Math.pow(h,1/3):(l*h+16)/116;return[116*d-16,500*(p-d),200*(d-g)]}function Te(e){const t=Math.sign(e);return e=Math.abs(e),(e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4))*t}const Qe=(e,t,n)=>{e=Te(e/255),t=Te(t/255),n=Te(n/255);const{MtxRGB2XYZ:o,MtxAdaptMa:r,MtxAdaptMaI:a,Xn:i,Yn:l,Zn:c,As:f,Bs:h,Cs:p}=U;let d=e*o.m00+t*o.m10+n*o.m20,g=e*o.m01+t*o.m11+n*o.m21,y=e*o.m02+t*o.m12+n*o.m22;const z=i*r.m00+l*r.m10+c*r.m20,v=i*r.m01+l*r.m11+c*r.m21,b=i*r.m02+l*r.m12+c*r.m22;let $=d*r.m00+g*r.m10+y*r.m20,L=d*r.m01+g*r.m11+y*r.m21,R=d*r.m02+g*r.m12+y*r.m22;return $*=z/f,L*=v/h,R*=b/p,d=$*a.m00+L*a.m10+R*a.m20,g=$*a.m01+L*a.m11+R*a.m21,y=$*a.m02+L*a.m12+R*a.m22,[d,g,y]};u.prototype.lab=function(){return Se(this._rgb)},Object.assign(k,{lab:(...e)=>new u(...e,"lab"),getLabWhitePoint:fe,setLabWhitePoint:q}),w.format.lab=ke,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"lab"),S(e)==="array"&&e.length===3)return"lab"}}),u.prototype.darken=function(e=1){const t=this,n=t.lab();return n[0]-=U.Kn*e,new u(n,"lab").alpha(t.alpha(),!0)},u.prototype.brighten=function(e=1){return this.darken(-e)},u.prototype.darker=u.prototype.darken,u.prototype.brighter=u.prototype.brighten,u.prototype.get=function(e){const[t,n]=e.split("."),o=this[t]();if(n){const r=t.indexOf(n)-(t.substr(0,2)==="ok"?2:0);if(r>-1)return o[r];throw new Error(`unknown channel ${n} in mode ${t}`)}else return o};const{pow:Vt}=Math,Jt=1e-7,Qt=20;u.prototype.luminance=function(e,t="rgb"){if(e!==void 0&&S(e)==="number"){if(e===0)return new u([0,0,0,this._rgb[3]],"rgb");if(e===1)return new u([255,255,255,this._rgb[3]],"rgb");let n=this.luminance(),o=Qt;const r=(i,l)=>{const c=i.interpolate(l,.5,t),f=c.luminance();return Math.abs(e-f)<Jt||!o--?c:f>e?r(i,c):r(c,l)},a=(n>e?r(new u([0,0,0]),this):r(this,new u([255,255,255]))).rgb();return new u([...a,this._rgb[3]])}return en(...this._rgb.slice(0,3))};const en=(e,t,n)=>(e=Ae(e),t=Ae(t),n=Ae(n),.2126*e+.7152*t+.0722*n),Ae=e=>(e/=255,e<=.03928?e/12.92:Vt((e+.055)/1.055,2.4));var B={},ne=(e,t,n=.5,...o)=>{let r=o[0]||"lrgb";if(!B[r]&&!o.length&&(r=Object.keys(B)[0]),!B[r])throw new Error(`interpolation mode ${r} is not defined`);return S(e)!=="object"&&(e=new u(e)),S(t)!=="object"&&(t=new u(t)),B[r](e,t,n).alpha(e.alpha()+n*(t.alpha()-e.alpha()))};u.prototype.mix=u.prototype.interpolate=function(e,t=.5,...n){return ne(this,e,t,...n)},u.prototype.premultiply=function(e=!1){const t=this._rgb,n=t[3];return e?(this._rgb=[t[0]*n,t[1]*n,t[2]*n,n],this):new u([t[0]*n,t[1]*n,t[2]*n,n],"rgb")};const{sin:tn,cos:nn}=Math,et=(...e)=>{let[t,n,o]=_(e,"lch");return isNaN(o)&&(o=0),o=o*Xt,[t,nn(o)*n,tn(o)*n]},Ee=(...e)=>{e=_(e,"lch");const[t,n,o]=e,[r,a,i]=et(t,n,o),[l,c,f]=ke(r,a,i);return[l,c,f,e.length>3?e[3]:1]},on=(...e)=>{const t=We(_(e,"hcl"));return Ee(...t)},{sqrt:rn,atan2:an,round:ln}=Math,tt=(...e)=>{const[t,n,o]=_(e,"lab"),r=rn(n*n+o*o);let a=(an(o,n)*Yt+360)%360;return ln(r*1e4)===0&&(a=Number.NaN),[t,r,a]},Re=(...e)=>{const[t,n,o,...r]=_(e,"rgb"),[a,i,l]=Se(t,n,o),[c,f,h]=tt(a,i,l);return[c,f,h,...r.length>0&&r[0]<1?[r[0]]:[]]};u.prototype.lch=function(){return Re(this._rgb)},u.prototype.hcl=function(){return We(Re(this._rgb))},Object.assign(k,{lch:(...e)=>new u(...e,"lch"),hcl:(...e)=>new u(...e,"hcl")}),w.format.lch=Ee,w.format.hcl=on,["lch","hcl"].forEach(e=>w.autodetect.push({p:2,test:(...t)=>{if(t=_(t,e),S(t)==="array"&&t.length===3)return e}})),u.prototype.saturate=function(e=1){const t=this,n=t.lch();return n[1]+=U.Kn*e,n[1]<0&&(n[1]=0),new u(n,"lch").alpha(t.alpha(),!0)},u.prototype.desaturate=function(e=1){return this.saturate(-e)},u.prototype.set=function(e,t,n=!1){const[o,r]=e.split("."),a=this[o]();if(r){const i=o.indexOf(r)-(o.substr(0,2)==="ok"?2:0);if(i>-1){if(S(t)=="string")switch(t.charAt(0)){case"+":a[i]+=+t;break;case"-":a[i]+=+t;break;case"*":a[i]*=+t.substr(1);break;case"/":a[i]/=+t.substr(1);break;default:a[i]=+t}else if(S(t)==="number")a[i]=t;else throw new Error("unsupported value for Color.set");const l=new u(a,o);return n?(this._rgb=l._rgb,this):l}throw new Error(`unknown channel ${r} in mode ${o}`)}else return a},u.prototype.tint=function(e=.5,...t){return ne(this,"white",e,...t)},u.prototype.shade=function(e=.5,...t){return ne(this,"black",e,...t)};const cn=(e,t,n)=>{const o=e._rgb,r=t._rgb;return new u(o[0]+n*(r[0]-o[0]),o[1]+n*(r[1]-o[1]),o[2]+n*(r[2]-o[2]),"rgb")};B.rgb=cn;const{sqrt:Le,pow:oe}=Math,fn=(e,t,n)=>{const[o,r,a]=e._rgb,[i,l,c]=t._rgb;return new u(Le(oe(o,2)*(1-n)+oe(i,2)*n),Le(oe(r,2)*(1-n)+oe(l,2)*n),Le(oe(a,2)*(1-n)+oe(c,2)*n),"rgb")};B.lrgb=fn;const sn=(e,t,n)=>{const o=e.lab(),r=t.lab();return new u(o[0]+n*(r[0]-o[0]),o[1]+n*(r[1]-o[1]),o[2]+n*(r[2]-o[2]),"lab")};B.lab=sn;var re=(e,t,n,o)=>{let r,a;o==="hsl"?(r=e.hsl(),a=t.hsl()):o==="hsv"?(r=e.hsv(),a=t.hsv()):o==="hcg"?(r=e.hcg(),a=t.hcg()):o==="hsi"?(r=e.hsi(),a=t.hsi()):o==="lch"||o==="hcl"?(o="hcl",r=e.hcl(),a=t.hcl()):o==="oklch"&&(r=e.oklch().reverse(),a=t.oklch().reverse());let i,l,c,f,h,p;(o.substr(0,1)==="h"||o==="oklch")&&([i,c,h]=r,[l,f,p]=a);let d,g,y,z;return!isNaN(i)&&!isNaN(l)?(l>i&&l-i>180?z=l-(i+360):l<i&&i-l>180?z=l+360-i:z=l-i,g=i+n*z):isNaN(i)?isNaN(l)?g=Number.NaN:(g=l,(h==1||h==0)&&o!="hsv"&&(d=f)):(g=i,(p==1||p==0)&&o!="hsv"&&(d=c)),d===void 0&&(d=c+n*(f-c)),y=h+n*(p-h),o==="oklch"?new u([y,d,g],o):new u([g,d,y],o)};const nt=(e,t,n)=>re(e,t,n,"lch");B.lch=nt,B.hcl=nt;const un=e=>{if(S(e)=="number"&&e>=0&&e<=16777215){const t=e>>16,n=e>>8&255,o=e&255;return[t,n,o,1]}throw new Error("unknown num color: "+e)},hn=(...e)=>{const[t,n,o]=_(e,"rgb");return(t<<16)+(n<<8)+o};u.prototype.num=function(){return hn(this._rgb)},Object.assign(k,{num:(...e)=>new u(...e,"num")}),w.format.num=un,w.autodetect.push({p:5,test:(...e)=>{if(e.length===1&&S(e[0])==="number"&&e[0]>=0&&e[0]<=16777215)return"num"}});const dn=(e,t,n)=>{const o=e.num(),r=t.num();return new u(o+n*(r-o),"num")};B.num=dn;const{floor:pn}=Math,bn=(...e)=>{e=_(e,"hcg");let[t,n,o]=e,r,a,i;o=o*255;const l=n*255;if(n===0)r=a=i=o;else{t===360&&(t=0),t>360&&(t-=360),t<0&&(t+=360),t/=60;const c=pn(t),f=t-c,h=o*(1-n),p=h+l*(1-f),d=h+l*f,g=h+l;switch(c){case 0:[r,a,i]=[g,d,h];break;case 1:[r,a,i]=[p,g,h];break;case 2:[r,a,i]=[h,g,d];break;case 3:[r,a,i]=[h,p,g];break;case 4:[r,a,i]=[d,h,g];break;case 5:[r,a,i]=[g,h,p];break}}return[r,a,i,e.length>3?e[3]:1]},gn=(...e)=>{const[t,n,o]=_(e,"rgb"),r=qe(t,n,o),a=Ze(t,n,o),i=a-r,l=i*100/255,c=r/(255-i)*100;let f;return i===0?f=Number.NaN:(t===a&&(f=(n-o)/i),n===a&&(f=2+(o-t)/i),o===a&&(f=4+(t-n)/i),f*=60,f<0&&(f+=360)),[f,l,c]};u.prototype.hcg=function(){return gn(this._rgb)};const mn=(...e)=>new u(...e,"hcg");k.hcg=mn,w.format.hcg=bn,w.autodetect.push({p:1,test:(...e)=>{if(e=_(e,"hcg"),S(e)==="array"&&e.length===3)return"hcg"}});const vn=(e,t,n)=>re(e,t,n,"hcg");B.hcg=vn;const{cos:ae}=Math,xn=(...e)=>{e=_(e,"hsi");let[t,n,o]=e,r,a,i;return isNaN(t)&&(t=0),isNaN(n)&&(n=0),t>360&&(t-=360),t<0&&(t+=360),t/=360,t<1/3?(i=(1-n)/3,r=(1+n*ae(F*t)/ae(Ce-F*t))/3,a=1-(i+r)):t<2/3?(t-=1/3,r=(1-n)/3,a=(1+n*ae(F*t)/ae(Ce-F*t))/3,i=1-(r+a)):(t-=2/3,a=(1-n)/3,i=(1+n*ae(F*t)/ae(Ce-F*t))/3,r=1-(a+i)),r=J(o*r*3),a=J(o*a*3),i=J(o*i*3),[r*255,a*255,i*255,e.length>3?e[3]:1]},{min:yn,sqrt:Mn,acos:wn}=Math,_n=(...e)=>{let[t,n,o]=_(e,"rgb");t/=255,n/=255,o/=255;let r;const a=yn(t,n,o),i=(t+n+o)/3,l=i>0?1-a/i:0;return l===0?r=NaN:(r=(t-n+(t-o))/2,r/=Mn((t-n)*(t-n)+(t-o)*(n-o)),r=wn(r),o>n&&(r=F-r),r/=F),[r*360,l,i]};u.prototype.hsi=function(){return _n(this._rgb)};const Cn=(...e)=>new u(...e,"hsi");k.hsi=Cn,w.format.hsi=xn,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"hsi"),S(e)==="array"&&e.length===3)return"hsi"}});const kn=(e,t,n)=>re(e,t,n,"hsi");B.hsi=kn;const $e=(...e)=>{e=_(e,"hsl");const[t,n,o]=e;let r,a,i;if(n===0)r=a=i=o*255;else{const l=[0,0,0],c=[0,0,0],f=o<.5?o*(1+n):o+n-o*n,h=2*o-f,p=t/360;l[0]=p+1/3,l[1]=p,l[2]=p-1/3;for(let d=0;d<3;d++)l[d]<0&&(l[d]+=1),l[d]>1&&(l[d]-=1),6*l[d]<1?c[d]=h+(f-h)*6*l[d]:2*l[d]<1?c[d]=f:3*l[d]<2?c[d]=h+(f-h)*(2/3-l[d])*6:c[d]=h;[r,a,i]=[c[0]*255,c[1]*255,c[2]*255]}return e.length>3?[r,a,i,e[3]]:[r,a,i,1]},ot=(...e)=>{e=_(e,"rgba");let[t,n,o]=e;t/=255,n/=255,o/=255;const r=qe(t,n,o),a=Ze(t,n,o),i=(a+r)/2;let l,c;return a===r?(l=0,c=Number.NaN):l=i<.5?(a-r)/(a+r):(a-r)/(2-a-r),t==a?c=(n-o)/(a-r):n==a?c=2+(o-t)/(a-r):o==a&&(c=4+(t-n)/(a-r)),c*=60,c<0&&(c+=360),e.length>3&&e[3]!==void 0?[c,l,i,e[3]]:[c,l,i]};u.prototype.hsl=function(){return ot(this._rgb)};const zn=(...e)=>new u(...e,"hsl");k.hsl=zn,w.format.hsl=$e,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"hsl"),S(e)==="array"&&e.length===3)return"hsl"}});const Sn=(e,t,n)=>re(e,t,n,"hsl");B.hsl=Sn;const{floor:Tn}=Math,An=(...e)=>{e=_(e,"hsv");let[t,n,o]=e,r,a,i;if(o*=255,n===0)r=a=i=o;else{t===360&&(t=0),t>360&&(t-=360),t<0&&(t+=360),t/=60;const l=Tn(t),c=t-l,f=o*(1-n),h=o*(1-n*c),p=o*(1-n*(1-c));switch(l){case 0:[r,a,i]=[o,p,f];break;case 1:[r,a,i]=[h,o,f];break;case 2:[r,a,i]=[f,o,p];break;case 3:[r,a,i]=[f,h,o];break;case 4:[r,a,i]=[p,f,o];break;case 5:[r,a,i]=[o,f,h];break}}return[r,a,i,e.length>3?e[3]:1]},{min:En,max:Rn}=Math,Ln=(...e)=>{e=_(e,"rgb");let[t,n,o]=e;const r=En(t,n,o),a=Rn(t,n,o),i=a-r;let l,c,f;return f=a/255,a===0?(l=Number.NaN,c=0):(c=i/a,t===a&&(l=(n-o)/i),n===a&&(l=2+(o-t)/i),o===a&&(l=4+(t-n)/i),l*=60,l<0&&(l+=360)),[l,c,f]};u.prototype.hsv=function(){return Ln(this._rgb)};const $n=(...e)=>new u(...e,"hsv");k.hsv=$n,w.format.hsv=An,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"hsv"),S(e)==="array"&&e.length===3)return"hsv"}});const Nn=(e,t,n)=>re(e,t,n,"hsv");B.hsv=Nn;function de(e,t){let n=e.length;Array.isArray(e[0])||(e=[e]),Array.isArray(t[0])||(t=t.map(i=>[i]));let o=t[0].length,r=t[0].map((i,l)=>t.map(c=>c[l])),a=e.map(i=>r.map(l=>Array.isArray(i)?i.reduce((c,f,h)=>c+f*(l[h]||0),0):l.reduce((c,f)=>c+f*i,0)));return n===1&&(a=a[0]),o===1?a.map(i=>i[0]):a}const Ne=(...e)=>{e=_(e,"lab");const[t,n,o,...r]=e,[a,i,l]=Pn([t,n,o]),[c,f,h]=Je(a,i,l);return[c,f,h,...r.length>0&&r[0]<1?[r[0]]:[]]};function Pn(e){var t=[[1.2268798758459243,-.5578149944602171,.2813910456659647],[-.0405757452148008,1.112286803280317,-.0717110580655164],[-.0763729366746601,-.4214933324022432,1.5869240198367816]],n=[[1,.3963377773761749,.2158037573099136],[1,-.1055613458156586,-.0638541728258133],[1,-.0894841775298119,-1.2914855480194092]],o=de(n,e);return de(t,o.map(r=>r**3))}const Pe=(...e)=>{const[t,n,o,...r]=_(e,"rgb"),a=Qe(t,n,o);return[...Dn(a),...r.length>0&&r[0]<1?[r[0]]:[]]};function Dn(e){const t=[[.819022437996703,.3619062600528904,-.1288737815209879],[.0329836539323885,.9292868615863434,.0361446663506424],[.0481771893596242,.2642395317527308,.6335478284694309]],n=[[.210454268309314,.7936177747023054,-.0040720430116193],[1.9779985324311684,-2.42859224204858,.450593709617411],[.0259040424655478,.7827717124575296,-.8086757549230774]],o=de(t,e);return de(n,o.map(r=>Math.cbrt(r)))}u.prototype.oklab=function(){return Pe(this._rgb)},Object.assign(k,{oklab:(...e)=>new u(...e,"oklab")}),w.format.oklab=Ne,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"oklab"),S(e)==="array"&&e.length===3)return"oklab"}});const Hn=(e,t,n)=>{const o=e.oklab(),r=t.oklab();return new u(o[0]+n*(r[0]-o[0]),o[1]+n*(r[1]-o[1]),o[2]+n*(r[2]-o[2]),"oklab")};B.oklab=Hn;const Bn=(e,t,n)=>re(e,t,n,"oklch");B.oklch=Bn;const{pow:De,sqrt:He,PI:Be,cos:rt,sin:at,atan2:Gn}=Math;var In=(e,t="lrgb",n=null)=>{const o=e.length;n||(n=Array.from(new Array(o)).map(()=>1));const r=o/n.reduce(function(p,d){return p+d});if(n.forEach((p,d)=>{n[d]*=r}),e=e.map(p=>new u(p)),t==="lrgb")return On(e,n);const a=e.shift(),i=a.get(t),l=[];let c=0,f=0;for(let p=0;p<i.length;p++)if(i[p]=(i[p]||0)*n[0],l.push(isNaN(i[p])?0:n[0]),t.charAt(p)==="h"&&!isNaN(i[p])){const d=i[p]/180*Be;c+=rt(d)*n[0],f+=at(d)*n[0]}let h=a.alpha()*n[0];e.forEach((p,d)=>{const g=p.get(t);h+=p.alpha()*n[d+1];for(let y=0;y<i.length;y++)if(!isNaN(g[y]))if(l[y]+=n[d+1],t.charAt(y)==="h"){const z=g[y]/180*Be;c+=rt(z)*n[d+1],f+=at(z)*n[d+1]}else i[y]+=g[y]*n[d+1]});for(let p=0;p<i.length;p++)if(t.charAt(p)==="h"){let d=Gn(f/l[p],c/l[p])/Be*180;for(;d<0;)d+=360;for(;d>=360;)d-=360;i[p]=d}else i[p]=i[p]/l[p];return h/=o,new u(i,t).alpha(h>.99999?1:h,!0)};const On=(e,t)=>{const n=e.length,o=[0,0,0,0];for(let r=0;r<e.length;r++){const a=e[r],i=t[r]/n,l=a._rgb;o[0]+=De(l[0],2)*i,o[1]+=De(l[1],2)*i,o[2]+=De(l[2],2)*i,o[3]+=l[3]*i}return o[0]=He(o[0]),o[1]=He(o[1]),o[2]=He(o[2]),o[3]>.9999999&&(o[3]=1),new u(we(o))},{pow:jn}=Math;function pe(e){let t="rgb",n=k("#ccc"),o=0,r=[0,1],a=[],i=[0,0],l=!1,c=[],f=!1,h=0,p=1,d=!1,g={},y=!0,z=1;const v=function(s){if(s=s||["#fff","#000"],s&&S(s)==="string"&&k.brewer&&k.brewer[s.toLowerCase()]&&(s=k.brewer[s.toLowerCase()]),S(s)==="array"){s.length===1&&(s=[s[0],s[0]]),s=s.slice(0);for(let m=0;m<s.length;m++)s[m]=k(s[m]);a.length=0;for(let m=0;m<s.length;m++)a.push(m/(s.length-1))}return P(),c=s},b=function(s){if(l!=null){const m=l.length-1;let M=0;for(;M<m&&s>=l[M];)M++;return M-1}return 0};let $=s=>s,L=s=>s;const R=function(s,m){let M,x;if(m==null&&(m=!1),isNaN(s)||s===null)return n;m?x=s:l&&l.length>2?x=b(s)/(l.length-2):p!==h?x=(s-h)/(p-h):x=1,x=L(x),m||(x=$(x)),z!==1&&(x=jn(x,z)),x=i[0]+x*(1-i[0]-i[1]),x=J(x,0,1);const E=Math.floor(x*1e4);if(y&&g[E])M=g[E];else{if(S(c)==="array")for(let A=0;A<a.length;A++){const N=a[A];if(x<=N){M=c[A];break}if(x>=N&&A===a.length-1){M=c[A];break}if(x>N&&x<a[A+1]){x=(x-N)/(a[A+1]-N),M=k.interpolate(c[A],c[A+1],x,t);break}}else S(c)==="function"&&(M=c(x));y&&(g[E]=M)}return M};var P=()=>g={};v(e);const C=function(s){const m=k(R(s));return f&&m[f]?m[f]():m};return C.classes=function(s){if(s!=null){if(S(s)==="array")l=s,r=[s[0],s[s.length-1]];else{const m=k.analyze(r);s===0?l=[m.min,m.max]:l=k.limits(m,"e",s)}return C}return l},C.domain=function(s){if(!arguments.length)return r;h=s[0],p=s[s.length-1],a=[];const m=c.length;if(s.length===m&&h!==p)for(let M of Array.from(s))a.push((M-h)/(p-h));else{for(let M=0;M<m;M++)a.push(M/(m-1));if(s.length>2){const M=s.map((E,A)=>A/(s.length-1)),x=s.map(E=>(E-h)/(p-h));x.every((E,A)=>M[A]===E)||(L=E=>{if(E<=0||E>=1)return E;let A=0;for(;E>=x[A+1];)A++;const N=(E-x[A])/(x[A+1]-x[A]);return M[A]+N*(M[A+1]-M[A])})}}return r=[h,p],C},C.mode=function(s){return arguments.length?(t=s,P(),C):t},C.range=function(s,m){return v(s),C},C.out=function(s){return f=s,C},C.spread=function(s){return arguments.length?(o=s,C):o},C.correctLightness=function(s){return s==null&&(s=!0),d=s,P(),d?$=function(m){const M=R(0,!0).lab()[0],x=R(1,!0).lab()[0],E=M>x;let A=R(m,!0).lab()[0];const N=M+(x-M)*m;let Q=A-N,se=0,ye=1,Me=20;for(;Math.abs(Q)>.01&&Me-- >0;)(function(){return E&&(Q*=-1),Q<0?(se=m,m+=(ye-m)*.5):(ye=m,m+=(se-m)*.5),A=R(m,!0).lab()[0],Q=A-N})();return m}:$=m=>m,C},C.padding=function(s){return s!=null?(S(s)==="number"&&(s=[s,s]),i=s,C):i},C.colors=function(s,m){arguments.length<2&&(m="hex");let M=[];if(arguments.length===0)M=c.slice(0);else if(s===1)M=[C(.5)];else if(s>1){const x=r[0],E=r[1]-x;M=Xn(0,s).map(A=>C(x+A/(s-1)*E))}else{e=[];let x=[];if(l&&l.length>2)for(let E=1,A=l.length,N=1<=A;N?E<A:E>A;N?E++:E--)x.push((l[E-1]+l[E])*.5);else x=r;M=x.map(E=>C(E))}return k[m]&&(M=M.map(x=>x[m]())),M},C.cache=function(s){return s!=null?(y=s,C):y},C.gamma=function(s){return s!=null?(z=s,C):z},C.nodata=function(s){return s!=null?(n=k(s),C):n},C}function Xn(e,t,n){let o=[],r=e<t,a=t;for(let i=e;r?i<a:i>a;r?i++:i--)o.push(i);return o}const Yn=function(e){let t=[1,1];for(let n=1;n<e;n++){let o=[1];for(let r=1;r<=t.length;r++)o[r]=(t[r]||0)+t[r-1];t=o}return t},Un=function(e){let t,n,o,r;if(e=e.map(a=>new u(a)),e.length===2)[n,o]=e.map(a=>a.lab()),t=function(a){const i=[0,1,2].map(l=>n[l]+a*(o[l]-n[l]));return new u(i,"lab")};else if(e.length===3)[n,o,r]=e.map(a=>a.lab()),t=function(a){const i=[0,1,2].map(l=>(1-a)*(1-a)*n[l]+2*(1-a)*a*o[l]+a*a*r[l]);return new u(i,"lab")};else if(e.length===4){let a;[n,o,r,a]=e.map(i=>i.lab()),t=function(i){const l=[0,1,2].map(c=>(1-i)*(1-i)*(1-i)*n[c]+3*(1-i)*(1-i)*i*o[c]+3*(1-i)*i*i*r[c]+i*i*i*a[c]);return new u(l,"lab")}}else if(e.length>=5){let a,i,l;a=e.map(c=>c.lab()),l=e.length-1,i=Yn(l),t=function(c){const f=1-c,h=[0,1,2].map(p=>a.reduce((d,g,y)=>d+i[y]*f**(l-y)*c**y*g[p],0));return new u(h,"lab")}}else throw new RangeError("No point in running bezier with only one color.");return t};var Fn=e=>{const t=Un(e);return t.scale=()=>pe(t),t};const{round:it}=Math;u.prototype.rgb=function(e=!0){return e===!1?this._rgb.slice(0,3):this._rgb.slice(0,3).map(it)},u.prototype.rgba=function(e=!0){return this._rgb.slice(0,4).map((t,n)=>n<3?e===!1?t:it(t):t)},Object.assign(k,{rgb:(...e)=>new u(...e,"rgb")}),w.format.rgb=(...e)=>{const t=_(e,"rgba");return t[3]===void 0&&(t[3]=1),t},w.autodetect.push({p:3,test:(...e)=>{if(e=_(e,"rgba"),S(e)==="array"&&(e.length===3||e.length===4&&S(e[3])=="number"&&e[3]>=0&&e[3]<=1))return"rgb"}});const X=(e,t,n)=>{if(!X[n])throw new Error("unknown blend mode "+n);return X[n](e,t)},K=e=>(t,n)=>{const o=k(n).rgb(),r=k(t).rgb();return k.rgb(e(o,r))},V=e=>(t,n)=>{const o=[];return o[0]=e(t[0],n[0]),o[1]=e(t[1],n[1]),o[2]=e(t[2],n[2]),o},qn=e=>e,Zn=(e,t)=>e*t/255,Wn=(e,t)=>e>t?t:e,Kn=(e,t)=>e>t?e:t,Vn=(e,t)=>255*(1-(1-e/255)*(1-t/255)),Jn=(e,t)=>t<128?2*e*t/255:255*(1-2*(1-e/255)*(1-t/255)),Qn=(e,t)=>255*(1-(1-t/255)/(e/255)),eo=(e,t)=>e===255?255:(e=255*(t/255)/(1-e/255),e>255?255:e);X.normal=K(V(qn)),X.multiply=K(V(Zn)),X.screen=K(V(Vn)),X.overlay=K(V(Jn)),X.darken=K(V(Wn)),X.lighten=K(V(Kn)),X.dodge=K(V(eo)),X.burn=K(V(Qn));const{pow:to,sin:no,cos:oo}=Math;function ro(e=300,t=-1.5,n=1,o=1,r=[0,1]){let a=0,i;S(r)==="array"?i=r[1]-r[0]:(i=0,r=[r,r]);const l=function(c){const f=F*((e+120)/360+t*c),h=to(r[0]+i*c,o),d=(a!==0?n[0]+c*a:n)*h*(1-h)/2,g=oo(f),y=no(f),z=h+d*(-.14861*g+1.78277*y),v=h+d*(-.29227*g-.90649*y),b=h+d*(1.97294*g);return k(we([z*255,v*255,b*255,1]))};return l.start=function(c){return c==null?e:(e=c,l)},l.rotations=function(c){return c==null?t:(t=c,l)},l.gamma=function(c){return c==null?o:(o=c,l)},l.hue=function(c){return c==null?n:(n=c,S(n)==="array"?(a=n[1]-n[0],a===0&&(n=n[1])):a=0,l)},l.lightness=function(c){return c==null?r:(S(c)==="array"?(r=c,i=c[1]-c[0]):(r=[c,c],i=0),l)},l.scale=()=>k.scale(l),l.hue(n),l}const ao="0123456789abcdef",{floor:io,random:lo}=Math;var co=()=>{let e="#";for(let t=0;t<6;t++)e+=ao.charAt(io(lo()*16));return new u(e,"hex")};const{log:lt,pow:fo,floor:so,abs:uo}=Math;function ct(e,t=null){const n={min:Number.MAX_VALUE,max:Number.MAX_VALUE*-1,sum:0,values:[],count:0};return S(e)==="object"&&(e=Object.values(e)),e.forEach(o=>{t&&S(o)==="object"&&(o=o[t]),o!=null&&!isNaN(o)&&(n.values.push(o),n.sum+=o,o<n.min&&(n.min=o),o>n.max&&(n.max=o),n.count+=1)}),n.domain=[n.min,n.max],n.limits=(o,r)=>ft(n,o,r),n}function ft(e,t="equal",n=7){S(e)=="array"&&(e=ct(e));const{min:o,max:r}=e,a=e.values.sort((l,c)=>l-c);if(n===1)return[o,r];const i=[];if(t.substr(0,1)==="c"&&(i.push(o),i.push(r)),t.substr(0,1)==="e"){i.push(o);for(let l=1;l<n;l++)i.push(o+l/n*(r-o));i.push(r)}else if(t.substr(0,1)==="l"){if(o<=0)throw new Error("Logarithmic scales are only possible for values > 0");const l=Math.LOG10E*lt(o),c=Math.LOG10E*lt(r);i.push(o);for(let f=1;f<n;f++)i.push(fo(10,l+f/n*(c-l)));i.push(r)}else if(t.substr(0,1)==="q"){i.push(o);for(let l=1;l<n;l++){const c=(a.length-1)*l/n,f=so(c);if(f===c)i.push(a[f]);else{const h=c-f;i.push(a[f]*(1-h)+a[f+1]*h)}}i.push(r)}else if(t.substr(0,1)==="k"){let l;const c=a.length,f=new Array(c),h=new Array(n);let p=!0,d=0,g=null;g=[],g.push(o);for(let v=1;v<n;v++)g.push(o+v/n*(r-o));for(g.push(r);p;){for(let b=0;b<n;b++)h[b]=0;for(let b=0;b<c;b++){const $=a[b];let L=Number.MAX_VALUE,R;for(let P=0;P<n;P++){const C=uo(g[P]-$);C<L&&(L=C,R=P),h[R]++,f[b]=R}}const v=new Array(n);for(let b=0;b<n;b++)v[b]=null;for(let b=0;b<c;b++)l=f[b],v[l]===null?v[l]=a[b]:v[l]+=a[b];for(let b=0;b<n;b++)v[b]*=1/h[b];p=!1;for(let b=0;b<n;b++)if(v[b]!==g[b]){p=!0;break}g=v,d++,d>200&&(p=!1)}const y={};for(let v=0;v<n;v++)y[v]=[];for(let v=0;v<c;v++)l=f[v],y[l].push(a[v]);let z=[];for(let v=0;v<n;v++)z.push(y[v][0]),z.push(y[v][y[v].length-1]);z=z.sort((v,b)=>v-b),i.push(z[0]);for(let v=1;v<z.length;v+=2){const b=z[v];!isNaN(b)&&i.indexOf(b)===-1&&i.push(b)}}return i}var ho=(e,t)=>{e=new u(e),t=new u(t);const n=e.luminance(),o=t.luminance();return n>o?(n+.05)/(o+.05):(o+.05)/(n+.05)};/**
 * @license
 *
 * The APCA contrast prediction algorithm is based of the formulas published
 * in the APCA-1.0.98G specification by Myndex. The specification is available at:
 * https://raw.githubusercontent.com/Myndex/apca-w3/master/images/APCAw3_0.1.17_APCA0.0.98G.svg
 *
 * Note that the APCA implementation is still beta, so please update to
 * future versions of chroma.js when they become available.
 *
 * You can read more about the APCA Readability Criterion at
 * https://readtech.org/ARC/
 */const st=.027,po=5e-4,bo=.1,ut=1.14,be=.022,ht=1.414;var go=(e,t)=>{e=new u(e),t=new u(t),e.alpha()<1&&(e=ne(t,e,e.alpha(),"rgb"));const n=dt(...e.rgb()),o=dt(...t.rgb()),r=n>=be?n:n+Math.pow(be-n,ht),a=o>=be?o:o+Math.pow(be-o,ht),i=Math.pow(a,.56)-Math.pow(r,.57),l=Math.pow(a,.65)-Math.pow(r,.62),c=Math.abs(a-r)<po?0:r<a?i*ut:l*ut;return(Math.abs(c)<bo?0:c>0?c-st:c+st)*100};function dt(e,t,n){return .2126729*Math.pow(e/255,2.4)+.7151522*Math.pow(t/255,2.4)+.072175*Math.pow(n/255,2.4)}const{sqrt:Z,pow:D,min:mo,max:vo,atan2:pt,abs:bt,cos:ge,sin:gt,exp:xo,PI:mt}=Math;function yo(e,t,n=1,o=1,r=1){var a=function(Ue){return 360*Ue/(2*mt)},i=function(Ue){return 2*mt*Ue/360};e=new u(e),t=new u(t);const[l,c,f]=Array.from(e.lab()),[h,p,d]=Array.from(t.lab()),g=(l+h)/2,y=Z(D(c,2)+D(f,2)),z=Z(D(p,2)+D(d,2)),v=(y+z)/2,b=.5*(1-Z(D(v,7)/(D(v,7)+D(25,7)))),$=c*(1+b),L=p*(1+b),R=Z(D($,2)+D(f,2)),P=Z(D(L,2)+D(d,2)),C=(R+P)/2,s=a(pt(f,$)),m=a(pt(d,L)),M=s>=0?s:s+360,x=m>=0?m:m+360,E=bt(M-x)>180?(M+x+360)/2:(M+x)/2,A=1-.17*ge(i(E-30))+.24*ge(i(2*E))+.32*ge(i(3*E+6))-.2*ge(i(4*E-63));let N=x-M;N=bt(N)<=180?N:x<=M?N+360:N-360,N=2*Z(R*P)*gt(i(N)/2);const Q=h-l,se=P-R,ye=1+.015*D(g-50,2)/Z(20+D(g-50,2)),Me=1+.045*C,Bt=1+.015*C*A,jo=30*xo(-D((E-275)/25,2)),Xo=-(2*Z(D(C,7)/(D(C,7)+D(25,7))))*gt(2*i(jo)),Yo=Z(D(Q/(n*ye),2)+D(se/(o*Me),2)+D(N/(r*Bt),2)+Xo*(se/(o*Me))*(N/(r*Bt)));return vo(0,mo(100,Yo))}function Mo(e,t,n="lab"){e=new u(e),t=new u(t);const o=e.get(n),r=t.get(n);let a=0;for(let i in o){const l=(o[i]||0)-(r[i]||0);a+=l*l}return Math.sqrt(a)}var wo=(...e)=>{try{return new u(...e),!0}catch{return!1}},_o={cool(){return pe([k.hsl(180,1,.9),k.hsl(250,.7,.4)])},hot(){return pe(["#000","#f00","#ff0","#fff"]).mode("rgb")}};const Ge={OrRd:["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"],PuBu:["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"],BuPu:["#f7fcfd","#e0ecf4","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#810f7c","#4d004b"],Oranges:["#fff5eb","#fee6ce","#fdd0a2","#fdae6b","#fd8d3c","#f16913","#d94801","#a63603","#7f2704"],BuGn:["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"],YlOrBr:["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],YlGn:["#ffffe5","#f7fcb9","#d9f0a3","#addd8e","#78c679","#41ab5d","#238443","#006837","#004529"],Reds:["#fff5f0","#fee0d2","#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"],RdPu:["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"],Greens:["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"],YlGnBu:["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"],Purples:["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"],GnBu:["#f7fcf0","#e0f3db","#ccebc5","#a8ddb5","#7bccc4","#4eb3d3","#2b8cbe","#0868ac","#084081"],Greys:["#ffffff","#f0f0f0","#d9d9d9","#bdbdbd","#969696","#737373","#525252","#252525","#000000"],YlOrRd:["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"],PuRd:["#f7f4f9","#e7e1ef","#d4b9da","#c994c7","#df65b0","#e7298a","#ce1256","#980043","#67001f"],Blues:["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08519c","#08306b"],PuBuGn:["#fff7fb","#ece2f0","#d0d1e6","#a6bddb","#67a9cf","#3690c0","#02818a","#016c59","#014636"],Viridis:["#440154","#482777","#3f4a8a","#31678e","#26838f","#1f9d8a","#6cce5a","#b6de2b","#fee825"],Spectral:["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"],RdYlGn:["#a50026","#d73027","#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"],RdBu:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"],PiYG:["#8e0152","#c51b7d","#de77ae","#f1b6da","#fde0ef","#f7f7f7","#e6f5d0","#b8e186","#7fbc41","#4d9221","#276419"],PRGn:["#40004b","#762a83","#9970ab","#c2a5cf","#e7d4e8","#f7f7f7","#d9f0d3","#a6dba0","#5aae61","#1b7837","#00441b"],RdYlBu:["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"],BrBG:["#543005","#8c510a","#bf812d","#dfc27d","#f6e8c3","#f5f5f5","#c7eae5","#80cdc1","#35978f","#01665e","#003c30"],RdGy:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#ffffff","#e0e0e0","#bababa","#878787","#4d4d4d","#1a1a1a"],PuOr:["#7f3b08","#b35806","#e08214","#fdb863","#fee0b6","#f7f7f7","#d8daeb","#b2abd2","#8073ac","#542788","#2d004b"],Set2:["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"],Accent:["#7fc97f","#beaed4","#fdc086","#ffff99","#386cb0","#f0027f","#bf5b17","#666666"],Set1:["#e41a1c","#377eb8","#4daf4a","#984ea3","#ff7f00","#ffff33","#a65628","#f781bf","#999999"],Set3:["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"],Dark2:["#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#666666"],Paired:["#a6cee3","#1f78b4","#b2df8a","#33a02c","#fb9a99","#e31a1c","#fdbf6f","#ff7f00","#cab2d6","#6a3d9a","#ffff99","#b15928"],Pastel2:["#b3e2cd","#fdcdac","#cbd5e8","#f4cae4","#e6f5c9","#fff2ae","#f1e2cc","#cccccc"],Pastel1:["#fbb4ae","#b3cde3","#ccebc5","#decbe4","#fed9a6","#ffffcc","#e5d8bd","#fddaec","#f2f2f2"]},vt=Object.keys(Ge),xt=new Map(vt.map(e=>[e.toLowerCase(),e])),Co=typeof Proxy=="function"?new Proxy(Ge,{get(e,t){const n=t.toLowerCase();if(xt.has(n))return e[xt.get(n)]},getOwnPropertyNames(){return Object.getOwnPropertyNames(vt)}}):Ge,ko=(...e)=>{e=_(e,"cmyk");const[t,n,o,r]=e,a=e.length>4?e[4]:1;return r===1?[0,0,0,a]:[t>=1?0:255*(1-t)*(1-r),n>=1?0:255*(1-n)*(1-r),o>=1?0:255*(1-o)*(1-r),a]},{max:yt}=Math,zo=(...e)=>{let[t,n,o]=_(e,"rgb");t=t/255,n=n/255,o=o/255;const r=1-yt(t,yt(n,o)),a=r<1?1/(1-r):0,i=(1-t-r)*a,l=(1-n-r)*a,c=(1-o-r)*a;return[i,l,c,r]};u.prototype.cmyk=function(){return zo(this._rgb)},Object.assign(k,{cmyk:(...e)=>new u(...e,"cmyk")}),w.format.cmyk=ko,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"cmyk"),S(e)==="array"&&e.length===4)return"cmyk"}});const So=(...e)=>{const t=_(e,"hsla");let n=ee(e)||"lsa";return t[0]=O(t[0]||0)+"deg",t[1]=O(t[1]*100)+"%",t[2]=O(t[2]*100)+"%",n==="hsla"||t.length>3&&t[3]<1?(t[3]="/ "+(t.length>3?t[3]:1),n="hsla"):t.length=3,`${n.substr(0,3)}(${t.join(" ")})`},To=(...e)=>{const t=_(e,"lab");let n=ee(e)||"lab";return t[0]=O(t[0])+"%",t[1]=O(t[1]),t[2]=O(t[2]),n==="laba"||t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`lab(${t.join(" ")})`},Ao=(...e)=>{const t=_(e,"lch");let n=ee(e)||"lab";return t[0]=O(t[0])+"%",t[1]=O(t[1]),t[2]=isNaN(t[2])?"none":O(t[2])+"deg",n==="lcha"||t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`lch(${t.join(" ")})`},Eo=(...e)=>{const t=_(e,"lab");return t[0]=O(t[0]*100)+"%",t[1]=_e(t[1]),t[2]=_e(t[2]),t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`oklab(${t.join(" ")})`},Mt=(...e)=>{const[t,n,o,...r]=_(e,"rgb"),[a,i,l]=Pe(t,n,o),[c,f,h]=tt(a,i,l);return[c,f,h,...r.length>0&&r[0]<1?[r[0]]:[]]},Ro=(...e)=>{const t=_(e,"lch");return t[0]=O(t[0]*100)+"%",t[1]=_e(t[1]),t[2]=isNaN(t[2])?"none":O(t[2])+"deg",t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`oklch(${t.join(" ")})`},{round:Ie}=Math,Lo=(...e)=>{const t=_(e,"rgba");let n=ee(e)||"rgb";if(n.substr(0,3)==="hsl")return So(ot(t),n);if(n.substr(0,3)==="lab"){const o=fe();q("d50");const r=To(Se(t),n);return q(o),r}if(n.substr(0,3)==="lch"){const o=fe();q("d50");const r=Ao(Re(t),n);return q(o),r}return n.substr(0,5)==="oklab"?Eo(Pe(t)):n.substr(0,5)==="oklch"?Ro(Mt(t)):(t[0]=Ie(t[0]),t[1]=Ie(t[1]),t[2]=Ie(t[2]),(n==="rgba"||t.length>3&&t[3]<1)&&(t[3]="/ "+(t.length>3?t[3]:1),n="rgba"),`${n.substr(0,3)}(${t.slice(0,n==="rgb"?3:4).join(" ")})`)},wt=(...e)=>{e=_(e,"lch");const[t,n,o,...r]=e,[a,i,l]=et(t,n,o),[c,f,h]=Ne(a,i,l);return[c,f,h,...r.length>0&&r[0]<1?[r[0]]:[]]},W=/((?:-?\d+)|(?:-?\d+(?:\.\d+)?)%|none)/.source,Y=/((?:-?(?:\d+(?:\.\d*)?|\.\d+)%?)|none)/.source,me=/((?:-?(?:\d+(?:\.\d*)?|\.\d+)%)|none)/.source,j=/\s*/.source,ie=/\s+/.source,Oe=/\s*,\s*/.source,ve=/((?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:deg)?)|none)/.source,le=/\s*(?:\/\s*((?:[01]|[01]?\.\d+)|\d+(?:\.\d+)?%))?/.source,_t=new RegExp("^rgba?\\("+j+[W,W,W].join(ie)+le+"\\)$"),Ct=new RegExp("^rgb\\("+j+[W,W,W].join(Oe)+j+"\\)$"),kt=new RegExp("^rgba\\("+j+[W,W,W,Y].join(Oe)+j+"\\)$"),zt=new RegExp("^hsla?\\("+j+[ve,me,me].join(ie)+le+"\\)$"),St=new RegExp("^hsl?\\("+j+[ve,me,me].join(Oe)+j+"\\)$"),Tt=/^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/,At=new RegExp("^lab\\("+j+[Y,Y,Y].join(ie)+le+"\\)$"),Et=new RegExp("^lch\\("+j+[Y,Y,ve].join(ie)+le+"\\)$"),Rt=new RegExp("^oklab\\("+j+[Y,Y,Y].join(ie)+le+"\\)$"),Lt=new RegExp("^oklch\\("+j+[Y,Y,ve].join(ie)+le+"\\)$"),{round:$t}=Math,ce=e=>e.map((t,n)=>n<=2?J($t(t),0,255):t),H=(e,t=0,n=100,o=!1)=>(typeof e=="string"&&e.endsWith("%")&&(e=parseFloat(e.substring(0,e.length-1))/100,o?e=t+(e+1)*.5*(n-t):e=t+e*(n-t)),+e),G=(e,t)=>e==="none"?t:e,je=e=>{if(e=e.toLowerCase().trim(),e==="transparent")return[0,0,0,0];let t;if(w.format.named)try{return w.format.named(e)}catch{}if((t=e.match(_t))||(t=e.match(Ct))){let n=t.slice(1,4);for(let r=0;r<3;r++)n[r]=+H(G(n[r],0),0,255);n=ce(n);const o=t[4]!==void 0?+H(t[4],0,1):1;return n[3]=o,n}if(t=e.match(kt)){const n=t.slice(1,5);for(let o=0;o<4;o++)n[o]=+H(n[o],0,255);return n}if((t=e.match(zt))||(t=e.match(St))){const n=t.slice(1,4);n[0]=+G(n[0].replace("deg",""),0),n[1]=+H(G(n[1],0),0,100)*.01,n[2]=+H(G(n[2],0),0,100)*.01;const o=ce($e(n)),r=t[4]!==void 0?+H(t[4],0,1):1;return o[3]=r,o}if(t=e.match(Tt)){const n=t.slice(1,4);n[1]*=.01,n[2]*=.01;const o=$e(n);for(let r=0;r<3;r++)o[r]=$t(o[r]);return o[3]=+t[4],o}if(t=e.match(At)){const n=t.slice(1,4);n[0]=H(G(n[0],0),0,100),n[1]=H(G(n[1],0),-125,125,!0),n[2]=H(G(n[2],0),-125,125,!0);const o=fe();q("d50");const r=ce(ke(n));q(o);const a=t[4]!==void 0?+H(t[4],0,1):1;return r[3]=a,r}if(t=e.match(Et)){const n=t.slice(1,4);n[0]=H(n[0],0,100),n[1]=H(G(n[1],0),0,150,!1),n[2]=+G(n[2].replace("deg",""),0);const o=fe();q("d50");const r=ce(Ee(n));q(o);const a=t[4]!==void 0?+H(t[4],0,1):1;return r[3]=a,r}if(t=e.match(Rt)){const n=t.slice(1,4);n[0]=H(G(n[0],0),0,1),n[1]=H(G(n[1],0),-.4,.4,!0),n[2]=H(G(n[2],0),-.4,.4,!0);const o=ce(Ne(n)),r=t[4]!==void 0?+H(t[4],0,1):1;return o[3]=r,o}if(t=e.match(Lt)){const n=t.slice(1,4);n[0]=H(G(n[0],0),0,1),n[1]=H(G(n[1],0),0,.4,!1),n[2]=+G(n[2].replace("deg",""),0);const o=ce(wt(n)),r=t[4]!==void 0?+H(t[4],0,1):1;return o[3]=r,o}};je.test=e=>_t.test(e)||zt.test(e)||At.test(e)||Et.test(e)||Rt.test(e)||Lt.test(e)||Ct.test(e)||kt.test(e)||St.test(e)||Tt.test(e)||e==="transparent",u.prototype.css=function(e){return Lo(this._rgb,e)};const $o=(...e)=>new u(...e,"css");k.css=$o,w.format.css=je,w.autodetect.push({p:5,test:(e,...t)=>{if(!t.length&&S(e)==="string"&&je.test(e))return"css"}}),w.format.gl=(...e)=>{const t=_(e,"rgba");return t[0]*=255,t[1]*=255,t[2]*=255,t};const No=(...e)=>new u(...e,"gl");k.gl=No,u.prototype.gl=function(){const e=this._rgb;return[e[0]/255,e[1]/255,e[2]/255,e[3]]},u.prototype.hex=function(e){return Ve(this._rgb,e)};const Po=(...e)=>new u(...e,"hex");k.hex=Po,w.format.hex=Ke,w.autodetect.push({p:4,test:(e,...t)=>{if(!t.length&&S(e)==="string"&&[3,4,5,6,7,8,9].indexOf(e.length)>=0)return"hex"}});const{log:xe}=Math,Nt=e=>{const t=e/100;let n,o,r;return t<66?(n=255,o=t<6?0:-155.25485562709179-.44596950469579133*(o=t-2)+104.49216199393888*xe(o),r=t<20?0:-254.76935184120902+.8274096064007395*(r=t-10)+115.67994401066147*xe(r)):(n=351.97690566805693+.114206453784165*(n=t-55)-40.25366309332127*xe(n),o=325.4494125711974+.07943456536662342*(o=t-50)-28.0852963507957*xe(o),r=255),[n,o,r,1]},{round:Do}=Math,Ho=(...e)=>{const t=_(e,"rgb"),n=t[0],o=t[2];let r=1e3,a=4e4;const i=.4;let l;for(;a-r>i;){l=(a+r)*.5;const c=Nt(l);c[2]/c[0]>=o/n?a=l:r=l}return Do(l)};u.prototype.temp=u.prototype.kelvin=u.prototype.temperature=function(){return Ho(this._rgb)};const Xe=(...e)=>new u(...e,"temp");Object.assign(k,{temp:Xe,kelvin:Xe,temperature:Xe}),w.format.temp=w.format.kelvin=w.format.temperature=Nt,u.prototype.oklch=function(){return Mt(this._rgb)},Object.assign(k,{oklch:(...e)=>new u(...e,"oklch")}),w.format.oklch=wt,w.autodetect.push({p:2,test:(...e)=>{if(e=_(e,"oklch"),S(e)==="array"&&e.length===3)return"oklch"}}),Object.assign(k,{analyze:ct,average:In,bezier:Fn,blend:X,brewer:Co,Color:u,colors:te,contrast:ho,contrastAPCA:go,cubehelix:ro,deltaE:yo,distance:Mo,input:w,interpolate:ne,limits:ft,mix:ne,random:co,scale:pe,scales:_o,valid:wo});let T=null,I=null,Ye=null,Pt=null,Dt=null;const Bo=(e,t)=>{const n=e*Math.PI/180,o=t*Math.PI/180,r=Math.cos(o)*Math.sin(n),a=Math.sin(o),i=-Math.cos(o)*Math.cos(n);return[r,a,i]},Go=e=>{if(T=e.getContext("webgl2"),!T)throw new Error("WebGL not supported");const t=(i,l,c)=>{const f=i.createShader(l);return f?(i.shaderSource(f,c),i.compileShader(f),i.getShaderParameter(f,i.COMPILE_STATUS)?f:(console.error("An error occurred compiling the shaders: "+i.getShaderInfoLog(f)),i.deleteShader(f),null)):(console.error("Unable to create shader"),null)},n=t(T,T.VERTEX_SHADER,It),o=t(T,T.FRAGMENT_SHADER,Gt);if(!n||!o)throw new Error("Failed to load shaders");if(I=T.createProgram(),!I)throw new Error("Failed to create program");if(T.attachShader(I,n),T.attachShader(I,o),T.linkProgram(I),!T.getProgramParameter(I,T.LINK_STATUS))throw console.error("Unable to initialize the shader program: "+T.getProgramInfoLog(I)),new Error("Failed to link program");T.useProgram(I),Ye=T.createBuffer(),T.bindBuffer(T.ARRAY_BUFFER,Ye);const r=new Float32Array([-1,-1,1,-1,-1,1,1,1]);T.bufferData(T.ARRAY_BUFFER,r,T.STATIC_DRAW);const a=T.getAttribLocation(I,"aPosition");T.enableVertexAttribArray(a),T.vertexAttribPointer(a,2,T.FLOAT,!1,0,0),Pt=T.getUniformLocation(I,"heightMap"),Dt=T.getUniformLocation(I,"demType")},Ht=new OffscreenCanvas(256,256),Io=(e,t,n)=>{let o=e.TEXTURE0;Object.entries(n).forEach(([r,{image:a,type:i}])=>{const l=e.createTexture();e.activeTexture(o),e.bindTexture(e.TEXTURE_2D,l);const c=e.getUniformLocation(t,r);e.uniform1i(c,o-e.TEXTURE0),i==="height"?e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(e.TEXTURE_2D,0,e.RGB,256,1,0,e.RGB,e.UNSIGNED_BYTE,a),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),o+=1})},Oo=(e,t,n)=>{for(const[o,{type:r,value:a}]of Object.entries(n)){const i=e.getUniformLocation(t,o);i!==null&&e[`uniform${r}`](i,a)}};self.onmessage=async e=>{const{center:t,left:n,right:o,top:r,bottom:a,tileId:i,z:l,maxzoom:c,demTypeNumber:f,uniformsData:h,evolutionColorArray:p,slopeCorlorArray:d,aspectColorArray:g,floodingImage:y}=e.data;try{if(T||Go(Ht),!T||!I||!Ye)throw new Error("WebGL initialization failed");const{evolution:z,slope:v,shadow:b,aspect:$,curvature:L,edge:R,contour:P,flooding:C}=h,s=Bo(b.option.azimuth.value,b.option.altitude.value),m={zoomLevel:{type:"1f",value:l},maxzoom:{type:"1f",value:c},evolutionMode:{type:"1i",value:z.option.visible.value?1:0},slopeMode:{type:"1i",value:v.option.visible.value?1:0},shadowMode:{type:"1i",value:b.option.visible.value?1:0},aspectMode:{type:"1i",value:$.option.visible.value?1:0},curvatureMode:{type:"1i",value:L.option.visible.value?1:0},edgeMode:{type:"1i",value:R.option.visible.value?1:0},contourMode:{type:"1i",value:P.option.visible.value?1:0},floodingMode:{type:"1i",value:C.option.visible.value?1:0},evolutionAlpha:{type:"1f",value:z.option.opacity.value},slopeAlpha:{type:"1f",value:v.option.opacity.value},shadowStrength:{type:"1f",value:b.option.opacity.value},aspectAlpha:{type:"1f",value:$.option.opacity.value},curvatureAlpha:{type:"1f",value:L.option.opacity.value},edgeAlpha:{type:"1f",value:R.option.opacity.value},contourAlpha:{type:"1f",value:P.option.opacity.value},floodingAlpha:{type:"1f",value:C.option.opacity.value},ridgeColor:{type:"4fv",value:k(L.option.ridgeColor.value).gl()},valleyColor:{type:"4fv",value:k(L.option.valleyColor.value).gl()},edgeColor:{type:"4fv",value:k(R.option.edgeColor.value).gl()},shadowColor:{type:"4fv",value:k(b.option.shadowColor.value).gl()},highlightColor:{type:"4fv",value:k(b.option.highlightColor.value).gl()},contourColor:{type:"4fv",value:k(P.option.contourColor.value).gl()},ambient:{type:"1f",value:b.option.ambient.value},ridgeThreshold:{type:"1f",value:L.option.ridgeThreshold.value},valleyThreshold:{type:"1f",value:L.option.valleyThreshold.value},userDefinedIntensity:{type:"1f",value:R.option.edgeIntensity.value},maxHeight:{type:"1f",value:z.option.maxHeight.value},minHeight:{type:"1f",value:z.option.minHeight.value},contourMaxHeight:{type:"1f",value:P.option.maxHeight.value},lightDirection:{type:"3fv",value:s},contourCount:{type:"1f",value:P.option.contourCount.value},waterLevel:{type:"1f",value:C.option.waterLevel.value}};Oo(T,I,m),Io(T,I,{heightMap:{image:t,type:"height"},heightMapLeft:{image:n,type:"height"},heightMapRight:{image:o,type:"height"},heightMapTop:{image:r,type:"height"},heightMapBottom:{image:a,type:"height"},...z.option.visible.value?{u_evolutionMap:{image:p,type:"colormap"}}:{},...v.option.visible.value?{u_slopeMap:{image:d,type:"colormap"}}:{},...$.option.visible.value?{u_aspectMap:{image:g,type:"colormap"}}:{},...C.option.visible.value?{u_floodingImage:{image:y,type:"height"}}:{}}),T.uniform1i(Pt,0),T.uniform1f(Dt,f),T.clear(T.COLOR_BUFFER_BIT),T.drawArrays(T.TRIANGLE_STRIP,0,4);const M=await Ht.convertToBlob();if(!M)throw new Error("Failed to convert canvas to blob");const x=await M.arrayBuffer();self.postMessage({id:i,buffer:x})}catch(z){z instanceof Error&&self.postMessage({id:i,error:z.message})}}})();
