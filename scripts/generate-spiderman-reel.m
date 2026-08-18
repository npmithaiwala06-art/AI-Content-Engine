#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>

static CGColorRef Color(CGFloat r, CGFloat g, CGFloat b, CGFloat a) {
    return CGColorCreateGenericRGB(r, g, b, a);
}

static void FillColor(CGContextRef context, CGFloat r, CGFloat g, CGFloat b, CGFloat a) {
    CGColorRef value = Color(r, g, b, a);
    CGContextSetFillColorWithColor(context, value);
    CGColorRelease(value);
}

static void StrokeColor(CGContextRef context, CGFloat r, CGFloat g, CGFloat b, CGFloat a) {
    CGColorRef value = Color(r, g, b, a);
    CGContextSetStrokeColorWithColor(context, value);
    CGColorRelease(value);
}

static void DrawCenteredText(CGContextRef context, NSString *text, CGFloat y, CGFloat size, CGColorRef foreground) {
    CTFontRef font = CTFontCreateWithName(CFSTR("AvenirNextCondensed-Heavy"), size, NULL);
    NSDictionary *attributes = @{
        (__bridge NSString *)kCTFontAttributeName: (__bridge id)font,
        (__bridge NSString *)kCTForegroundColorAttributeName: (__bridge id)foreground,
        (__bridge NSString *)kCTKernAttributeName: @1.5,
    };
    NSAttributedString *string = [[NSAttributedString alloc] initWithString:text attributes:attributes];
    CTLineRef line = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)string);
    CGRect bounds = CTLineGetBoundsWithOptions(line, kCTLineBoundsUseOpticalBounds);
    CGContextSetTextPosition(context, (720.0 - bounds.size.width) / 2.0 - bounds.origin.x, y);
    CTLineDraw(line, context);
    CFRelease(line);
    CFRelease(font);
}

static void DrawWeb(CGContextRef context, CGPoint center, CGFloat phase) {
    CGContextSaveGState(context);
    StrokeColor(context, 1, 1, 1, 0.23);
    CGContextSetLineWidth(context, 2);
    CGFloat radius = 820;
    for (NSInteger index = 0; index < 14; index++) {
        CGFloat angle = ((CGFloat)index / 14.0) * M_PI * 2.0 + phase * 0.05;
        CGContextMoveToPoint(context, center.x, center.y);
        CGContextAddLineToPoint(context, center.x + cos(angle) * radius, center.y + sin(angle) * radius);
    }
    CGContextStrokePath(context);
    for (NSInteger ring = 1; ring <= 8; ring++) {
        CGFloat ringRadius = ring * 95.0 + fmod(phase, 95.0);
        CGContextBeginPath(context);
        for (NSInteger index = 0; index <= 56; index++) {
            CGFloat angle = ((CGFloat)index / 56.0) * M_PI * 2.0;
            CGFloat wave = sin(angle * 14.0 + phase * 0.08) * 7.0;
            CGFloat x = center.x + cos(angle) * (ringRadius + wave);
            CGFloat y = center.y + sin(angle) * (ringRadius + wave);
            index == 0 ? CGContextMoveToPoint(context, x, y) : CGContextAddLineToPoint(context, x, y);
        }
        CGContextClosePath(context);
        CGContextStrokePath(context);
    }
    CGContextRestoreGState(context);
}

