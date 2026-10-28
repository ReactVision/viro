//
//  VRTVPSUploadSession.h
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// The background NSURLSession that uploads VPS scan recordings for
// VRTARSceneNavigatorModule's rvTransferScanRecording, so an upload keeps going
// while the app is in the background or after it has been terminated.
@interface VRTVPSUploadSession : NSObject

// Optional. An app may call this from
// application:handleEventsForBackgroundURLSession:completionHandler:. When the
// system relaunches the app in the background because an upload finished, this
// finishes the scan (its complete call) during that launch and then calls
// completionHandler on the main queue. Without it the upload still finishes,
// but the scan is completed only once VRTARSceneNavigatorModule next starts, or
// by Studio's sweep. Returns NO, and keeps nothing, for another identifier.
+ (BOOL)handleEventsForBackgroundURLSession:(NSString *)identifier
                          completionHandler:(void (^)(void))completionHandler;

// @internal Creates the session, or reconnects to the one an earlier process
// left, so that process's transfers are delivered here and finished.
+ (instancetype)shared;

// @internal A new zip path in Library/Application Support/ViroVPSUploads,
// creating the directory and deleting zips there older than 7 days. Nil, with
// *error set, when the directory cannot be created.
+ (nullable NSString *)makeZipPath:(NSString *_Nullable *_Nullable)error;

// @internal Resolves a JSON string, never fails. See rvTransferScanRecording.
- (void)transfer:(NSString *)requestJson completion:(void (^)(NSString *resultJson))completion;

// @internal Deletes a prepared zip that no transfer is using; a path outside
// the uploads directory is ignored.
- (void)discardZip:(NSString *)path completion:(void (^)(void))completion;

@end

NS_ASSUME_NONNULL_END
