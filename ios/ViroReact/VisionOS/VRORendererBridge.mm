// VRORendererBridge.mm
// ViroReact — visionOS
//
// Bridges VRORenderer + VRODriverVisionOS into an ObjC interface consumable
// by ViroImmersiveRenderer.swift.
//
// Matrix convention:
//   Swift computes eyeFromWorld = view.transform × inverse(deviceAnchor) and passes it
//   here as the view transform.  toMatrix4f() copies the 16 floats directly (both are
//   column-major), so no transposition or inversion is needed.

#if __has_include(<CompositorServices/CompositorServices.h>)

#import "VRORendererBridge.h"

// ── C++ includes ─────────────────────────────────────────────────────────────
#include "VRODefines.h"
#if VRO_METAL

#include "VRORenderer.h"
#include "VRODriverVisionOS.h"
#include "VRORendererConfiguration.h"
#include "VROInputControllerBase.h"
#include "VROInputPresenter.h"
#include "VROMatrix4f.h"
#include "VROFieldOfView.h"
#include "VROViewport.h"
#include "VROEye.h"
#include "VROMetalUtils.h"
#include "VROLog.h"
// Test scene
#include "VROSceneController.h"
#include "VROScene.h"
#include "VRONode.h"
#include "VROBox.h"
#include "VROSphere.h"
#include "VROSurface.h"
#include "VROLight.h"
#include "VROMaterial.h"
#include "VROGLTFLoader.h"
#include "VROModelIOUtil.h"
#include "VROThreadRestricted.h"
#include "VROTexture.h"
#include "VROTextureSubstrateMetal.h"
#include "VROSkybox.h"
#include "VROShaderModifier.h"
#import <MetalKit/MetalKit.h>

// Local mirror of VROLightUniforms / VROSceneLightingUniforms from VROSharedStructures.h.
// Cannot include VROSharedStructures.h directly because it typedef-declares a 'VROSurface'
// struct that conflicts with the VROSurface geometry class included above.
struct VROLightUniformsMM {
    int           type;
    simd_float3   position;
    simd_float3   direction;
    simd_float3   color;
    float         attenuation_start_distance;
    float         attenuation_end_distance;
    float         attenuation_falloff_exp;
    float         spot_inner_angle;
    float         spot_outer_angle;
};
struct VROSceneLightingUniformsMM {
    simd_float3        ambient_light_color;
    VROLightUniformsMM lights[8];
    int                num_lights;
};

// ── Stub input controller ─────────────────────────────────────────────────────
// Handles the three remaining pure-virtual methods from VROInputControllerBase.
// Week 4 will replace this with a real hand-tracking controller.

class VROInputControllerVisionOS : public VROInputControllerBase {
public:
    VROInputControllerVisionOS(std::shared_ptr<VRODriver> driver)
        : VROInputControllerBase(driver) {}

    std::string getHeadset()    override { return "visionos"; }
    std::string getController() override { return "hand"; }

protected:
    VROVector3f getDragForwardOffset() override { return { 0, 0, -1 }; }
};

// ── Private implementation ────────────────────────────────────────────────────
@interface VRORendererBridge () {
    std::shared_ptr<VRODriverVisionOS>            _driver;
    std::shared_ptr<VRORenderer>                  _renderer;
    std::shared_ptr<VROInputControllerVisionOS>   _inputController;
    std::shared_ptr<VRONode>                      _cameraNode;
    // Soldier animation loop — shared_ptr keeps the std::function alive across frames.
    // _soldierAnimPending: set to 1 by the GLTF callback (main thread) to signal
    // prepareFrame (render thread) to fire the first execute() on the correct thread.
    // VROTransaction uses thread_local storage, so execute() + update() must share a thread.
    std::shared_ptr<std::function<void()>>        _soldierAnimLoop;
    std::atomic<bool>                             _soldierAnimPending;
    int _frameNumber;
}
@end

@implementation VRORendererBridge

