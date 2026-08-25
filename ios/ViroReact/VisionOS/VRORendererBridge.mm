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
#include "VROMetalFrameTimer.h"
#include "VRORendererConfiguration.h"
#include "VROInputControllerBase.h"
#include "VROInputPresenter.h"
#include "VROMatrix4f.h"
#include "VROFieldOfView.h"
#include "VROViewport.h"
#include "VROEye.h"
#include "VROMetalUtils.h"
#include "VROLog.h"
#include <cxxabi.h>
#include <typeinfo>
// Test scene
#include "VROSceneController.h"
#include "VROScene.h"
#include "VRONode.h"
#include "VROBox.h"
#include "VROSphere.h"
#include "VROSurface.h"
#include "VROPhysicsBody.h"
#include "VROPhysicsShape.h"
#include "VROPhysicsWorld.h"
#include "VROText.h"
#include "VROTypeface.h"
#include "VROLight.h"
#include "VROMaterial.h"
#include "VROGLTFLoader.h"
#include "VROModelIOUtil.h"
#include "VROThreadRestricted.h"
#include "VROTexture.h"
#include "VROTextureSubstrateMetal.h"
#include "VROSkybox.h"
#include "VROShaderModifier.h"
#include "VROParticleEmitter.h"
#import <MetalKit/MetalKit.h>

