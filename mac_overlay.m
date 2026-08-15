#import <Cocoa/Cocoa.h>

void mac_make_accessory() {
    // Calling this early prevents macOS from switching spaces when the app launches!
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
}

void mac_force_overlay(long win_id) {
    NSView *view = (NSView *)win_id;
    NSWindow *window = view.window;
    
    if (window) {
        window.level = NSScreenSaverWindowLevel; 
        
        NSWindowCollectionBehavior behavior = window.collectionBehavior;
        behavior &= ~NSWindowCollectionBehaviorMoveToActiveSpace;
        behavior |= NSWindowCollectionBehaviorCanJoinAllSpaces;
        behavior |= NSWindowCollectionBehaviorFullScreenAuxiliary;
        behavior |= NSWindowCollectionBehaviorStationary;
        
        window.collectionBehavior = behavior;
    }
}
