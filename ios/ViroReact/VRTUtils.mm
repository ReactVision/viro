//
//  VRTUtils.m
//  React
//
//  Created by Vik Advani on 1/8/16.
//  Copyright © 2016 Viro Media. All rights reserved.
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
//

#import "VRTUtils.h"
#import <React/RCTUtils.h>


// Populate NSarray values into regular C float array
void populateFloatArrayFromNSArray(NSArray<NSNumber *> *arraySource, float arrayDest[], int totalCount){
    int index =0;
    for (NSNumber *value in arraySource) {
        arrayDest[index] = [value floatValue];
        index++;
        if(index >=totalCount){
            break;
        }
    }
}

// Populate NSarray values into regular C int array
void populateIntArrayFromNSArray(NSArray<NSNumber *> *arraySource, int arrayDest[], int totalCount){
    int index =0;
    for (NSNumber *value in arraySource) {
        arrayDest[index] = [value intValue];
        index++;
        if(index >=totalCount){
            break;
        }
    }
}

// Request data from a URL and invoke a block on the download session's queue on completion (a non-2xx status is an error).
// Default timeout is 30 seconds on the NSMutableURLRequest, after a timeout, the block is called with an error.
NSURLSessionDataTask* downloadDataWithURL(NSURL *url, void (^completionBlock)(NSData *data, NSError *error)){
    // One session for all downloads; creating a session per request leaks it until invalidated.
    static NSURLSession *downloadSession;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSURLSessionConfiguration *sessionConfig = [NSURLSessionConfiguration defaultSessionConfiguration];
        sessionConfig.timeoutIntervalForRequest = 30;
        downloadSession = [NSURLSession sessionWithConfiguration:sessionConfig];
    });
    NSURLSessionDataTask * downloadTask = [downloadSession dataTaskWithURL:url
                                                         completionHandler:^(NSData *data, NSURLResponse *response, NSError *error){
                                                             NSData *resultData = data;
                                                             NSError *resultError = error;
                                                             if (!resultError && [response isKindOfClass:[NSHTTPURLResponse class]]) {
                                                                 NSInteger status = ((NSHTTPURLResponse *)response).statusCode;
                                                                 if (status < 200 || status > 299) {
                                                                     resultData = nil;
                                                                     resultError = [NSError errorWithDomain:NSURLErrorDomain
                                                                                                       code:NSURLErrorBadServerResponse
                                                                                                   userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:@"HTTP status %ld", (long)status]}];
                                                                 }
                                                             }
                                                             // On the session's queue, not main: callers decode here (HDR,
                                                             // images, image targets) and hop to main themselves for UI work.
                                                             completionBlock(resultData, resultError);
                                                         }];
    [downloadTask resume];
    return downloadTask;
}
