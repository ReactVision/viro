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
#include "VROLight.h"
#include "VROMaterial.h"
#include "VROGLTFLoader.h"
#include "VROModelIOUtil.h"

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

    // Container node added to the scene immediately; GLB geometry fills in async.
    auto modelNode = std::make_shared<VRONode>();
    scene->getRootNode()->addChildNode(modelNode);

    NSString *glbPath = [[NSBundle mainBundle] pathForResource:@"shiba" ofType:@"glb"];
    if (glbPath) {
        std::string filePath([glbPath UTF8String]);
        std::shared_ptr<VRODriver> driver = _driver;
        VROGLTFLoader::loadGLTFFromResource(filePath, {}, VROResourceType::LocalFile,
                                            modelNode, /*isGLB=*/true, driver,
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
        // Bundle resource missing — fall back to red box so rendering still validates.
        NSLog(@"[ViroBridge] shiba.glb not found in bundle, using fallback red box");
        auto box = VROBox::createBox(0.5f, 0.5f, 0.5f);
        auto mat = std::make_shared<VROMaterial>();
        mat->setLightingModel(VROLightingModel::Constant);
        mat->getDiffuse().setColor({1.0f, 0.0f, 0.0f, 1.0f});
        box->setMaterials({mat});
        modelNode->setGeometry(box);
        modelNode->setPosition({0.0f, 0.0f, -1.5f});
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
    NSUInteger width  = colorTexture.width;
    NSUInteger height = colorTexture.height;
    VROViewport viewport(0, 0, (int)width, (int)height);

    // VROCamera::onRotationChanged extracts _forward/_up via rotation.multiply(kBaseForward),
    // which is not a direction-only multiply — it adds the translation column too.
    // Strip the translation so the frustum's orientation is computed correctly.
    // The full view matrix (with translation) is still passed to renderEye for the actual shaders.
    VROMatrix4f vroView = toMatrix4f(viewTransform);
    VROMatrix4f vroViewRotOnly = vroView;
    vroViewRotOnly[12] = 0.0f;
    vroViewRotOnly[13] = 0.0f;
    vroViewRotOnly[14] = 0.0f;

    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:tangents
                                                               near:kZNear
                                                                far:kZFar];

    _renderer->prepareFrame(_frameNumber, viewport,
                            VROFieldOfView(),
                            vroViewRotOnly, vroProj,
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

    // Pre-bind lighting uniforms at buffer index 4 so the constant-lighting shader
    // receives valid ambient data.  The xcframework's bindShader() does not call
    // bindLights(), leaving index 4 unset; unset buffers produce black output
    // (invisible against the dark clear color).
    // Layout: VROSceneLightingUniforms starts with vector_float3 ambient_light_color
    // (16 bytes on arm64, matching Metal's float3 layout).  The rest stays zero
    // (num_lights = 0, no individual light entries needed for Constant shading).
    {
        // 512 bytes covers VROSceneLightingUniforms (ambient + 8 VROLightUniforms + num_lights).
        alignas(16) uint8_t lightingBytes[512] = {};
        // Write white ambient at offset 0 (float3 = 3 floats, Metal aligns to 16 bytes).
        float *ambient = reinterpret_cast<float *>(lightingBytes);
        ambient[0] = 1.0f;
        ambient[1] = 1.0f;
        ambient[2] = 1.0f;
        // ambient[3] stays 0 (padding between ambient_light_color and lights[]).
        [encoder setVertexBytes:lightingBytes length:sizeof(lightingBytes) atIndex:4];
        [encoder setFragmentBytes:lightingBytes length:sizeof(lightingBytes) atIndex:4];
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
