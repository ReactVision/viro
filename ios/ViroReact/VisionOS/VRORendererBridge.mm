// VRORendererBridge.mm
// ViroReact — visionOS
//
// Bridges VRORenderer + VRODriverVisionOS into an ObjC interface consumable
// by ViroImmersiveRenderer.swift.
//
// Matrix convention:
//   Swift hands in column-major simd_float4x4 matrices (Metal / ARKit convention).
//   VROMatrix4f is also column-major internally.  VROConvert::toMatrix4f copies
//   the 16 floats directly, so no transposition is needed.

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
#include "VROConvert.h"
#include "VROLog.h"
// Test scene
#include "VROSceneController.h"
#include "VROScene.h"
#include "VRONode.h"
#include "VROBox.h"
#include "VROLight.h"
#include "VROMaterial.h"

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
    int _frameNumber;
}
@end

@implementation VRORendererBridge

- (instancetype)initWithDevice:(id <MTLDevice>)device {
    self = [super init];
    if (!self) return nil;

    _frameNumber = 0;

    // ── Driver ───────────────────────────────────────────────────────────────
    _driver = std::make_shared<VRODriverVisionOS>(device);

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

    // ── Hardcoded test scene ─────────────────────────────────────────────────
    // Renders a floating red box 1.5m in front of the user to verify the
    // Metal pipeline is wired correctly.  Week 3+: replaced by JS-driven scenes.
    auto sceneController = std::make_shared<VROSceneController>();
    auto scene = sceneController->getScene();

    // Ambient light so the box is visible.
    auto light = std::make_shared<VROLight>(VROLightType::Ambient);
    light->setColor({1.0f, 1.0f, 1.0f});
    light->setIntensity(600);
    scene->getRootNode()->addLight(light);

    // Red box — 30 cm cube, 1.5 m forward, 0.5 m below eye level.
    auto box = VROBox::createBox(0.3f, 0.3f, 0.3f);
    auto material = std::make_shared<VROMaterial>();
    material->getDiffuse().setColor({0.8f, 0.15f, 0.15f, 1.0f});
    box->setMaterials({material});

    auto boxNode = std::make_shared<VRONode>();
    boxNode->setGeometry(box);
    boxNode->setPosition({0.0f, -0.5f, -1.5f});
    scene->getRootNode()->addChildNode(boxNode);

    _renderer->setSceneController(sceneController, _driver);
    // ────────────────────────────────────────────────────────────────────────

    return self;
}

// ── prepareFrame ──────────────────────────────────────────────────────────────
//
// Called once per frame with data from the LEFT eye (view index 0).
// Drives VRORenderer::prepareFrame which computes physics, animations, and
// visibility.  The eye-specific matrices are passed in from Swift after
// compositing with the ARKit device anchor.

- (void)prepareFrameWithViewIndex:(NSUInteger)viewIndex
                         drawable:(LayerRenderer.Drawable *)drawable
                    commandBuffer:(id <MTLCommandBuffer>)commandBuffer
{
    // Extract left-eye dimensions for the viewport.
    auto &view = drawable.views[viewIndex];
    NSUInteger width  = drawable.colorTextures[viewIndex].width;
    NSUInteger height = drawable.colorTextures[viewIndex].height;

    VROViewport viewport(0, 0, (int)width, (int)height);

    // View matrix: drawable.views[i].transform is device-to-rendering-space.
    // We take its inverse to get the "world-to-eye" view matrix.
    simd_float4x4 eyePose = view.transform;
    simd_float4x4 viewMtx = simd_inverse(eyePose);
    VROMatrix4f vroView = VROConvert::toMatrix4f(viewMtx);

    // Projection matrix from tangents (frustum, Metal depth [0,1]).
    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:view.tangents
                                                               near:kZNear far:kZFar];

    // Viro's prepareFrame uses the head rotation as the world-to-head matrix.
    // For visionOS we pass the full view matrix (left eye) since there's no
    // separate head+eye transform here.
    _renderer->prepareFrame(_frameNumber, viewport,
                            VROFieldOfView(), // unused when projection is passed
                            vroView, vroProj,
                            _driver);
}

// ── renderEye ─────────────────────────────────────────────────────────────────
//
// Called once per eye.  Sets the active encoder on the driver so that
// VROGeometrySubstrateMetal can issue draw calls, then invokes VRORenderer::renderEye.

- (void)renderEyeWithViewIndex:(NSUInteger)viewIndex
                       encoder:(id <MTLRenderCommandEncoder>)encoder
                      drawable:(LayerRenderer.Drawable *)drawable
                 commandBuffer:(id <MTLCommandBuffer>)commandBuffer
{
    auto &view = drawable.views[viewIndex];
    NSUInteger width  = drawable.colorTextures[viewIndex].width;
    NSUInteger height = drawable.colorTextures[viewIndex].height;

    // Activate the encoder on the driver.
    _driver->setActiveEncoder(encoder);

    VROViewport viewport(0, 0, (int)width, (int)height);

    simd_float4x4 eyePose = view.transform;
    simd_float4x4 viewMtx = simd_inverse(eyePose);
    VROMatrix4f vroView = VROConvert::toMatrix4f(viewMtx);
    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:view.tangents
                                                               near:kZNear far:kZFar];

    VROEyeType eyeType = (viewIndex == 0) ? VROEyeType::Left : VROEyeType::Right;
    _renderer->renderEye(eyeType, vroView, vroProj, viewport, _driver);

    // Deactivate the encoder so stale calls don't use it.
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
// Uses reverse-Z depth range [1, 0] for better depth precision on Vision Pro.

+ (VROMatrix4f)projectionFromTangents:(simd_float4)tangents
                                 near:(float)near
                                  far:(float)far
{
    float l = tangents[0];  // left  (negative)
    float r = tangents[1];  // right (positive)
    float u = tangents[2];  // up    (positive)
    float d = tangents[3];  // down  (negative)

    float rml = r - l;   // right minus left
    float umd = u - d;   // up minus down

    // Standard asymmetric frustum, Metal NDC z in [0, 1]:
    //   P[col][row] using column-major storage
    float mtx[16] = {
        // col 0
        2.0f / rml, 0.0f, 0.0f, 0.0f,
        // col 1
        0.0f, 2.0f / umd, 0.0f, 0.0f,
        // col 2
        (r + l) / rml,  (u + d) / umd,  -(far) / (far - near),  -1.0f,
        // col 3
        0.0f, 0.0f,  -(near * far) / (far - near), 0.0f
    };
    return VROMatrix4f(mtx);
}

@end

#endif  // VRO_METAL
#endif  // CompositorServices
