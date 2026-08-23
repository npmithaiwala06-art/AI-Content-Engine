#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

static const CGFloat W = 540.0;
static const CGFloat H = 960.0;

static CGColorRef MakeColor(CGFloat r, CGFloat g, CGFloat b, CGFloat a) {
    return CGColorCreateGenericRGB(r, g, b, a);
}

static void SetFill(CGContextRef context, CGFloat r, CGFloat g, CGFloat b, CGFloat a) {
    CGColorRef color = MakeColor(r, g, b, a);
    CGContextSetFillColorWithColor(context, color);
    CGColorRelease(color);
}

static CGFloat Ease(CGFloat value) {
    value = MIN(1, MAX(0, value));
    return value * value * (3 - 2 * value);
}

static CGFloat SceneProgress(CGFloat time, CGFloat start, CGFloat end) {
    return Ease((time - start) / (end - start));
}

static void DrawRoundedRect(CGContextRef context, CGRect rect, CGFloat radius, CGFloat r, CGFloat g, CGFloat b, CGFloat a) {
    CGPathRef path = CGPathCreateWithRoundedRect(rect, radius, radius, NULL);
    CGContextAddPath(context, path);
    SetFill(context, r, g, b, a);
    CGContextFillPath(context);
    CGPathRelease(path);
}

static void DrawCenteredText(CGContextRef context, NSString *text, CGFloat y, CGFloat size, CGColorRef color) {
    CTFontRef font = CTFontCreateWithName(CFSTR("AvenirNext-DemiBold"), size, NULL);
    NSDictionary *attributes = @{
        (__bridge NSString *)kCTFontAttributeName: (__bridge id)font,
        (__bridge NSString *)kCTForegroundColorAttributeName: (__bridge id)color,
        (__bridge NSString *)kCTKernAttributeName: @(size > 30 ? -0.8 : 0.4),
    };
    NSAttributedString *attributed = [[NSAttributedString alloc] initWithString:text attributes:attributes];
    CTLineRef line = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)attributed);
    CGRect bounds = CTLineGetBoundsWithOptions(line, kCTLineBoundsUseOpticalBounds);
    CGContextSetTextPosition(context, (W - bounds.size.width) / 2.0 - bounds.origin.x, y);
    CTLineDraw(line, context);
    CFRelease(line);
    CFRelease(font);
}

static void DrawBackground(CGContextRef context, CGFloat time) {
    CGColorSpaceRef space = CGColorSpaceCreateDeviceRGB();
    NSArray *colors = @[
        (__bridge id)MakeColor(0.018, 0.018, 0.075, 1),
        (__bridge id)MakeColor(0.085, 0.03, 0.20, 1),
        (__bridge id)MakeColor(0.03, 0.13, 0.19, 1),
    ];
    CGFloat locations[] = {0, 0.58, 1};
    CGGradientRef gradient = CGGradientCreateWithColors(space, (__bridge CFArrayRef)colors, locations);
    CGContextDrawLinearGradient(context, gradient, CGPointMake(0, H), CGPointMake(W, 0), 0);
    CGGradientRelease(gradient);
    CGColorSpaceRelease(space);

    CGContextSaveGState(context);
    CGContextSetBlendMode(context, kCGBlendModeScreen);
    for (NSInteger index = 0; index < 7; index++) {
        CGFloat x = fmod(index * 101.0 + time * (12 + index), W + 120) - 60;
        CGFloat y = 90 + index * 133;
        SetFill(context, index % 2 ? 0.12 : 0.43, index % 2 ? 0.75 : 0.18, 0.95, 0.07);
        CGContextFillEllipseInRect(context, CGRectMake(x, y, 110, 110));
    }
    CGContextRestoreGState(context);
}

static void DrawBrand(CGContextRef context, CGFloat alpha) {
    CGContextSaveGState(context);
    CGContextSetAlpha(context, alpha);
    CGColorRef white = MakeColor(1, 1, 1, 0.94);
    DrawCenteredText(context, @"✦  SocialFlow OS", 900, 24, white);
    CGColorRelease(white);
    CGContextRestoreGState(context);
}

