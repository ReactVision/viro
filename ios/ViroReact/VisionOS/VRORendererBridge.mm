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
#import "VRORendererBridge+Scene.h"

// ── C++ includes ─────────────────────────────────────────────────────────────
#include <algorithm>
#include <unordered_map>
#include <functional>
#include "VRODefines.h"
#if VRO_METAL

#include "VRORenderer.h"
#include "VRODriverVisionOS.h"
#include "VROMetalFrameTimer.h"
#include "VRORendererConfiguration.h"
#include "VROInputControllerBase.h"
#include "VROInputType.h"
#include "VROInputPresenter.h"
#include "VROReticle.h"
#include "VROHitTestResult.h"
#include <limits>
#include "VROTexture.h"
#include "VROData.h"
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
// ── Visible feedback for input bring-up ───────────────────────────────────────
//
// Without this nothing in the test scene reacts, so hand tracking looks broken even when
// every event is firing correctly — which is exactly how it looked on the first device run.
// The events were reaching the scene; the scene simply had no listeners.
//
// White at rest, amber on hover, green while pinched. Colour rather than motion so the state
// is readable from any angle and does not disturb the physics scene beside it.

class VROHighlightOnInput : public VROEventDelegate {
public:
    VROHighlightOnInput(std::shared_ptr<VROMaterial> material) : _material(material) {}

    void onHover(int source, std::shared_ptr<VRONode> node, bool isHovering,
                 std::vector<float> position) override {
        _hovering = isHovering;
        apply();
    }

    void onClick(int source, std::shared_ptr<VRONode> node, ClickState clickState,
                 std::vector<float> position) override {
        if (clickState == ClickState::ClickDown)      { _pressed = true;  }
        else if (clickState == ClickState::ClickUp)   { _pressed = false; }
        apply();
    }

private:
    void apply() {
        VROVector4f colour = _pressed  ? VROVector4f(0.2f, 0.9f, 0.3f, 1.0f)   // pinched
                           : _hovering ? VROVector4f(1.0f, 0.7f, 0.1f, 1.0f)   // pointed at
                                       : VROVector4f(1.0f, 1.0f, 1.0f, 1.0f);  // at rest
        _material->getDiffuse().setColor(colour);
    }

    std::shared_ptr<VROMaterial> _material;
    bool _hovering = false;
    bool _pressed  = false;
};

// ── Hand-tracking input controller ────────────────────────────────────────────
//
// Two hands, two independent sources, following the same shape as
// VROInputControllerOpenXR: capture both poses first, then dispatch each side with its own
// source id so hover, click and drag stay separate per hand. VROInputControllerBase already
// keeps a hit result per source, so nothing here has to reimplement hit testing.
//
// The ray is the index finger, not gaze: see the note on ViroVisionOS::InputSource.

class VROInputControllerVisionOS : public VROInputControllerBase {
public:
    VROInputControllerVisionOS(std::shared_ptr<VRODriver> driver)
        : VROInputControllerBase(driver) {}

    std::string getHeadset()    override { return "visionos"; }
    std::string getController() override { return "hand"; }

    struct HandState {
        bool        valid    = false;
        bool        pinching = false;
        VROVector3f origin;
        VROVector3f forward;
    };

    /*
     Called once per frame from the bridge, before either eye renders. Only stores state —
     dispatch happens in onProcess, which the renderer drives with a camera we do not have
     here.
     */
    void setHandState(const HandState &left, const HandState &right) {
        _left  = left;
        _right = right;
    }

    void onProcess(const VROCamera &camera) override {
        _reticleHit = false;
        // Right hand last so that, when both hands are pointing at something, the right one wins
        // the reticle rather than the two fighting over it frame by frame.
        dispatchHand(camera, ViroVisionOS::LeftHand,  _left,  _leftWasPinching);
        dispatchHand(camera, ViroVisionOS::RightHand, _right, _rightWasPinching);
        applyReticle(camera);
    }

    std::shared_ptr<VROReticle> getReticle() const { return _reticle; }

protected:
    VROVector3f getDragForwardOffset() override { return { 0, 0, -1 }; }

