#version 300 es
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

}