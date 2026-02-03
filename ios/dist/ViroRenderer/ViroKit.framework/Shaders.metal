//
//  Shaders.metal
//  ViroRenderer
//
//  Created by Raj Advani on 10/13/15.
//  Copyright © 2015 Raj Advani. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining
//  a copy of this software and associated documentation files (the
//  "Software"), to deal in the Software without restriction, including
//  without limitation the rights to use, copy, modify, merge, publish,
//  distribute, sublicense, and/or sell copies of the Software, and to
//  permit persons to whom the Software is furnished to do so, subject to
//  the following conditions:
//
//  The above copyright notice and this permission notice shall be included
//  in all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
//  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
//  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
//  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

#include <simd/simd.h>
#include "VROSharedStructures.h"

#include "VRODefines.h"
#if VRO_METAL

using namespace metal;

struct VROCustomUniforms {
#pragma custom_uniforms
};

constexpr sampler s(coord::normalized,
                    address::repeat,
                    filter::linear,
                    mip_filter::linear);

/* ---------------------------------------
   GEOMETRY ATTRIBUTES
 --------------------------------------- */

typedef struct {
    float3 position       [[ attribute(0) ]];
    float3 normal         [[ attribute(1) ]];
    float4 color          [[ attribute(2) ]];
    float2 texcoord       [[ attribute(3) ]];
} VRORendererAttributes;

/* ---------------------------------------
   MODIFIER STRUCTURES
   --------------------------------------- */

struct VROShaderGeometry {
    float3 position;
    float3 normal;
    float2 texcoord;
    float4 tangent;
    float4 bone_weights;
    int4   bone_indices;
};

struct VROShaderVertex {
    float4 position;
};

struct VROTransforms {
    float4x4 model_matrix;
    float4x4 view_matrix;
    float4x4 projection_matrix;
};

struct VROSurface {
    float4 diffuse_color;
    float2 diffuse_texcoord;
    float  diffuse_intensity;
    float  shininess;
    float3 specular_color;
    float  roughness;
    float  metalness;
    float  ao;
    float  alpha;
    float3 normal;
    float3 position;
    float3 view;
};

/* ---------------------------------------
   SHARED LIGHTING FUNCTIONS
 --------------------------------------- */

float compute_attenuation(constant VROLightUniforms &light,
                          float3 surface_pos,
                          thread float3 *surface_to_light);

float compute_attenuation(constant VROLightUniforms &light,
                          float3 surface_pos,
                          thread float3 *surface_to_light) {
    
    float attenuation = 1.0;
    
    // Directional light
    if (light.type == 1) {
        *surface_to_light = normalize(light.direction);
        attenuation = 1.0;
    }
    
    // Omni + Spot lights
    else {
        *surface_to_light = -normalize(light.position.xyz - surface_pos);
        float distance_to_light = length(light.position.xyz - surface_pos);
        float d = clamp((distance_to_light - light.attenuation_start_distance) /
                        (light.attenuation_end_distance - light.attenuation_start_distance),
                        0.0, 1.0);
        
        attenuation = 1.0 - pow(d, 1.0 / light.attenuation_falloff_exp);
        
        // Spot light
        if (light.type == 3) {
            float light_surface_angle = acos(dot(*surface_to_light, normalize(light.direction)));
            if (light_surface_angle > light.spot_inner_angle) {
                float t = (light_surface_angle - light.spot_inner_angle) / light.spot_outer_angle;
                attenuation = clamp(mix(attenuation, 0.0, t), 0.0, 1.0);
            }
        }
    }
    
    return attenuation;
}

float4 compute_reflection(float3 surface_position, float3 camera_position, float3 normal,
                          texturecube<float> reflect_texture);
float4 compute_reflection(float3 surface_position, float3 camera_position, float3 normal,
                          texturecube<float> reflect_texture) {
    
    float3 surface_to_camera = normalize(surface_position - camera_position);
    float3 reflect_ray = reflect(surface_to_camera, -normal);
    
    return reflect_texture.sample(s, float3(reflect_ray.xy, -reflect_ray.z));
}

/* ---------------------------------------
   CONSTANT LIGHTING MODEL
   --------------------------------------- */

typedef struct {
    float4 position [[ position ]];
    float4 color;
    float2 texcoord;
    
    float3 surface_position;
    
    float3 ambient_color;
    float4 material_color;
    float  diffuse_intensity;
    float  material_alpha;
} VROConstantLightingVertexOut;