- (instancetype)initWithDevice:(id <MTLDevice>)device {
    self = [super init];
    if (!self) return nil;

    _frameNumber = 0;
    _soldierAnimPending.store(false, std::memory_order_relaxed);

    // ── Driver ───────────────────────────────────────────────────────────────
    _driver = std::make_shared<VRODriverVisionOS>(device);
    NSLog(@"[ViroBridge] driver created. library=%@ stencilFmt=%d",
          _driver->getLibrary(), (int)_driver->getStencilPixelFormat());

    // ── Input controller ─────────────────────────────────────────────────────
    _inputController = std::make_shared<VROInputControllerVisionOS>(_driver);

    // ── Renderer configuration — all advanced features off for visionOS POC ─
    VRORendererConfiguration config;
    config.enableShadows        = false;
    config.enableBloom          = false;
    config.enableHDR            = false;
    config.enablePBR            = false;
    config.enableMultisampling  = false;

    _renderer = std::make_shared<VRORenderer>(config, _inputController);

    // ── Camera node ──────────────────────────────────────────────────────────
    // Root node, no VRONodeCamera attached — updateCamera() uses getWorldPosition()
    // directly and leaves baseRotation as identity, so headRotation (worldFromEye
    // rotation, updated every prepareFrame) drives the full camera orientation.
    _cameraNode = std::make_shared<VRONode>();
    _renderer->setPointOfView(_cameraNode);

    // ── Test scene ───────────────────────────────────────────────────────────
    auto sceneController = std::make_shared<VROSceneController>();
    auto scene = sceneController->getScene();

    auto ambientLight = std::make_shared<VROLight>(VROLightType::Ambient);
    ambientLight->setColor({0.3f, 0.3f, 0.3f});
    ambientLight->setIntensity(1000);
    scene->getRootNode()->addLight(ambientLight);

    auto dirLight = std::make_shared<VROLight>(VROLightType::Directional);
    dirLight->setColor({1.0f, 1.0f, 1.0f});
    dirLight->setIntensity(1000);
    dirLight->setDirection({0.0f, -1.0f, -0.5f});
    scene->getRootNode()->addLight(dirLight);

    // ── 360° background — large inverted sphere with equirectangular texture ─
    {
        NSString *bgPath = [[NSBundle mainBundle] pathForResource:@"360_space" ofType:@"jpg"];
        if (bgPath) {
            id<MTLDevice> device = std::dynamic_pointer_cast<VRODriverMetal>(_driver)->getDevice();
            MTKTextureLoader *loader = [[MTKTextureLoader alloc] initWithDevice:device];
            NSDictionary *opts = @{
                MTKTextureLoaderOptionSRGB: @(NO),
                MTKTextureLoaderOptionGenerateMipmaps: @(NO),
            };
            NSError *texErr = nil;
            id<MTLTexture> metalTex = [loader newTextureWithContentsOfURL:[NSURL fileURLWithPath:bgPath]
                                                                  options:opts error:&texErr];
            if (metalTex) {
                auto substrate = std::make_unique<VROTextureSubstrateMetal>(metalTex);
                auto tex = std::make_shared<VROTexture>(VROTextureType::Texture2D,
                                                        VROTextureInternalFormat::RGBA8,
                                                        std::move(substrate));
                // Large sphere with faces pointing inward so the equirectangular
                // image is visible from inside (camera at center).
                auto bgSphere = VROSphere::createSphere(50.0f, 30, 30, false);
                auto bgMat = std::make_shared<VROMaterial>();
                bgMat->setLightingModel(VROLightingModel::Constant);
                bgMat->getDiffuse().setTexture(tex);
                bgSphere->setMaterials({bgMat});
                auto bgNode = std::make_shared<VRONode>();
                bgNode->setGeometry(bgSphere);
                scene->getRootNode()->addChildNode(bgNode);
                NSLog(@"[ViroBridge] 360_space background sphere set (%lux%lu)",
                      (unsigned long)metalTex.width, (unsigned long)metalTex.height);
            } else {
                NSLog(@"[ViroBridge] Failed to load 360_space texture: %@", texErr);
            }
        } else {
            NSLog(@"[ViroBridge] 360_space.jpg not found — skipping background");
        }
    }

    // ── shiba.glb (centre) ───────────────────────────────────────────────────
    auto shibaNode = std::make_shared<VRONode>();
    scene->getRootNode()->addChildNode(shibaNode);

    NSString *glbPath = [[NSBundle mainBundle] pathForResource:@"shiba" ofType:@"glb"];
    if (glbPath) {
        std::string filePath([glbPath UTF8String]);
        std::shared_ptr<VRODriver> driver = _driver;
        VROGLTFLoader::loadGLTFFromResource(filePath, {}, VROResourceType::LocalFile,
                                            shibaNode, /*isGLB=*/true, driver,
                                            [](std::shared_ptr<VRONode> node, bool success) {
            if (success) {
                node->setScale({0.5f, 0.5f, 0.5f});
                node->setPosition({0.0f, -0.5f, -1.5f});
                NSLog(@"[ViroBridge] shiba.glb loaded");
            } else {
                NSLog(@"[ViroBridge] shiba.glb failed to load");
            }
        });
    } else {
        NSLog(@"[ViroBridge] shiba.glb not found in bundle");
    }

    // ── Soldier.glb (skeletal animation validation) ──────────────────────────
    auto soldierNode = std::make_shared<VRONode>();
    scene->getRootNode()->addChildNode(soldierNode);

    NSString *soldierPath = [[NSBundle mainBundle] pathForResource:@"Soldier" ofType:@"glb"];
    if (soldierPath) {
        std::string filePath([soldierPath UTF8String]);
        std::shared_ptr<VRODriver> driver = _driver;

        // Capture the animation loop shared_ptr by reference so we can store it on first load.
        __weak VRORendererBridge *weakSelf = self;
        VROGLTFLoader::loadGLTFFromResource(filePath, {}, VROResourceType::LocalFile,
                                            soldierNode, /*isGLB=*/true, driver,
                                            [weakSelf](std::shared_ptr<VRONode> node, bool success) {
            if (!success) {
                NSLog(@"[ViroBridge] Soldier.glb failed to load");
                return;
            }
            node->setScale({0.4f, 0.4f, 0.4f});
            node->setPosition({0.5f, -0.9f, -1.8f});

            // Log available animation names to confirm "Walk" exists.
            std::set<std::string> keys = node->getAnimationKeys(true);
            NSMutableString *keyList = [NSMutableString string];
            for (const std::string &k : keys) {
                [keyList appendFormat:@" \"%s\"", k.c_str()];
            }
            NSLog(@"[ViroBridge] Soldier.glb loaded — animations:%@", keyList);

            // Loop "Walk" animation indefinitely using the same pattern as VROGLTFTest::animate().
            // A shared_ptr<function> allows the closure to re-arm itself without a retain cycle:
            // the ivar holds the strong ref; the closure holds only a weak ref.
            VRORendererBridge *strongSelf = weakSelf;
            if (!strongSelf) return;

            auto loopFn = std::make_shared<std::function<void()>>();
            std::weak_ptr<VRONode>                         node_w  = node;
            std::weak_ptr<std::function<void()>>           fn_w    = loopFn;

            *loopFn = [node_w, fn_w]() {
                auto n  = node_w.lock();
                auto fn = fn_w.lock();
                NSLog(@"[ViroBridge] ANIM: loopFn invoked, node=%p fn=%p", (void*)n.get(), (void*)fn.get());
                if (!n || !fn) return;

                auto anim = n->getAnimation("Walk", true);
                NSLog(@"[ViroBridge] ANIM: getAnimation(Walk) returned %p", (void*)anim.get());
                if (anim) {
                    anim->execute(n, *fn);
                    NSLog(@"[ViroBridge] ANIM: execute() called");
                } else {
                    NSLog(@"[ViroBridge] \"Walk\" animation not found on Soldier node");
                }
            };

            strongSelf->_soldierAnimLoop = loopFn;
            // Do NOT call (*loopFn)() here — this callback runs on the main queue
            // (VROPlatformDispatchAsyncRenderer → dispatch_get_main_queue), but
            // VROTransaction uses thread_local storage and update() runs on the
            // CompositorServices render thread.  Signal prepareFrame to fire the
            // first execute() from the render thread so all subsequent completions
            // (also fired from update() on the render thread) stay on the same thread.
            NSLog(@"[ViroBridge] ANIM: setting _soldierAnimPending=true (main queue → render thread handoff)");
            strongSelf->_soldierAnimPending.store(true, std::memory_order_release);
        });
    } else {
        NSLog(@"[ViroBridge] Soldier.glb not found in bundle");
    }

    // ── VROBox — left, red ───────────────────────────────────────────────────
    {
        auto box = VROBox::createBox(0.3f, 0.3f, 0.3f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.9f, 0.15f, 0.15f, 1.0f});
        box->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(box);
        node->setPosition({-0.9f, -0.2f, -1.5f});
        scene->getRootNode()->addChildNode(node);
    }

    // ── VROSphere — right, blue ──────────────────────────────────────────────
    {
        auto sphere = VROSphere::createSphere(0.2f, 20, 20, true);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.15f, 0.4f, 0.9f, 1.0f});
        sphere->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(sphere);
        node->setPosition({0.9f, -0.2f, -1.5f});
        scene->getRootNode()->addChildNode(node);
    }

    // ── VROSurface — back wall quad, green ───────────────────────────────────
    {
        auto quad = VROSurface::createSurface(1.2f, 0.8f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.15f, 0.75f, 0.3f, 1.0f});
        quad->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(quad);
        node->setPosition({0.0f, 0.1f, -2.5f});
        scene->getRootNode()->addChildNode(node);
    }

    // ── VROBox — upper-left, yellow ──────────────────────────────────────────
    {
        auto box = VROBox::createBox(0.2f, 0.2f, 0.2f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.95f, 0.85f, 0.1f, 1.0f});
        box->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(box);
        node->setPosition({-0.5f, 0.4f, -1.8f});
        scene->getRootNode()->addChildNode(node);
    }

    // ── VROSphere — lower-right, magenta ─────────────────────────────────────
    {
        auto sphere = VROSphere::createSphere(0.15f, 16, 16, true);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.85f, 0.1f, 0.75f, 1.0f});
        sphere->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(sphere);
        node->setPosition({0.6f, -0.55f, -2.0f});
        scene->getRootNode()->addChildNode(node);
    }

    // ── Surface shader modifier — position-based color stripes ───────────────
    // Tests that #pragma surface_modifier_body injection works on Metal.
    // Uses _surface.position (world-space) to drive a sine-wave color pattern;
    // no uniforms needed so this also works as a static visual regression check.
    {
        auto sphere = VROSphere::createSphere(0.22f, 30, 30, true);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Constant);
        // Base color — will be overwritten by the modifier every frame.
        mat->getDiffuse().setColor({1.0f, 1.0f, 1.0f, 1.0f});

        std::vector<std::string> modifierCode = {
            // Stripe pattern driven by world-space Y position.
            // _surface.position is set before this pragma in all Metal fragment functions.
            "float stripe = sin(_surface.position.y * 30.0) * 0.5 + 0.5;",
            "_surface.diffuse_color = float4(stripe, 0.2, 1.0 - stripe, 1.0);",
        };
        auto modifier = std::make_shared<VROShaderModifier>(VROShaderEntryPoint::Surface,
                                                            modifierCode);
        modifier->setName("stripe");
        mat->addShaderModifier(modifier);
        sphere->setMaterials({mat});

        auto node = std::make_shared<VRONode>();
        node->setGeometry(sphere);
        node->setPosition({-1.0f, -0.3f, -2.0f});
        scene->getRootNode()->addChildNode(node);
        NSLog(@"[ViroBridge] Surface shader modifier sphere added");
    }

    _renderer->setSceneController(sceneController, _driver);
    // ────────────────────────────────────────────────────────────────────────

    return self;
}

