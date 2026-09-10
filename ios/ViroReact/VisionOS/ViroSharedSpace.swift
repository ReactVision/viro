//
//  ViroSharedSpace.swift
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//
//  Platform-native co-location for visionOS (CL-I).
//
//  visionOS cannot relocalise a ReactVision cloud anchor — the AR subsystem is
//  excluded from this renderer target and passthrough camera access needs an
//  enterprise entitlement — but it does not need to. ARKit's
//  SharedCoordinateSpaceProvider aligns the *world origin itself* across nearby
//  devices.
//
//  That makes visionOS shaped differently from every other platform here, and
//  the difference matters to callers:
//
//    Phone / Quest → a frame is an anchor you locate, and content is placed
//                    relative to that anchor's transform.
//    visionOS      → once the space converges there is no separate frame. World
//                    coordinates are already common, so the frame transform is
//                    identity and content placed at a world position lands in
//                    the same physical spot on every participant.
//
//  ARKit does not move the alignment data itself. It hands out opaque blobs and
//  expects them delivered to the other participants, by any transport — which is
//  what `nextOutgoingData()` and `pushIncoming(_:)` are for. The co-location
//  channel can carry them once reactvisioncca builds for xros; until then the
//  app supplies the transport, the same way it supplies a cloud anchor id today.
//

import ARKit
import Foundation

@available(visionOS 2.0, *)
@objc(ViroSharedSpace)
public final class ViroSharedSpace: NSObject {

    /// Whether this device can join a shared coordinate space at all.
    @objc public static var isSupported: Bool {
        SharedCoordinateSpaceProvider.isSupported
    }

    private let provider = SharedCoordinateSpaceProvider()
    private var eventTask: Task<Void, Never>?

    /// True between `.sharingEnabled` and `.sharingDisabled`.
    @objc public private(set) var isSharing: Bool = false

    /// Participants currently aligned to this space, excluding the local device.
    @objc public private(set) var participantCount: Int = 0

    /// Fired on sharing state or participant changes, on the main actor.
    @objc public var onStateChange: ((Bool, Int) -> Void)?

    /// The provider to hand to `ARKitSession.run()`, or nil when unsupported.
    ///
    /// Deliberately not run on its own session: a second `ARKitSession` is
    /// refused while one is live, so this has to join the renderer's.
    public var dataProvider: (any DataProvider)? {
        SharedCoordinateSpaceProvider.isSupported ? provider : nil
    }

    /// Begin observing. Call after the renderer's `ARKitSession.run()`.
    @objc public func start() {
        guard SharedCoordinateSpaceProvider.isSupported, eventTask == nil else { return }

        eventTask = Task { [weak self] in
            guard let self else { return }
            for await event in self.provider.eventUpdates {
                switch event {
                case .sharingEnabled:
                    await self.update(sharing: true, participants: self.participantCount)
                case .sharingDisabled:
                    await self.update(sharing: false, participants: 0)
                case .connectedParticipantIdentifiers(let ids):
                    await self.update(sharing: self.isSharing, participants: ids.count)
                @unknown default:
                    // A future case must not silently change the reported state.
                    NSLog("[Viro] shared space: unrecognised event, ignoring")
                }
            }
        }
    }

    @objc public func stop() {
        eventTask?.cancel()
        eventTask = nil
        isSharing = false
        participantCount = 0
    }

    /// Alignment data to deliver to the other participants, or nil when there is
    /// nothing new to send. Poll it; ARKit produces data as tracking evolves.
    @objc public func nextOutgoingData() -> Data? {
        provider.nextCoordinateSpaceData?.data
    }

    /// Hand ARKit alignment data received from another participant.
    @objc public func pushIncoming(_ data: Data) {
        guard let parsed = SharedCoordinateSpaceProvider.CoordinateSpaceData(data: data) else {
            NSLog("[Viro] shared space: rejected malformed alignment data (%d bytes)", data.count)
            return
        }
        provider.push(data: parsed)
    }

    @MainActor
    private func update(sharing: Bool, participants: Int) {
        isSharing = sharing
        participantCount = participants
        onStateChange?(sharing, participants)
    }
}
