(function(){"use strict";var Ot=`#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#define GLSLIFY 1
#endif

uniform bool u_only_center; // 中心タイルのみのフラグ

uniform sampler2D u_height_map_center;
uniform sampler2D u_height_map_left;
uniform sampler2D u_height_map_right;
uniform sampler2D u_height_map_top;
uniform sampler2D u_height_map_bottom;

uniform float u_dem_type; // mapbox(0.0), gsi(1.0), terrarium(2.0)
uniform float u_zoom_level;
uniform float u_max_zoom;

uniform bool  u_slope_mode;
uniform bool  u_elevation_mode;
uniform bool  u_shadow_mode;
uniform bool  u_aspect_mode;
uniform bool  u_curvature_mode;
uniform bool  u_edge_mode;
uniform bool  u_contour_mode;
uniform bool  u_flooding_mode;

uniform sampler2D u_elevationMap;
uniform sampler2D u_slopeMap;
uniform sampler2D u_aspectMap;
uniform sampler2D u_floodingImage;

uniform float u_elevation_alpha;
uniform float u_slope_alpha;
uniform float u_aspect_alpha;
uniform float u_curvature_alpha;
uniform float u_edge_alpha;
uniform float u_shadow_strength;
uniform float u_ambient;
uniform float u_contour_alpha;
uniform float u_flooding_alpha;

uniform vec4 u_shadow_color;
uniform vec4 u_highlight_color;
uniform vec4 u_ridge_color;
uniform vec4 u_valley_color;
uniform vec4 u_edge_color;
uniform vec4 u_contour_color;

uniform float u_ridge_threshold;
uniform float u_valley_threshold;
uniform float u_edge_intensity;
uniform float u_contour_count;
uniform float u_water_level;

uniform float u_max_height;
uniform float u_min_height;
uniform float u_contour_max_height;
uniform vec3 u_light_direction;
in vec2 v_tex_coord ;
out vec4 fragColor;





// 高さ変換関数
float convertToHeight(vec4 color) {
    vec3 rgb = color.rgb * 255.0;

    if (u_dem_type == 0.0) {  // mapbox (TerrainRGB)

        return -10000.0 + dot(rgb, vec3(256.0 * 256.0, 256.0, 1.0)) * 0.1;

    } else if (u_dem_type == 1.0) {  // gsi (地理院標高タイル)
        // 地理院標高タイルの無効値チェック (R, G, B) = (128, 0, 0)
        if (rgb == vec3(128.0, 0.0, 0.0)) {
            return -9999.0;
        }

        float total = dot(rgb, vec3(65536.0, 256.0, 1.0));
        return mix(total, total - 16777216.0, step(8388608.0, total)) * 0.01;

    } else if (u_dem_type == 2.0) {  // terrarium (TerrariumRGB)

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
mat3 height_matrix;

TerrainData calculateTerrainData(vec2 uv) {

    TerrainData data;
    // 9マスピクセルのインデックス番号 
    // ----------------------------
    // | [0][0] | [0][1] | [0][2] |
    // ----------------------------
    // | [1][0] | [1][1] | [1][2] |
    // ----------------------------
    // | [2][0] | [2][1] | [2][2] |
    // ----------------------------

    // height_mapの隣接タイル
    // ----------------------------
    // |        | top    | 　　　  |
    // ----------------------------
    // | left   | center | right  |
    // ----------------------------
    // |        | bottom |        |
    // ----------------------------

    vec2 pixel_size = vec2(1.0) / 256.0;

   // 高さマトリックスの作成
    if(u_only_center){
        // 中心のテクスチャのみでサンプリング　
        // 左上
        height_matrix[0][0] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(-pixel_size.x, -pixel_size.y), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.x <= pixel_size.x && uv.y <= pixel_size.y) ? uv + vec2(1.0 - pixel_size.x, 1.0 - pixel_size.y) :
            (uv.y <= pixel_size.y) ? uv + vec2(-pixel_size.x, 1.0 - pixel_size.y) :
            (uv.x <= pixel_size.x) ? uv + vec2(1.0 - pixel_size.x, -pixel_size.y) :
            uv + vec2(-pixel_size.x, -pixel_size.y)
        ));

        // 上
        height_matrix[0][1] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(0.0, -pixel_size.y), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.y <= pixel_size.y) ? uv + vec2(0.0, 1.0 - pixel_size.y) :
            uv + vec2(0.0, -pixel_size.y)
        ));

        // 右上
        height_matrix[0][2] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(pixel_size.x, -pixel_size.y), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.x >= 1.0 - pixel_size.x && uv.y <= pixel_size.y) ? uv + vec2(-1.0 + pixel_size.x, 1.0 - pixel_size.y) :
            (uv.y <= pixel_size.y) ? uv + vec2(pixel_size.x, 1.0 - pixel_size.y) :
            (uv.x >= 1.0 - pixel_size.x) ? uv + vec2(-1.0 + pixel_size.x, -pixel_size.y) :
            uv + vec2(pixel_size.x, -pixel_size.y)
        ));

        // 左
        height_matrix[1][0] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(-pixel_size.x, 0.0), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.x <= pixel_size.x) ? uv + vec2(1.0 - pixel_size.x, 0.0) :
            uv + vec2(-pixel_size.x, 0.0)
        ));

        // 中央
        height_matrix[1][1] = convertToHeight(texture(u_height_map_center, uv));

        // 右
        height_matrix[1][2] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(pixel_size.x, 0.0), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.x >= 1.0 - pixel_size.x) ? uv + vec2(-1.0 + pixel_size.x, 0.0) :
            uv + vec2(pixel_size.x, 0.0)
        ));

        // 左下
        height_matrix[2][0] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(-pixel_size.x, pixel_size.y), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.x <= pixel_size.x && uv.y >= 1.0 - pixel_size.y) ? uv + vec2(1.0 - pixel_size.x, -1.0 + pixel_size.y) :
            (uv.y >= 1.0 - pixel_size.y) ? uv + vec2(-pixel_size.x, -1.0 + pixel_size.y) :
            (uv.x <= pixel_size.x) ? uv + vec2(1.0 - pixel_size.x, pixel_size.y) :
            uv + vec2(-pixel_size.x, pixel_size.y)
        ));

        // 下
        height_matrix[2][1] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(0.0, pixel_size.y), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.y >= 1.0 - pixel_size.y) ? uv + vec2(0.0, -1.0 + pixel_size.y) :
            uv + vec2(0.0, pixel_size.y)
        ));

        // 右下
        height_matrix[2][2] = convertToHeight(texture(
            u_height_map_center,
            u_only_center ? clamp(uv + vec2(pixel_size.x, pixel_size.y), vec2(0.0), vec2(1.0) - pixel_size) :
            (uv.x >= 1.0 - pixel_size.x && uv.y >= 1.0 - pixel_size.y) ? uv + vec2(-1.0 + pixel_size.x, -1.0 + pixel_size.y) :
            (uv.y >= 1.0 - pixel_size.y) ? uv + vec2(pixel_size.x, -1.0 + pixel_size.y) :
            (uv.x >= 1.0 - pixel_size.x) ? uv + vec2(-1.0 + pixel_size.x, pixel_size.y) :
            uv + vec2(pixel_size.x, pixel_size.y)
        ));

    } else {
        // 端の場合は隣接テクスチャからサンプル
        // 左上
        height_matrix[0][0] = convertToHeight(
            (uv.x <= pixel_size.x && uv.y <= pixel_size.y) ? texture(u_height_map_left, uv + vec2(1.0 - pixel_size.x, 1.0 - pixel_size.y)) :
            (uv.y <= pixel_size.y) ? texture(u_height_map_top, uv + vec2(-pixel_size.x, 1.0 - pixel_size.y)) :
            (uv.x <= pixel_size.x) ? texture(u_height_map_left, uv + vec2(1.0 - pixel_size.x, -pixel_size.y)) :
            texture(u_height_map_center, uv + vec2(-pixel_size.x, -pixel_size.y))
        );

        // 上
        height_matrix[0][1] = convertToHeight(
            (uv.y <= pixel_size.y) ? texture(u_height_map_top, uv + vec2(0.0, 1.0 - pixel_size.y)) :
            texture(u_height_map_center, uv + vec2(0.0, -pixel_size.y))
        );

        // 右上
        height_matrix[0][2] = convertToHeight(
            (uv.x >= 1.0 - pixel_size.x && uv.y <= pixel_size.y) ? texture(u_height_map_right, uv + vec2(-1.0 + pixel_size.x, 1.0 - pixel_size.y)) :
            (uv.y <= pixel_size.y) ? texture(u_height_map_top, uv + vec2(pixel_size.x, 1.0 - pixel_size.y)) :
            (uv.x >= 1.0 - pixel_size.x) ? texture(u_height_map_right, uv + vec2(-1.0 + pixel_size.x, -pixel_size.y)) :
            texture(u_height_map_center, uv + vec2(pixel_size.x, -pixel_size.y))
        );

        // 左
        height_matrix[1][0] = convertToHeight(
            (uv.x <= pixel_size.x) ? texture(u_height_map_left, uv + vec2(1.0 - pixel_size.x, 0.0)) :
            texture(u_height_map_center, uv + vec2(-pixel_size.x, 0.0))
        );

        // 中央
        height_matrix[1][1] = convertToHeight(texture(u_height_map_center, uv));

        // 右
        height_matrix[1][2] = convertToHeight(
            (uv.x >= 1.0 - pixel_size.x) ? texture(u_height_map_right, uv + vec2(-1.0 + pixel_size.x, 0.0)) :
            texture(u_height_map_center, uv + vec2(pixel_size.x, 0.0))
        );

        // 左下
        height_matrix[2][0] = convertToHeight(
            (uv.x <= pixel_size.x && uv.y >= 1.0 - pixel_size.y) ? texture(u_height_map_left, uv + vec2(1.0 - pixel_size.x, -1.0 + pixel_size.y)) :
            (uv.y >= 1.0 - pixel_size.y) ? texture(u_height_map_bottom, uv + vec2(-pixel_size.x, -1.0 + pixel_size.y)) :
            (uv.x <= pixel_size.x) ? texture(u_height_map_left, uv + vec2(1.0 - pixel_size.x, pixel_size.y)) :
            texture(u_height_map_center, uv + vec2(-pixel_size.x, pixel_size.y))
        );

        // 下
        height_matrix[2][1] = convertToHeight(
            (uv.y >= 1.0 - pixel_size.y) ? texture(u_height_map_bottom, uv + vec2(0.0, -1.0 + pixel_size.y)) :
            texture(u_height_map_center, uv + vec2(0.0, pixel_size.y))
        );

        // 右下
        height_matrix[2][2] = convertToHeight(
            (uv.x >= 1.0 - pixel_size.x && uv.y >= 1.0 - pixel_size.y) ? texture(u_height_map_right, uv + vec2(-1.0 + pixel_size.x, -1.0 + pixel_size.y)) :
            (uv.y >= 1.0 - pixel_size.y) ? texture(u_height_map_bottom, uv + vec2(pixel_size.x, -1.0 + pixel_size.y)) :
            (uv.x >= 1.0 - pixel_size.x) ? texture(u_height_map_right, uv + vec2(-1.0 + pixel_size.x, pixel_size.y)) :
            texture(u_height_map_center, uv + vec2(pixel_size.x, pixel_size.y))
        );
   }

    // 法線の計算
    data.normal.x = (height_matrix[0][0] + height_matrix[0][1] + height_matrix[0][2]) - 
                    (height_matrix[2][0] + height_matrix[2][1] + height_matrix[2][2]);
    data.normal.y = (height_matrix[0][0] + height_matrix[1][0] + height_matrix[2][0]) - 
                    (height_matrix[0][2] + height_matrix[1][2] + height_matrix[2][2]);
    data.normal.z = 2.0 * pixel_size.x * 256.0; // スケーリング係数
    data.normal = normalize(data.normal);

    // 曲率の計算
    data.curvature = conv(conv_c, height_matrix);

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
    float pal_num = u_contour_count; // 等高線の数
    const float smooth_factor = 0.5; // 滑らかさの制御

    // スムーズな等高線の生成
    float n = height;
    float contour = n * (1.0 - smooth_factor) + clamp(floor(n * (pal_num - 0.001)) / (pal_num - 1.0), 0.0, 1.0) * smooth_factor;

    return contour;
}

void main() {
    vec2 uv = v_tex_coord ;
    vec4 color = texture(u_height_map_center, uv);

    if(color.a == 0.0){
        // テクスチャなし、または透明ピクセルの場合
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    if (!u_elevation_mode && !u_slope_mode && !u_shadow_mode && !u_aspect_mode && !u_curvature_mode && !u_edge_mode && !u_contour_mode && !u_flooding_mode) {
        fragColor = color;
        return;
    }

    vec4 final_color = vec4(0.0, 0.0,0.0,0.0);
    bool need_normal = (u_slope_mode || u_aspect_mode || u_shadow_mode || u_edge_mode);
    bool need_curvature = (u_curvature_mode);

    TerrainData terrain_data;
    if (need_normal || need_curvature) {
        terrain_data = calculateTerrainData(uv);
    }


    if (u_elevation_mode) {
        float height = convertToHeight(color);

        if(-9999.0 == height){
            // 無効地の場合
            fragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }

        float normalized_height = clamp((height - u_min_height) / (u_max_height - u_min_height), 0.0, 1.0);
        vec4 terrain_color = getColorFromMap(u_elevationMap, normalized_height);
        final_color = mix(final_color, terrain_color, u_elevation_alpha);
    }

    if (need_normal) {
        vec3 normal = terrain_data.normal;

        if (u_slope_mode) {
            float slope = calculateSlope(normal);
            float normalized_slope = clamp(slope / 90.0, 0.0, 1.0);
            vec4 slope_color = getColorFromMap(u_slopeMap, normalized_slope);
            final_color = mix(final_color, slope_color, u_slope_alpha);
            // NOTE: 放線のデバッグ
            // vec3 normalizedColor = (normal + 1.0) * 0.5;
            // final_color = vec4(normalizedColor, 1.0);
        }

        if (u_aspect_mode) {
            float aspect = atan(normal.y, normal.x);
            float normalized_aspect = (aspect + 3.14159265359) / (2.0 * 3.14159265359);
            vec4 aspect_color = getColorFromMap(u_aspectMap, normalized_aspect);
            final_color = mix(final_color, aspect_color, u_aspect_alpha);
        }

        if (u_shadow_mode) {
            vec3 view_direction = normalize(vec3(0.0, 0.0, 1.0)); // 視線ベクトル
            float highlight_strength = 0.5; // ハイライトの強度
            // 拡散光の計算
            float diffuse = max(dot(normal, u_light_direction), 0.0);

            // 環境光と拡散光の合成
            float shadow_factor = u_ambient + (1.0 - u_ambient) * diffuse;
            float shadow_alpha = (1.0 - shadow_factor) * u_shadow_strength;

            // ハイライトの計算
            vec3 reflect_dir = reflect(-u_light_direction, normal); // 反射ベクトル
            float spec = pow(max(dot(view_direction, reflect_dir), 0.0), 16.0); // スペキュラ成分（光沢の鋭さ）
            vec3 final_highlight = highlight_strength * spec * u_highlight_color.rgb; // ハイライトの最終的な強度と色

            // ハイライトと影を重ねる
            final_color.rgb = mix(final_color.rgb, u_shadow_color.rgb, shadow_alpha); // 影の適用
            final_color.rgb += final_highlight; // ハイライトの適用
            final_color.a = final_color.a * (1.0 - shadow_alpha) + shadow_alpha;
        }
    }

    if (need_curvature) {
        float z = 10.0 * exp2(14.0 - u_zoom_level); // ズームレベルに基づくスケーリング係数

        if (color.a == 0.0) {
            fragColor = vec4(0.0, 0.0, 0.0, 0.0);
            return;
        }

        float curvature = terrain_data.curvature;
        float scaled_curvature = terrain_data.curvature / z;
        float normalized_curvature = clamp((scaled_curvature + 1.0) / 2.0, 0.0, 1.0);

        vec4 curvature_color = vec4(0.0);  // デフォルトで透明

        // 山の稜線の処理
        if (normalized_curvature >= u_ridge_threshold) {
            float intensity = (normalized_curvature - u_ridge_threshold) / (1.0 - u_ridge_threshold);
            curvature_color = vec4(u_ridge_color.rgb, intensity * u_curvature_alpha);
        }
        // 谷の処理
        else if (normalized_curvature <= u_valley_threshold) {
            float intensity = (u_valley_threshold - normalized_curvature) / u_valley_threshold;
            curvature_color = vec4(u_valley_color.rgb, intensity * u_curvature_alpha);
        }

        // アルファブレンディング
        final_color.rgb = mix(final_color.rgb, curvature_color.rgb, curvature_color.a);
        final_color.a = max(final_color.a, curvature_color.a);
    }


    if(u_edge_mode) {


        vec2 e = vec2(1.5/256.0, 0);
        float edge_x = abs(height_matrix[1][2] - height_matrix[1][0]); // 左右の高さ差
        float edge_y = abs(height_matrix[2][1] - height_matrix[0][1]); // 上下の高さ差
        
        float z = 0.5 * exp2(u_zoom_level - 17.0);
        float edge_intensity = z;
        
        float edge_strength = (edge_x + edge_y) * edge_intensity * u_edge_intensity;
        
        // エッジの透明度を考慮したブレンディング
        vec4 edge = vec4(u_edge_color.rgb, clamp(edge_strength, 0.0, 0.8) * u_edge_alpha);
        
        // アルファブレンディング
        final_color.rgb = mix(final_color.rgb, edge.rgb, edge.a);
        final_color.a = max(final_color.a, edge.a);
    }

    if (u_contour_mode) {
              // 等高線の生成
        float height = convertToHeight(color);
        float normalized_height = clamp((height - 0.0) / (u_contour_max_height - 0.0), 0.0, 1.0);
        float contour_lines = createContours(normalized_height);

        vec2 texel_size = 1.0 / vec2(256.0, 256.0);
        float height_right = createContours(clamp(convertToHeight(texture(u_height_map_center, uv + vec2(texel_size.x, 0.0))) / u_contour_max_height, 0.0, 1.0));
        float height_up = createContours(clamp(convertToHeight(texture(u_height_map_center, uv + vec2(0.0, texel_size.y))) / u_contour_max_height, 0.0, 1.0));

        // 境界を計算
        float edge_threshold = 0.01; // 境界を検出するためのしきい値
        float edge = step(edge_threshold, abs(contour_lines - height_right)) + step(edge_threshold, abs(contour_lines - height_up));

        // 最終的な色の計算
        vec3 col = final_color.rgb;
        vec3 outline_color = u_contour_color.rgb; // アウトラインの色（黒）

         // アウトラインを追加し、ライン以外は透明にする
        if (edge > 0.0) {
            vec4 final_contour_color = vec4(outline_color, u_contour_alpha);
            final_color.a = max(final_color.a, final_contour_color.a);
            final_color.rgb = mix(final_color.rgb, final_contour_color.rgb, final_contour_color.a);
        }

    }


   if (u_flooding_mode) {
    float height = convertToHeight(color);
    vec4 flooding_color = vec4(0.0, 0.0, 1.0, u_flooding_alpha); // デフォルトの浸水色

        if (height < u_water_level) {
            // 浸水箇所のテクスチャから色を取得し、floodingAlpha を適用
            flooding_color = vec4(texture(u_floodingImage, uv).rgb, u_flooding_alpha);

            // アルファブレンドによる最終的な色の適用
            final_color.rgb = mix(final_color.rgb, flooding_color.rgb, flooding_color.a);
            final_color.a = mix(final_color.a, flooding_color.a, u_flooding_alpha); // アルファもブレンド
        }
    }


    fragColor = final_color;

}`,jt=`#version 300 es
in vec4 a_position;
out vec2 v_tex_coord;

void main() {
    gl_Position = a_position;
    v_tex_coord = vec2(a_position.x * 0.5 + 0.5, a_position.y * -0.5 + 0.5); // Y軸を反転
}`;const{min:Bt,max:It}=Math;var J=(e,t=0,n=1)=>Bt(It(t,e),n),we=e=>{e._clipped=!1,e._unclipped=e.slice(0);for(let t=0;t<=3;t++)t<3?((e[t]<0||e[t]>255)&&(e._clipped=!0),e[t]=J(e[t],0,255)):t===3&&(e[t]=J(e[t],0,1));return e};const Fe={};for(let e of["Boolean","Number","String","Function","Array","Date","RegExp","Undefined","Null"])Fe[`[object ${e}]`]=e.toLowerCase();function M(e){return Fe[Object.prototype.toString.call(e)]||"object"}var k=(e,t=null)=>e.length>=3?Array.prototype.slice.call(e):M(e[0])=="object"&&t?t.split("").filter(n=>e[0][n]!==void 0).map(n=>e[0][n]):e[0].slice(0),ee=e=>{if(e.length<2)return null;const t=e.length-1;return M(e[t])=="string"?e[t].toLowerCase():null};const{PI:fe,min:qe,max:Ze}=Math,I=e=>Math.round(e*100)/100,ze=e=>Math.round(e*100)/100,F=fe*2,ke=fe/3,Dt=fe/180,Ht=180/fe;function We(e){return[...e.slice(0,3).reverse(),...e.slice(3)]}var y={format:{},autodetect:[]};class f{constructor(...t){const n=this;if(M(t[0])==="object"&&t[0].constructor&&t[0].constructor===this.constructor)return t[0];let o=ee(t),r=!1;if(!o){r=!0,y.sorted||(y.autodetect=y.autodetect.sort((i,a)=>a.p-i.p),y.sorted=!0);for(let i of y.autodetect)if(o=i.test(...t),o)break}if(y.format[o]){const i=y.format[o].apply(null,r?t:t.slice(0,-1));n._rgb=we(i)}else throw new Error("unknown format: "+t);n._rgb.length===3&&n._rgb.push(1)}toString(){return M(this.hex)=="function"?this.hex():`[${this._rgb.join(",")}]`}}const Xt="3.1.2",E=(...e)=>new f(...e);E.version=Xt;const te={aliceblue:"#f0f8ff",antiquewhite:"#faebd7",aqua:"#00ffff",aquamarine:"#7fffd4",azure:"#f0ffff",beige:"#f5f5dc",bisque:"#ffe4c4",black:"#000000",blanchedalmond:"#ffebcd",blue:"#0000ff",blueviolet:"#8a2be2",brown:"#a52a2a",burlywood:"#deb887",cadetblue:"#5f9ea0",chartreuse:"#7fff00",chocolate:"#d2691e",coral:"#ff7f50",cornflowerblue:"#6495ed",cornsilk:"#fff8dc",crimson:"#dc143c",cyan:"#00ffff",darkblue:"#00008b",darkcyan:"#008b8b",darkgoldenrod:"#b8860b",darkgray:"#a9a9a9",darkgreen:"#006400",darkgrey:"#a9a9a9",darkkhaki:"#bdb76b",darkmagenta:"#8b008b",darkolivegreen:"#556b2f",darkorange:"#ff8c00",darkorchid:"#9932cc",darkred:"#8b0000",darksalmon:"#e9967a",darkseagreen:"#8fbc8f",darkslateblue:"#483d8b",darkslategray:"#2f4f4f",darkslategrey:"#2f4f4f",darkturquoise:"#00ced1",darkviolet:"#9400d3",deeppink:"#ff1493",deepskyblue:"#00bfff",dimgray:"#696969",dimgrey:"#696969",dodgerblue:"#1e90ff",firebrick:"#b22222",floralwhite:"#fffaf0",forestgreen:"#228b22",fuchsia:"#ff00ff",gainsboro:"#dcdcdc",ghostwhite:"#f8f8ff",gold:"#ffd700",goldenrod:"#daa520",gray:"#808080",green:"#008000",greenyellow:"#adff2f",grey:"#808080",honeydew:"#f0fff0",hotpink:"#ff69b4",indianred:"#cd5c5c",indigo:"#4b0082",ivory:"#fffff0",khaki:"#f0e68c",laserlemon:"#ffff54",lavender:"#e6e6fa",lavenderblush:"#fff0f5",lawngreen:"#7cfc00",lemonchiffon:"#fffacd",lightblue:"#add8e6",lightcoral:"#f08080",lightcyan:"#e0ffff",lightgoldenrod:"#fafad2",lightgoldenrodyellow:"#fafad2",lightgray:"#d3d3d3",lightgreen:"#90ee90",lightgrey:"#d3d3d3",lightpink:"#ffb6c1",lightsalmon:"#ffa07a",lightseagreen:"#20b2aa",lightskyblue:"#87cefa",lightslategray:"#778899",lightslategrey:"#778899",lightsteelblue:"#b0c4de",lightyellow:"#ffffe0",lime:"#00ff00",limegreen:"#32cd32",linen:"#faf0e6",magenta:"#ff00ff",maroon:"#800000",maroon2:"#7f0000",maroon3:"#b03060",mediumaquamarine:"#66cdaa",mediumblue:"#0000cd",mediumorchid:"#ba55d3",mediumpurple:"#9370db",mediumseagreen:"#3cb371",mediumslateblue:"#7b68ee",mediumspringgreen:"#00fa9a",mediumturquoise:"#48d1cc",mediumvioletred:"#c71585",midnightblue:"#191970",mintcream:"#f5fffa",mistyrose:"#ffe4e1",moccasin:"#ffe4b5",navajowhite:"#ffdead",navy:"#000080",oldlace:"#fdf5e6",olive:"#808000",olivedrab:"#6b8e23",orange:"#ffa500",orangered:"#ff4500",orchid:"#da70d6",palegoldenrod:"#eee8aa",palegreen:"#98fb98",paleturquoise:"#afeeee",palevioletred:"#db7093",papayawhip:"#ffefd5",peachpuff:"#ffdab9",peru:"#cd853f",pink:"#ffc0cb",plum:"#dda0dd",powderblue:"#b0e0e6",purple:"#800080",purple2:"#7f007f",purple3:"#a020f0",rebeccapurple:"#663399",red:"#ff0000",rosybrown:"#bc8f8f",royalblue:"#4169e1",saddlebrown:"#8b4513",salmon:"#fa8072",sandybrown:"#f4a460",seagreen:"#2e8b57",seashell:"#fff5ee",sienna:"#a0522d",silver:"#c0c0c0",skyblue:"#87ceeb",slateblue:"#6a5acd",slategray:"#708090",slategrey:"#708090",snow:"#fffafa",springgreen:"#00ff7f",steelblue:"#4682b4",tan:"#d2b48c",teal:"#008080",thistle:"#d8bfd8",tomato:"#ff6347",turquoise:"#40e0d0",violet:"#ee82ee",wheat:"#f5deb3",white:"#ffffff",whitesmoke:"#f5f5f5",yellow:"#ffff00",yellowgreen:"#9acd32"},Yt=/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,Ut=/^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/,Ke=e=>{if(e.match(Yt)){(e.length===4||e.length===7)&&(e=e.substr(1)),e.length===3&&(e=e.split(""),e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]);const t=parseInt(e,16),n=t>>16,o=t>>8&255,r=t&255;return[n,o,r,1]}if(e.match(Ut)){(e.length===5||e.length===9)&&(e=e.substr(1)),e.length===4&&(e=e.split(""),e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]+e[3]+e[3]);const t=parseInt(e,16),n=t>>24&255,o=t>>16&255,r=t>>8&255,i=Math.round((t&255)/255*100)/100;return[n,o,r,i]}throw new Error(`unknown hex color: ${e}`)},{round:he}=Math,Ve=(...e)=>{let[t,n,o,r]=k(e,"rgba"),i=ee(e)||"auto";r===void 0&&(r=1),i==="auto"&&(i=r<1?"rgba":"rgb"),t=he(t),n=he(n),o=he(o);let l="000000"+(t<<16|n<<8|o).toString(16);l=l.substr(l.length-6);let c="0"+he(r*255).toString(16);switch(c=c.substr(c.length-2),i.toLowerCase()){case"rgba":return`#${l}${c}`;case"argb":return`#${c}${l}`;default:return`#${l}`}};f.prototype.name=function(){const e=Ve(this._rgb,"rgb");for(let t of Object.keys(te))if(te[t]===e)return t.toLowerCase();return e},y.format.named=e=>{if(e=e.toLowerCase(),te[e])return Ke(te[e]);throw new Error("unknown color name: "+e)},y.autodetect.push({p:5,test:(e,...t)=>{if(!t.length&&M(e)==="string"&&te[e.toLowerCase()])return"named"}}),f.prototype.alpha=function(e,t=!1){return e!==void 0&&M(e)==="number"?t?(this._rgb[3]=e,this):new f([this._rgb[0],this._rgb[1],this._rgb[2],e],"rgb"):this._rgb[3]},f.prototype.clipped=function(){return this._rgb._clipped||!1};const U={Kn:18,labWhitePoint:"d65",Xn:.95047,Yn:1,Zn:1.08883,t0:.137931034,t1:.206896552,t2:.12841855,t3:.008856452,kE:216/24389,kKE:8,kK:24389/27,RefWhiteRGB:{X:.95047,Y:1,Z:1.08883},MtxRGB2XYZ:{m00:.4124564390896922,m01:.21267285140562253,m02:.0193338955823293,m10:.357576077643909,m11:.715152155287818,m12:.11919202588130297,m20:.18043748326639894,m21:.07217499330655958,m22:.9503040785363679},MtxXYZ2RGB:{m00:3.2404541621141045,m01:-.9692660305051868,m02:.055643430959114726,m10:-1.5371385127977166,m11:1.8760108454466942,m12:-.2040259135167538,m20:-.498531409556016,m21:.041556017530349834,m22:1.0572251882231791},As:.9414285350000001,Bs:1.040417467,Cs:1.089532651,MtxAdaptMa:{m00:.8951,m01:-.7502,m02:.0389,m10:.2664,m11:1.7135,m12:-.0685,m20:-.1614,m21:.0367,m22:1.0296},MtxAdaptMaI:{m00:.9869929054667123,m01:.43230526972339456,m02:-.008528664575177328,m10:-.14705425642099013,m11:.5183602715367776,m12:.04004282165408487,m20:.15996265166373125,m21:.0492912282128556,m22:.9684866957875502}},Ft=new Map([["a",[1.0985,.35585]],["b",[1.0985,.35585]],["c",[.98074,1.18232]],["d50",[.96422,.82521]],["d55",[.95682,.92149]],["d65",[.95047,1.08883]],["e",[1,1,1]],["f2",[.99186,.67393]],["f7",[.95041,1.08747]],["f11",[1.00962,.6435]],["icc",[.96422,.82521]]]);function q(e){const t=Ft.get(String(e).toLowerCase());if(!t)throw new Error("unknown Lab illuminant "+e);U.labWhitePoint=e,U.Xn=t[0],U.Zn=t[1]}function se(){return U.labWhitePoint}const Ee=(...e)=>{e=k(e,"lab");const[t,n,o]=e,[r,i,a]=qt(t,n,o),[l,c,s]=Je(r,i,a);return[l,c,s,e.length>3?e[3]:1]},qt=(e,t,n)=>{const{kE:o,kK:r,kKE:i,Xn:a,Yn:l,Zn:c}=U,s=(e+16)/116,h=.002*t+s,p=s-.005*n,_=h*h*h,b=p*p*p,x=_>o?_:(116*h-16)/r,$=e>i?Math.pow((e+16)/116,3):e/r,d=b>o?b:(116*p-16)/r,m=x*a,C=$*l,N=d*c;return[m,C,N]},Me=e=>{const t=Math.sign(e);return e=Math.abs(e),(e<=.0031308?e*12.92:1.055*Math.pow(e,1/2.4)-.055)*t},Je=(e,t,n)=>{const{MtxAdaptMa:o,MtxAdaptMaI:r,MtxXYZ2RGB:i,RefWhiteRGB:a,Xn:l,Yn:c,Zn:s}=U,h=l*o.m00+c*o.m10+s*o.m20,p=l*o.m01+c*o.m11+s*o.m21,_=l*o.m02+c*o.m12+s*o.m22,b=a.X*o.m00+a.Y*o.m10+a.Z*o.m20,x=a.X*o.m01+a.Y*o.m11+a.Z*o.m21,$=a.X*o.m02+a.Y*o.m12+a.Z*o.m22,d=(e*o.m00+t*o.m10+n*o.m20)*(b/h),m=(e*o.m01+t*o.m11+n*o.m21)*(x/p),C=(e*o.m02+t*o.m12+n*o.m22)*($/_),N=d*r.m00+m*r.m10+C*r.m20,L=d*r.m01+m*r.m11+C*r.m21,S=d*r.m02+m*r.m12+C*r.m22,w=Me(N*i.m00+L*i.m10+S*i.m20),u=Me(N*i.m01+L*i.m11+S*i.m21),g=Me(N*i.m02+L*i.m12+S*i.m22);return[w*255,u*255,g*255]},Re=(...e)=>{const[t,n,o,...r]=k(e,"rgb"),[i,a,l]=Qe(t,n,o),[c,s,h]=Zt(i,a,l);return[c,s,h,...r.length>0&&r[0]<1?[r[0]]:[]]};function Zt(e,t,n){const{Xn:o,Yn:r,Zn:i,kE:a,kK:l}=U,c=e/o,s=t/r,h=n/i,p=c>a?Math.pow(c,1/3):(l*c+16)/116,_=s>a?Math.pow(s,1/3):(l*s+16)/116,b=h>a?Math.pow(h,1/3):(l*h+16)/116;return[116*_-16,500*(p-_),200*(_-b)]}function Te(e){const t=Math.sign(e);return e=Math.abs(e),(e<=.04045?e/12.92:Math.pow((e+.055)/1.055,2.4))*t}const Qe=(e,t,n)=>{e=Te(e/255),t=Te(t/255),n=Te(n/255);const{MtxRGB2XYZ:o,MtxAdaptMa:r,MtxAdaptMaI:i,Xn:a,Yn:l,Zn:c,As:s,Bs:h,Cs:p}=U;let _=e*o.m00+t*o.m10+n*o.m20,b=e*o.m01+t*o.m11+n*o.m21,x=e*o.m02+t*o.m12+n*o.m22;const $=a*r.m00+l*r.m10+c*r.m20,d=a*r.m01+l*r.m11+c*r.m21,m=a*r.m02+l*r.m12+c*r.m22;let C=_*r.m00+b*r.m10+x*r.m20,N=_*r.m01+b*r.m11+x*r.m21,L=_*r.m02+b*r.m12+x*r.m22;return C*=$/s,N*=d/h,L*=m/p,_=C*i.m00+N*i.m10+L*i.m20,b=C*i.m01+N*i.m11+L*i.m21,x=C*i.m02+N*i.m12+L*i.m22,[_,b,x]};f.prototype.lab=function(){return Re(this._rgb)},Object.assign(E,{lab:(...e)=>new f(...e,"lab"),getLabWhitePoint:se,setLabWhitePoint:q}),y.format.lab=Ee,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"lab"),M(e)==="array"&&e.length===3)return"lab"}}),f.prototype.darken=function(e=1){const t=this,n=t.lab();return n[0]-=U.Kn*e,new f(n,"lab").alpha(t.alpha(),!0)},f.prototype.brighten=function(e=1){return this.darken(-e)},f.prototype.darker=f.prototype.darken,f.prototype.brighter=f.prototype.brighten,f.prototype.get=function(e){const[t,n]=e.split("."),o=this[t]();if(n){const r=t.indexOf(n)-(t.substr(0,2)==="ok"?2:0);if(r>-1)return o[r];throw new Error(`unknown channel ${n} in mode ${t}`)}else return o};const{pow:Wt}=Math,Kt=1e-7,Vt=20;f.prototype.luminance=function(e,t="rgb"){if(e!==void 0&&M(e)==="number"){if(e===0)return new f([0,0,0,this._rgb[3]],"rgb");if(e===1)return new f([255,255,255,this._rgb[3]],"rgb");let n=this.luminance(),o=Vt;const r=(a,l)=>{const c=a.interpolate(l,.5,t),s=c.luminance();return Math.abs(e-s)<Kt||!o--?c:s>e?r(a,c):r(c,l)},i=(n>e?r(new f([0,0,0]),this):r(this,new f([255,255,255]))).rgb();return new f([...i,this._rgb[3]])}return Jt(...this._rgb.slice(0,3))};const Jt=(e,t,n)=>(e=Ae(e),t=Ae(t),n=Ae(n),.2126*e+.7152*t+.0722*n),Ae=e=>(e/=255,e<=.03928?e/12.92:Wt((e+.055)/1.055,2.4));var j={},ne=(e,t,n=.5,...o)=>{let r=o[0]||"lrgb";if(!j[r]&&!o.length&&(r=Object.keys(j)[0]),!j[r])throw new Error(`interpolation mode ${r} is not defined`);return M(e)!=="object"&&(e=new f(e)),M(t)!=="object"&&(t=new f(t)),j[r](e,t,n).alpha(e.alpha()+n*(t.alpha()-e.alpha()))};f.prototype.mix=f.prototype.interpolate=function(e,t=.5,...n){return ne(this,e,t,...n)},f.prototype.premultiply=function(e=!1){const t=this._rgb,n=t[3];return e?(this._rgb=[t[0]*n,t[1]*n,t[2]*n,n],this):new f([t[0]*n,t[1]*n,t[2]*n,n],"rgb")};const{sin:Qt,cos:en}=Math,et=(...e)=>{let[t,n,o]=k(e,"lch");return isNaN(o)&&(o=0),o=o*Dt,[t,en(o)*n,Qt(o)*n]},$e=(...e)=>{e=k(e,"lch");const[t,n,o]=e,[r,i,a]=et(t,n,o),[l,c,s]=Ee(r,i,a);return[l,c,s,e.length>3?e[3]:1]},tn=(...e)=>{const t=We(k(e,"hcl"));return $e(...t)},{sqrt:nn,atan2:on,round:rn}=Math,tt=(...e)=>{const[t,n,o]=k(e,"lab"),r=nn(n*n+o*o);let i=(on(o,n)*Ht+360)%360;return rn(r*1e4)===0&&(i=Number.NaN),[t,r,i]},Le=(...e)=>{const[t,n,o,...r]=k(e,"rgb"),[i,a,l]=Re(t,n,o),[c,s,h]=tt(i,a,l);return[c,s,h,...r.length>0&&r[0]<1?[r[0]]:[]]};f.prototype.lch=function(){return Le(this._rgb)},f.prototype.hcl=function(){return We(Le(this._rgb))},Object.assign(E,{lch:(...e)=>new f(...e,"lch"),hcl:(...e)=>new f(...e,"hcl")}),y.format.lch=$e,y.format.hcl=tn,["lch","hcl"].forEach(e=>y.autodetect.push({p:2,test:(...t)=>{if(t=k(t,e),M(t)==="array"&&t.length===3)return e}})),f.prototype.saturate=function(e=1){const t=this,n=t.lch();return n[1]+=U.Kn*e,n[1]<0&&(n[1]=0),new f(n,"lch").alpha(t.alpha(),!0)},f.prototype.desaturate=function(e=1){return this.saturate(-e)},f.prototype.set=function(e,t,n=!1){const[o,r]=e.split("."),i=this[o]();if(r){const a=o.indexOf(r)-(o.substr(0,2)==="ok"?2:0);if(a>-1){if(M(t)=="string")switch(t.charAt(0)){case"+":i[a]+=+t;break;case"-":i[a]+=+t;break;case"*":i[a]*=+t.substr(1);break;case"/":i[a]/=+t.substr(1);break;default:i[a]=+t}else if(M(t)==="number")i[a]=t;else throw new Error("unsupported value for Color.set");const l=new f(i,o);return n?(this._rgb=l._rgb,this):l}throw new Error(`unknown channel ${r} in mode ${o}`)}else return i},f.prototype.tint=function(e=.5,...t){return ne(this,"white",e,...t)},f.prototype.shade=function(e=.5,...t){return ne(this,"black",e,...t)};const an=(e,t,n)=>{const o=e._rgb,r=t._rgb;return new f(o[0]+n*(r[0]-o[0]),o[1]+n*(r[1]-o[1]),o[2]+n*(r[2]-o[2]),"rgb")};j.rgb=an;const{sqrt:Ce,pow:oe}=Math,ln=(e,t,n)=>{const[o,r,i]=e._rgb,[a,l,c]=t._rgb;return new f(Ce(oe(o,2)*(1-n)+oe(a,2)*n),Ce(oe(r,2)*(1-n)+oe(l,2)*n),Ce(oe(i,2)*(1-n)+oe(c,2)*n),"rgb")};j.lrgb=ln;const cn=(e,t,n)=>{const o=e.lab(),r=t.lab();return new f(o[0]+n*(r[0]-o[0]),o[1]+n*(r[1]-o[1]),o[2]+n*(r[2]-o[2]),"lab")};j.lab=cn;var re=(e,t,n,o)=>{let r,i;o==="hsl"?(r=e.hsl(),i=t.hsl()):o==="hsv"?(r=e.hsv(),i=t.hsv()):o==="hcg"?(r=e.hcg(),i=t.hcg()):o==="hsi"?(r=e.hsi(),i=t.hsi()):o==="lch"||o==="hcl"?(o="hcl",r=e.hcl(),i=t.hcl()):o==="oklch"&&(r=e.oklch().reverse(),i=t.oklch().reverse());let a,l,c,s,h,p;(o.substr(0,1)==="h"||o==="oklch")&&([a,c,h]=r,[l,s,p]=i);let _,b,x,$;return!isNaN(a)&&!isNaN(l)?(l>a&&l-a>180?$=l-(a+360):l<a&&a-l>180?$=l+360-a:$=l-a,b=a+n*$):isNaN(a)?isNaN(l)?b=Number.NaN:(b=l,(h==1||h==0)&&o!="hsv"&&(_=s)):(b=a,(p==1||p==0)&&o!="hsv"&&(_=c)),_===void 0&&(_=c+n*(s-c)),x=h+n*(p-h),o==="oklch"?new f([x,_,b],o):new f([b,_,x],o)};const nt=(e,t,n)=>re(e,t,n,"lch");j.lch=nt,j.hcl=nt;const sn=e=>{if(M(e)=="number"&&e>=0&&e<=16777215){const t=e>>16,n=e>>8&255,o=e&255;return[t,n,o,1]}throw new Error("unknown num color: "+e)},un=(...e)=>{const[t,n,o]=k(e,"rgb");return(t<<16)+(n<<8)+o};f.prototype.num=function(){return un(this._rgb)},Object.assign(E,{num:(...e)=>new f(...e,"num")}),y.format.num=sn,y.autodetect.push({p:5,test:(...e)=>{if(e.length===1&&M(e[0])==="number"&&e[0]>=0&&e[0]<=16777215)return"num"}});const fn=(e,t,n)=>{const o=e.num(),r=t.num();return new f(o+n*(r-o),"num")};j.num=fn;const{floor:hn}=Math,_n=(...e)=>{e=k(e,"hcg");let[t,n,o]=e,r,i,a;o=o*255;const l=n*255;if(n===0)r=i=a=o;else{t===360&&(t=0),t>360&&(t-=360),t<0&&(t+=360),t/=60;const c=hn(t),s=t-c,h=o*(1-n),p=h+l*(1-s),_=h+l*s,b=h+l;switch(c){case 0:[r,i,a]=[b,_,h];break;case 1:[r,i,a]=[p,b,h];break;case 2:[r,i,a]=[h,b,_];break;case 3:[r,i,a]=[h,p,b];break;case 4:[r,i,a]=[_,h,b];break;case 5:[r,i,a]=[b,h,p];break}}return[r,i,a,e.length>3?e[3]:1]},pn=(...e)=>{const[t,n,o]=k(e,"rgb"),r=qe(t,n,o),i=Ze(t,n,o),a=i-r,l=a*100/255,c=r/(255-a)*100;let s;return a===0?s=Number.NaN:(t===i&&(s=(n-o)/a),n===i&&(s=2+(o-t)/a),o===i&&(s=4+(t-n)/a),s*=60,s<0&&(s+=360)),[s,l,c]};f.prototype.hcg=function(){return pn(this._rgb)};const dn=(...e)=>new f(...e,"hcg");E.hcg=dn,y.format.hcg=_n,y.autodetect.push({p:1,test:(...e)=>{if(e=k(e,"hcg"),M(e)==="array"&&e.length===3)return"hcg"}});const bn=(e,t,n)=>re(e,t,n,"hcg");j.hcg=bn;const{cos:ie}=Math,mn=(...e)=>{e=k(e,"hsi");let[t,n,o]=e,r,i,a;return isNaN(t)&&(t=0),isNaN(n)&&(n=0),t>360&&(t-=360),t<0&&(t+=360),t/=360,t<1/3?(a=(1-n)/3,r=(1+n*ie(F*t)/ie(ke-F*t))/3,i=1-(a+r)):t<2/3?(t-=1/3,r=(1-n)/3,i=(1+n*ie(F*t)/ie(ke-F*t))/3,a=1-(r+i)):(t-=2/3,i=(1-n)/3,a=(1+n*ie(F*t)/ie(ke-F*t))/3,r=1-(i+a)),r=J(o*r*3),i=J(o*i*3),a=J(o*a*3),[r*255,i*255,a*255,e.length>3?e[3]:1]},{min:gn,sqrt:vn,acos:xn}=Math,yn=(...e)=>{let[t,n,o]=k(e,"rgb");t/=255,n/=255,o/=255;let r;const i=gn(t,n,o),a=(t+n+o)/3,l=a>0?1-i/a:0;return l===0?r=NaN:(r=(t-n+(t-o))/2,r/=vn((t-n)*(t-n)+(t-o)*(n-o)),r=xn(r),o>n&&(r=F-r),r/=F),[r*360,l,a]};f.prototype.hsi=function(){return yn(this._rgb)};const wn=(...e)=>new f(...e,"hsi");E.hsi=wn,y.format.hsi=mn,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"hsi"),M(e)==="array"&&e.length===3)return"hsi"}});const zn=(e,t,n)=>re(e,t,n,"hsi");j.hsi=zn;const Ne=(...e)=>{e=k(e,"hsl");const[t,n,o]=e;let r,i,a;if(n===0)r=i=a=o*255;else{const l=[0,0,0],c=[0,0,0],s=o<.5?o*(1+n):o+n-o*n,h=2*o-s,p=t/360;l[0]=p+1/3,l[1]=p,l[2]=p-1/3;for(let _=0;_<3;_++)l[_]<0&&(l[_]+=1),l[_]>1&&(l[_]-=1),6*l[_]<1?c[_]=h+(s-h)*6*l[_]:2*l[_]<1?c[_]=s:3*l[_]<2?c[_]=h+(s-h)*(2/3-l[_])*6:c[_]=h;[r,i,a]=[c[0]*255,c[1]*255,c[2]*255]}return e.length>3?[r,i,a,e[3]]:[r,i,a,1]},ot=(...e)=>{e=k(e,"rgba");let[t,n,o]=e;t/=255,n/=255,o/=255;const r=qe(t,n,o),i=Ze(t,n,o),a=(i+r)/2;let l,c;return i===r?(l=0,c=Number.NaN):l=a<.5?(i-r)/(i+r):(i-r)/(2-i-r),t==i?c=(n-o)/(i-r):n==i?c=2+(o-t)/(i-r):o==i&&(c=4+(t-n)/(i-r)),c*=60,c<0&&(c+=360),e.length>3&&e[3]!==void 0?[c,l,a,e[3]]:[c,l,a]};f.prototype.hsl=function(){return ot(this._rgb)};const kn=(...e)=>new f(...e,"hsl");E.hsl=kn,y.format.hsl=Ne,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"hsl"),M(e)==="array"&&e.length===3)return"hsl"}});const En=(e,t,n)=>re(e,t,n,"hsl");j.hsl=En;const{floor:Mn}=Math,Rn=(...e)=>{e=k(e,"hsv");let[t,n,o]=e,r,i,a;if(o*=255,n===0)r=i=a=o;else{t===360&&(t=0),t>360&&(t-=360),t<0&&(t+=360),t/=60;const l=Mn(t),c=t-l,s=o*(1-n),h=o*(1-n*c),p=o*(1-n*(1-c));switch(l){case 0:[r,i,a]=[o,p,s];break;case 1:[r,i,a]=[h,o,s];break;case 2:[r,i,a]=[s,o,p];break;case 3:[r,i,a]=[s,h,o];break;case 4:[r,i,a]=[p,s,o];break;case 5:[r,i,a]=[o,s,h];break}}return[r,i,a,e.length>3?e[3]:1]},{min:Tn,max:An}=Math,$n=(...e)=>{e=k(e,"rgb");let[t,n,o]=e;const r=Tn(t,n,o),i=An(t,n,o),a=i-r;let l,c,s;return s=i/255,i===0?(l=Number.NaN,c=0):(c=a/i,t===i&&(l=(n-o)/a),n===i&&(l=2+(o-t)/a),o===i&&(l=4+(t-n)/a),l*=60,l<0&&(l+=360)),[l,c,s]};f.prototype.hsv=function(){return $n(this._rgb)};const Ln=(...e)=>new f(...e,"hsv");E.hsv=Ln,y.format.hsv=Rn,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"hsv"),M(e)==="array"&&e.length===3)return"hsv"}});const Cn=(e,t,n)=>re(e,t,n,"hsv");j.hsv=Cn;function _e(e,t){let n=e.length;Array.isArray(e[0])||(e=[e]),Array.isArray(t[0])||(t=t.map(a=>[a]));let o=t[0].length,r=t[0].map((a,l)=>t.map(c=>c[l])),i=e.map(a=>r.map(l=>Array.isArray(a)?a.reduce((c,s,h)=>c+s*(l[h]||0),0):l.reduce((c,s)=>c+s*a,0)));return n===1&&(i=i[0]),o===1?i.map(a=>a[0]):i}const Pe=(...e)=>{e=k(e,"lab");const[t,n,o,...r]=e,[i,a,l]=Nn([t,n,o]),[c,s,h]=Je(i,a,l);return[c,s,h,...r.length>0&&r[0]<1?[r[0]]:[]]};function Nn(e){var t=[[1.2268798758459243,-.5578149944602171,.2813910456659647],[-.0405757452148008,1.112286803280317,-.0717110580655164],[-.0763729366746601,-.4214933324022432,1.5869240198367816]],n=[[1,.3963377773761749,.2158037573099136],[1,-.1055613458156586,-.0638541728258133],[1,-.0894841775298119,-1.2914855480194092]],o=_e(n,e);return _e(t,o.map(r=>r**3))}const Se=(...e)=>{const[t,n,o,...r]=k(e,"rgb"),i=Qe(t,n,o);return[...Pn(i),...r.length>0&&r[0]<1?[r[0]]:[]]};function Pn(e){const t=[[.819022437996703,.3619062600528904,-.1288737815209879],[.0329836539323885,.9292868615863434,.0361446663506424],[.0481771893596242,.2642395317527308,.6335478284694309]],n=[[.210454268309314,.7936177747023054,-.0040720430116193],[1.9779985324311684,-2.42859224204858,.450593709617411],[.0259040424655478,.7827717124575296,-.8086757549230774]],o=_e(t,e);return _e(n,o.map(r=>Math.cbrt(r)))}f.prototype.oklab=function(){return Se(this._rgb)},Object.assign(E,{oklab:(...e)=>new f(...e,"oklab")}),y.format.oklab=Pe,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"oklab"),M(e)==="array"&&e.length===3)return"oklab"}});const Sn=(e,t,n)=>{const o=e.oklab(),r=t.oklab();return new f(o[0]+n*(r[0]-o[0]),o[1]+n*(r[1]-o[1]),o[2]+n*(r[2]-o[2]),"oklab")};j.oklab=Sn;const Gn=(e,t,n)=>re(e,t,n,"oklch");j.oklch=Gn;const{pow:Ge,sqrt:Oe,PI:je,cos:rt,sin:it,atan2:On}=Math;var jn=(e,t="lrgb",n=null)=>{const o=e.length;n||(n=Array.from(new Array(o)).map(()=>1));const r=o/n.reduce(function(p,_){return p+_});if(n.forEach((p,_)=>{n[_]*=r}),e=e.map(p=>new f(p)),t==="lrgb")return Bn(e,n);const i=e.shift(),a=i.get(t),l=[];let c=0,s=0;for(let p=0;p<a.length;p++)if(a[p]=(a[p]||0)*n[0],l.push(isNaN(a[p])?0:n[0]),t.charAt(p)==="h"&&!isNaN(a[p])){const _=a[p]/180*je;c+=rt(_)*n[0],s+=it(_)*n[0]}let h=i.alpha()*n[0];e.forEach((p,_)=>{const b=p.get(t);h+=p.alpha()*n[_+1];for(let x=0;x<a.length;x++)if(!isNaN(b[x]))if(l[x]+=n[_+1],t.charAt(x)==="h"){const $=b[x]/180*je;c+=rt($)*n[_+1],s+=it($)*n[_+1]}else a[x]+=b[x]*n[_+1]});for(let p=0;p<a.length;p++)if(t.charAt(p)==="h"){let _=On(s/l[p],c/l[p])/je*180;for(;_<0;)_+=360;for(;_>=360;)_-=360;a[p]=_}else a[p]=a[p]/l[p];return h/=o,new f(a,t).alpha(h>.99999?1:h,!0)};const Bn=(e,t)=>{const n=e.length,o=[0,0,0,0];for(let r=0;r<e.length;r++){const i=e[r],a=t[r]/n,l=i._rgb;o[0]+=Ge(l[0],2)*a,o[1]+=Ge(l[1],2)*a,o[2]+=Ge(l[2],2)*a,o[3]+=l[3]*a}return o[0]=Oe(o[0]),o[1]=Oe(o[1]),o[2]=Oe(o[2]),o[3]>.9999999&&(o[3]=1),new f(we(o))},{pow:In}=Math;function pe(e){let t="rgb",n=E("#ccc"),o=0,r=[0,1],i=[],a=[0,0],l=!1,c=[],s=!1,h=0,p=1,_=!1,b={},x=!0,$=1;const d=function(u){if(u=u||["#fff","#000"],u&&M(u)==="string"&&E.brewer&&E.brewer[u.toLowerCase()]&&(u=E.brewer[u.toLowerCase()]),M(u)==="array"){u.length===1&&(u=[u[0],u[0]]),u=u.slice(0);for(let g=0;g<u.length;g++)u[g]=E(u[g]);i.length=0;for(let g=0;g<u.length;g++)i.push(g/(u.length-1))}return S(),c=u},m=function(u){if(l!=null){const g=l.length-1;let z=0;for(;z<g&&u>=l[z];)z++;return z-1}return 0};let C=u=>u,N=u=>u;const L=function(u,g){let z,v;if(g==null&&(g=!1),isNaN(u)||u===null)return n;g?v=u:l&&l.length>2?v=m(u)/(l.length-2):p!==h?v=(u-h)/(p-h):v=1,v=N(v),g||(v=C(v)),$!==1&&(v=In(v,$)),v=a[0]+v*(1-a[0]-a[1]),v=J(v,0,1);const T=Math.floor(v*1e4);if(x&&b[T])z=b[T];else{if(M(c)==="array")for(let R=0;R<i.length;R++){const P=i[R];if(v<=P){z=c[R];break}if(v>=P&&R===i.length-1){z=c[R];break}if(v>P&&v<i[R+1]){v=(v-P)/(i[R+1]-P),z=E.interpolate(c[R],c[R+1],v,t);break}}else M(c)==="function"&&(z=c(v));x&&(b[T]=z)}return z};var S=()=>b={};d(e);const w=function(u){const g=E(L(u));return s&&g[s]?g[s]():g};return w.classes=function(u){if(u!=null){if(M(u)==="array")l=u,r=[u[0],u[u.length-1]];else{const g=E.analyze(r);u===0?l=[g.min,g.max]:l=E.limits(g,"e",u)}return w}return l},w.domain=function(u){if(!arguments.length)return r;h=u[0],p=u[u.length-1],i=[];const g=c.length;if(u.length===g&&h!==p)for(let z of Array.from(u))i.push((z-h)/(p-h));else{for(let z=0;z<g;z++)i.push(z/(g-1));if(u.length>2){const z=u.map((T,R)=>R/(u.length-1)),v=u.map(T=>(T-h)/(p-h));v.every((T,R)=>z[R]===T)||(N=T=>{if(T<=0||T>=1)return T;let R=0;for(;T>=v[R+1];)R++;const P=(T-v[R])/(v[R+1]-v[R]);return z[R]+P*(z[R+1]-z[R])})}}return r=[h,p],w},w.mode=function(u){return arguments.length?(t=u,S(),w):t},w.range=function(u,g){return d(u),w},w.out=function(u){return s=u,w},w.spread=function(u){return arguments.length?(o=u,w):o},w.correctLightness=function(u){return u==null&&(u=!0),_=u,S(),_?C=function(g){const z=L(0,!0).lab()[0],v=L(1,!0).lab()[0],T=z>v;let R=L(g,!0).lab()[0];const P=z+(v-z)*g;let Q=R-P,ue=0,xe=1,ye=20;for(;Math.abs(Q)>.01&&ye-- >0;)(function(){return T&&(Q*=-1),Q<0?(ue=g,g+=(xe-g)*.5):(xe=g,g+=(ue-g)*.5),R=L(g,!0).lab()[0],Q=R-P})();return g}:C=g=>g,w},w.padding=function(u){return u!=null?(M(u)==="number"&&(u=[u,u]),a=u,w):a},w.colors=function(u,g){arguments.length<2&&(g="hex");let z=[];if(arguments.length===0)z=c.slice(0);else if(u===1)z=[w(.5)];else if(u>1){const v=r[0],T=r[1]-v;z=Dn(0,u).map(R=>w(v+R/(u-1)*T))}else{e=[];let v=[];if(l&&l.length>2)for(let T=1,R=l.length,P=1<=R;P?T<R:T>R;P?T++:T--)v.push((l[T-1]+l[T])*.5);else v=r;z=v.map(T=>w(T))}return E[g]&&(z=z.map(v=>v[g]())),z},w.cache=function(u){return u!=null?(x=u,w):x},w.gamma=function(u){return u!=null?($=u,w):$},w.nodata=function(u){return u!=null?(n=E(u),w):n},w}function Dn(e,t,n){let o=[],r=e<t,i=t;for(let a=e;r?a<i:a>i;r?a++:a--)o.push(a);return o}const Hn=function(e){let t=[1,1];for(let n=1;n<e;n++){let o=[1];for(let r=1;r<=t.length;r++)o[r]=(t[r]||0)+t[r-1];t=o}return t},Xn=function(e){let t,n,o,r;if(e=e.map(i=>new f(i)),e.length===2)[n,o]=e.map(i=>i.lab()),t=function(i){const a=[0,1,2].map(l=>n[l]+i*(o[l]-n[l]));return new f(a,"lab")};else if(e.length===3)[n,o,r]=e.map(i=>i.lab()),t=function(i){const a=[0,1,2].map(l=>(1-i)*(1-i)*n[l]+2*(1-i)*i*o[l]+i*i*r[l]);return new f(a,"lab")};else if(e.length===4){let i;[n,o,r,i]=e.map(a=>a.lab()),t=function(a){const l=[0,1,2].map(c=>(1-a)*(1-a)*(1-a)*n[c]+3*(1-a)*(1-a)*a*o[c]+3*(1-a)*a*a*r[c]+a*a*a*i[c]);return new f(l,"lab")}}else if(e.length>=5){let i,a,l;i=e.map(c=>c.lab()),l=e.length-1,a=Hn(l),t=function(c){const s=1-c,h=[0,1,2].map(p=>i.reduce((_,b,x)=>_+a[x]*s**(l-x)*c**x*b[p],0));return new f(h,"lab")}}else throw new RangeError("No point in running bezier with only one color.");return t};var Yn=e=>{const t=Xn(e);return t.scale=()=>pe(t),t};const{round:at}=Math;f.prototype.rgb=function(e=!0){return e===!1?this._rgb.slice(0,3):this._rgb.slice(0,3).map(at)},f.prototype.rgba=function(e=!0){return this._rgb.slice(0,4).map((t,n)=>n<3?e===!1?t:at(t):t)},Object.assign(E,{rgb:(...e)=>new f(...e,"rgb")}),y.format.rgb=(...e)=>{const t=k(e,"rgba");return t[3]===void 0&&(t[3]=1),t},y.autodetect.push({p:3,test:(...e)=>{if(e=k(e,"rgba"),M(e)==="array"&&(e.length===3||e.length===4&&M(e[3])=="number"&&e[3]>=0&&e[3]<=1))return"rgb"}});const X=(e,t,n)=>{if(!X[n])throw new Error("unknown blend mode "+n);return X[n](e,t)},K=e=>(t,n)=>{const o=E(n).rgb(),r=E(t).rgb();return E.rgb(e(o,r))},V=e=>(t,n)=>{const o=[];return o[0]=e(t[0],n[0]),o[1]=e(t[1],n[1]),o[2]=e(t[2],n[2]),o},Un=e=>e,Fn=(e,t)=>e*t/255,qn=(e,t)=>e>t?t:e,Zn=(e,t)=>e>t?e:t,Wn=(e,t)=>255*(1-(1-e/255)*(1-t/255)),Kn=(e,t)=>t<128?2*e*t/255:255*(1-2*(1-e/255)*(1-t/255)),Vn=(e,t)=>255*(1-(1-t/255)/(e/255)),Jn=(e,t)=>e===255?255:(e=255*(t/255)/(1-e/255),e>255?255:e);X.normal=K(V(Un)),X.multiply=K(V(Fn)),X.screen=K(V(Wn)),X.overlay=K(V(Kn)),X.darken=K(V(qn)),X.lighten=K(V(Zn)),X.dodge=K(V(Jn)),X.burn=K(V(Vn));const{pow:Qn,sin:eo,cos:to}=Math;function no(e=300,t=-1.5,n=1,o=1,r=[0,1]){let i=0,a;M(r)==="array"?a=r[1]-r[0]:(a=0,r=[r,r]);const l=function(c){const s=F*((e+120)/360+t*c),h=Qn(r[0]+a*c,o),_=(i!==0?n[0]+c*i:n)*h*(1-h)/2,b=to(s),x=eo(s),$=h+_*(-.14861*b+1.78277*x),d=h+_*(-.29227*b-.90649*x),m=h+_*(1.97294*b);return E(we([$*255,d*255,m*255,1]))};return l.start=function(c){return c==null?e:(e=c,l)},l.rotations=function(c){return c==null?t:(t=c,l)},l.gamma=function(c){return c==null?o:(o=c,l)},l.hue=function(c){return c==null?n:(n=c,M(n)==="array"?(i=n[1]-n[0],i===0&&(n=n[1])):i=0,l)},l.lightness=function(c){return c==null?r:(M(c)==="array"?(r=c,a=c[1]-c[0]):(r=[c,c],a=0),l)},l.scale=()=>E.scale(l),l.hue(n),l}const oo="0123456789abcdef",{floor:ro,random:io}=Math;var ao=()=>{let e="#";for(let t=0;t<6;t++)e+=oo.charAt(ro(io()*16));return new f(e,"hex")};const{log:lt,pow:lo,floor:co,abs:so}=Math;function ct(e,t=null){const n={min:Number.MAX_VALUE,max:Number.MAX_VALUE*-1,sum:0,values:[],count:0};return M(e)==="object"&&(e=Object.values(e)),e.forEach(o=>{t&&M(o)==="object"&&(o=o[t]),o!=null&&!isNaN(o)&&(n.values.push(o),n.sum+=o,o<n.min&&(n.min=o),o>n.max&&(n.max=o),n.count+=1)}),n.domain=[n.min,n.max],n.limits=(o,r)=>st(n,o,r),n}function st(e,t="equal",n=7){M(e)=="array"&&(e=ct(e));const{min:o,max:r}=e,i=e.values.sort((l,c)=>l-c);if(n===1)return[o,r];const a=[];if(t.substr(0,1)==="c"&&(a.push(o),a.push(r)),t.substr(0,1)==="e"){a.push(o);for(let l=1;l<n;l++)a.push(o+l/n*(r-o));a.push(r)}else if(t.substr(0,1)==="l"){if(o<=0)throw new Error("Logarithmic scales are only possible for values > 0");const l=Math.LOG10E*lt(o),c=Math.LOG10E*lt(r);a.push(o);for(let s=1;s<n;s++)a.push(lo(10,l+s/n*(c-l)));a.push(r)}else if(t.substr(0,1)==="q"){a.push(o);for(let l=1;l<n;l++){const c=(i.length-1)*l/n,s=co(c);if(s===c)a.push(i[s]);else{const h=c-s;a.push(i[s]*(1-h)+i[s+1]*h)}}a.push(r)}else if(t.substr(0,1)==="k"){let l;const c=i.length,s=new Array(c),h=new Array(n);let p=!0,_=0,b=null;b=[],b.push(o);for(let d=1;d<n;d++)b.push(o+d/n*(r-o));for(b.push(r);p;){for(let m=0;m<n;m++)h[m]=0;for(let m=0;m<c;m++){const C=i[m];let N=Number.MAX_VALUE,L;for(let S=0;S<n;S++){const w=so(b[S]-C);w<N&&(N=w,L=S),h[L]++,s[m]=L}}const d=new Array(n);for(let m=0;m<n;m++)d[m]=null;for(let m=0;m<c;m++)l=s[m],d[l]===null?d[l]=i[m]:d[l]+=i[m];for(let m=0;m<n;m++)d[m]*=1/h[m];p=!1;for(let m=0;m<n;m++)if(d[m]!==b[m]){p=!0;break}b=d,_++,_>200&&(p=!1)}const x={};for(let d=0;d<n;d++)x[d]=[];for(let d=0;d<c;d++)l=s[d],x[l].push(i[d]);let $=[];for(let d=0;d<n;d++)$.push(x[d][0]),$.push(x[d][x[d].length-1]);$=$.sort((d,m)=>d-m),a.push($[0]);for(let d=1;d<$.length;d+=2){const m=$[d];!isNaN(m)&&a.indexOf(m)===-1&&a.push(m)}}return a}var uo=(e,t)=>{e=new f(e),t=new f(t);const n=e.luminance(),o=t.luminance();return n>o?(n+.05)/(o+.05):(o+.05)/(n+.05)};/**
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
 */const ut=.027,fo=5e-4,ho=.1,ft=1.14,de=.022,ht=1.414;var _o=(e,t)=>{e=new f(e),t=new f(t),e.alpha()<1&&(e=ne(t,e,e.alpha(),"rgb"));const n=_t(...e.rgb()),o=_t(...t.rgb()),r=n>=de?n:n+Math.pow(de-n,ht),i=o>=de?o:o+Math.pow(de-o,ht),a=Math.pow(i,.56)-Math.pow(r,.57),l=Math.pow(i,.65)-Math.pow(r,.62),c=Math.abs(i-r)<fo?0:r<i?a*ft:l*ft;return(Math.abs(c)<ho?0:c>0?c-ut:c+ut)*100};function _t(e,t,n){return .2126729*Math.pow(e/255,2.4)+.7151522*Math.pow(t/255,2.4)+.072175*Math.pow(n/255,2.4)}const{sqrt:Z,pow:G,min:po,max:bo,atan2:pt,abs:dt,cos:be,sin:bt,exp:mo,PI:mt}=Math;function go(e,t,n=1,o=1,r=1){var i=function(Ue){return 360*Ue/(2*mt)},a=function(Ue){return 2*mt*Ue/360};e=new f(e),t=new f(t);const[l,c,s]=Array.from(e.lab()),[h,p,_]=Array.from(t.lab()),b=(l+h)/2,x=Z(G(c,2)+G(s,2)),$=Z(G(p,2)+G(_,2)),d=(x+$)/2,m=.5*(1-Z(G(d,7)/(G(d,7)+G(25,7)))),C=c*(1+m),N=p*(1+m),L=Z(G(C,2)+G(s,2)),S=Z(G(N,2)+G(_,2)),w=(L+S)/2,u=i(pt(s,C)),g=i(pt(_,N)),z=u>=0?u:u+360,v=g>=0?g:g+360,T=dt(z-v)>180?(z+v+360)/2:(z+v)/2,R=1-.17*be(a(T-30))+.24*be(a(2*T))+.32*be(a(3*T+6))-.2*be(a(4*T-63));let P=v-z;P=dt(P)<=180?P:v<=z?P+360:P-360,P=2*Z(L*S)*bt(a(P)/2);const Q=h-l,ue=S-L,xe=1+.015*G(b-50,2)/Z(20+G(b-50,2)),ye=1+.045*w,Gt=1+.015*w*R,Io=30*mo(-G((T-275)/25,2)),Do=-(2*Z(G(w,7)/(G(w,7)+G(25,7))))*bt(2*a(Io)),Ho=Z(G(Q/(n*xe),2)+G(ue/(o*ye),2)+G(P/(r*Gt),2)+Do*(ue/(o*ye))*(P/(r*Gt)));return bo(0,po(100,Ho))}function vo(e,t,n="lab"){e=new f(e),t=new f(t);const o=e.get(n),r=t.get(n);let i=0;for(let a in o){const l=(o[a]||0)-(r[a]||0);i+=l*l}return Math.sqrt(i)}var xo=(...e)=>{try{return new f(...e),!0}catch{return!1}},yo={cool(){return pe([E.hsl(180,1,.9),E.hsl(250,.7,.4)])},hot(){return pe(["#000","#f00","#ff0","#fff"]).mode("rgb")}};const Be={OrRd:["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"],PuBu:["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"],BuPu:["#f7fcfd","#e0ecf4","#bfd3e6","#9ebcda","#8c96c6","#8c6bb1","#88419d","#810f7c","#4d004b"],Oranges:["#fff5eb","#fee6ce","#fdd0a2","#fdae6b","#fd8d3c","#f16913","#d94801","#a63603","#7f2704"],BuGn:["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"],YlOrBr:["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],YlGn:["#ffffe5","#f7fcb9","#d9f0a3","#addd8e","#78c679","#41ab5d","#238443","#006837","#004529"],Reds:["#fff5f0","#fee0d2","#fcbba1","#fc9272","#fb6a4a","#ef3b2c","#cb181d","#a50f15","#67000d"],RdPu:["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"],Greens:["#f7fcf5","#e5f5e0","#c7e9c0","#a1d99b","#74c476","#41ab5d","#238b45","#006d2c","#00441b"],YlGnBu:["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"],Purples:["#fcfbfd","#efedf5","#dadaeb","#bcbddc","#9e9ac8","#807dba","#6a51a3","#54278f","#3f007d"],GnBu:["#f7fcf0","#e0f3db","#ccebc5","#a8ddb5","#7bccc4","#4eb3d3","#2b8cbe","#0868ac","#084081"],Greys:["#ffffff","#f0f0f0","#d9d9d9","#bdbdbd","#969696","#737373","#525252","#252525","#000000"],YlOrRd:["#ffffcc","#ffeda0","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"],PuRd:["#f7f4f9","#e7e1ef","#d4b9da","#c994c7","#df65b0","#e7298a","#ce1256","#980043","#67001f"],Blues:["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08519c","#08306b"],PuBuGn:["#fff7fb","#ece2f0","#d0d1e6","#a6bddb","#67a9cf","#3690c0","#02818a","#016c59","#014636"],Viridis:["#440154","#482777","#3f4a8a","#31678e","#26838f","#1f9d8a","#6cce5a","#b6de2b","#fee825"],Spectral:["#9e0142","#d53e4f","#f46d43","#fdae61","#fee08b","#ffffbf","#e6f598","#abdda4","#66c2a5","#3288bd","#5e4fa2"],RdYlGn:["#a50026","#d73027","#f46d43","#fdae61","#fee08b","#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"],RdBu:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#f7f7f7","#d1e5f0","#92c5de","#4393c3","#2166ac","#053061"],PiYG:["#8e0152","#c51b7d","#de77ae","#f1b6da","#fde0ef","#f7f7f7","#e6f5d0","#b8e186","#7fbc41","#4d9221","#276419"],PRGn:["#40004b","#762a83","#9970ab","#c2a5cf","#e7d4e8","#f7f7f7","#d9f0d3","#a6dba0","#5aae61","#1b7837","#00441b"],RdYlBu:["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"],BrBG:["#543005","#8c510a","#bf812d","#dfc27d","#f6e8c3","#f5f5f5","#c7eae5","#80cdc1","#35978f","#01665e","#003c30"],RdGy:["#67001f","#b2182b","#d6604d","#f4a582","#fddbc7","#ffffff","#e0e0e0","#bababa","#878787","#4d4d4d","#1a1a1a"],PuOr:["#7f3b08","#b35806","#e08214","#fdb863","#fee0b6","#f7f7f7","#d8daeb","#b2abd2","#8073ac","#542788","#2d004b"],Set2:["#66c2a5","#fc8d62","#8da0cb","#e78ac3","#a6d854","#ffd92f","#e5c494","#b3b3b3"],Accent:["#7fc97f","#beaed4","#fdc086","#ffff99","#386cb0","#f0027f","#bf5b17","#666666"],Set1:["#e41a1c","#377eb8","#4daf4a","#984ea3","#ff7f00","#ffff33","#a65628","#f781bf","#999999"],Set3:["#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f"],Dark2:["#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#666666"],Paired:["#a6cee3","#1f78b4","#b2df8a","#33a02c","#fb9a99","#e31a1c","#fdbf6f","#ff7f00","#cab2d6","#6a3d9a","#ffff99","#b15928"],Pastel2:["#b3e2cd","#fdcdac","#cbd5e8","#f4cae4","#e6f5c9","#fff2ae","#f1e2cc","#cccccc"],Pastel1:["#fbb4ae","#b3cde3","#ccebc5","#decbe4","#fed9a6","#ffffcc","#e5d8bd","#fddaec","#f2f2f2"]},gt=Object.keys(Be),vt=new Map(gt.map(e=>[e.toLowerCase(),e])),wo=typeof Proxy=="function"?new Proxy(Be,{get(e,t){const n=t.toLowerCase();if(vt.has(n))return e[vt.get(n)]},getOwnPropertyNames(){return Object.getOwnPropertyNames(gt)}}):Be,zo=(...e)=>{e=k(e,"cmyk");const[t,n,o,r]=e,i=e.length>4?e[4]:1;return r===1?[0,0,0,i]:[t>=1?0:255*(1-t)*(1-r),n>=1?0:255*(1-n)*(1-r),o>=1?0:255*(1-o)*(1-r),i]},{max:xt}=Math,ko=(...e)=>{let[t,n,o]=k(e,"rgb");t=t/255,n=n/255,o=o/255;const r=1-xt(t,xt(n,o)),i=r<1?1/(1-r):0,a=(1-t-r)*i,l=(1-n-r)*i,c=(1-o-r)*i;return[a,l,c,r]};f.prototype.cmyk=function(){return ko(this._rgb)},Object.assign(E,{cmyk:(...e)=>new f(...e,"cmyk")}),y.format.cmyk=zo,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"cmyk"),M(e)==="array"&&e.length===4)return"cmyk"}});const Eo=(...e)=>{const t=k(e,"hsla");let n=ee(e)||"lsa";return t[0]=I(t[0]||0)+"deg",t[1]=I(t[1]*100)+"%",t[2]=I(t[2]*100)+"%",n==="hsla"||t.length>3&&t[3]<1?(t[3]="/ "+(t.length>3?t[3]:1),n="hsla"):t.length=3,`${n.substr(0,3)}(${t.join(" ")})`},Mo=(...e)=>{const t=k(e,"lab");let n=ee(e)||"lab";return t[0]=I(t[0])+"%",t[1]=I(t[1]),t[2]=I(t[2]),n==="laba"||t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`lab(${t.join(" ")})`},Ro=(...e)=>{const t=k(e,"lch");let n=ee(e)||"lab";return t[0]=I(t[0])+"%",t[1]=I(t[1]),t[2]=isNaN(t[2])?"none":I(t[2])+"deg",n==="lcha"||t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`lch(${t.join(" ")})`},To=(...e)=>{const t=k(e,"lab");return t[0]=I(t[0]*100)+"%",t[1]=ze(t[1]),t[2]=ze(t[2]),t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`oklab(${t.join(" ")})`},yt=(...e)=>{const[t,n,o,...r]=k(e,"rgb"),[i,a,l]=Se(t,n,o),[c,s,h]=tt(i,a,l);return[c,s,h,...r.length>0&&r[0]<1?[r[0]]:[]]},Ao=(...e)=>{const t=k(e,"lch");return t[0]=I(t[0]*100)+"%",t[1]=ze(t[1]),t[2]=isNaN(t[2])?"none":I(t[2])+"deg",t.length>3&&t[3]<1?t[3]="/ "+(t.length>3?t[3]:1):t.length=3,`oklch(${t.join(" ")})`},{round:Ie}=Math,$o=(...e)=>{const t=k(e,"rgba");let n=ee(e)||"rgb";if(n.substr(0,3)==="hsl")return Eo(ot(t),n);if(n.substr(0,3)==="lab"){const o=se();q("d50");const r=Mo(Re(t),n);return q(o),r}if(n.substr(0,3)==="lch"){const o=se();q("d50");const r=Ro(Le(t),n);return q(o),r}return n.substr(0,5)==="oklab"?To(Se(t)):n.substr(0,5)==="oklch"?Ao(yt(t)):(t[0]=Ie(t[0]),t[1]=Ie(t[1]),t[2]=Ie(t[2]),(n==="rgba"||t.length>3&&t[3]<1)&&(t[3]="/ "+(t.length>3?t[3]:1),n="rgba"),`${n.substr(0,3)}(${t.slice(0,n==="rgb"?3:4).join(" ")})`)},wt=(...e)=>{e=k(e,"lch");const[t,n,o,...r]=e,[i,a,l]=et(t,n,o),[c,s,h]=Pe(i,a,l);return[c,s,h,...r.length>0&&r[0]<1?[r[0]]:[]]},W=/((?:-?\d+)|(?:-?\d+(?:\.\d+)?)%|none)/.source,Y=/((?:-?(?:\d+(?:\.\d*)?|\.\d+)%?)|none)/.source,me=/((?:-?(?:\d+(?:\.\d*)?|\.\d+)%)|none)/.source,D=/\s*/.source,ae=/\s+/.source,De=/\s*,\s*/.source,ge=/((?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:deg)?)|none)/.source,le=/\s*(?:\/\s*((?:[01]|[01]?\.\d+)|\d+(?:\.\d+)?%))?/.source,zt=new RegExp("^rgba?\\("+D+[W,W,W].join(ae)+le+"\\)$"),kt=new RegExp("^rgb\\("+D+[W,W,W].join(De)+D+"\\)$"),Et=new RegExp("^rgba\\("+D+[W,W,W,Y].join(De)+D+"\\)$"),Mt=new RegExp("^hsla?\\("+D+[ge,me,me].join(ae)+le+"\\)$"),Rt=new RegExp("^hsl?\\("+D+[ge,me,me].join(De)+D+"\\)$"),Tt=/^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/,At=new RegExp("^lab\\("+D+[Y,Y,Y].join(ae)+le+"\\)$"),$t=new RegExp("^lch\\("+D+[Y,Y,ge].join(ae)+le+"\\)$"),Lt=new RegExp("^oklab\\("+D+[Y,Y,Y].join(ae)+le+"\\)$"),Ct=new RegExp("^oklch\\("+D+[Y,Y,ge].join(ae)+le+"\\)$"),{round:Nt}=Math,ce=e=>e.map((t,n)=>n<=2?J(Nt(t),0,255):t),O=(e,t=0,n=100,o=!1)=>(typeof e=="string"&&e.endsWith("%")&&(e=parseFloat(e.substring(0,e.length-1))/100,o?e=t+(e+1)*.5*(n-t):e=t+e*(n-t)),+e),B=(e,t)=>e==="none"?t:e,He=e=>{if(e=e.toLowerCase().trim(),e==="transparent")return[0,0,0,0];let t;if(y.format.named)try{return y.format.named(e)}catch{}if((t=e.match(zt))||(t=e.match(kt))){let n=t.slice(1,4);for(let r=0;r<3;r++)n[r]=+O(B(n[r],0),0,255);n=ce(n);const o=t[4]!==void 0?+O(t[4],0,1):1;return n[3]=o,n}if(t=e.match(Et)){const n=t.slice(1,5);for(let o=0;o<4;o++)n[o]=+O(n[o],0,255);return n}if((t=e.match(Mt))||(t=e.match(Rt))){const n=t.slice(1,4);n[0]=+B(n[0].replace("deg",""),0),n[1]=+O(B(n[1],0),0,100)*.01,n[2]=+O(B(n[2],0),0,100)*.01;const o=ce(Ne(n)),r=t[4]!==void 0?+O(t[4],0,1):1;return o[3]=r,o}if(t=e.match(Tt)){const n=t.slice(1,4);n[1]*=.01,n[2]*=.01;const o=Ne(n);for(let r=0;r<3;r++)o[r]=Nt(o[r]);return o[3]=+t[4],o}if(t=e.match(At)){const n=t.slice(1,4);n[0]=O(B(n[0],0),0,100),n[1]=O(B(n[1],0),-125,125,!0),n[2]=O(B(n[2],0),-125,125,!0);const o=se();q("d50");const r=ce(Ee(n));q(o);const i=t[4]!==void 0?+O(t[4],0,1):1;return r[3]=i,r}if(t=e.match($t)){const n=t.slice(1,4);n[0]=O(n[0],0,100),n[1]=O(B(n[1],0),0,150,!1),n[2]=+B(n[2].replace("deg",""),0);const o=se();q("d50");const r=ce($e(n));q(o);const i=t[4]!==void 0?+O(t[4],0,1):1;return r[3]=i,r}if(t=e.match(Lt)){const n=t.slice(1,4);n[0]=O(B(n[0],0),0,1),n[1]=O(B(n[1],0),-.4,.4,!0),n[2]=O(B(n[2],0),-.4,.4,!0);const o=ce(Pe(n)),r=t[4]!==void 0?+O(t[4],0,1):1;return o[3]=r,o}if(t=e.match(Ct)){const n=t.slice(1,4);n[0]=O(B(n[0],0),0,1),n[1]=O(B(n[1],0),0,.4,!1),n[2]=+B(n[2].replace("deg",""),0);const o=ce(wt(n)),r=t[4]!==void 0?+O(t[4],0,1):1;return o[3]=r,o}};He.test=e=>zt.test(e)||Mt.test(e)||At.test(e)||$t.test(e)||Lt.test(e)||Ct.test(e)||kt.test(e)||Et.test(e)||Rt.test(e)||Tt.test(e)||e==="transparent",f.prototype.css=function(e){return $o(this._rgb,e)};const Lo=(...e)=>new f(...e,"css");E.css=Lo,y.format.css=He,y.autodetect.push({p:5,test:(e,...t)=>{if(!t.length&&M(e)==="string"&&He.test(e))return"css"}}),y.format.gl=(...e)=>{const t=k(e,"rgba");return t[0]*=255,t[1]*=255,t[2]*=255,t};const Co=(...e)=>new f(...e,"gl");E.gl=Co,f.prototype.gl=function(){const e=this._rgb;return[e[0]/255,e[1]/255,e[2]/255,e[3]]},f.prototype.hex=function(e){return Ve(this._rgb,e)};const No=(...e)=>new f(...e,"hex");E.hex=No,y.format.hex=Ke,y.autodetect.push({p:4,test:(e,...t)=>{if(!t.length&&M(e)==="string"&&[3,4,5,6,7,8,9].indexOf(e.length)>=0)return"hex"}});const{log:ve}=Math,Pt=e=>{const t=e/100;let n,o,r;return t<66?(n=255,o=t<6?0:-155.25485562709179-.44596950469579133*(o=t-2)+104.49216199393888*ve(o),r=t<20?0:-254.76935184120902+.8274096064007395*(r=t-10)+115.67994401066147*ve(r)):(n=351.97690566805693+.114206453784165*(n=t-55)-40.25366309332127*ve(n),o=325.4494125711974+.07943456536662342*(o=t-50)-28.0852963507957*ve(o),r=255),[n,o,r,1]},{round:Po}=Math,So=(...e)=>{const t=k(e,"rgb"),n=t[0],o=t[2];let r=1e3,i=4e4;const a=.4;let l;for(;i-r>a;){l=(i+r)*.5;const c=Pt(l);c[2]/c[0]>=o/n?i=l:r=l}return Po(l)};f.prototype.temp=f.prototype.kelvin=f.prototype.temperature=function(){return So(this._rgb)};const Xe=(...e)=>new f(...e,"temp");Object.assign(E,{temp:Xe,kelvin:Xe,temperature:Xe}),y.format.temp=y.format.kelvin=y.format.temperature=Pt,f.prototype.oklch=function(){return yt(this._rgb)},Object.assign(E,{oklch:(...e)=>new f(...e,"oklch")}),y.format.oklch=wt,y.autodetect.push({p:2,test:(...e)=>{if(e=k(e,"oklch"),M(e)==="array"&&e.length===3)return"oklch"}}),Object.assign(E,{analyze:ct,average:jn,bezier:Yn,blend:X,brewer:wo,Color:f,colors:te,contrast:uo,contrastAPCA:_o,cubehelix:no,deltaE:go,distance:vo,input:y,interpolate:ne,limits:st,mix:ne,random:ao,scale:pe,scales:yo,valid:xo});let A=null,H=null,Ye=null;const Go=(e,t)=>{const n=e*Math.PI/180,o=t*Math.PI/180,r=Math.cos(o)*Math.sin(n),i=Math.sin(o),a=-Math.cos(o)*Math.cos(n);return[r,i,a]},Oo=e=>{if(A=e.getContext("webgl2"),!A)throw new Error("WebGL not supported");const t=(a,l,c)=>{const s=a.createShader(l);return s?(a.shaderSource(s,c),a.compileShader(s),a.getShaderParameter(s,a.COMPILE_STATUS)?s:(console.error("An error occurred compiling the shaders: "+a.getShaderInfoLog(s)),a.deleteShader(s),null)):(console.error("Unable to create shader"),null)},n=t(A,A.VERTEX_SHADER,jt),o=t(A,A.FRAGMENT_SHADER,Ot);if(!n||!o)throw new Error("Failed to load shaders");if(H=A.createProgram(),!H)throw new Error("Failed to create program");if(A.attachShader(H,n),A.attachShader(H,o),A.linkProgram(H),!A.getProgramParameter(H,A.LINK_STATUS))throw console.error("Unable to initialize the shader program: "+A.getProgramInfoLog(H)),new Error("Failed to link program");A.useProgram(H),Ye=A.createBuffer(),A.bindBuffer(A.ARRAY_BUFFER,Ye);const r=new Float32Array([-1,-1,1,-1,-1,1,1,1]);A.bufferData(A.ARRAY_BUFFER,r,A.STATIC_DRAW);const i=A.getAttribLocation(H,"a_position");A.enableVertexAttribArray(i),A.vertexAttribPointer(i,2,A.FLOAT,!1,0,0)},St=new OffscreenCanvas(256,256),jo=(e,t,n)=>{let o=e.TEXTURE0;Object.entries(n).forEach(([r,{image:i,type:a}])=>{const l=e.createTexture();e.activeTexture(o),e.bindTexture(e.TEXTURE_2D,l);const c=e.getUniformLocation(t,r);e.uniform1i(c,o-e.TEXTURE0),a==="height"?e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,i):e.texImage2D(e.TEXTURE_2D,0,e.RGB,256,1,0,e.RGB,e.UNSIGNED_BYTE,i),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),o+=1})},Bo=(e,t,n)=>{for(const[o,{type:r,value:i}]of Object.entries(n)){const a=e.getUniformLocation(t,o);a!==null&&e[`uniform${r}`](a,i)}};self.onmessage=async e=>{const{center:t,left:n,right:o,top:r,bottom:i,tileId:a,z:l,maxzoom:c,demTypeNumber:s,uniformsData:h,elevationColorArray:p,slopeCorlorArray:_,aspectColorArray:b,floodingImage:x,onlyCenter:$}=e.data;try{if(A||Oo(St),!A||!H||!Ye)throw new Error("WebGL initialization failed");const{elevation:d,slope:m,shadow:C,aspect:N,curvature:L,edge:S,contour:w,flooding:u}=h,g=Go(C.option.azimuth.value,C.option.altitude.value),z={u_dem_type:{type:"1f",value:s},u_only_center:{type:"1i",value:$?1:0},u_zoom_level:{type:"1f",value:l},u_max_zoom:{type:"1f",value:c},u_elevation_mode:{type:"1i",value:d.option.visible.value?1:0},u_slope_mode:{type:"1i",value:m.option.visible.value?1:0},u_shadow_mode:{type:"1i",value:C.option.visible.value?1:0},u_aspect_mode:{type:"1i",value:N.option.visible.value?1:0},u_curvature_mode:{type:"1i",value:L.option.visible.value?1:0},u_edge_mode:{type:"1i",value:S.option.visible.value?1:0},u_contour_mode:{type:"1i",value:w.option.visible.value?1:0},u_flooding_mode:{type:"1i",value:u.option.visible.value?1:0},u_elevation_alpha:{type:"1f",value:d.option.opacity.value},u_slope_alpha:{type:"1f",value:m.option.opacity.value},u_shadow_strength:{type:"1f",value:C.option.opacity.value},u_aspect_alpha:{type:"1f",value:N.option.opacity.value},u_curvature_alpha:{type:"1f",value:L.option.opacity.value},u_edge_alpha:{type:"1f",value:S.option.opacity.value},u_contour_alpha:{type:"1f",value:w.option.opacity.value},u_flooding_alpha:{type:"1f",value:u.option.opacity.value},u_ridge_color:{type:"4fv",value:E(L.option.ridgeColor.value).gl()},u_valley_color:{type:"4fv",value:E(L.option.valleyColor.value).gl()},u_edge_color:{type:"4fv",value:E(S.option.edgeColor.value).gl()},u_shadow_color:{type:"4fv",value:E(C.option.shadowColor.value).gl()},u_highlight_color:{type:"4fv",value:E(C.option.highlightColor.value).gl()},u_contour_color:{type:"4fv",value:E(w.option.contourColor.value).gl()},u_ambient:{type:"1f",value:C.option.ambient.value},u_ridge_threshold:{type:"1f",value:L.option.ridgeThreshold.value},u_valley_threshold:{type:"1f",value:L.option.valleyThreshold.value},u_edge_intensity:{type:"1f",value:S.option.edgeIntensity.value},u_max_height:{type:"1f",value:d.option.maxHeight.value},u_min_height:{type:"1f",value:d.option.minHeight.value},u_contour_max_height:{type:"1f",value:w.option.maxHeight.value},u_light_direction:{type:"3fv",value:g},u_contour_count:{type:"1f",value:w.option.contourCount.value},u_water_level:{type:"1f",value:u.option.waterLevel.value}};Bo(A,H,z),jo(A,H,{u_height_map_center:{image:t,type:"height"},u_height_map_left:{image:n,type:"height"},u_height_map_right:{image:o,type:"height"},u_height_map_top:{image:r,type:"height"},u_height_map_bottom:{image:i,type:"height"},...d.option.visible.value?{u_elevationMap:{image:p,type:"colormap"}}:{},...m.option.visible.value?{u_slopeMap:{image:_,type:"colormap"}}:{},...N.option.visible.value?{u_aspectMap:{image:b,type:"colormap"}}:{},...u.option.visible.value?{u_floodingImage:{image:x,type:"height"}}:{}}),A.clear(A.COLOR_BUFFER_BIT),A.drawArrays(A.TRIANGLE_STRIP,0,4);const v=await St.convertToBlob();if(!v)throw new Error("Failed to convert canvas to blob");const T=await v.arrayBuffer();self.postMessage({id:a,buffer:T})}catch(d){d instanceof Error&&self.postMessage({id:a,error:d.message})}}})();