    /*
     The presenter carries the reticle. There is no system pointer to rely on in a Metal
     immersive space — the compositor only highlights registered tracking areas — so without
     this the wearer has no indication of where the ray points, which is what made the
     head-through-hand mode unusable: correct aim, invisible.
     */
    /*
     A ring, drawn into an RGBA texture rather than left to VROReticle's default polyline.

     The polyline path strokes the circle with a shader modifier written in GLSL — vec3, mat3,
     highp — and the Metal substrate drops the lines it cannot translate while keeping the
     assignments, so the generated MSL failed to compile with "use of undeclared identifier
     'world_vertex_offset'" and the pipeline assertion aborted the process. The texture path
     goes through a plain VROSurface with no modifiers at all.

     Generated in code so the reticle needs no bundled asset, which matters because ViroKit
     ships to visionOS as a static library with no resource bundle of its own.
     */
    static std::shared_ptr<VROTexture> createReticleTexture() {
        const int size = 64;
        const float centre = (size - 1) * 0.5f;
        const float outer = size * 0.45f;
        const float inner = size * 0.30f;
        const float feather = 1.5f;   // pixels of alpha ramp, so the edge is not a staircase

        std::vector<uint8_t> pixels((size_t)size * size * 4, 0);
        for (int y = 0; y < size; y++) {
            for (int x = 0; x < size; x++) {
                const float dx = x - centre, dy = y - centre;
                const float d = std::sqrt(dx * dx + dy * dy);
                const float ramp = [&](float t) {
                    return std::clamp(t / feather, 0.0f, 1.0f);
                }(std::min(outer - d, d - inner));
                uint8_t *p = &pixels[((size_t)y * size + x) * 4];
                p[0] = 84;    // the same cyan VROReticle uses for its polyline
                p[1] = 249;
                p[2] = 247;
                p[3] = (uint8_t)std::lround(ramp * 255.0f);
            }
        }

        std::vector<std::shared_ptr<VROData>> data = {
            std::make_shared<VROData>(pixels.data(), (int)pixels.size())
        };
        return std::make_shared<VROTexture>(VROTextureType::Texture2D,
                                            VROTextureFormat::RGBA8,
                                            VROTextureInternalFormat::RGBA8,
                                            true, VROMipmapMode::None,
                                            data, size, size, std::vector<uint32_t>());
    }

    std::shared_ptr<VROInputPresenter> createPresenter(std::shared_ptr<VRODriver> driver) override {
        std::shared_ptr<VROInputPresenter> presenter = std::make_shared<VROInputPresenter>();
        _reticle = std::make_shared<VROReticle>(createReticleTexture());
        // Not headlocked: the reticle belongs at the point the hand ray hits, not pinned to the
        // centre of view. Headlocked is for platforms that aim with the head.
        _reticle->setPointerFixed(false);
        _reticle->setEnabled(false);
        presenter->setReticle(_reticle);
        return presenter;
    }