// ── prepareFrame ──────────────────────────────────────────────────────────────
//
// Called once per frame with left-eye data (view index 0).
// Drives VRORenderer::prepareFrame which computes physics, animations, and
// visibility.

- (void)prepareFrameWithViewIndex:(NSUInteger)viewIndex
                     colorTexture:(id <MTLTexture>)colorTexture
                    viewTransform:(simd_float4x4)viewTransform
                         tangents:(simd_float4)tangents
{
    // Register this CompositorServices thread as the VROThreadName::Renderer thread so that
    // VROAnimatable::animate() adds animations to transactions instead of immediately
    // terminating them. Must run once on the actual render thread; guard with frame==0.
    if (_frameNumber == 0) {
        VROThreadRestricted::setThread(VROThreadName::Renderer);
        NSLog(@"[ViroBridge] Registered render thread as VROThreadName::Renderer");
    }

    NSUInteger width  = colorTexture.width;
    NSUInteger height = colorTexture.height;
    VROViewport viewport(0, 0, (int)width, (int)height);

    // VROCamera::onRotationChanged computes:
    //   _forward = headRotation.multiply(kBaseForward)   (multiply adds translation!)
    // So headRotation must be worldFromEye rotation (R^T of eyeFromWorld), not eyeFromWorld.
    // With R^T: _forward = R^T * [0,0,-1] = world-space looking direction. ✓
    //
    // Eye world position: eyeFromWorld = [R|t], eye is at world pos -R^T*t.
    // Update _cameraNode so the frustum is centred at the real eye location.
    simd_float4 t = viewTransform.columns[3];
    VROVector3f eyeWorldPos(
        -(viewTransform.columns[0].x * t.x + viewTransform.columns[0].y * t.y + viewTransform.columns[0].z * t.z),
        -(viewTransform.columns[1].x * t.x + viewTransform.columns[1].y * t.y + viewTransform.columns[1].z * t.z),
        -(viewTransform.columns[2].x * t.x + viewTransform.columns[2].y * t.y + viewTransform.columns[2].z * t.z)
    );
    _cameraNode->setPosition(eyeWorldPos);
    // setPosition updates _position synchronously (no active transaction → onTermination fires
    // immediately), but _worldPosition is only written by computeTransforms, which is normally
    // called during scene-graph traversal.  _cameraNode is standalone (not in the scene), so we
    // must trigger it explicitly.  With no parent the parent transform is identity.
    _cameraNode->computeTransforms(VROMatrix4f(), VROMatrix4f());

    // R^T in column-major VROMatrix4f: col i of R^T = row i of R.
    // Row i of R (simd, column-major) = [columns[0][i], columns[1][i], columns[2][i]].
    // Previous code copied simd columns directly → produced R, not R^T.
    float rT[16] = {
        // col 0 of R^T = row 0 of R (right vector)
        viewTransform.columns[0].x, viewTransform.columns[1].x, viewTransform.columns[2].x, 0,
        // col 1 of R^T = row 1 of R (up vector)
        viewTransform.columns[0].y, viewTransform.columns[1].y, viewTransform.columns[2].y, 0,
        // col 2 of R^T = row 2 of R (back = -forward vector)
        viewTransform.columns[0].z, viewTransform.columns[1].z, viewTransform.columns[2].z, 0,
        0, 0, 0, 1
    };
    VROMatrix4f worldFromEyeRot(rT);

    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:tangents
                                                               near:kZNear
                                                                far:kZFar];

    // Fire pending animation starts on the render thread so VROTransaction thread_local
    // committed/updated state lives on the same thread as update().
    if (_soldierAnimPending.load(std::memory_order_acquire)) {
        _soldierAnimPending.store(false, std::memory_order_relaxed);
        NSLog(@"[ViroBridge] ANIM: draining pending flag on render thread, loop=%p", (void*)_soldierAnimLoop.get());
        if (_soldierAnimLoop) {
            NSLog(@"[ViroBridge] ANIM: calling loopFn on render thread");
            (*_soldierAnimLoop)();
            NSLog(@"[ViroBridge] ANIM: loopFn returned");
        }
    }

    _renderer->prepareFrame(_frameNumber, viewport,
                            VROFieldOfView(),
                            worldFromEyeRot, vroProj,
                            _driver);
}