// Local mirror of VROLightUniforms / VROSceneLightingUniforms from VROSharedStructures.h.
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
    // Dynamic body whose height is traced to confirm bullet is actually stepping.
    std::shared_ptr<VRONode>                      _physicsProbe;
    std::shared_ptr<VRONode>                      _floorCollider;
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

    // ── Input controller ─────────────────────────────────────────────────────
    _inputController = std::make_shared<VROInputControllerVisionOS>(_driver);

    // ── Renderer configuration ──────────────────────────────────────────────
    // Shadows: depth-texture render targets, silhouette rendering, and shadow sampling
    // in the lighting shaders are all in place on Metal.
    // HDR: the lighting fragment functions write the tone-mapping mask to a second
    // colour attachment, specialised per target via function constants.
    // Bloom: the lighting shaders write a bloom buffer to a third attachment, the blur
    // pass has a Metal implementation, and the additive blend resolves to an MSL function.
    // PBR: Cook-Torrance direct lighting in MSL (pbr_lighting_* in Shaders.metal).
    // Image-based lighting is not implemented, so the ambient term stands in for the
    // environment contribution — a PBR material needs an analytic light to be lit.
    VRORendererConfiguration config;
    config.enableShadows        = true;
    config.enableBloom          = true;
    config.enableHDR            = true;
    config.enablePBR            = true;
    config.enableMultisampling  = false;

    // Fallback scene lighting at buffer index 4, re-applied by the driver to every
    // encoder it opens. bindShader() / bindLights() overwrite it per draw call for lit
    // materials; it only has to stop an unbound-buffer read by a shader that reaches
    // slot 4 first (Constant shaders, early-exit paths).
    // normalize({0, -1, -0.5}) = {0, -0.894, -0.447}, matching the scene's directional light.
    _driver->installDefaultLightingFallback(0.3f, 0.0f, -0.894427f, -0.447214f);

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
    // Shadow casting, so the test scene exercises the shadow-map pass. The orthographic
    // size has to cover the scene's footprint or objects fall outside the light frustum
    // and simply stop casting.
    dirLight->setCastsShadow(true);
    dirLight->setShadowOrthographicSize(6.0f);
    dirLight->setShadowNearZ(0.1f);
    dirLight->setShadowFarZ(10.0f);
    dirLight->setShadowOpacity(0.8f);
    dirLight->setShadowMapSize(1024);
    scene->getRootNode()->addLight(dirLight);

    // ── 360° equirectangular background ──────────────────────────────────────
    // Uses the real VROPortal::setBackgroundSphere now that it is implemented for this target
    // (VROVisionOSRenderStubs.cpp). The previous workaround — a 50 m inverted sphere added as a
    // scene node with renderingOrder -1 — is gone: it lived in this test app, so the library
    // still could not link an app that rendered a skybox through the VRT layer.
    {
        NSURL *bgURL = [[NSBundle mainBundle] URLForResource:@"360_space" withExtension:@"jpg"];
        if (bgURL) {
            MTKTextureLoader *loader = [[MTKTextureLoader alloc] initWithDevice:_driver->getDevice()];
            NSError *err = nil;
            id<MTLTexture> metalTex = [loader newTextureWithContentsOfURL:bgURL options:@{
                MTKTextureLoaderOptionSRGB: @NO,
                MTKTextureLoaderOptionGenerateMipmaps: @NO
            } error:&err];
            if (metalTex && !err) {
                auto substrate = std::make_unique<VROTextureSubstrateMetal>(metalTex);
                auto tex = std::make_shared<VROTexture>(VROTextureType::Texture2D,
                                                        VROTextureInternalFormat::RGBA8,
                                                        std::move(substrate));
                if (scene->getActivePortal()) {
                    // Same equirectangular texture drives image-based lighting, so the PBR
                    // materials are lit by the environment they sit in rather than by a flat
                    // ambient term. VROIBLPreprocess picks it up from the active portal.
                    scene->getActivePortal()->setLightingEnvironment(tex);
                    scene->getActivePortal()->setBackgroundSphere(tex);
                }
            } else {
                NSLog(@"[ViroBridge] 360_space.jpg texture load failed: %@", err);
            }
        } else {
            NSLog(@"[ViroBridge] 360_space.jpg not found in bundle");
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
                if (!n || !fn) return;
                auto anim = n->getAnimation("Walk", true);
                if (anim) {
                    anim->execute(n, *fn);
                }
            };

            strongSelf->_soldierAnimLoop = loopFn;
            // Do NOT call (*loopFn)() here — this callback runs on the main queue
            // (VROPlatformDispatchAsyncRenderer → dispatch_get_main_queue), but
            // VROTransaction uses thread_local storage and update() runs on the
            // CompositorServices render thread.  Signal prepareFrame to fire the
            // first execute() from the render thread so all subsequent completions
            // (also fired from update() on the render thread) stay on the same thread.
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
        // Low threshold so this box, which is large and unoccluded, clearly exercises
        // the bloom chain in the test scene.
        mat->setBloomThreshold(0.1f);
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

    // ── VROSphere ×2 — physically based, contrasting metalness / roughness ───
    // Left is polished metal, right a rough dielectric. The pair makes the Cook-Torrance
    // response legible: the metal takes its specular colour from its own albedo and keeps
    // a tight highlight, the dielectric spreads a broader white one.
    {
        struct { float metalness; float roughness; float x; } variants[] = {
            { 1.0f, 0.20f, -1.35f },
            { 0.0f, 0.70f,  1.35f },
        };
        for (const auto &variant : variants) {
            auto sphere = VROSphere::createSphere(0.14f, 24, 24, true);
            auto mat = std::make_shared<VROMaterial>();
            mat->setLightingModel(VROLightingModel::PhysicallyBased);
            mat->getDiffuse().setColor({0.85f, 0.72f, 0.35f, 1.0f});
            mat->getMetalness().setColor({variant.metalness, variant.metalness, variant.metalness, 1.0f});
            mat->getRoughness().setColor({variant.roughness, variant.roughness, variant.roughness, 1.0f});
            mat->getAmbientOcclusion().setColor({1.0f, 1.0f, 1.0f, 1.0f});
            sphere->setMaterials({mat});
            auto node = std::make_shared<VRONode>();
            node->setGeometry(sphere);
            // Kept out at the scene's radius: closer in, these intersect the near plane
            // and the whole frame degenerates.
            node->setPosition({variant.x, 0.1f, -1.6f});
            scene->getRootNode()->addChildNode(node);
        }
    }

    // ── Blend-mode strip — one quad per VROBlendMode over a light backdrop ───
    // M2.6-A mapped all seven VROBlendMode values onto MTLBlendFactor pairs but was never
    // checked visually. Each quad uses the same half-transparent orange over the same
    // white plate, so the modes have to look different from each other; if two match,
    // the mapping for one of them is wrong.
    {
        // Backdrop: a white plate the blends composite against.
        auto plate = VROSurface::createSurface(1.5f, 0.26f);
        auto plateMat = std::make_shared<VROMaterial>();
        plateMat->setLightingModel(VROLightingModel::Constant);
        plateMat->getDiffuse().setColor({0.85f, 0.85f, 0.85f, 1.0f});
        plateMat->setBlendMode(VROBlendMode::None);
        plateMat->setWritesToDepthBuffer(false);
        plate->setMaterials({plateMat});
        auto plateNode = std::make_shared<VRONode>();
        plateNode->setGeometry(plate);
        plateNode->setPosition({0.0f, 0.72f, -1.6f});
        plateNode->setRenderingOrder(10);
        scene->getRootNode()->addChildNode(plateNode);

        const VROBlendMode modes[] = {
            VROBlendMode::None, VROBlendMode::Alpha, VROBlendMode::Add,
            VROBlendMode::Multiply, VROBlendMode::Subtract, VROBlendMode::Screen,
            VROBlendMode::PremultiplyAlpha,
        };
        const int count = (int)(sizeof(modes) / sizeof(modes[0]));
        for (int i = 0; i < count; i++) {
            auto quad = VROSurface::createSurface(0.16f, 0.16f);
            auto mat = std::make_shared<VROMaterial>();
            mat->setLightingModel(VROLightingModel::Constant);
            mat->getDiffuse().setColor({0.95f, 0.45f, 0.1f, 0.5f});
            mat->setBlendMode(modes[i]);
            mat->setWritesToDepthBuffer(false);
            quad->setMaterials({mat});
            auto node = std::make_shared<VRONode>();
            node->setGeometry(quad);
            node->setPosition({-0.6f + 0.2f * i, 0.72f, -1.58f});
            // Drawn after the plate so each mode composites against it.
            node->setRenderingOrder(11);
            scene->getRootNode()->addChildNode(node);
        }
    }

    // ── Physics — bullet built for xros (M5) ─────────────────────────────────
    // Before bullet was compiled for xros, VROPhysicsWorld::computePhysics was a no-op
    // stub: bodies existed but nothing ever moved. This sphere starts above the floor and
    // has to fall and settle on it.
    {
        auto sphere = VROSphere::createSphere(0.09f, 20, 20, true);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.35f, 0.85f, 0.45f, 1.0f});
        sphere->setMaterials({mat});

        auto node = std::make_shared<VRONode>();
        node->setGeometry(sphere);
        node->setPosition({-1.10f, 0.10f, -1.60f});
        scene->getRootNode()->addChildNode(node);

        // The body itself is created on the first frame, not here: VRONode::initPhysicsBody
        // only registers with the physics world when the node already has a scene, and the
        // scene is not attached to the renderer until after it is built.
        // Traced in prepareFrame so the simulation can be checked by number rather than by
        // catching the fall in a screenshot.
        _physicsProbe = node;
    }

    // ── VROText — freetype + VROGlyphMetal (M5) ──────────────────────────────
    // The whole point of the M5 static-library work: before freetype was built for xros,
    // VRODriverVisionOS::newTypefaceCollection called pabort() and any ViroText took the
    // app down.
    {
        std::shared_ptr<VRODriver> driver = _driver;
        auto text = VROText::createSingleLineText(L"ViroText on visionOS",
                                                  "Helvetica", 14,
                                                  VROFontStyle::Normal, VROFontWeight::Regular,
                                                  {1.0f, 0.95f, 0.75f, 1.0f}, 0,
                                                  2.0f,
                                                  VROTextHorizontalAlignment::Center,
                                                  VROTextClipMode::None,
                                                  driver);
        if (text) {
            auto node = std::make_shared<VRONode>();
            node->setGeometry(text);
            // No node scale: VROText already builds its geometry in world units via
            // kTextPointToWorldScale (0.01), so a 24pt font is 0.24 units tall.
            // Below the SwiftUI panel and above the floor, where it is unobstructed.
            node->setPosition({0.0f, -0.50f, -1.10f});
            scene->getRootNode()->addChildNode(node);
        } else {
            NSLog(@"[ViroBridge] ViroText creation returned null");
        }
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

    // ── VROSurface — floor, grey. Receives the directional light's shadow. ───
    {
        auto floor = VROSurface::createSurface(4.0f, 4.0f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.55f, 0.55f, 0.58f, 1.0f});
        // A floor should receive shadows but not cast one onto itself.
        mat->setCastsShadows(false);
        floor->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(floor);
        // VROSurface is built in the XY plane facing +z; rotate it flat.
        node->setRotationEuler({-(float)M_PI_2, 0.0f, 0.0f});
        node->setPosition({0.0f, -0.7f, -1.8f});
        scene->getRootNode()->addChildNode(node);

        // The collider rides the floor's own visual node rather than a bare node of its own.
        // A node with no geometry never gets a world transform computed by the render
        // traversal, so its rigid body stays at the bullet origin — measured, not guessed.
        //
        // That node is rotated -90 degrees about X to lie flat, and a physics shape inherits
        // its node's rotation, so the extents are given in the node's *unrotated* frame:
        // (4, 4, 0.1) becomes a 4x4 slab 0.1 thick once rotated.
        _floorCollider = node;
    }

    // ── VROBox — upper-left, yellow ──────────────────────────────────────────
    {
        auto box = VROBox::createBox(0.2f, 0.2f, 0.2f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Phong);
        mat->getDiffuse().setColor({0.95f, 0.85f, 0.1f, 1.0f});
        // Bright enough to cross the bloom threshold, so the bloom path has something
        // to glow in the test scene.
        mat->setBloomThreshold(0.4f);
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
    }

    // ── Particle emitter — M2.6-C validation ────────────────────────────────
    // A small quad emitting particles upward at -1.5m depth, left of centre.
    // Tests VROParticleUBOMetal: instanced draw, per-particle MVP, color tint.
    {
        // Particle quad: small white 5x5 cm billboard.
        auto particleQuad = VROSurface::createSurface(0.05f, 0.05f);
        auto particleMat = particleQuad->getMaterials()[0];
        particleMat->setLightingModel(VROLightingModel::Constant);
        particleMat->getDiffuse().setColor({1.0f, 0.6f, 0.1f, 1.0f});   // orange base
        particleMat->setBlendMode(VROBlendMode::Add);

        std::shared_ptr<VRODriver> driver = _driver;
        auto emitter = std::make_shared<VROParticleEmitter>(driver, particleQuad);
        emitter->setRun(true);

        auto emitterNode = std::make_shared<VRONode>();
        emitterNode->setPosition({-0.3f, -0.6f, -1.5f});
        emitterNode->setParticleEmitter(emitter);
        scene->getRootNode()->addChildNode(emitterNode);
    }

    // ── White reference box at 0.5m ──────────────────────────────────────────
    {
        auto box = VROBox::createBox(0.3f, 0.3f, 0.3f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Constant);
        mat->getDiffuse().setColor({1.0f, 1.0f, 1.0f, 1.0f});   // white
        // VROBlendMode::None writes alpha directly (no src*src blend squaring),
        // ensuring CompositorServices sees alpha=1 and renders the box as opaque.
        mat->setBlendMode(VROBlendMode::None);
        box->setMaterials({mat});
        auto node = std::make_shared<VRONode>();
        node->setGeometry(box);
        node->setPosition({0.0f, 0.0f, -0.5f});
        scene->getRootNode()->addChildNode(node);
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
    // Sync pixel format from the drawable texture BEFORE prepareFrame triggers
    // updateSortKeys → material substrate creation → pipeline state compilation.
    // VRODriverMetal defaults to BGRA8Unorm_sRGB; CompositorServices provides
    // RGBA16Float.  Setting it here ensures any pipeline compiled during prepareFrame
    // (including the first-frame initRenderer path) uses the correct format.
    // TEMP diagnostic (device crash triage 2026-08-24)
    NSLog(@"[ViroBridge] PREPARE view=%d colour=%lu %lux%lu",
          (int)viewIndex, (unsigned long)colorTexture.pixelFormat,
          (unsigned long)colorTexture.width, (unsigned long)colorTexture.height);
    _driver->setColorPixelFormat(colorTexture.pixelFormat);

    VROMetalFrameTimer *timer = _driver->getFrameTimerForBridge();
    if (timer) { timer->beginPhase("prepareFrame"); }

    // Physics bodies are created here rather than during scene construction, because
    // VRONode::initPhysicsBody registers with the world only if the node already belongs to
    // a scene — and the scene is attached to the renderer after it is built.
    // Frame 5, not frame 1: a physics body takes its initial transform from the node's
    // *world* transform, which is only computed during the render traversal. Creating the
    // bodies before any traversal has run places them both at the origin, where the sphere
    // starts inside the floor slab and pops through it.
    if (_frameNumber == 5 && _physicsProbe && _floorCollider) {
        // Box params are FULL extents, not half extents — the header comment in
        // VROPhysicsShape.h says "half span" but a (2, 0.05, 2) box measured an AABB of
        // (-1, -0.025, -1)..(1, 0.025, 1).
        _floorCollider->initPhysicsBody(VROPhysicsBody::VROPhysicsBodyType::Static, 0.0f,
                                        std::make_shared<VROPhysicsShape>(
                                            VROPhysicsShape::VROShapeType::Box,
                                            std::vector<float>{ 4.0f, 4.0f, 0.1f }));
        _physicsProbe->initPhysicsBody(VROPhysicsBody::VROPhysicsBodyType::Dynamic, 1.0f,
                                       std::make_shared<VROPhysicsShape>(
                                           VROPhysicsShape::VROShapeType::Sphere,
                                           std::vector<float>{ 0.09f }));
        NSLog(@"[ViroBridge] physics bodies created (floor=%d sphere=%d)",
              _floorCollider->getPhysicsBody() != nullptr,
              _physicsProbe->getPhysicsBody() != nullptr);
    }

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
        if (_soldierAnimLoop) {
            (*_soldierAnimLoop)();
        }
    }

    _renderer->prepareFrame(_frameNumber, viewport,
                            VROFieldOfView(),
                            worldFromEyeRot, vroProj,
                            _driver);

    if (timer) { timer->endPhase("prepareFrame"); }
}

