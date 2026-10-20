//
//  VRTVPSUploadSession.mm
//  ViroReact
//
//  Copyright © 2026 ReactVision. All rights reserved.
//

#import "VRTVPSUploadSession.h"
#import <UIKit/UIKit.h>

static NSString *const kRVUploadSessionId = @"com.reactvision.viro.vps-upload";
static const NSTimeInterval kRVZipMaxAge = 7 * 24 * 60 * 60;
static const NSUInteger kRVMaxBodyBytes = 64 * 1024;

static void (^sEventsCompletionHandler)(void);

static NSString *RVUploadJson(NSDictionary *object) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
    NSString *json = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
    return json ?: @"{\"success\":false,\"stage\":\"upload\",\"error\":\"Could not encode the result\"}";
}

static NSDictionary *RVUploadObject(NSString *json) {
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    id parsed = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    return [parsed isKindOfClass:[NSDictionary class]] ? parsed : nil;
}

static NSString *RVUploadString(id value) {
    return [value isKindOfClass:[NSString class]] && [value length] > 0 ? value : nil;
}

static NSURL *RVUploadHttpURL(id value) {
    NSURL *url = [value isKindOfClass:[NSString class]] ? [NSURL URLWithString:value] : nil;
    NSString *scheme = url.scheme.lowercaseString;
    return [scheme isEqualToString:@"https"] || [scheme isEqualToString:@"http"] ? url : nil;
}

static NSDictionary<NSString *, NSString *> *RVUploadHeaders(id value) {
    NSMutableDictionary *headers = [NSMutableDictionary dictionary];
    if (![value isKindOfClass:[NSDictionary class]]) return headers;
    for (id key in value) {
        id header = value[key];
        if ([key isKindOfClass:[NSString class]] && [header isKindOfClass:[NSString class]]) {
            headers[key] = header;
        }
    }
    return headers;
}

static NSString *RVUploadBodyString(NSData *data) {
    if (!data) return @"";
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"";
}

static NSInteger RVUploadStatus(NSURLResponse *response) {
    return [response isKindOfClass:[NSHTTPURLResponse class]] ? ((NSHTTPURLResponse *)response).statusCode : 0;
}

static NSString *RVUploadsDirectory(BOOL create, NSString **error) {
    NSFileManager *fm = [NSFileManager defaultManager];
    NSError *err = nil;
    NSURL *support = [fm URLForDirectory:NSApplicationSupportDirectory inDomain:NSUserDomainMask
                       appropriateForURL:nil create:create error:&err];
    NSURL *dir = [support URLByAppendingPathComponent:@"ViroVPSUploads" isDirectory:YES];
    if (dir && create) {
        // nsurlsessiond reads the zip while the device may be locked, and a
        // file created here inherits the directory's protection class.
        NSDictionary *attributes = @{NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication};
        if (![fm createDirectoryAtURL:dir withIntermediateDirectories:YES attributes:attributes error:&err]) {
            dir = nil;
        } else {
            [dir setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:nil];
        }
    }
    if (!dir && error) {
        *error = [NSString stringWithFormat:@"Could not create the upload directory: %@",
                  err.localizedDescription ?: @"unknown error"];
    }
    return dir.path;
}

// Only zips directly inside the uploads directory are ever read for an upload
// or deleted, whatever path JS passes.
static BOOL RVIsUploadZip(NSString *path) {
    if (path.length == 0 || ![path.pathExtension isEqualToString:@"zip"]) return NO;
    NSString *dir = RVUploadsDirectory(NO, nil);
    return dir && [[path.stringByStandardizingPath stringByDeletingLastPathComponent]
                      isEqualToString:dir.stringByStandardizingPath];
}

static void RVRemoveUploadZip(NSString *path) {
    if (RVIsUploadZip(path)) [[NSFileManager defaultManager] removeItemAtPath:path error:nil];
}

// Background execution time for the complete call, which runs on an ordinary
// session. -end is idempotent, so the expiration handler and the settle that
// follows it can both call it.
@interface RVUploadBackgroundTime : NSObject
- (void)end;
@end

@implementation RVUploadBackgroundTime {
    UIBackgroundTaskIdentifier _identifier;
}

- (instancetype)init {
    if ((self = [super init])) {
        __weak RVUploadBackgroundTime *weakSelf = self;
        @synchronized (self) {
            _identifier = [[UIApplication sharedApplication]
                beginBackgroundTaskWithName:@"ViroVPSScanUpload"
                          expirationHandler:^{ [weakSelf end]; }];
        }
    }
    return self;
}

- (void)end {
    @synchronized (self) {
        if (_identifier == UIBackgroundTaskInvalid) return;
        [[UIApplication sharedApplication] endBackgroundTask:_identifier];
        _identifier = UIBackgroundTaskInvalid;
    }
}