// ── renderEye ─────────────────────────────────────────────────────────────────
//
// Called once per eye.  Sets the active encoder on the driver so that
// VROGeometrySubstrateMetal can issue draw calls, then invokes VRORenderer::renderEye.

- (void)renderEyeWithViewIndex:(NSUInteger)viewIndex
                       encoder:(id <MTLRenderCommandEncoder>)encoder
                  colorTexture:(id <MTLTexture>)colorTexture
                  depthTexture:(id <MTLTexture>)depthTexture
                 viewTransform:(simd_float4x4)viewTransform
                      tangents:(simd_float4)tangents
{
    // Sync pixel formats from the actual drawable textures BEFORE the renderer
    // creates VROGeometrySubstrateMetal — updatePipelineStates() reads these
    // formats at compile time.  VRODriverMetal defaults to BGRA8Unorm_sRGB which
    // differs from the CompositorServices drawable format and causes silent draw
    // rejection when the pipeline state format doesn't match the render pass.
    _driver->setColorPixelFormat(colorTexture.pixelFormat);
    _driver->setDepthPixelFormat(depthTexture.pixelFormat);

    _driver->setActiveEncoder(encoder);

    NSUInteger width  = colorTexture.width;
    NSUInteger height = colorTexture.height;
    VROViewport viewport(0, 0, (int)width, (int)height);

    VROMatrix4f vroView = toMatrix4f(viewTransform);
    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:tangents
                                                               near:kZNear
                                                                far:kZFar];

    VROEyeType eyeType = (viewIndex == 0) ? VROEyeType::Left : VROEyeType::Right;

    // Pre-bind scene lighting uniforms at buffer index 4.
    // bindShader() / bindLights() will overwrite this per draw call for Phong materials,
    // but a valid fallback here prevents unset-buffer reads if any shader reads index 4
    // before bindLights() fires (e.g., Constant shaders, or early-exit paths).
    {
        VROSceneLightingUniformsMM lightingUniforms = {};
        // Ambient component (matches the VROLight::Ambient added to the scene).
        lightingUniforms.ambient_light_color = { 0.3f, 0.3f, 0.3f };
        // Directional light (matches the VROLight::Directional added to the scene).
        lightingUniforms.num_lights = 1;
        lightingUniforms.lights[0].type      = 1;   // VROLightType::Directional
        lightingUniforms.lights[0].color     = { 1.0f, 1.0f, 1.0f };
        // normalize({0, -1, -0.5}) = {0, -0.894, -0.447}
        lightingUniforms.lights[0].direction = { 0.0f, -0.894427f, -0.447214f };
        lightingUniforms.lights[0].attenuation_falloff_exp = 1.0f;
        [encoder setVertexBytes:&lightingUniforms length:sizeof(lightingUniforms) atIndex:4];
        [encoder setFragmentBytes:&lightingUniforms length:sizeof(lightingUniforms) atIndex:4];
    }

    @try {
        try {
            _renderer->renderEye(eyeType, vroView, vroProj, viewport, _driver);
        } catch (const std::exception &e) {
            NSLog(@"[ViroBridge] renderEye C++ exception: %s (frame=%d)", e.what(), _frameNumber);
        } catch (...) {
            NSLog(@"[ViroBridge] renderEye unknown C++ exception (frame=%d)", _frameNumber);
        }
    } @catch (NSException *e) {
        NSLog(@"[ViroBridge] renderEye NSException: %@ — %@ (frame=%d)", e.name, e.reason, _frameNumber);
    }

    _driver->setActiveEncoder(nil);
}