    /*
     Place the reticle on whatever the ray hit this frame, and size it by distance so it keeps a
     constant angular size — a fixed-radius reticle is a dot far away and a hoop up close.
     */
    void applyReticle(const VROCamera &camera) {
        if (!_reticle) { return; }
        if (!_reticleHit) {
            _reticle->setEnabled(false);
            return;
        }
        _reticle->setEnabled(true);
        _reticle->setPosition(_reticlePosition);
        const float distance = (_reticlePosition - camera.getPosition()).magnitude();
        _reticle->setRadius(std::max(0.008f, distance * kReticleAngularSize));
    }

private:
    void dispatchHand(const VROCamera &camera, int source,
                      const HandState &hand, bool &wasPinching) {
        if (!hand.valid) {
            // A hand that just went out of view while pinching would otherwise leave a click
            // latched down forever.
            if (wasPinching) {
                VROInputControllerBase::onButtonEvent(source, VROEventDelegate::ClickState::ClickUp);
                wasPinching = false;
            }
            _filter[slotFor(source)].reset();
            _hoverHeld[slotFor(source)] = false;
            _reticleDistance[slotFor(source)] = -1.0f;
            return;
        }

        // ── Which ray to act on ──────────────────────────────────────────────
        //
        // Not the live one, while pinching. Closing the index against the thumb curls the
        // finger, and the ray is the finger: measured on device, the forward vector's Y
        // component swung from -0.11 to -0.81 during a single pinch. Acting on the live ray
        // means the click lands wherever the finger ended up pointing — the floor — instead
        // of on what the wearer was aiming at.
        //
        // The frozen ray is also deliberately not the one from the frame the threshold
        // tripped on. By then the fingers are already 2 cm apart and most of the curl has
        // happened. `_aimHistory` keeps a short delay line so the pinch acts on the aim from
        // before the gesture started, which is the aim the wearer chose.
        // ── The live ray ─────────────────────────────────────────────────────
        //
        // Origin::Head aims from between the eyes through the hand rather than along the finger.
        // The finger ray inherits every bit of articulation noise — the joints move whenever the
        // hand does anything, and hardest exactly as a pinch begins — whereas a head-through-hand
        // ray does not depend on finger pose at all. It is also how people physically point.
        VROVector3f liveOrigin  = hand.origin;
        VROVector3f liveForward = hand.forward;
        if (_tuning.origin == Tuning::Origin::Head && _hasHead) {
            const VROVector3f toHand = hand.origin - _headPosition;
            const float reach = toHand.magnitude();
            // Too close to the head and the direction is meaningless; keep the finger ray.
            if (reach > 0.05f) {
                liveOrigin  = _headPosition;
                liveForward = toHand / reach;
            }
        }
        liveForward = _filter[slotFor(source)].apply(liveForward, _tuning.smoothing);

        // The reticle rides the live filtered ray, deliberately not the one the events use. The
        // hysteresis below holds the aim still until it drifts past a threshold, which is right
        // for hover — it stops the target flickering — and wrong for a drawn indicator, which
        // then advances in steps and reads as lag. Freezing on pinch is the same story: correct
        // for where the click lands, wrong for where the dot is drawn.
        _liveOrigin[slotFor(source)]  = liveOrigin;
        _liveForward[slotFor(source)] = liveForward;

        Ray &aim = _aim[slotFor(source)];
        if (!wasPinching) {
            aim.pushLive(liveOrigin, liveForward);
        }
        const bool pinchStarting = hand.pinching && !wasPinching;
        if (pinchStarting) {
            aim.freeze();
        }
        const VROVector3f origin  = aim.frozen ? aim.frozenOrigin  : liveOrigin;
        VROVector3f forward = aim.frozen ? aim.frozenForward : liveForward;

        // ── Hover hysteresis ────────────────────────────────────────────────
        //
        // Without this, a target at the edge of the ray flickers in and out of hover as the hand
        // breathes, and selection stops feeling like something the user controls. Once a target is
        // acquired, hold the aim that acquired it until the ray has moved off by a real margin.
        const int slot = slotFor(source);
        if (!aim.frozen && _tuning.hoverHysteresis > 0.0f) {
            if (_hoverHeld[slot]) {
                const float drift = std::acos(std::clamp(forward.dot(_hoverForward[slot]), -1.0f, 1.0f));
                if (drift < _tuning.hoverHysteresis) {
                    forward = _hoverForward[slot];
                } else {
                    _hoverForward[slot] = forward;
                }
            } else {
                _hoverForward[slot] = forward;
                _hoverHeld[slot] = true;
            }
        }

        // Applied to the ray the events use, not to the reticle: the mark stays where the wearer
        // is actually pointing, while the selection is the forgiving one. A reticle that jumped to
        // the assisted direction would be telling them their aim was somewhere it was not.
        forward = widenAim(camera, origin, forward);

        VROQuaternion rotation = VROQuaternion::rotationFromTo({ 0, 0, -1 }, forward);
        VROInputControllerBase::updateHitNode(source, camera, origin, forward);
        // Take only the *depth* from the hit and lay it along the live ray. That keeps the
        // reticle on the surface it is pointing at while still moving smoothly, and it means a
        // miss is not a disappearance — it falls back to a fixed reach, so the wearer can always
        // see where they are aiming, which is the whole point of having one.
        const int rslot = slotFor(source);
        float target = kReticleFallbackDistance;
        if (std::shared_ptr<VROHitTestResult> hit = getHitResultForSource(source)) {
            if (!hit->isBackgroundHit()) {
                target = (hit->getLocation() - _liveOrigin[rslot]).magnitude();
            }
        }
        // Ease the depth rather than snapping it, or crossing an edge pops the reticle between
        // the object and the fallback distance.
        if (_reticleDistance[rslot] <= 0.0f) {
            _reticleDistance[rslot] = target;
        } else {
            _reticleDistance[rslot] += (target - _reticleDistance[rslot]) * kReticleDepthEasing;
        }
        _reticleHit = true;
        _reticlePosition = _liveOrigin[rslot] + _liveForward[rslot] * _reticleDistance[rslot];
        // processGazeEvent is what turns a hit result into onHover — without it the hit is
        // computed, click still works through onButtonEvent, and hover silently never fires.
        VROInputControllerBase::processGazeEvent(source);
        VROInputControllerBase::onMove(source, origin, rotation, forward);

        // Edges only: the base class treats every ClickDown as a new press.
        if (hand.pinching != wasPinching) {
            VROInputControllerBase::onButtonEvent(
                source, hand.pinching ? VROEventDelegate::ClickState::ClickDown
                                      : VROEventDelegate::ClickState::ClickUp);
            wasPinching = hand.pinching;
            if (!hand.pinching) {
                aim.thaw();
            }
        }
    }

