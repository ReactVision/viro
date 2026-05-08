//
//  VROInputControllerBase.h
//  ViroRenderer
//
//  Copyright © 2017 Viro Media. All rights reserved.
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

#ifndef VROInputControllerBase_h
#define VROInputControllerBase_h

#include <stdio.h>
#include <map>
#include <vector>
#include <string>
#include <memory>
#include <set>
#include <float.h>
#include "VROInputPresenter.h"
#include "VROScene.h"
#include "VRORenderContext.h"
#include "VROEventDelegate.h"
#include "VROHitTestResult.h"
#include "VRONode.h"
#include "VROGeometry.h"

static const float ON_DRAG_DISTANCE_THRESHOLD = 0.01;
static const float ON_PINCH_SCALE_THRESHOLD = 0.02;
static const float ON_ROTATE_THRESHOLD = 0.01; // in radians (~.5729 degrees)
static float kSceneBackgroundDistance = 8;

/*
 Responsible for mapping generalized input data from a controller, to a unified
 set of VROEventDelegate.EventTypes. It then notifies corresponding VROEventDelegates
 in the current scene about the event type that has been triggered.
 
 For example, VROInputControllerDaydream maps the onTouchPadClick event onto
 a Viro onPrimaryClick event type within VROInputControllerBase, of which then notifies all
 VROEventDelegates about such an event.
 */
class VROInputControllerBase {
public:
    VROInputControllerBase(std::shared_ptr<VRODriver> driver);
    virtual ~VROInputControllerBase(){}
    
    /*
     For testing background reticle distance.
     */
    void debugMoveReticle();

    /*
     onProcess is to be implemented by derived classes to drive the processing
     of platform-specific input events and map them to viro-specific input events.
     */
    virtual void onProcess(const VROCamera &camera) {
        //No-op
    }

    /*
     Called when the renderer is about to be backgrounded within Android's lifecycle.
     */
    virtual void onPause() {
        // No-op
    }

    /*
     Called when the renderer is about to be foregrounded within Android's lifecycle.
     */
    virtual void onResume() {
        // No-op
    }

    void attachScene(std::shared_ptr<VROScene> scene) {
        _scene = scene;
    }
    void detachScene() {
        _scene = nullptr;
    }
    
    /*
     Set the current view and projection matrices.
     */
    void setView(VROMatrix4f view);
    void setProjection(VROMatrix4f projection);

    /*
     Get the presenter, creating it if it does not yet exist. Must be invoked on the
     rendering thread.
     */
    std::shared_ptr<VROInputPresenter> getPresenter() {
        std::shared_ptr<VRODriver> driver = _driver.lock();
        if (!_controllerPresenter && driver) {
            _controllerPresenter = createPresenter(driver);
            registerEventDelegate(_controllerPresenter);
        }
        return _controllerPresenter;
    }

    virtual std::string getHeadset() = 0;
    virtual std::string getController() = 0;

   /*
    For notifying components outside the scene tree, we specifically register
    them here to be tracked by the VROEventManager. Calling registerEventDelegate
    twice with the same delegate will only have callbacks be triggered once.
    */
    void registerEventDelegate(std::shared_ptr<VROEventDelegate> delegate){
        _delegates.insert(delegate);
    }
    void removeEventDelegate(std::shared_ptr<VROEventDelegate> delegate){
        _delegates.erase(delegate);
    }

    /*
     Below are Viro-specific input events to be trigged by derived Input Controller
     classes; these are the Viro-sepcific events that platform-specific events
     are mapped to.
     */
    void onControllerStatus(int source, VROEventDelegate::ControllerStatus status);
    void onButtonEvent(int source, VROEventDelegate::ClickState clickAction);
    void onTouchpadEvent(int source, VROEventDelegate::TouchState touchAction, float lastKnownX, float lastKnownY);
    
    /*
     The following position, rotation and forward are all in world coordinates.
     */
    void onMove(int source, VROVector3f position, VROQuaternion rotation, VROVector3f forward);
    void onSwipe(int source, VROEventDelegate::SwipeState swipeState);
    void onScroll(int source, float x, float y);
    
    /*
     Pinch event that passes scale factor indicting the change in the pinch ratio
     since the pinch started. Scale factor begins at 1 when pinch starts with
     PinchState::PinchStart.
     */
    void onPinch(int source, float scaleFactor, VROEventDelegate::PinchState pinchState);
    