@end

@interface VRTVPSUploadSession () <NSURLSessionDataDelegate>
@end

@implementation VRTVPSUploadSession {
    // Every ivar below, and every delegate callback, is on this queue.
    dispatch_queue_t _queue;
    NSURLSession *_background;
    NSURLSession *_foreground;
    BOOL _tasksLoaded;
    NSMutableArray<dispatch_block_t> *_waitingForTasks;
    // Keyed by scan id, from a transfer's start until it settles.
    NSMutableDictionary<NSString *, NSString *> *_zips;
    NSMutableDictionary<NSString *, void (^)(NSString *)> *_completions;
    NSMutableDictionary<NSString *, RVUploadBackgroundTime *> *_backgroundTimes;
    NSMutableDictionary<NSNumber *, NSMutableData *> *_bodies;
}

+ (BOOL)handleEventsForBackgroundURLSession:(NSString *)identifier
                          completionHandler:(void (^)(void))completionHandler {
    if (![identifier isEqualToString:kRVUploadSessionId]) return NO;
    // Stored before the session exists, since creating it is what delivers
    // the events, and their end can follow at once.
    @synchronized (self) {
        sEventsCompletionHandler = [completionHandler copy];
    }
    [self shared];
    return YES;
}

+ (instancetype)shared {
    static VRTVPSUploadSession *shared;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        shared = [[VRTVPSUploadSession alloc] initShared];
    });
    return shared;
}

+ (NSString *)makeZipPath:(NSString **)error {
    NSString *dir = RVUploadsDirectory(YES, error);
    if (!dir) return nil;
    NSFileManager *fm = [NSFileManager defaultManager];
    NSDate *cutoff = [NSDate dateWithTimeIntervalSinceNow:-kRVZipMaxAge];
    for (NSString *name in [fm contentsOfDirectoryAtPath:dir error:nil]) {
        if (![name.pathExtension isEqualToString:@"zip"]) continue;
        NSString *path = [dir stringByAppendingPathComponent:name];
        NSDate *modified = [fm attributesOfItemAtPath:path error:nil][NSFileModificationDate];
        if (modified && [modified compare:cutoff] == NSOrderedAscending) {
            [fm removeItemAtPath:path error:nil];
        }
    }
    return [dir stringByAppendingPathComponent:[[NSUUID UUID].UUIDString stringByAppendingPathExtension:@"zip"]];
}

- (instancetype)initShared {
    if (!(self = [super init])) return nil;
    _queue = dispatch_queue_create("com.reactvision.viro.vps-upload", DISPATCH_QUEUE_SERIAL);
    _waitingForTasks = [NSMutableArray array];
    _zips = [NSMutableDictionary dictionary];
    _completions = [NSMutableDictionary dictionary];
    _backgroundTimes = [NSMutableDictionary dictionary];
    _bodies = [NSMutableDictionary dictionary];

    NSOperationQueue *delegateQueue = [[NSOperationQueue alloc] init];
    delegateQueue.maxConcurrentOperationCount = 1;
    delegateQueue.underlyingQueue = _queue;

    NSURLSessionConfiguration *config =
        [NSURLSessionConfiguration backgroundSessionConfigurationWithIdentifier:kRVUploadSessionId];
    config.sessionSendsLaunchEvents = YES;
    config.discretionary = NO;
    config.timeoutIntervalForRequest = 120;
    config.timeoutIntervalForResource = 24 * 60 * 60;
    _background = [NSURLSession sessionWithConfiguration:config delegate:self delegateQueue:delegateQueue];

    NSURLSessionConfiguration *foreground = [NSURLSessionConfiguration ephemeralSessionConfiguration];
    foreground.timeoutIntervalForRequest = 60;
    _foreground = [NSURLSession sessionWithConfiguration:foreground];

    // Transfer calls wait for this, so a scan that an earlier process is still
    // uploading answers UPLOAD_IN_PROGRESS rather than starting a second PUT.
    [_background getAllTasksWithCompletionHandler:^(NSArray<__kindof NSURLSessionTask *> *tasks) {
        dispatch_async(self->_queue, ^{
            for (NSURLSessionTask *task in tasks) {
                if (task.state != NSURLSessionTaskStateRunning &&
                    task.state != NSURLSessionTaskStateSuspended) continue;
                NSDictionary *job = RVUploadObject(task.taskDescription);
                NSString *scanId = RVUploadString(job[@"scan_id"]);
                if (scanId && !self->_zips[scanId]) {
                    self->_zips[scanId] = RVUploadString(job[@"zip_path"]) ?: @"";
                }
            }
            self->_tasksLoaded = YES;
            for (dispatch_block_t block in self->_waitingForTasks) block();
            [self->_waitingForTasks removeAllObjects];
        });
    }];
    return self;
}