// ── endFrame ─────────────────────────────────────────────────────────────────

- (void)endFrame {
    _renderer->endFrame(_driver);
    ++_frameNumber;
}

// ── Projection helper ─────────────────────────────────────────────────────────
//
// Builds an asymmetric frustum projection matrix from CompositorServices tangents.
// tangents = (left, right, up, down) half-angle tangents.
// Metal NDC depth range [0, 1].

+ (VROMatrix4f)projectionFromTangents:(simd_float4)tangents
                                 near:(float)near
                                  far:(float)far
{
    float l = tangents[0];  // left  (negative)
    float r = tangents[1];  // right (positive)
    float u = tangents[2];  // up    (positive)
    float d = tangents[3];  // down  (negative)

    float rml = r - l;
    float umd = u - d;

    // Column-major asymmetric frustum (Metal NDC z in [0, 1])
    float mtx[16] = {
        // col 0
        2.0f / rml, 0.0f, 0.0f, 0.0f,
        // col 1
        0.0f, 2.0f / umd, 0.0f, 0.0f,
        // col 2
        (r + l) / rml, (u + d) / umd, -(far) / (far - near), -1.0f,
        // col 3
        0.0f, 0.0f, -(near * far) / (far - near), 0.0f
    };
    return VROMatrix4f(mtx);
}

@end

#endif  // VRO_METAL
#endif  // CompositorServices