vertex VROConstantLightingVertexOut constant_lighting_vertex(VRORendererAttributes attributes [[ stage_in ]],
                                                             constant VROViewUniforms &view [[ buffer(1) ]],
                                                             constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                             constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                             constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma geometry_modifier_uniforms
#pragma vertex_modifier_uniforms

    VROConstantLightingVertexOut out;

    VROShaderGeometry _geometry;
    _geometry.position = attributes.position;
    _geometry.normal = attributes.normal;
    _geometry.texcoord = attributes.texcoord;

    VROTransforms _transforms;
    _transforms.model_matrix = view.model_matrix;
    _transforms.view_matrix = view.view_matrix;
    _transforms.projection_matrix = view.projection_matrix;

#pragma geometry_modifier_body

    float3 v_position = (_transforms.model_matrix * float4(_geometry.position, 1.0)).xyz;
    float4 in_position = float4(_geometry.position, 1.0);
    
    VROShaderVertex _vertex;
    _vertex.position = view.modelview_projection_matrix * in_position;

#pragma vertex_modifier_body

    out.position = _vertex.position;
    out.texcoord = _geometry.texcoord;
    out.ambient_color = lighting.ambient_light_color;
    out.material_color = material.diffuse_surface_color;
    out.diffuse_intensity = material.diffuse_intensity;
    out.material_alpha = material.alpha;
    out.surface_position = v_position;
    
    return out;
}