static void DrawHook(CGContextRef context, CGFloat time) {
    CGFloat entrance = SceneProgress(time, 0, 0.65);
    CGFloat exit = 1 - SceneProgress(time, 2.4, 3.0);
    CGContextSaveGState(context);
    CGContextSetAlpha(context, entrance * exit);
    CGContextTranslateCTM(context, 0, (1 - entrance) * -45);
    CGColorRef white = MakeColor(1, 1, 1, 1);
    CGColorRef violet = MakeColor(0.62, 0.39, 1, 1);
    DrawCenteredText(context, @"AI SHOULD", 535, 62, white);
    DrawCenteredText(context, @"SAVE TIME", 466, 62, violet);
    DrawCenteredText(context, @"NOT CREATE MORE WORK", 410, 22, white);
    DrawRoundedRect(context, CGRectMake(148, 330, 244, 6), 3, 0.47, 0.25, 1, 0.9);
    CGColorRelease(white);
    CGColorRelease(violet);
    CGContextRestoreGState(context);
}

static void DrawRepetition(CGContextRef context, CGFloat time) {
    CGFloat alpha = SceneProgress(time, 2.8, 3.4) * (1 - SceneProgress(time, 6.4, 7.0));
    CGContextSaveGState(context);
    CGContextSetAlpha(context, alpha);
    CGColorRef white = MakeColor(1, 1, 1, 1);
    CGColorRef pale = MakeColor(0.82, 0.79, 0.93, 1);
    DrawCenteredText(context, @"BRIEF. COPY. PASTE.", 810, 39, white);
    DrawCenteredText(context, @"REPEAT.", 756, 49, pale);
    for (NSInteger index = 0; index < 4; index++) {
        CGFloat slide = SceneProgress(time, 3.0 + index * 0.18, 3.65 + index * 0.18);
        CGFloat y = 600 - index * 128;
        DrawRoundedRect(context, CGRectMake(42 + (1 - slide) * 560, y, 456, 98), 18, 0.10, 0.08, 0.22, 0.97);
        DrawRoundedRect(context, CGRectMake(62 + (1 - slide) * 560, y + 57, 30, 25), 7, 0.45, 0.25, 1, 1);
        NSArray *labels = @[@"Brand voice", @"Target audience", @"Campaign goal", @"Platform rules"];
        CTFontRef font = CTFontCreateWithName(CFSTR("AvenirNext-Medium"), 19, NULL);
        NSDictionary *attrs = @{(__bridge NSString *)kCTFontAttributeName:(__bridge id)font, (__bridge NSString *)kCTForegroundColorAttributeName:(__bridge id)white};
        NSAttributedString *line = [[NSAttributedString alloc] initWithString:labels[index] attributes:attrs];
        CTLineRef textLine = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)line);
        CGContextSetTextPosition(context, 108 + (1 - slide) * 560, y + 59);
        CTLineDraw(textLine, context);
        CFRelease(textLine); CFRelease(font);
        DrawRoundedRect(context, CGRectMake(62 + (1 - slide) * 560, y + 24, 350 - index * 28, 9), 4.5, 0.64, 0.58, 0.78, 0.35);
    }
    CGColorRelease(white);
    CGColorRelease(pale);
    CGContextRestoreGState(context);
}

static void DrawFounderMoment(CGContextRef context, CGFloat time) {
    CGFloat alpha = SceneProgress(time, 6.8, 7.35) * (1 - SceneProgress(time, 10.2, 10.8));
    CGFloat scale = 0.88 + SceneProgress(time, 7.0, 8.2) * 0.12;
    CGContextSaveGState(context);
    CGContextSetAlpha(context, alpha);
    CGContextTranslateCTM(context, W / 2, H / 2);
    CGContextScaleCTM(context, scale, scale);
    CGContextTranslateCTM(context, -W / 2, -H / 2);
    SetFill(context, 0.43, 0.20, 1, 0.18);
    CGContextFillEllipseInRect(context, CGRectMake(95, 304, 350, 350));
    CGColorRef violet = MakeColor(0.67, 0.44, 1, 1);
    CGColorRef white = MakeColor(1, 1, 1, 1);
    DrawCenteredText(context, @"✦", 559, 98, violet);
    DrawCenteredText(context, @"SO I BUILT", 470, 44, white);
    DrawCenteredText(context, @"SOCIALFLOW OS", 410, 52, violet);
    DrawCenteredText(context, @"ONE SECURE CONTENT WORKSPACE", 360, 18, white);
    CGColorRelease(violet); CGColorRelease(white);
    CGContextRestoreGState(context);
}