    /*
     Widen the aim to a cone when the ray itself misses.

     A ray of zero width asks for more precision than hand tracking can deliver: the target has to
     be hit exactly, and a target that is nearly hit behaves identically to one that is not aimed at
     at all. Sampling a ring around the ray gives small targets a tolerance without taking anything
     away from a precise aim — the centre ray is tried first and wins whenever it hits, so nothing
     that already worked starts behaving differently.

     Cost is bounded and only paid on a miss: nine tests, and none at all while the wearer is
     actually pointing at something.
     */
    VROVector3f widenAim(const VROCamera &camera, const VROVector3f &origin,
                         const VROVector3f &forward) {
        if (_tuning.coneAngle <= 0.0f) { return forward; }

        VROHitTestResult centre = VROInputControllerBase::hitTest(camera, origin, forward, true);
        if (!centre.isBackgroundHit()) { return forward; }

        // A basis perpendicular to the ray, to lay the ring on.
        VROVector3f up = std::fabs(forward.y) > 0.9f ? VROVector3f(1, 0, 0) : VROVector3f(0, 1, 0);
        VROVector3f right = forward.cross(up).normalize();
        up = right.cross(forward).normalize();

        const int kSamples = 8;
        const float tan = std::tan(_tuning.coneAngle);
        VROVector3f best = forward;
        float bestDistance = std::numeric_limits<float>::max();

        for (int i = 0; i < kSamples; i++) {
            const float a = (2.0f * M_PI * i) / kSamples;
            VROVector3f candidate =
                (forward + right * (std::cos(a) * tan) + up * (std::sin(a) * tan)).normalize();
            VROHitTestResult hit = VROInputControllerBase::hitTest(camera, origin, candidate, true);
            if (hit.isBackgroundHit()) { continue; }
            // Nearest wins: with two targets inside the cone, the closer one is the one the wearer
            // is most likely reaching for, and it is also the one that occludes the other.
            if (hit.getDistance() < bestDistance) {
                bestDistance = hit.getDistance();
                best = candidate;
            }
        }
        return best;
    }

    static int slotFor(int source) { return source == ViroVisionOS::LeftHand ? 0 : 1; }

    // ── Live-tunable input parameters ────────────────────────────────────────
    //
    // Defaults are the starting point for tuning on device, not settled values. They are
    // deliberately reachable from JavaScript: input tuning takes dozens of iterations with a
    // headset on, and a rebuild cycle is ten minutes.
    struct Tuning {
        enum class Origin { Finger, Head };
        Origin origin = Origin::Head;   // head-through-hand: see setInputTuning
        float  smoothing = 0.6f;        // 0 = raw, 1 = heavy
        float  hoverHysteresis = 0.035f; // radians
        float  coneAngle = 0.030f;       // radians (~1.7°); 0 disables the cone cast
    };
    Tuning _tuning;
    VROVector3f _headPosition;
    bool _hasHead = false;