static void DrawHero(CGContextRef context, CGFloat progress) {
    CGFloat swing = sin(progress * M_PI * 2.0);
    CGFloat bounce = cos(progress * M_PI * 4.0);
    CGFloat x = 720.0 * 0.52 + swing * 115.0;
    CGFloat y = 1280.0 * 0.46 + bounce * 45.0;
    CGContextSaveGState(context);
    CGContextTranslateCTM(context, x, y);
    CGContextRotateCTM(context, -0.22 + swing * 0.12);

    StrokeColor(context, 0.95, 0.98, 1, 0.9);
    CGContextSetLineWidth(context, 5);
    CGContextMoveToPoint(context, 64, 100);
    CGContextAddCurveToPoint(context, 175, 255, 290, 485, 390, 720);
    CGContextStrokePath(context);

    FillColor(context, 0.01, 0.02, 0.06, 0.4);
    CGContextFillEllipseInRect(context, CGRectMake(-95, -240, 210, 60));
    FillColor(context, 0.78, 0.03, 0.10, 1);
    CGContextFillEllipseInRect(context, CGRectMake(-54, 76, 108, 132));
    FillColor(context, 0.94, 0.98, 1, 1);
    CGContextFillEllipseInRect(context, CGRectMake(-37, 125, 26, 48));
    CGContextFillEllipseInRect(context, CGRectMake(11, 125, 26, 48));

    CGMutablePathRef torso = CGPathCreateMutable();
    CGPathMoveToPoint(torso, NULL, -58, 80);
    CGPathAddCurveToPoint(torso, NULL, -82, 20, -76, -58, -42, -94);
    CGPathAddLineToPoint(torso, NULL, 45, -94);
    CGPathAddCurveToPoint(torso, NULL, 78, -50, 82, 24, 58, 80);
    CGPathCloseSubpath(torso);
    CGContextAddPath(context, torso);
    FillColor(context, 0.72, 0.03, 0.09, 1);
    CGContextFillPath(context);
    CGPathRelease(torso);
    FillColor(context, 0.03, 0.18, 0.45, 1);
    CGContextFillRect(context, CGRectMake(-43, -91, 87, 78));

    CGContextSetLineCap(context, kCGLineCapRound);
    CGContextSetLineWidth(context, 30);
    StrokeColor(context, 0.76, 0.03, 0.10, 1);
    CGContextMoveToPoint(context, -48, 43); CGContextAddLineToPoint(context, -132, 5); CGContextAddLineToPoint(context, -170, -84); CGContextStrokePath(context);
    CGContextMoveToPoint(context, 48, 43); CGContextAddLineToPoint(context, 111, 105); CGContextAddLineToPoint(context, 75, 164); CGContextStrokePath(context);
    CGContextSetLineWidth(context, 38);
    StrokeColor(context, 0.03, 0.18, 0.45, 1);
    CGContextMoveToPoint(context, -29, -81); CGContextAddLineToPoint(context, -100, -180); CGContextAddLineToPoint(context, -173, -203); CGContextStrokePath(context);
    CGContextMoveToPoint(context, 29, -81); CGContextAddLineToPoint(context, 111, -154); CGContextAddLineToPoint(context, 176, -118); CGContextStrokePath(context);
    CGContextRestoreGState(context);
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSString *path = argc > 1 ? [NSString stringWithUTF8String:argv[1]] : @"spiderman-reel-demo.mov";
        NSURL *url = [NSURL fileURLWithPath:path];
        [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
        NSError *error = nil;
        AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:url fileType:AVFileTypeQuickTimeMovie error:&error];
        if (!writer) { NSLog(@"%@", error); return 1; }
        NSDictionary *settings = @{
            AVVideoCodecKey: AVVideoCodecTypeAppleProRes422Proxy,
            AVVideoWidthKey: @720,
            AVVideoHeightKey: @1280,
        };
        AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:settings];
        input.expectsMediaDataInRealTime = NO;
        NSDictionary *attributes = @{
            (__bridge NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
            (__bridge NSString *)kCVPixelBufferWidthKey: @720,
            (__bridge NSString *)kCVPixelBufferHeightKey: @1280,
        };
        AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input sourcePixelBufferAttributes:attributes];
        [writer addInput:input];
        if (![writer startWriting]) { NSLog(@"%@", writer.error); return 1; }
        [writer startSessionAtSourceTime:kCMTimeZero];

        const int fps = 30;
        const int frames = 180;
        for (int frame = 0; frame < frames; frame++) {
            while (!input.readyForMoreMediaData) { [NSThread sleepForTimeInterval:0.002]; }
            CVPixelBufferRef buffer = NULL;
            CVReturn result = CVPixelBufferPoolCreatePixelBuffer(NULL, adaptor.pixelBufferPool, &buffer);
            if (result != kCVReturnSuccess || !buffer) { NSLog(@"Could not create frame"); return 1; }
            CVPixelBufferLockBaseAddress(buffer, 0);
            CGContextRef context = CGBitmapContextCreate(
                CVPixelBufferGetBaseAddress(buffer), 720, 1280, 8,
                CVPixelBufferGetBytesPerRow(buffer), CGColorSpaceCreateDeviceRGB(),
                kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little
            );
            CGFloat progress = (CGFloat)frame / (CGFloat)(frames - 1);
            CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
            NSArray *colors = @[
                (__bridge id)Color(0.025, 0.04, 0.12, 1),
                (__bridge id)Color(0.09, 0.18, 0.42, 1),
                (__bridge id)Color(0.72, 0.04, 0.12, 1),
            ];
            CGFloat locations[] = {0, 0.58, 1};
            CGGradientRef gradient = CGGradientCreateWithColors(colorSpace, (__bridge CFArrayRef)colors, locations);
            CGContextDrawLinearGradient(context, gradient, CGPointMake(0, 1280), CGPointMake(720, 0), 0);
            CGGradientRelease(gradient);
            CGColorSpaceRelease(colorSpace);
            DrawWeb(context, CGPointMake(158, 922), frame * 4.0);
            FillColor(context, 0.01, 0.02, 0.06, 0.78);
            for (int index = 0; index < 12; index++) {
                CGFloat buildingWidth = 62;
                CGFloat buildingHeight = 150 + (index * 83) % 290;
                CGContextFillRect(context, CGRectMake(index * buildingWidth, 0, buildingWidth - 3, buildingHeight));
            }
            DrawHero(context, progress);
            int beat = MIN(3, (int)(progress * 4));
            NSArray<NSString *> *headlines = @[@"SPIDER-MAN", @"SPIDER-SENSE", @"SWING INTO", @"FOLLOW FOR MORE"];
            NSArray<NSString *> *subheads = @[@"REEL DEMO", @"ACTIVATED", @"THE ACTION", @"@SOCIALFLOWDEMO"];
            CGColorRef white = Color(1, 1, 1, 1);
            CGColorRef yellow = Color(1, 0.78, 0.12, 1);
            CGColorRef pale = Color(1, 1, 1, 0.72);
            DrawCenteredText(context, headlines[beat], 1110, 66, white);
            DrawCenteredText(context, subheads[beat], 1048, 34, yellow);
            DrawCenteredText(context, @"FAN-MADE DEMO • NOT AFFILIATED", 35, 18, pale);
            CGColorRelease(white); CGColorRelease(yellow); CGColorRelease(pale);
            CGContextRelease(context);
            CVPixelBufferUnlockBaseAddress(buffer, 0);
            if (![adaptor appendPixelBuffer:buffer withPresentationTime:CMTimeMake(frame, fps)]) {
                NSLog(@"%@", writer.error); CVPixelBufferRelease(buffer); return 1;
            }
            CVPixelBufferRelease(buffer);
        }
        [input markAsFinished];
        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        [writer finishWritingWithCompletionHandler:^{ dispatch_semaphore_signal(semaphore); }];
        dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
        if (writer.status != AVAssetWriterStatusCompleted) { NSLog(@"%@", writer.error); return 1; }
        printf("%s\n", path.UTF8String);
    }
    return 0;
}