// ── renderEye ─────────────────────────────────────────────────────────────────
//
// Called once per eye.  Sets the active encoder on the driver so that
// VROGeometrySubstrateMetal can issue draw calls, then invokes VRORenderer::renderEye.

- (void)setFrameTimingEnabled:(BOOL)enabled {
    _driver->setFrameTimingEnabled(enabled);
}

- (void)setFrameCommandBuffer:(id <MTLCommandBuffer>)commandBuffer {
    _driver->setFrameCommandBuffer(commandBuffer);
    if (VROMetalFrameTimer *timer = _driver->getFrameTimerForBridge()) {
        if (commandBuffer) {
            timer->beginFrame(commandBuffer);
        } else {
            // Passed nil after the last eye is submitted, which is the end of the frame.
            timer->endFrame();
        }
    }
}

- (void)renderEyeWithViewIndex:(NSUInteger)viewIndex
          renderPassDescriptor:(MTLRenderPassDescriptor *)renderPass
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
    // TEMP diagnostic (device crash triage 2026-08-24)
    NSLog(@"[ViroBridge] RENDER-EYE begin view=%d colour=%lu",
          (int)viewIndex, (unsigned long)colorTexture.pixelFormat);
    _driver->setColorPixelFormat(colorTexture.pixelFormat);
    _driver->setDepthPixelFormat(depthTexture.pixelFormat);

    NSUInteger width  = colorTexture.width;
    NSUInteger height = colorTexture.height;
    VROViewport viewport(0, 0, (int)width, (int)height);

    VROMatrix4f vroView = toMatrix4f(viewTransform);
    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:tangents
                                                               near:kZNear
                                                                far:kZFar];

    VROEyeType eyeType = (viewIndex == 0) ? VROEyeType::Left : VROEyeType::Right;

    if (VROMetalFrameTimer *timer = _driver->getFrameTimerForBridge()) {
        timer->beginPhase("renderEye");
    }
    _driver->beginDisplayPass(renderPass);

    @try {
        try {
            _renderer->renderEye(eyeType, vroView, vroProj, viewport, _driver);
        } catch (const std::exception &e) {
            NSLog(@"[ViroBridge] renderEye C++ exception: %s (frame=%d)", e.what(), _frameNumber);
        } catch (...) {
            // ObjC exceptions reach this handler as C++ exceptions under the unified
            // runtime, so report the type — a bare "unknown exception" hides Metal
            // validation failures, which is how they present.
            const std::type_info *type = __cxxabiv1::__cxa_current_exception_type();
            NSLog(@"[ViroBridge] renderEye unknown C++ exception type=%s (frame=%d)",
                  type ? type->name() : "?", _frameNumber);
            throw;
        }
    } @catch (NSException *e) {
        NSLog(@"[ViroBridge] renderEye NSException: %@ — %@ (frame=%d)", e.name, e.reason, _frameNumber);
    }

    _driver->endDisplayPass();

    if (VROMetalFrameTimer *timer = _driver->getFrameTimerForBridge()) {
        timer->endPhase("renderEye");
    }
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