    static constexpr float kReticleAngularSize = 0.012f;
    // Where the reticle sits when the ray hits nothing: far enough to read as "out there",
    // near enough to stay comfortable to focus on.
    static constexpr float kReticleFallbackDistance = 2.5f;
    static constexpr float kReticleDepthEasing = 0.25f;
    std::shared_ptr<VROReticle> _reticle;
    VROVector3f _reticlePosition;
    bool _reticleHit = false;
    VROVector3f _liveOrigin[2];
    VROVector3f _liveForward[2];
    float _reticleDistance[2] = { -1.0f, -1.0f };

public:
    void setHeadPosition(const VROVector3f &p) { _headPosition = p; _hasHead = true; }

    void applyTuning(NSDictionary *t) {
        if (NSString *o = t[@"rayOrigin"]) {
            _tuning.origin = [o isEqualToString:@"finger"] ? Tuning::Origin::Finger
                                                           : Tuning::Origin::Head;
            _filter[0].reset();
            _filter[1].reset();
        }
        if (NSNumber *n = t[@"smoothing"]) {
            _tuning.smoothing = std::clamp(n.floatValue, 0.0f, 1.0f);
        }
        if (NSNumber *n = t[@"hoverHysteresis"]) {
            _tuning.hoverHysteresis = std::max(0.0f, n.floatValue);
        }
        if (NSNumber *n = t[@"coneAngle"]) {
            _tuning.coneAngle = std::max(0.0f, n.floatValue);
        }
    }

private:

    /*
     One-euro filter on the aim direction.

     The live ray was previously raw joint data with no filtering at all, taken from a finger that
     moves whenever the hand does anything — which is the jitter, and it is not latency: the delay
     line below never fed the live ray.

     A fixed low-pass would trade jitter for lag uniformly. This adapts: heavy smoothing when the
     hand is nearly still, light when it is moving deliberately, so a slow careful aim is steady
     and a fast sweep still keeps up.
     */
    struct DirectionFilter {
        void reset() { initialised = false; }

        VROVector3f apply(const VROVector3f &raw, float smoothing) {
            if (smoothing <= 0.0f) { return raw; }
            if (!initialised) {
                value = raw; velocity = 0.0f; initialised = true;
                return value;
            }
            // Angular speed stands in for the "speed" term of a one-euro filter.
            const float speed = (raw - value).magnitude();
            velocity = 0.7f * velocity + 0.3f * speed;

            // More movement → less smoothing. The constants set how quickly that trade happens
            // and are the part most worth tuning on device.
            const float responsiveness = velocity / (velocity + 0.02f);
            const float alpha = (1.0f - smoothing) + smoothing * responsiveness;

            value = value * (1.0f - alpha) + raw * alpha;
            const float len = value.magnitude();
            if (len > 1e-5f) { value = value / len; }
            return value;
        }

        VROVector3f value;
        float velocity = 0.0f;
        bool  initialised = false;
    };
    DirectionFilter _filter[2];
    VROVector3f _hoverForward[2];
    bool        _hoverHeld[2] = { false, false };

    /*
     A short delay line of recent aim, plus the frozen aim held for the duration of a pinch.

     kAimDelayFrames is ~150 ms at 90 Hz — long enough to predate the finger curl that
     triggers the pinch, short enough that the frozen aim still corresponds to where the
     wearer was looking a moment ago rather than to somewhere they have already left.
     */
    struct Ray {
        static const int kAimDelayFrames = 14;

        void pushLive(const VROVector3f &o, const VROVector3f &f) {
            origins[cursor]  = o;
            forwards[cursor] = f;
            cursor = (cursor + 1) % kAimDelayFrames;
            if (filled < kAimDelayFrames) { filled++; }
        }