static void DrawProductFlow(CGContextRef context, CGFloat time) {
    CGFloat alpha = SceneProgress(time, 10.5, 11.1) * (1 - SceneProgress(time, 16.0, 16.6));
    CGContextSaveGState(context);
    CGContextSetAlpha(context, alpha);
    CGColorRef white = MakeColor(1, 1, 1, 1);
    CGColorRef violet = MakeColor(0.67, 0.44, 1, 1);
    DrawCenteredText(context, @"REMEMBER THE BRAND", 812, 35, white);
    DrawCenteredText(context, @"CREATE THE CAMPAIGN", 768, 27, violet);
    DrawRoundedRect(context, CGRectMake(50, 430, 440, 260), 25, 0.055, 0.055, 0.13, 0.98);
    DrawRoundedRect(context, CGRectMake(78, 470, 166, 172), 18, 0.12, 0.09, 0.25, 1);
    DrawCenteredText(context, @"BRAND", 582, 19, white);
    DrawCenteredText(context, @"MEMORY", 552, 23, violet);
    for (NSInteger line = 0; line < 4; line++) DrawRoundedRect(context, CGRectMake(98, 512 - line * 26, 124 - line * 8, 8), 4, 0.64, 0.56, 0.82, 0.5);
    DrawRoundedRect(context, CGRectMake(296, 487, 154, 142), 18, 0.10, 0.27, 0.31, 1);
    DrawCenteredText(context, @"✦", 567, 48, white);
    DrawCenteredText(context, @"GENERATE", 526, 18, white);
    DrawCenteredText(context, @"CONTENT", 501, 18, white);
    CGFloat lineProgress = SceneProgress(time, 12.0, 14.5);
    SetFill(context, 0.42, 0.28, 1, 0.95);
    CGContextFillRect(context, CGRectMake(243, 550, 53 + lineProgress * 5, 4));
    DrawCenteredText(context, @"ONE GOAL IN", 356, 24, white);
    DrawCenteredText(context, @"A COMPLETE CAMPAIGN OUT", 317, 25, violet);
    CGColorRelease(white); CGColorRelease(violet);
    CGContextRestoreGState(context);
}

static void DrawOutputs(CGContextRef context, CGFloat time) {
    CGFloat alpha = SceneProgress(time, 16.2, 16.8) * (1 - SceneProgress(time, 21.0, 21.6));
    CGContextSaveGState(context);
    CGContextSetAlpha(context, alpha);
    CGColorRef white = MakeColor(1, 1, 1, 1);
    CGColorRef violet = MakeColor(0.68, 0.45, 1, 1);
    DrawCenteredText(context, @"READY TO CREATE", 815, 42, white);
    NSArray *titles = @[@"CAPTIONS", @"IMAGE ADS", @"VIDEO STORYBOARDS", @"CALENDARS"];
    NSArray *icons = @[@"✎", @"▣", @"▶", @"□"];
    for (NSInteger index = 0; index < 4; index++) {
        CGFloat reveal = SceneProgress(time, 16.4 + index * 0.35, 17.2 + index * 0.35);
        CGFloat x = index % 2 == 0 ? 44 : 282;
        CGFloat y = index < 2 ? 560 : 340;
        CGFloat offset = (1 - reveal) * 80;
        DrawRoundedRect(context, CGRectMake(x, y - offset, 214, 180), 22, 0.08, 0.07, 0.18, 0.98);
        CTFontRef iconFont = CTFontCreateWithName(CFSTR("AvenirNext-DemiBold"), 42, NULL);
        NSDictionary *attrs = @{(__bridge NSString *)kCTFontAttributeName:(__bridge id)iconFont, (__bridge NSString *)kCTForegroundColorAttributeName:(__bridge id)violet};
        NSAttributedString *icon = [[NSAttributedString alloc] initWithString:icons[index] attributes:attrs];
        CTLineRef iconLine = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)icon);
        CGContextSetTextPosition(context, x + 82, y + 93 - offset); CTLineDraw(iconLine, context);
        CFRelease(iconLine); CFRelease(iconFont);
        CTFontRef titleFont = CTFontCreateWithName(CFSTR("AvenirNext-DemiBold"), index == 2 ? 15 : 17, NULL);
        NSDictionary *titleAttrs = @{(__bridge NSString *)kCTFontAttributeName:(__bridge id)titleFont, (__bridge NSString *)kCTForegroundColorAttributeName:(__bridge id)white};
        NSAttributedString *title = [[NSAttributedString alloc] initWithString:titles[index] attributes:titleAttrs];
        CTLineRef titleLine = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)title);
        CGRect titleBounds = CTLineGetBoundsWithOptions(titleLine, kCTLineBoundsUseOpticalBounds);
        CGContextSetTextPosition(context, x + (214 - titleBounds.size.width) / 2 - titleBounds.origin.x, y + 46 - offset); CTLineDraw(titleLine, context);
        CFRelease(titleLine); CFRelease(titleFont);
    }
    DrawCenteredText(context, @"ONE CONNECTED WORKFLOW", 255, 20, violet);
    CGColorRelease(white); CGColorRelease(violet);
    CGContextRestoreGState(context);
}