fragment float4 constant_lighting_fragment_c(VROConstantLightingVertexOut in [[ stage_in ]],
                                             constant VROMaterialUniforms &material [[ buffer(2) ]],
                                             constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                             constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = material.shininess;
    _surface.roughness = material.roughness;
    _surface.metalness = material.metalness;
    _surface.ao = material.ao;
    _surface.normal = float3(0, 0, 1);
    _surface.view = normalize(in.camera_position - in.surface_position);
    _surface.diffuse_texcoord = float2(0, 0);
    _surface.specular_texcoord = float2(0, 0);
    _surface.alpha = in.material_alpha;
    
#pragma surface_modifier_body

    float4 frag_color = float4(_surface.diffuse_color.xyz * lighting.ambient_light_color + _surface.diffuse_color.xyz * in.diffuse_intensity,
                               _surface.alpha * _surface.diffuse_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 constant_lighting_fragment_t(VROConstantLightingVertexOut in [[ stage_in ]],
                                             texture2d<float> texture [[ texture(0) ]],
                                             constant VROMaterialUniforms &material [[ buffer(2) ]],
                                             constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                             constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = material.shininess;
    _surface.normal = float3(0, 0, 1);
    _surface.alpha = in.material_alpha;

#pragma surface_modifier_body

    float4 frag_color = float4(_surface.diffuse_color.xyz * lighting.ambient_light_color + _surface.diffuse_color.xyz * in.diffuse_intensity,
                               _surface.alpha * _surface.diffuse_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 constant_lighting_fragment_q(VROConstantLightingVertexOut in [[ stage_in ]],
                                             texturecube<float> texture [[ texture(0) ]],
                                             constant VROMaterialUniforms &material [[ buffer(2) ]],
                                             constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                             constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float3 texcoord = float3(in.surface_position.x, in.surface_position.y, -in.surface_position.z);
    float4 texture_color = texture.sample(s, texcoord);

    VROSurface _surface;
    _surface.diffuse_color = in.material_color * texture_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = material.shininess;
    _surface.normal = float3(0, 0, 1);
    _surface.alpha = in.material_alpha;

#pragma surface_modifier_body

    float4 frag_color = float4(_surface.diffuse_color.xyz * lighting.ambient_light_color + _surface.diffuse_color.xyz * in.diffuse_intensity, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

/* ---------------------------------------
 LAMBERT LIGHTING MODEL
 --------------------------------------- */

typedef struct {
    float4 position [[ position ]];
    float3 normal;
    float4 color;
    float2 texcoord;
    
    float3 surface_position;
    float3 camera_position;
    
    float3 ambient_color;
    float4 material_color;
    float  diffuse_intensity;
    float  material_alpha;
} VROLambertLightingVertexOut;

vertex VROLambertLightingVertexOut lambert_lighting_vertex(VRORendererAttributes attributes [[ stage_in ]],
                                                           constant VROViewUniforms &view [[ buffer(1) ]],
                                                           constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                           constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                           constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma geometry_modifier_uniforms
#pragma vertex_modifier_uniforms

    VROLambertLightingVertexOut out;

    VROShaderGeometry _geometry;
    _geometry.position = attributes.position;
    _geometry.normal = attributes.normal;
    _geometry.texcoord = attributes.texcoord;
    _geometry.color = attributes.color;

    VROTransforms _transforms;
    _transforms.model_matrix = view.model_matrix;
    _transforms.view_matrix = view.view_matrix;
    _transforms.projection_matrix = view.projection_matrix;
    _transforms.normal_matrix = view.normal_matrix;
    _transforms.modelview_matrix = view.modelview_matrix;

#pragma geometry_modifier_body

    float3 v_position = (_transforms.model_matrix * float4(_geometry.position, 1.0)).xyz;
    float4 in_position = float4(_geometry.position, 1.0);
    
    VROShaderVertex _vertex;
    _vertex.position = view.modelview_projection_matrix * in_position;

#pragma vertex_modifier_body
    
    out.position = _vertex.position;
    out.texcoord = _geometry.texcoord;
    out.color = _geometry.color;
    
    out.surface_position = v_position;
    out.camera_position  = view.camera_position;
    out.normal = normalize((_transforms.normal_matrix * float4(_geometry.normal, 0.0)).xyz);
    
    out.ambient_color = lighting.ambient_light_color;
    out.material_color = material.diffuse_surface_color;
    out.diffuse_intensity = material.diffuse_intensity;
    out.material_alpha = material.alpha;
    
    return out;
}

float3 apply_light_lambert(constant VROLightUniforms &light,
                           float3 surface_pos,
                           float3 surface_normal,
                           float4 material_color);
float3 apply_light_lambert(constant VROLightUniforms &light,
                           float3 surface_pos,
                           float3 surface_normal,
                           float4 material_color) {
    
    thread float3 surface_to_light;
    float attenuation = compute_attenuation(light, surface_pos, &surface_to_light);
    
    float diffuse_coeff = fmax(0.0, dot(-surface_normal, surface_to_light));
    return attenuation * diffuse_coeff * material_color.rgb * light.color;
}

float4 lambert_lighting_diffuse_fixed(VROLambertLightingVertexOut in,
                                      constant VROSceneLightingUniforms &lighting);
float4 lambert_lighting_diffuse_fixed(VROLambertLightingVertexOut in,
                                      constant VROSceneLightingUniforms &lighting) {
    float3 ambient_light_color = in.ambient_color * in.material_color.xyz;
    float4 material_diffuse_color = in.material_color * in.diffuse_intensity;
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_lambert(lighting.lights[i],
                                                      in.surface_position,
                                                      in.normal,
                                                      material_diffuse_color);
    }
    
    return float4(ambient_light_color + diffuse_light_color,
                  in.material_alpha * in.material_color.a);
}

float4 lambert_lighting_diffuse_texture(VROLambertLightingVertexOut in,
                                        texture2d<float> texture,
                                        constant VROSceneLightingUniforms &lighting);
float4 lambert_lighting_diffuse_texture(VROLambertLightingVertexOut in,
                                        texture2d<float> texture,
                                        constant VROSceneLightingUniforms &lighting) {
    
    float4 diffuse_texture_color = texture.sample(s, in.texcoord);
    float3 ambient_light_color = in.ambient_color * diffuse_texture_color.xyz;
    
    float4 material_diffuse_color = diffuse_texture_color * in.diffuse_intensity;
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_lambert(lighting.lights[i],
                                                      in.surface_position,
                                                      in.normal,
                                                      material_diffuse_color);
    }
    
    return float4(ambient_light_color + diffuse_light_color,
                  in.material_alpha * diffuse_texture_color.a);
}

fragment float4 lambert_lighting_fragment_c(VROLambertLightingVertexOut in [[ stage_in ]],
                                            constant VROMaterialUniforms &material [[ buffer(2) ]],
                                            constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                            constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = 0;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * in.material_color.a;

#pragma surface_modifier_body

    float3 ambient_light_color = in.ambient_color * _surface.diffuse_color.xyz;
    float4 material_diffuse_color = _surface.diffuse_color * in.diffuse_intensity;
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_lambert(lighting.lights[i],
                                                      in.surface_position,
                                                      _surface.normal,
                                                      material_diffuse_color);
    }
    
    float4 frag_color = float4(ambient_light_color + diffuse_light_color, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 lambert_lighting_fragment_c_reflect(VROLambertLightingVertexOut in [[ stage_in ]],
                                                    texturecube<float> reflect_texture [[ texture(0) ]],
                                                    constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                    constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                    constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * in.material_color.a;

#pragma surface_modifier_body

    float4 reflective_color = compute_reflection(in.surface_position, in.camera_position, _surface.normal, reflect_texture);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_lambert(lighting.lights[i],
                                                      in.surface_position,
                                                      _surface.normal,
                                                      _surface.diffuse_color.xyz,
                                                      in.diffuse_intensity);
    }
    float4 lighting_color = float4(in.ambient_color * _surface.diffuse_color.xyz + diffuse_light_color, _surface.alpha);
    
    float4 frag_color = float4(lighting_color.xyz + reflective_color.xyz, lighting_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 lambert_lighting_fragment_t(VROLambertLightingVertexOut in [[ stage_in ]],
                                            texture2d<float> texture [[ texture(0) ]],
                                            constant VROMaterialUniforms &material [[ buffer(2) ]],
                                            constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                            constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color * in.material_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = 0;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * diffuse_texture_color.a * in.material_color.a;

#pragma surface_modifier_body

    float3 ambient_light_color = in.ambient_color * _surface.diffuse_color.xyz;
    float4 material_diffuse_color = _surface.diffuse_color * in.diffuse_intensity;
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_lambert(lighting.lights[i],
                                                      in.surface_position,
                                                      _surface.normal,
                                                      material_diffuse_color);
    }
    
    float4 frag_color = float4(ambient_light_color + diffuse_light_color, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 lambert_lighting_fragment_t_reflect(VROLambertLightingVertexOut in [[ stage_in ]],
                                                    texture2d<float> texture [[ texture(0) ]],
                                                    texturecube<float> reflect_texture [[ texture(1) ]],
                                                    constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                    constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                    constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color * in.material_color;
    _surface.specular_color = float4(0, 0, 0, 0);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * diffuse_texture_color.a * in.material_color.a;

#pragma surface_modifier_body

    float4 reflective_color = compute_reflection(in.surface_position, in.camera_position, _surface.normal, reflect_texture);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_lambert(lighting.lights[i],
                                                      in.surface_position,
                                                      _surface.normal,
                                                      _surface.diffuse_color.xyz,
                                                      in.diffuse_intensity);
    }
    float4 lighting_color = float4(in.ambient_color * _surface.diffuse_color.xyz + diffuse_light_color, _surface.alpha);
    
    float4 frag_color = float4(lighting_color.xyz + reflective_color.xyz, lighting_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

/* ---------------------------------------
   PHONG LIGHTING MODEL
   --------------------------------------- */

typedef struct {
    float4 position [[ position ]];
    float3 normal;
    float4 color;
    float2 texcoord;
    
    float3 surface_position;
    float3 camera_position;
    
    float3 ambient_color;
    float4 material_color;
    float  material_shininess;
    float  diffuse_intensity;
    float  material_alpha;
} VROPhongLightingVertexOut;

vertex VROPhongLightingVertexOut phong_lighting_vertex(VRORendererAttributes attributes [[ stage_in ]],
                                                       constant VROViewUniforms &view [[ buffer(1) ]],
                                                       constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                       constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                       constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma geometry_modifier_uniforms
#pragma vertex_modifier_uniforms

    VROPhongLightingVertexOut out;

    VROShaderGeometry _geometry;
    _geometry.position = attributes.position;
    _geometry.normal = attributes.normal;
    _geometry.texcoord = attributes.texcoord;
    _geometry.color = attributes.color;

    VROTransforms _transforms;
    _transforms.model_matrix = view.model_matrix;
    _transforms.view_matrix = view.view_matrix;
    _transforms.projection_matrix = view.projection_matrix;
    _transforms.normal_matrix = view.normal_matrix;
    _transforms.modelview_matrix = view.modelview_matrix;

#pragma geometry_modifier_body

    float3 v_position = (_transforms.model_matrix * float4(_geometry.position, 1.0)).xyz;
    float4 in_position = float4(_geometry.position, 1.0);
    
    VROShaderVertex _vertex;
    _vertex.position = view.modelview_projection_matrix * in_position;

#pragma vertex_modifier_body
    
    out.position = _vertex.position;
    out.texcoord = _geometry.texcoord;
    out.color = _geometry.color;
    
    out.surface_position = v_position;
    out.camera_position  = view.camera_position;
    out.normal = normalize((_transforms.normal_matrix * float4(_geometry.normal, 0.0)).xyz);
    
    out.ambient_color = lighting.ambient_light_color;
    out.material_color = material.diffuse_surface_color;
    out.material_shininess = material.shininess;
    out.diffuse_intensity = material.diffuse_intensity;
    out.material_alpha = material.alpha;
    
    return out;
}

float3 apply_light_phong(constant VROLightUniforms &light,
                         float3 surface_pos,
                         float3 surface_normal,
                         float3 surface_to_camera,
                         float4 material_diffuse_color,
                         float4 material_specular_color,
                         float  material_shininess);
float3 apply_light_phong(constant VROLightUniforms &light,
                         float3 surface_pos,
                         float3 surface_normal,
                         float3 surface_to_camera,
                         float4 material_diffuse_color,
                         float4 material_specular_color,
                         float  material_shininess) {
    
    thread float3 surface_to_light;
    float attenuation = compute_attenuation(light, surface_pos, &surface_to_light);
    
    // Diffuse
    float diffuse_coeff = fmax(0.0, dot(-surface_normal, surface_to_light));
    float3 diffuse = diffuse_coeff * material_diffuse_color.rgb * light.color;
    
    // Specular
    float specular_coeff = 0.0;
    if (diffuse_coeff > 0.0) {
        specular_coeff = pow(max(0.0, dot(surface_to_camera,
                                          reflect(surface_to_light, -surface_normal))),
                             material_shininess);
    }

    float3 specular = specular_coeff * material_specular_color.rgb * light.color;
    return attenuation * (diffuse + specular);
}

float4 phong_lighting_diffuse_fixed(VROPhongLightingVertexOut in [[ stage_in ]],
                                    texture2d<float> specular_texture [[ texture(0) ]],
                                    constant VROSceneLightingUniforms &lighting [[ buffer(0) ]]);
float4 phong_lighting_diffuse_fixed(VROPhongLightingVertexOut in [[ stage_in ]],
                                    texture2d<float> specular_texture [[ texture(0) ]],
                                    constant VROSceneLightingUniforms &lighting [[ buffer(0) ]]) {
    
    float3 ambient_light_color = in.ambient_color * in.material_color.xyz;

    float4 material_diffuse_color = in.material_color * in.diffuse_intensity;
    float4 material_specular_color = specular_texture.sample(s, in.texcoord);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_phong(lighting.lights[i],
                                                    in.surface_position,
                                                    in.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    material_specular_color,
                                                    in.material_shininess);
    }
    
    return float4(ambient_light_color + diffuse_light_color,
                  in.material_alpha * in.material_color.a);
}

float4 phong_lighting_diffuse_texture(VROPhongLightingVertexOut in [[ stage_in ]],
                                      texture2d<float> diffuse_texture [[ texture(0) ]],
                                      texture2d<float> specular_texture [[ texture(1) ]],
                                      constant VROSceneLightingUniforms &lighting [[ buffer(0) ]]);
float4 phong_lighting_diffuse_texture(VROPhongLightingVertexOut in [[ stage_in ]],
                                      texture2d<float> diffuse_texture [[ texture(0) ]],
                                      texture2d<float> specular_texture [[ texture(1) ]],
                                      constant VROSceneLightingUniforms &lighting [[ buffer(0) ]]) {
    
    float4 diffuse_texture_color = diffuse_texture.sample(s, in.texcoord);
    float3 ambient_light_color = in.ambient_color * diffuse_texture_color.xyz;
    
    float4 material_diffuse_color  = diffuse_texture_color * in.diffuse_intensity;
    float4 material_specular_color = specular_texture.sample(s, in.texcoord);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_phong(lighting.lights[i],
                                                    in.surface_position,
                                                    in.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    material_specular_color,
                                                    in.material_shininess);
    }
    
    return float4(ambient_light_color + diffuse_light_color,
                  in.material_alpha * diffuse_texture_color.a);
}

fragment float4 phong_lighting_fragment_c(VROPhongLightingVertexOut in [[ stage_in ]],
                                          texture2d<float> specular_texture [[ texture(0) ]],
                                          constant VROMaterialUniforms &material [[ buffer(2) ]],
                                          constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                          constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * in.material_color.a;

#pragma surface_modifier_body

    float3 ambient_light_color = in.ambient_color * _surface.diffuse_color.xyz;
    float4 material_diffuse_color = _surface.diffuse_color * in.diffuse_intensity;
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_phong(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    
    float4 frag_color = float4(ambient_light_color + diffuse_light_color, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 phong_lighting_fragment_c_reflect(VROPhongLightingVertexOut in [[ stage_in ]],
                                                  texture2d<float> specular_texture [[ texture(0) ]],
                                                  texturecube<float> reflect_texture [[ texture(1) ]],
                                                  constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                  constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                  constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * in.material_color.a;

#pragma surface_modifier_body

    float4 reflective_color = compute_reflection(in.surface_position, in.camera_position, _surface.normal, reflect_texture);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_phong(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    _surface.diffuse_color.xyz,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    float4 lighting_color = float4(in.ambient_color * _surface.diffuse_color.xyz + diffuse_light_color, _surface.alpha);
    
    float4 frag_color = float4(lighting_color.xyz + reflective_color.xyz, lighting_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 phong_lighting_fragment_t(VROPhongLightingVertexOut in [[ stage_in ]],
                                          texture2d<float> diffuse_texture [[ texture(0) ]],
                                          texture2d<float> specular_texture [[ texture(1) ]],
                                          constant VROMaterialUniforms &material [[ buffer(2) ]],
                                          constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                          constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = diffuse_texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color * in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * diffuse_texture_color.a * in.material_color.a;

#pragma surface_modifier_body

    float3 ambient_light_color = in.ambient_color * _surface.diffuse_color.xyz;
    float4 material_diffuse_color = _surface.diffuse_color * in.diffuse_intensity;
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_phong(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    
    float4 frag_color = float4(ambient_light_color + diffuse_light_color, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 phong_lighting_fragment_t_reflect(VROPhongLightingVertexOut in [[ stage_in ]],
                                          texture2d<float> diffuse_texture [[ texture(0) ]],
                                          texture2d<float> specular_texture [[ texture(1) ]],
                                          texturecube<float> reflect_texture [[ texture(2) ]],
                                                  constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                  constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                  constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = diffuse_texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color * in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * diffuse_texture_color.a * in.material_color.a;

#pragma surface_modifier_body

    float4 reflective_color = compute_reflection(in.surface_position, in.camera_position, _surface.normal, reflect_texture);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_phong(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    _surface.diffuse_color.xyz,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    float4 lighting_color = float4(in.ambient_color * _surface.diffuse_color.xyz + diffuse_light_color, _surface.alpha);
    
    float4 frag_color = float4(lighting_color.xyz + reflective_color.xyz, lighting_color.a);

#pragma fragment_modifier_body

    return frag_color;
   --------------------------------------- */

typedef struct {
    float4 position [[ position ]];
    float3 normal;
    float4 color;
    float2 texcoord;
    
    float3 surface_position;
    float3 camera_position;
    
    float3 ambient_color;
    float4 material_color;
    float  material_shininess;
    float  diffuse_intensity;
    float  material_alpha;
} VROBlinnLightingVertexOut;

vertex VROBlinnLightingVertexOut blinn_lighting_vertex(VRORendererAttributes attributes [[ stage_in ]],
                                                       constant VROViewUniforms &view [[ buffer(1) ]],
                                                       constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                       constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                       constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma geometry_modifier_uniforms
#pragma vertex_modifier_uniforms

    VROBlinnLightingVertexOut out;

    VROShaderGeometry _geometry;
    _geometry.position = attributes.position;
    _geometry.normal = attributes.normal;
    _geometry.texcoord = attributes.texcoord;
    _geometry.color = attributes.color;

    VROTransforms _transforms;
    _transforms.model_matrix = view.model_matrix;
    _transforms.view_matrix = view.view_matrix;
    _transforms.projection_matrix = view.projection_matrix;
    _transforms.normal_matrix = view.normal_matrix;
    _transforms.modelview_matrix = view.modelview_matrix;

#pragma geometry_modifier_body

    float3 v_position = (_transforms.model_matrix * float4(_geometry.position, 1.0)).xyz;
    float4 in_position = float4(_geometry.position, 1.0);
    
    VROShaderVertex _vertex;
    _vertex.position = view.modelview_projection_matrix * in_position;

#pragma vertex_modifier_body
    
    out.position = _vertex.position;
    out.texcoord = _geometry.texcoord;
    out.color = _geometry.color;
    
    out.surface_position = v_position;
    out.camera_position  = view.camera_position;
    out.normal = normalize((_transforms.normal_matrix * float4(_geometry.normal, 0.0)).xyz);
    
    out.ambient_color = lighting.ambient_light_color;
    out.material_color = material.diffuse_surface_color;
    out.material_shininess = material.shininess;
    out.diffuse_intensity = material.diffuse_intensity;
    out.material_alpha = material.alpha;
    
    return out;
}

float3 apply_light_blinn(constant VROLightUniforms &light,
                         float3 surface_pos,
                         float3 surface_normal,
                         float3 surface_to_camera,
                         float4 material_diffuse_color,
                         float4 material_specular_color,
                         float  material_shininess);
float3 apply_light_blinn(constant VROLightUniforms &light,
                         float3 surface_pos,
                         float3 surface_normal,
                         float3 surface_to_camera,
                         float4 material_diffuse_color,
                         float4 material_specular_color,
                         float  material_shininess) {
    
    thread float3 surface_to_light;
    float attenuation = compute_attenuation(light, surface_pos, &surface_to_light);
    
    // Diffuse
    float diffuse_coeff = fmax(0.0, dot(-surface_normal, surface_to_light));
    float3 diffuse = diffuse_coeff * material_diffuse_color.rgb * light.color;
    
    // Specular
    float specular_coeff = 0.0;
    if (diffuse_coeff > 0.0) {
        specular_coeff = pow(max(0.0, dot(normalize(-surface_to_camera + surface_to_light),
                                          -surface_normal)),
                             material_shininess);
    }
    
    float3 specular = specular_coeff * material_specular_color.rgb * light.color;
    return attenuation * (diffuse + specular);
}

float4 blinn_lighting_diffuse_fixed(VROBlinnLightingVertexOut in,
                                    texture2d<float> specular_texture,
                                    constant VROSceneLightingUniforms &lighting);
float4 blinn_lighting_diffuse_fixed(VROBlinnLightingVertexOut in,
                                    texture2d<float> specular_texture,
                                    constant VROSceneLightingUniforms &lighting) {
    
    float3 ambient_light_color = in.ambient_color * in.material_color.xyz;

    float4 material_diffuse_color = in.material_color * in.diffuse_intensity;
    float4 material_specular_color = specular_texture.sample(s, in.texcoord);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_blinn(lighting.lights[i],
                                                    in.surface_position,
                                                    in.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    material_specular_color,
                                                    in.material_shininess);
    }
    
    return float4(ambient_light_color + diffuse_light_color,
                  in.material_alpha * in.material_color.a);
}

float4 blinn_lighting_diffuse_texture(VROBlinnLightingVertexOut in,
                                      texture2d<float> diffuse_texture,
                                      texture2d<float> specular_texture,
                                      constant VROSceneLightingUniforms &lighting);
float4 blinn_lighting_diffuse_texture(VROBlinnLightingVertexOut in,
                                      texture2d<float> diffuse_texture,
                                      texture2d<float> specular_texture,
                                      constant VROSceneLightingUniforms &lighting) {
    
    float4 diffuse_texture_color = diffuse_texture.sample(s, in.texcoord);
    float3 ambient_light_color = in.ambient_color * diffuse_texture_color.xyz;
    
    float4 material_diffuse_color  = diffuse_texture_color * in.diffuse_intensity;
    float4 material_specular_color = specular_texture.sample(s, in.texcoord);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_blinn(lighting.lights[i],
                                                    in.surface_position,
                                                    in.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    material_specular_color,
                                                    in.material_shininess);
    }
    
    return float4(ambient_light_color + diffuse_light_color,
                  in.material_alpha * diffuse_texture_color.a);
}

fragment float4 blinn_lighting_fragment_c(VROBlinnLightingVertexOut in [[ stage_in ]],
                                          texture2d<float> specular_texture [[ texture(0) ]],
                                          constant VROMaterialUniforms &material [[ buffer(2) ]],
                                          constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                          constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * in.material_color.a;

#pragma surface_modifier_body

    float3 ambient_light_color = in.ambient_color * _surface.diffuse_color.xyz;
    float4 material_diffuse_color = _surface.diffuse_color * in.diffuse_intensity;
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_blinn(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    
    float4 frag_color = float4(ambient_light_color + diffuse_light_color, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 blinn_lighting_fragment_c_reflect(VROBlinnLightingVertexOut in [[ stage_in ]],
                                                  texture2d<float> specular_texture [[ texture(0) ]],
                                                  texturecube<float> reflect_texture [[ texture(1) ]],
                                                  constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                  constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                  constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    VROSurface _surface;
    _surface.diffuse_color = in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * in.material_color.a;

#pragma surface_modifier_body

    float4 reflective_color = compute_reflection(in.surface_position, in.camera_position, _surface.normal, reflect_texture);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_blinn(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    _surface.diffuse_color.xyz,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    float4 lighting_color = float4(in.ambient_color * _surface.diffuse_color.xyz + diffuse_light_color, _surface.alpha);
    
    float4 frag_color = float4(lighting_color.xyz + reflective_color.xyz, lighting_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 blinn_lighting_fragment_t(VROBlinnLightingVertexOut in [[ stage_in ]],
                                          texture2d<float> diffuse_texture [[ texture(0) ]],
                                          texture2d<float> specular_texture [[ texture(1) ]],
                                          constant VROMaterialUniforms &material [[ buffer(2) ]],
                                          constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                          constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = diffuse_texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color * in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * diffuse_texture_color.a * in.material_color.a;

#pragma surface_modifier_body

    float3 ambient_light_color = in.ambient_color * _surface.diffuse_color.xyz;
    float4 material_diffuse_color = _surface.diffuse_color * in.diffuse_intensity;
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_blinn(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    material_diffuse_color,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    
    float4 frag_color = float4(ambient_light_color + diffuse_light_color, _surface.alpha);

#pragma fragment_modifier_body

    return frag_color;
}

fragment float4 blinn_lighting_fragment_t_reflect(VROBlinnLightingVertexOut in [[ stage_in ]],
                                                  texture2d<float> diffuse_texture [[ texture(0) ]],
                                                  texture2d<float> specular_texture [[ texture(1) ]],
                                                  texturecube<float> reflect_texture [[ texture(2) ]],
                                                  constant VROMaterialUniforms &material [[ buffer(2) ]],
                                                  constant VROCustomUniforms &_custom [[ buffer(3) ]],
                                                  constant VROSceneLightingUniforms &lighting [[ buffer(4) ]]) {
    
#pragma surface_modifier_uniforms
#pragma fragment_modifier_uniforms

    float4 diffuse_texture_color = diffuse_texture.sample(s, in.texcoord);

    VROSurface _surface;
    _surface.diffuse_color = diffuse_texture_color * in.material_color;
    _surface.specular_color = specular_texture.sample(s, in.texcoord);
    _surface.shininess = material.shininess;
    _surface.normal = in.normal;
    _surface.alpha = in.material_alpha * diffuse_texture_color.a * in.material_color.a;

#pragma surface_modifier_body

    float4 reflective_color = compute_reflection(in.surface_position, in.camera_position, _surface.normal, reflect_texture);
    
    float3 diffuse_light_color = float3(0, 0, 0);
    float3 surface_to_camera = normalize(in.camera_position - in.surface_position);
    for (int i = 0; i < lighting.num_lights; i++) {
        diffuse_light_color += apply_light_blinn(lighting.lights[i],
                                                    in.surface_position,
                                                    _surface.normal,
                                                    surface_to_camera,
                                                    _surface.diffuse_color.xyz,
                                                    _surface.specular_color,
                                                    _surface.shininess);
    }
    float4 lighting_color = float4(in.ambient_color * _surface.diffuse_color.xyz + diffuse_light_color, _surface.alpha);
    
    float4 frag_color = float4(lighting_color.xyz + reflective_color.xyz, lighting_color.a);

#pragma fragment_modifier_body

    return frag_color;
}

/* ---------------------------------------
   DISTORTION SHADERS
   --------------------------------------- */

typedef struct {
    float2 position       [[ attribute(0) ]];
    float  vignette       [[ attribute(1) ]];
    float2 red_texcoord   [[ attribute(2) ]];
    float2 green_texcoord [[ attribute(3) ]];
    float2 blue_texcoord  [[ attribute(4) ]];
} VRODistortionAttributes;

typedef struct {
    float4 position [[ position ]];
    float2 texcoord;
    float  vignette;
} VRODistortionVertexOut;

vertex VRODistortionVertexOut distortion_vertex(VRODistortionAttributes attributes [[ stage_in ]],
                                                constant VRODistortionUniforms &uniforms [[ buffer(1) ]]) {
    
    VRODistortionVertexOut out;
    out.position = float4(attributes.position, 0.0, 1.0);
    out.texcoord = attributes.blue_texcoord.xy * uniforms.texcoord_scale;
    out.vignette = attributes.vignette;
    
    return out;
}

fragment float4 distortion_fragment(VRODistortionVertexOut in [[ stage_in ]],
                                    texture2d<float> texture [[ texture(0) ]]) {
    
    return in.vignette * texture.sample(s, in.texcoord);
}

typedef struct {
    float4 position [[ position ]];
    float2 red_texcoord;
    float2 blue_texcoord;
    float2 green_texcoord;
    float  vignette;
} VRODistortionAberrationVertexOut;

vertex VRODistortionAberrationVertexOut distortion_aberration_vertex(VRODistortionAttributes attributes [[ stage_in ]],
                                                                     constant VRODistortionUniforms &uniforms [[ buffer(1) ]]) {
    
    VRODistortionAberrationVertexOut out;
    out.position = float4(attributes.position, 0.0, 1.0);
    out.red_texcoord = attributes.red_texcoord.xy * uniforms.texcoord_scale;
    out.green_texcoord = attributes.green_texcoord.xy * uniforms.texcoord_scale;
    out.blue_texcoord = attributes.blue_texcoord.xy * uniforms.texcoord_scale;
    out.vignette = attributes.vignette;
    
    return out;
}

fragment float4 distortion_aberration_fragment(VRODistortionAberrationVertexOut in [[ stage_in ]],
                                               texture2d<float> texture [[ texture(0) ]]) {
    
    return in.vignette * float4(texture.sample(s, in.red_texcoord).r,
                                texture.sample(s, in.green_texcoord).g,
                                texture.sample(s, in.blue_texcoord).b,
                                1.0);
}

#endif