        void freeze() {
            // The oldest entry still in the buffer: the aim from before the gesture began.
            const int oldest = (filled < kAimDelayFrames) ? 0 : cursor;
            frozenOrigin  = origins[oldest];
            frozenForward = forwards[oldest];
            frozen = true;
        }

        void thaw() { frozen = false; }

        VROVector3f origins[kAimDelayFrames];
        VROVector3f forwards[kAimDelayFrames];
        int  cursor = 0;
        int  filled = 0;
        bool frozen = false;
        VROVector3f frozenOrigin;
        VROVector3f frozenForward;
    };

    Ray _aim[2];

    HandState _left, _right;
    bool _leftWasPinching  = false;
    bool _rightWasPinching = false;
};

// ── Private implementation ────────────────────────────────────────────────────
@interface VRORendererBridge () {
    std::shared_ptr<VRODriverVisionOS>            _driver;
    std::shared_ptr<VRORenderer>                  _renderer;
    std::shared_ptr<VROInputControllerVisionOS>   _inputController;
    std::unordered_map<int, uint16_t>            _trackingAreaValues;
    // VRORenderer keeps its scene controller private, and the bridge is the only thing that ever
    // sets one — so holding our own reference is cheaper than widening the renderer's API.
    std::shared_ptr<VROSceneController>          _activeSceneController;
    std::shared_ptr<VRONode>                      _cameraNode;
    // VRONode::setEventDelegate stores a weak_ptr, so the scene does not keep the delegate
    // alive. Held here for the lifetime of the bridge; a local would be destroyed as soon as
    // the scene finished building and every event would silently find no listener.
    std::vector<std::shared_ptr<VROEventDelegate>>  _eventDelegates;
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

// Weak, deliberately: this only mirrors whichever bridge ViroImmersiveRenderer currently owns,
// and must never be the reason one stays alive after the ImmersiveSpace closes. ARC is off in
// ViroKitVisionOS but on here in ViroReact, so __weak behaves normally.
static __weak VRORendererBridge *sCurrentBridge = nil;

@implementation VRORendererBridge

+ (nullable VRORendererBridge *)currentBridge {
    return sCurrentBridge;
}

- (instancetype)initWithDevice:(id <MTLDevice>)device {
    self = [super init];
    if (!self) return nil;

    // Publish before any of the setup below: a React view can mount and look for the bridge
    // while the ImmersiveSpace is still opening.
    sCurrentBridge = self;

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
    // VIRO_MINIMAL_RENDER=1 disables every post-processing pass, so the renderer draws straight
    // into the drawable with no offscreen targets in between.
    //
    // This is how the CompositorServices abort was localised (2026-08-25): with the passes on,
    // cp_drawable_encode_present kills the process as __BUG_IN_CLIENT__ a second or two after the
    // ImmersiveSpace opens; with them off the app runs. Keep it — the same switch separates "the
    // renderer is wrong" from "a post-processing pass is wrong" in one run, and that distinction
    // took four refuted hypotheses to reach the first time.
    // Each pass can also be turned off on its own (VIRO_DISABLE_HDR, _BLOOM, _SHADOWS, _PBR),
    // which is what narrows "somewhere in post-processing" down to a single pass.
    const bool minimal = (getenv("VIRO_MINIMAL_RENDER") != NULL);
    auto disabled = [minimal](const char *name) {
        return minimal || getenv(name) != NULL;
    };
    config.enableShadows        = !disabled("VIRO_DISABLE_SHADOWS");
    config.enableBloom          = !disabled("VIRO_DISABLE_BLOOM");
    config.enableHDR            = !disabled("VIRO_DISABLE_HDR");
    config.enablePBR            = !disabled("VIRO_DISABLE_PBR");
    config.enableMultisampling  = false;
    NSLog(@"[Viro] render config: shadows=%d bloom=%d hdr=%d pbr=%d",
          config.enableShadows, config.enableBloom, config.enableHDR, config.enablePBR);

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
        node->setName("white-box");

        // Hover and click have to be enabled per node — the delegate alone is not enough,
        // the controller checks the node's enabled-event map before dispatching.
        auto highlight = std::make_shared<VROHighlightOnInput>(mat);
        highlight->setEnabledEvent(VROEventDelegate::EventAction::OnHover, true);
        highlight->setEnabledEvent(VROEventDelegate::EventAction::OnClick, true);
        node->setEventDelegate(highlight);
        _eventDelegates.push_back(highlight);

        scene->getRootNode()->addChildNode(node);
    }