    void onRotate(int source, float rotationRadians, VROEventDelegate::RotateState rotateState);

    /*
     Function that attempts to notify a delegate on the Scene of the current camera transform.
     */
    void notifyCameraTransform(const VROCamera &camera);

protected:
    
    virtual std::shared_ptr<VROInputPresenter> createPresenter(std::shared_ptr<VRODriver> driver) {
        perror("Error: Derived class should create a presenter for BaseInputController to consume!");
        return nullptr;
    }
    
    /*
     This function returns the forward offset used in drag
     */
    virtual VROVector3f getDragForwardOffset() = 0;
    
    /*
     Status of the current controller, for example if it's Connected / Disconnected.
     */
    VROEventDelegate::ControllerStatus _currentControllerStatus;

    /*
     Update the hit node, performing an intersection from the camera's position
     toward the given direction.
     */
    void updateHitNode(const VROCamera &camera, VROVector3f origin, VROVector3f ray);

    /*
     Source-aware hit-node update. Stores the result both in the legacy
     `_hitResult` (so single-pointer subsystems — drag, fuse, pinch, rotate —
     keep working unchanged) and in `_hitResultsBySource[source]` so that
     gaze/click events can resolve against the specific input source that
     produced them. Used by backends with multiple simultaneous pointers
     (e.g. OpenXR with two hands tracked at once).
     */
    void updateHitNode(int source, const VROCamera &camera,
                       VROVector3f origin, VROVector3f ray);

    /*
     Returns the per-source hit result if one was recorded for this source,
     otherwise falls back to the legacy single-source `_hitResult`.
     */
    std::shared_ptr<VROHitTestResult> getHitResultForSource(int source) const;

    /*
     VRODraggedObject encapsulates all the information that needs to be tracked
     and processed for onDrag events for a given dragged node.
     */
    struct VRODraggedObject{
        std::shared_ptr<VRONode> _draggedNode;
        VROVector3f _originalHitLocation;
        VROVector3f _originalDraggedNodePosition;
        VROQuaternion _originalDraggedNodeRotation;
        VROVector3f _forwardOffset;
        float _draggedDistanceFromController;
        VROEventDelegate::DragState _dragState;
    };
    
    /*
     Last hit result that we are performing a drag event on.
     */
    std::shared_ptr<VRODraggedObject> _lastDraggedNode;

    /*
     This function is meant to be called to run the dragging logic after onMove
     deals with other events, etc. This allows for the dragging logic to be overridden.
     */
    virtual void processDragging(int source);

    /*
     This function returns the next drag position for drag type FixedDistance
     */
    VROVector3f getDragPositionFixedDistance();

    /*
     This function returns the next drag position for drag type FixedToPlane
     */
    VROVector3f getDragPositionFixedToPlane();

    /*
     Returns the position of the intersection point on the given node's configured fixed
     plane, based on a rayIntersectPlane test performed from the _lastKnownPosition in
     the direction of _lastKnownForward.
     */
    VROVector3f getPlaneIntersect(std::shared_ptr<VRONode> node);

    /*
     Last result that was returned from the hit test.
     */
    std::shared_ptr<VROHitTestResult> _hitResult;

    /*
     Per-source hit results, populated by the source-aware updateHitNode
     overload. Empty entry → no per-source override; falls back to `_hitResult`.
     */
    std::map<int, std::shared_ptr<VROHitTestResult>> _hitResultsBySource;
    
    /*
     Last known posiiton of the controller.
     */
    VROVector3f _lastKnownPosition;
    
    /*
     Last known position of the node that was dragged previously by this controller.
     */
    VROVector3f _lastDraggedNodePosition;
    
    /*
     The pointer's normalized forward vector indicating where the controller
     is pointing.
     */
    VROVector3f _lastKnownForward;

    /*
     Last known pinch scale value.
     */
    float _lastPinchScale;
    
    /*
     Last known rotation value in radians.
     */
    float _lastRotation;
    
    /*
     The view and projection matrices, updated each render cycle.
     */
    VROMatrix4f _view, _projection;

    /*
     Delegates registered within the manager to be notified of events
     to an element that is outside the scene tree.
     */
    std::set<std::shared_ptr<VROEventDelegate>> _delegates;
    
    std::shared_ptr<VROScene> _scene;