static void DrawFinal(CGContextRef context, CGFloat time, CGImageRef adImage) {
    CGFloat alpha = SceneProgress(time, 21.2, 21.8);
    CGContextSaveGState(context);
    CGContextSetAlpha(context, alpha);
    if (adImage) {
        CGFloat imageRatio = (CGFloat)CGImageGetWidth(adImage) / (CGFloat)CGImageGetHeight(adImage);
        CGFloat drawHeight = 530;
        CGFloat drawWidth = drawHeight * imageRatio;
        CGRect imageRect = CGRectMake((W - drawWidth) / 2, 308, drawWidth, drawHeight);
        CGContextSetShadowWithColor(context, CGSizeMake(0, 12), 28, MakeColor(0.38, 0.18, 1, 0.45));
        CGContextDrawImage(context, imageRect, adImage);
        CGContextSetShadowWithColor(context, CGSizeZero, 0, NULL);
    }
    SetFill(context, 0.015, 0.015, 0.065, 0.38);
    CGContextFillRect(context, CGRectMake(0, 0, W, H));
    CGColorRef white = MakeColor(1, 1, 1, 1);
    CGColorRef violet = MakeColor(0.70, 0.49, 1, 1);
    DrawCenteredText(context, @"YOUR BRAND STORY.", 226, 35, white);
    DrawCenteredText(context, @"BUILT ONCE.", 179, 39, violet);
    DrawCenteredText(context, @"READY EVERYWHERE.", 132, 35, white);
    DrawRoundedRect(context, CGRectMake(78, 45, 384, 58), 17, 0.39, 0.15, 0.92, 0.97);
    DrawCenteredText(context, @"START CREATING WITH SOCIALFLOW OS", 65, 17, white);
    CGColorRelease(white); CGColorRelease(violet);
    CGContextRestoreGState(context);
}

static CGImageRef LoadImage(NSString *path) {
    NSURL *url = [NSURL fileURLWithPath:path];
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
    if (!source) return NULL;
    CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
    CFRelease(source);
    return image;
}

static BOOL RenderVideo(NSString *imagePath, NSString *videoPath) {
    NSURL *videoURL = [NSURL fileURLWithPath:videoPath];
    [[NSFileManager defaultManager] removeItemAtURL:videoURL error:nil];
    NSError *error = nil;
    AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:videoURL fileType:AVFileTypeQuickTimeMovie error:&error];
    if (!writer) { NSLog(@"%@", error); return NO; }
    NSDictionary *settings = @{ AVVideoCodecKey: AVVideoCodecTypeAppleProRes422Proxy, AVVideoWidthKey: @(W), AVVideoHeightKey: @(H) };
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:settings];
    input.expectsMediaDataInRealTime = NO;
    NSDictionary *attributes = @{ (__bridge NSString *)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_32BGRA), (__bridge NSString *)kCVPixelBufferWidthKey:@(W), (__bridge NSString *)kCVPixelBufferHeightKey:@(H) };
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input sourcePixelBufferAttributes:attributes];
    [writer addInput:input];
    if (![writer startWriting]) { NSLog(@"%@", writer.error); return NO; }
    [writer startSessionAtSourceTime:kCMTimeZero];
    CGImageRef adImage = LoadImage(imagePath);
    const int fps = 30;
    const int frames = 720;
    CGColorSpaceRef bitmapSpace = CGColorSpaceCreateDeviceRGB();
    for (int frame = 0; frame < frames; frame++) {
        @autoreleasepool {
            while (!input.readyForMoreMediaData) [NSThread sleepForTimeInterval:0.001];
            CVPixelBufferRef buffer = NULL;
            if (CVPixelBufferPoolCreatePixelBuffer(NULL, adaptor.pixelBufferPool, &buffer) != kCVReturnSuccess || !buffer) return NO;
            CVPixelBufferLockBaseAddress(buffer, 0);
            CGContextRef context = CGBitmapContextCreate(CVPixelBufferGetBaseAddress(buffer), W, H, 8, CVPixelBufferGetBytesPerRow(buffer), bitmapSpace, kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little);
            CGFloat time = (CGFloat)frame / fps;
            DrawBackground(context, time);
            DrawBrand(context, time < 21.2 ? 1 : 0);
            if (time < 3.1) DrawHook(context, time);
            if (time >= 2.7 && time < 7.1) DrawRepetition(context, time);
            if (time >= 6.7 && time < 10.9) DrawFounderMoment(context, time);
            if (time >= 10.4 && time < 16.7) DrawProductFlow(context, time);
            if (time >= 16.1 && time < 21.7) DrawOutputs(context, time);
            if (time >= 21.1) DrawFinal(context, time, adImage);
            CGContextRelease(context);
            CVPixelBufferUnlockBaseAddress(buffer, 0);
            BOOL appended = [adaptor appendPixelBuffer:buffer withPresentationTime:CMTimeMake(frame, fps)];
            CVPixelBufferRelease(buffer);
            if (!appended) { NSLog(@"%@", writer.error); return NO; }
        }
    }
    CGColorSpaceRelease(bitmapSpace);
    if (adImage) CGImageRelease(adImage);
    [input markAsFinished];
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{ dispatch_semaphore_signal(done); }];
    dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
    return writer.status == AVAssetWriterStatusCompleted;
}

