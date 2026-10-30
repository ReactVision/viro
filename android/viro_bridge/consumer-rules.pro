# Rules applied to the app that consumes this library, so a minified release
# build does not strip or rename what native code and reflection look up by name.

# libviro_renderer, libviro_arcore and libreactvisioncca resolve these classes,
# fields and methods by name through JNI (FindClass/GetMethodID/RegisterNatives).
-keep class com.viro.** { *; }
-keep class com.reactvision.cca.** { *; }

# WorkManager instantiates the upload worker reflectively from its class name
# stored in the work database.
-keep class com.viromedia.bridge.module.VpsScanUploadWorker { <init>(...); }

# Fabric's view manager property cache finds setters through this annotation,
# and the module registry finds exported methods the same way.
-keepclassmembers class com.viromedia.bridge.** {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Native methods keep their names so JNI symbol lookup still matches.
-keepclasseswithmembernames,includedescriptorclasses class com.viromedia.bridge.** {
    native <methods>;
}