    /*
     Returns the hit test result for the closest node that was hit.
     */
    VROHitTestResult hitTest(const VROCamera &camera, VROVector3f origin, VROVector3f ray, bool boundsOnly);

    virtual void processGazeEvent(int source);

private:
    
    /*
     UI presenter for this input controller.
     */
    std::shared_ptr<VROInputPresenter> _controllerPresenter;
    
    /*
     Last known position that a TouchEvent occured on.
     */
    VROVector3f _lastTouchedPosition;
    
    /*
     The controller's quaternion that represents the rotation from (0, 0, -1) required to
     achieve the controller's current orientation.
     */
    VROQuaternion _lastKnownRotation;

    /*
     Last node that we have clicked down on.
     */
    std::shared_ptr<VRONode> _lastClickedNode;

    /*
     Per-source last clicked node — used to detect a "completed" click
     (ClickDown + ClickUp on the same node from the same source) when
     multiple pointers are active simultaneously.
     */
    std::map<int, std::shared_ptr<VRONode>> _lastClickedNodesBySource;

    /*
     Last known that was successfully hovered upon.
     */
    std::shared_ptr<VRONode> _lastHoveredNode;

    /*
     Per-source last hovered node, used by the source-aware hover dispatch in
     `processGazeEvent`. An entry's presence is the signal that this source
     has its own hover state; otherwise we fall back to `_lastHoveredNode`.
     */
    std::map<int, std::shared_ptr<VRONode>> _lastHoveredNodesBySource;

    /*
     Hover hysteresis state, per source.

     OpenXR controller / hand aim ray-casts naturally jitter — pointing at a
     small target with a controller held by an unsteady hand causes the
     hit-test to alternate between the target node and the surrounding
     background every 1–3 frames. Without hysteresis, every alternation
     produced an `onHover(false)` / `onHover(true)` pair to JS, which
     manifested as a flickering hover state and "the click takes dozens of
     presses to register" — because if the user pulled the trigger on a
     "miss" frame, `onButtonEvent` resolved the click against the background
     instead of the target.

     The hysteresis works as a grace period: when the hit changes from
     `lastHovered` to a different node, we do NOT immediately fire the
     exit — instead we record the candidate change and the timestamp.
     If, within `kHoverHysteresisMillis`, the hit returns to `lastHovered`,
     the exit is cancelled (no `onHover(false)` ever fires). If the new
     candidate persists past the window, the exit is confirmed and the
     normal enter/exit dispatch happens.

     The same window is consulted by `onButtonEvent` so that clicks landing
     on a transient miss-frame are still routed to `lastHovered` if the
     pending-exit window is still open. That eliminates the "many presses
     to click" symptom even though the underlying ray-cast still oscillates.
     */
    static constexpr double kHoverHysteresisMillis = 75.0;
    struct HoverPending {
        std::shared_ptr<VRONode> candidateNode;   // node the hit currently resolves to
        VROVector3f candidatePos;                 // hit location at the moment of pending start
        bool candidateBgHit = false;              // whether candidate is a background hit
        double startedMillis = -1.0;              // wall-clock time when the candidate first appeared
    };
    std::map<int, HoverPending> _hoverPendingBySource;
    HoverPending _hoverPending;  // legacy single-source fallback

    /*
     Returns the first node that is able to handle the event action by bubbling it up.
     If nothing is able to handle the event, nullptr is returned.
     */
    std::shared_ptr<VRONode> getNodeToHandleEvent(VROEventDelegate::EventAction action,
                                                  std::shared_ptr<VRONode> startingNode);

    /*
     Current node that we are fusing on.
     */
    std::shared_ptr<VRONode> _currentFusedNode;
    
    /*
     Current node that we are pinching on.
     */
    std::shared_ptr<VRONode> _currentPinchedNode;
    
    /*
     Current node that we are rotating on.
     */
    std::shared_ptr<VRONode>  _currentRotateNode;

    /*
     Time at which the onFuse event is triggered, in milliseconds.
     */
    double _fuseTriggerAtMillis = -1;

    /*
     True if we have already notified delegates about the onFuse event.
     */
    bool _haveNotifiedOnFuseTriggered;

    /*
     Weak pointer to the driver.
     */
    std::weak_ptr<VRODriver> _driver;

    void processOnFuseEvent(int source, std::shared_ptr<VRONode> node);
    void notifyOnFuseEvent(int source, float timeToFuseRatio);
};

#endif