static BOOL AddVoiceover(NSString *videoPath, NSString *voicePath, NSString *outputPath) {
    AVURLAsset *video = [AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:videoPath] options:nil];
    AVURLAsset *voice = [AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:voicePath] options:nil];
    AVMutableComposition *composition = [AVMutableComposition composition];
    AVMutableCompositionTrack *videoTrack = [composition addMutableTrackWithMediaType:AVMediaTypeVideo preferredTrackID:kCMPersistentTrackID_Invalid];
    AVAssetTrack *sourceVideo = [video tracksWithMediaType:AVMediaTypeVideo].firstObject;
    NSError *error = nil;
    [videoTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, video.duration) ofTrack:sourceVideo atTime:kCMTimeZero error:&error];
    videoTrack.preferredTransform = sourceVideo.preferredTransform;
    AVAssetTrack *sourceVoice = [voice tracksWithMediaType:AVMediaTypeAudio].firstObject;
    if (sourceVoice) {
        AVMutableCompositionTrack *audioTrack = [composition addMutableTrackWithMediaType:AVMediaTypeAudio preferredTrackID:kCMPersistentTrackID_Invalid];
        CMTime audioDuration = CMTimeCompare(voice.duration, video.duration) < 0 ? voice.duration : video.duration;
        [audioTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, audioDuration) ofTrack:sourceVoice atTime:kCMTimeZero error:&error];
    }
    NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
    [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];
    AVAssetExportSession *exporter = [[AVAssetExportSession alloc] initWithAsset:composition presetName:AVAssetExportPresetPassthrough];
    exporter.outputURL = outputURL;
    exporter.outputFileType = AVFileTypeQuickTimeMovie;
    exporter.shouldOptimizeForNetworkUse = YES;
    dispatch_semaphore_t done = dispatch_semaphore_create(0);
    [exporter exportAsynchronouslyWithCompletionHandler:^{ dispatch_semaphore_signal(done); }];
    dispatch_semaphore_wait(done, DISPATCH_TIME_FOREVER);
    if (exporter.status != AVAssetExportSessionStatusCompleted) NSLog(@"%@", exporter.error);
    return exporter.status == AVAssetExportSessionStatusCompleted;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 5) {
            fprintf(stderr, "Usage: %s IMAGE VIDEO_ONLY VOICEOVER OUTPUT\n", argv[0]);
            return 2;
        }
        NSString *image = [NSString stringWithUTF8String:argv[1]];
        NSString *videoOnly = [NSString stringWithUTF8String:argv[2]];
        NSString *voice = [NSString stringWithUTF8String:argv[3]];
        NSString *output = [NSString stringWithUTF8String:argv[4]];
        if (!RenderVideo(image, videoOnly)) return 1;
        if (!AddVoiceover(videoOnly, voice, output)) return 1;
        printf("%s\n", output.UTF8String);
    }
    return 0;
}