- (void)whenTasksLoaded:(dispatch_block_t)block {
    dispatch_async(_queue, ^{
        if (self->_tasksLoaded) {
            block();
        } else {
            [self->_waitingForTasks addObject:block];
        }
    });
}

- (void)transfer:(NSString *)requestJson completion:(void (^)(NSString *))completion {
    [self whenTasksLoaded:^{
        [self startTransfer:requestJson completion:completion];
    }];
}

- (void)discardZip:(NSString *)path completion:(void (^)(void))completion {
    [self whenTasksLoaded:^{
        [self removeZipIfUnused:path];
        completion();
    }];
}

- (void)removeZipIfUnused:(NSString *)path {
    if (path && ![_zips.allValues containsObject:path]) RVRemoveUploadZip(path);
}

- (void)startTransfer:(NSString *)requestJson completion:(void (^)(NSString *))completion {
    NSDictionary *request = RVUploadObject(requestJson);
    NSString *scanId = RVUploadString(request[@"scan_id"]);
    NSString *zipPath = RVUploadString(request[@"zip_path"]);
    id bytesValue = request[@"bytes"];
    long long bytes = [bytesValue isKindOfClass:[NSNumber class]] ? [bytesValue longLongValue] : 0;
    id putValue = request[@"put_url"];
    NSURL *putURL = RVUploadHttpURL(putValue);
    NSURL *completeURL = RVUploadHttpURL(request[@"complete_url"]);

    NSString *invalid = nil;
    if (!scanId) {
        invalid = @"scan_id is missing";
    } else if (putValue && putValue != [NSNull null] && !putURL) {
        invalid = @"put_url is not an http(s) URL";
    } else if (putURL && !RVIsUploadZip(zipPath)) {
        invalid = @"zip_path is not a zip made by rvPrepareScanRecording";
    } else if (putURL && (bytes <= 0 || [bytesValue doubleValue] != (double)bytes)) {
        invalid = @"bytes must be a positive integer";
    } else if (!completeURL) {
        invalid = @"complete_url is not an http(s) URL";
    }
    if (invalid) {
        [self removeZipIfUnused:zipPath];
        completion(RVUploadJson(@{@"success": @NO, @"stage": @"upload", @"scan_id": scanId ?: @"",
                                  @"error": [@"Invalid transfer request: " stringByAppendingString:invalid]}));
        return;
    }
    if (_zips[scanId]) {
        [self removeZipIfUnused:zipPath];
        completion(RVUploadJson(@{@"success": @NO, @"stage": @"upload", @"scan_id": scanId,
                                  @"code": @"UPLOAD_IN_PROGRESS",
                                  @"error": @"This scan's recording is already being uploaded"}));
        return;
    }

    NSDictionary *job = @{
        @"scan_id": scanId,
        @"zip_path": zipPath ?: @"",
        @"complete_url": completeURL.absoluteString,
        @"complete_headers": RVUploadHeaders(request[@"complete_headers"]),
    };
    _zips[scanId] = job[@"zip_path"];
    _completions[scanId] = completion;

    if (!putURL) {
        RVRemoveUploadZip(zipPath);
        [self postComplete:job attempt:0];
        return;
    }

    // The session sends the file's size as Content-Length, so the file must
    // be exactly the size the upload was admitted for.
    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:zipPath error:nil];
    if (!attributes) {
        [self settle:scanId result:@{@"success": @NO, @"stage": @"upload",
                                     @"error": @"The recording zip is missing"}];
        return;
    }
    unsigned long long size = [attributes[NSFileSize] unsignedLongLongValue];
    if (size != (unsigned long long)bytes) {
        [self settle:scanId result:@{@"success": @NO, @"stage": @"upload",
                                     @"error": [NSString stringWithFormat:
                                         @"The recording zip is %llu bytes, not the %lld in the request", size, bytes]}];
        return;
    }

    NSMutableURLRequest *put = [NSMutableURLRequest requestWithURL:putURL];
    put.HTTPMethod = @"PUT";
    put.timeoutInterval = 120;
    NSDictionary *putHeaders = RVUploadHeaders(request[@"put_headers"]);
    for (NSString *key in putHeaders) {
        [put setValue:putHeaders[key] forHTTPHeaderField:key];
    }
    if (![put valueForHTTPHeaderField:@"Content-Type"]) {
        [put setValue:@"application/zip" forHTTPHeaderField:@"Content-Type"];
    }
    NSURLSessionUploadTask *task = [_background uploadTaskWithRequest:put fromFile:[NSURL fileURLWithPath:zipPath]];
    // Read back in didCompleteWithError, possibly by a later process.
    task.taskDescription = RVUploadJson(job);
    [task resume];
}

- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)dataTask didReceiveData:(NSData *)data {
    NSNumber *key = @(dataTask.taskIdentifier);
    NSMutableData *body = _bodies[key];
    if (!body) {
        body = [NSMutableData data];
        _bodies[key] = body;
    }
    if (body.length < kRVMaxBodyBytes) [body appendData:data];
}

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    NSNumber *key = @(task.taskIdentifier);
    NSData *body = _bodies[key];
    [_bodies removeObjectForKey:key];

    NSDictionary *job = RVUploadObject(task.taskDescription);
    NSString *scanId = RVUploadString(job[@"scan_id"]);
    if (!scanId) return;
    NSString *zipPath = RVUploadString(job[@"zip_path"]) ?: @"";
    _zips[scanId] = zipPath;
    RVRemoveUploadZip(zipPath);

    if (error) {
        [self settle:scanId result:@{@"success": @NO, @"stage": @"upload",
                                     @"error": error.localizedDescription ?: @"Upload failed"}];
        return;
    }
    NSInteger status = RVUploadStatus(task.response);
    NSString *bodyString = RVUploadBodyString(body);
    // Storage answers a PUT to a path that is already stored with 409, or
    // with 400 and a Duplicate / "already exists" body: an earlier PUT landed.
    BOOL stored = (status >= 200 && status < 300) || status == 409 ||
        (status == 400 && ([bodyString containsString:@"Duplicate"] ||
                           [bodyString containsString:@"already exists"]));
    if (!stored) {
        [self settle:scanId result:@{@"success": @NO, @"stage": @"upload",
                                     @"status": @(status), @"body": bodyString}];
        return;
    }
    [self postComplete:job attempt:0];
}

- (void)URLSessionDidFinishEventsForBackgroundURLSession:(NSURLSession *)session {
    dispatch_async(dispatch_get_main_queue(), ^{
        void (^handler)(void) = nil;
        @synchronized ([VRTVPSUploadSession class]) {
            handler = sEventsCompletionHandler;
            sEventsCompletionHandler = nil;
        }
        if (handler) handler();
    });
}

- (void)postComplete:(NSDictionary *)job attempt:(int)attempt {
    NSString *scanId = job[@"scan_id"];
    NSURL *url = RVUploadHttpURL(job[@"complete_url"]);
    if (!url) {
        [self settle:scanId result:@{@"success": @NO, @"stage": @"complete",
                                     @"error": @"complete_url is not an http(s) URL"}];
        return;
    }
    if (!_backgroundTimes[scanId]) {
        _backgroundTimes[scanId] = [[RVUploadBackgroundTime alloc] init];
    }

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = @"POST";
    request.timeoutInterval = 60;
    NSDictionary *headers = RVUploadHeaders(job[@"complete_headers"]);
    for (NSString *key in headers) {
        [request setValue:headers[key] forHTTPHeaderField:key];
    }
    if (![request valueForHTTPHeaderField:@"Content-Type"]) {
        [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    }
    request.HTTPBody = [@"{}" dataUsingEncoding:NSUTF8StringEncoding];

    [[_foreground dataTaskWithRequest:request
                    completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        dispatch_async(self->_queue, ^{
            NSInteger status = error ? 0 : RVUploadStatus(response);
            if ((error || status >= 500) && attempt < 2) {
                int64_t delay = attempt == 0 ? 2 : 10;
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, delay * (int64_t)NSEC_PER_SEC), self->_queue, ^{
                    [self postComplete:job attempt:attempt + 1];
                });
                return;
            }
            if (error) {
                [self settle:scanId result:@{@"success": @NO, @"stage": @"complete",
                                             @"error": error.localizedDescription ?: @"Complete call failed"}];
                return;
            }
            BOOL ok = status >= 200 && status < 300;
            [self settle:scanId result:@{@"success": @(ok), @"stage": @"complete",
                                         @"status": @(status), @"body": RVUploadBodyString(data)}];
        });
    }] resume];
}

- (void)settle:(NSString *)scanId result:(NSDictionary *)result {
    NSMutableDictionary *withId = [result mutableCopy];
    withId[@"scan_id"] = scanId;
    RVRemoveUploadZip(_zips[scanId]);
    [_zips removeObjectForKey:scanId];
    [_backgroundTimes[scanId] end];
    [_backgroundTimes removeObjectForKey:scanId];
    void (^completion)(NSString *) = _completions[scanId];
    [_completions removeObjectForKey:scanId];
    if (completion) completion(RVUploadJson(withId));
}

@end