    _renderer->setSceneController(sceneController, _driver);
    _activeSceneController = sceneController;
    // ────────────────────────────────────────────────────────────────────────

    return self;
}

- (void)detachNativeSceneController {
    if (!_renderer) {
        return;
    }
    // An empty scene rather than none: VRORenderer always needs something to render, and the
    // point here is only to stop it holding React's nodes.
    auto empty = std::make_shared<VROSceneController>();
    _renderer->setSceneController(empty, _driver);
    _activeSceneController = empty;
    NSLog(@"[Viro] React scene detached from the ImmersiveSpace renderer");
}

- (void)setNativeSceneController:(std::shared_ptr<VROSceneController>)sceneController {
    if (!sceneController || !_renderer) {
        return;
    }
    // No transition duration: this runs when React mounts its scene, and a cross-fade from the
    // placeholder would read as a glitch rather than a transition.
    _renderer->setSceneController(sceneController, _driver);
    _activeSceneController = sceneController;

    // Worth a line: "my ImmersiveSpace is empty" has several possible causes, and this
    // distinguishes "React never handed a scene over" from "it did, and the scene is empty or
    // the geometry is not where you think". A child count of zero is the interesting case.
    auto scene = sceneController->getScene();
    NSLog(@"[Viro] React scene attached to the ImmersiveSpace renderer (%lu root children)",
          scene ? (unsigned long)scene->getRootNode()->getChildNodes().size() : 0UL);
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

- (BOOL)endAnyOpenEncoder {
    if (!_driver || !_driver->hasOpenEncoder()) {
        return NO;
    }
    _driver->endActiveEncoder();
    return YES;
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

            // Drawn after the scene, inside the same display pass, so it composites over what it
            // is pointing at. Its material neither reads nor writes depth, so it stays visible
            // against geometry it overlaps.
            if (_inputController) {
                if (std::shared_ptr<VROReticle> reticle = _inputController->getReticle()) {
                    if (_renderer->hasRenderContext()) {
                        std::shared_ptr<VRODriver> driver = std::static_pointer_cast<VRODriver>(_driver);
                        reticle->renderEye(eyeType, *_renderer->getRenderContext(), driver);
                    }
                }
            }
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

- (NSArray<NSNumber *> *)hoverableNodeIdentifiers {
    NSMutableArray<NSNumber *> *ids = [NSMutableArray array];
    if (!_renderer) { return ids; }
    if (!_activeSceneController) { return ids; }
    auto scene = _activeSceneController->getScene();
    if (!scene) { return ids; }

    // Walk the tree once per frame. A node gets a tracking area if it responds to the pointer at
    // all — not only OnHover. The system effect exists to say "this reacts to you", and a box
    // that takes a click but never lights up reads as dead, which is the opposite of the point.
    std::function<void(const std::shared_ptr<VRONode> &)> walk =
        [&](const std::shared_ptr<VRONode> &node) {
            if (!node) { return; }
            auto delegate = node->getEventDelegate();
            if (delegate &&
                (delegate->isEventEnabled(VROEventDelegate::EventAction::OnHover) ||
                 delegate->isEventEnabled(VROEventDelegate::EventAction::OnClick) ||
                 delegate->isEventEnabled(VROEventDelegate::EventAction::OnDrag))) {
                [ids addObject:@((uint64_t)node->getUniqueID())];
            }
            for (const auto &child : node->getChildNodes()) { walk(child); }
        };
    walk(scene->getRootNode());
    return ids;
}

- (void)renderTrackingAreasWithViewIndex:(NSUInteger)viewIndex
                    renderPassDescriptor:(MTLRenderPassDescriptor *)renderPass
                           viewTransform:(simd_float4x4)viewTransform
                                tangents:(simd_float4)tangents {
    if (!_renderer || !_activeSceneController) {
        return;
    }
    auto scene = _activeSceneController->getScene();
    if (!scene) { return; }

    if (!_renderer->hasRenderContext()) { return; }
    VRORenderContext &context = *_renderer->getRenderContext();

    // The context is left holding the *last* eye drawn, so reusing it as-is would write both
    // eyes' ids from the right eye's viewpoint — a highlight offset from its object on the left.
    // Point it at this view instead; the next frame's renderEye overwrites these again.
    VROMatrix4f vroView = toMatrix4f(viewTransform);
    VROMatrix4f vroProj = [VRORendererBridge projectionFromTangents:tangents
                                                               near:kZNear
                                                                far:kZFar];
    context.setViewMatrix(vroView);
    context.setProjectionMatrix(vroProj);

    _driver->beginDisplayPass(renderPass);

    // beginDisplayPass only hands the descriptor to the display target; the encoder is not
    // created until something binds it. The eye pass gets that for free inside renderEye, but
    // this pass has no renderer call to do it, so bind here — without this every draw below
    // returns early on a nil encoder and the descriptor's clear never runs, which leaves the
    // tracking texture holding whatever was in that memory.
    if (std::shared_ptr<VRORenderTarget> display = _driver->getDisplay()) {
        display->bind();
    }

    // Deliberately after the bind, not before it: a scene with nothing hoverable still has to
    // clear this texture. Returning early would present whatever was in that memory, and the
    // compositor reads it to decide the hover effect.
    if (_trackingAreaValues.empty()) {
        _driver->endDisplayPass();
        return;
    }

    std::shared_ptr<VRODriver> driver = std::static_pointer_cast<VRODriver>(_driver);

    std::function<void(const std::shared_ptr<VRONode> &)> walk =
        [&](const std::shared_ptr<VRONode> &node) {
            if (!node) { return; }
            auto it = _trackingAreaValues.find(node->getUniqueID());
            if (it != _trackingAreaValues.end()) {
                if (auto geometry = node->getGeometry()) {
                    geometry->renderTrackingArea(node->getWorldTransform(), it->second,
                                                 context, driver);
                }
            }
            for (const auto &child : node->getChildNodes()) { walk(child); }
        };
    walk(scene->getRootNode());

    _driver->endDisplayPass();
}

- (void)resetTrackingAreas {
    _trackingAreaValues.clear();
}

- (void)registerTrackingAreaForIdentifier:(uint64_t)identifier renderValue:(uint16_t)renderValue {
    _trackingAreaValues[(int)identifier] = renderValue;
}

- (void)setHeadPosition:(simd_float3)headPosition {
    if (!_inputController) { return; }
    _inputController->setHeadPosition({ headPosition.x, headPosition.y, headPosition.z });
}

- (void)setInputTuning:(NSDictionary *)tuning {
    if (!_inputController || tuning == nil) { return; }
    _inputController->applyTuning(tuning);
    NSLog(@"[Viro] input tuning: %@", tuning);
}

- (void)updateHandsWithLeftValid:(BOOL)leftValid
                      leftOrigin:(simd_float3)leftOrigin
                     leftForward:(simd_float3)leftForward
                    leftPinching:(BOOL)leftPinching
                      rightValid:(BOOL)rightValid
                     rightOrigin:(simd_float3)rightOrigin
                    rightForward:(simd_float3)rightForward
                   rightPinching:(BOOL)rightPinching {
    if (!_inputController) {
        return;
    }
    VROInputControllerVisionOS::HandState left;
    left.valid    = leftValid;
    left.pinching = leftPinching;
    left.origin   = { leftOrigin.x,  leftOrigin.y,  leftOrigin.z  };
    left.forward  = { leftForward.x, leftForward.y, leftForward.z };

    VROInputControllerVisionOS::HandState right;
    right.valid    = rightValid;
    right.pinching = rightPinching;
    right.origin   = { rightOrigin.x,  rightOrigin.y,  rightOrigin.z  };
    right.forward  = { rightForward.x, rightForward.y, rightForward.z };

    // Only stored here. The dispatch needs a camera, which the renderer supplies when it
    // calls onProcess during the frame.
    _inputController->setHandState(left, right);

}

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
