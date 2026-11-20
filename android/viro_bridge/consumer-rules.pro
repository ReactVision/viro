# Rules applied to the app that consumes this library, so a minified release
# build does not strip or rename what native code and reflection look up by name.

# libviro_renderer, libviro_arcore and libreactvisioncca resolve these classes,
# fields and methods by name through JNI (FindClass/GetMethodID/RegisterNatives).
-keep class com.viro.** { *; }
-keep class com.reactvision.cca.** { *; }

# WorkManager instantiates the upload worker reflectively from its class name
# stored in the work database.
-keep class com.viromedia.bridge.module.VpsScanUploadWorker { <init>(...); }

# Room creates WorkManager's database (WorkDatabase_Impl) through its no-argument
# constructor by reflection. work-runtime 2.9.1 resolves Room 2.5.0, whose own
# rule keeps the class but not the constructor, so R8 full mode removes it and
# the app crashes at launch in androidx.startup. Room 2.6 ships this same rule.
-keep class * extends androidx.room.RoomDatabase { <init>(); }

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

# The bundled GVR SDK (sdk-common) carries VR logging protos whose generated
# code references protobuf and logging classes the SDK does not ship. They are
# missing with or without R8, so this changes nothing at runtime; without it,
# R8 stops the release build on the missing classes.
-dontwarn com.google.common.logging.Vr$**
-dontwarn com.google.protobuf.CodedOutputStream
-dontwarn com.google.protobuf.GeneratedMessageLite
-dontwarn com.google.protobuf.MessageLite
-dontwarn com.google.protobuf.Parser
-dontwarn com.google.protobuf.nano.NanoEnumValue
-dontwarn logs.proto.wireless.performance.mobile.MemoryMetric$**

# GVR's native library (libgvr.so) looks classes up by name: VrParamsProviderJni,
# GvrApi$PoseTracker, ExternalSurfaceManager and others. Only the ones marked
# @UsedByNative are kept by GVR's own rules, so R8 could remove the rest from a
# minified VR build. Kept whole; the cost is that GVR is not shrunk.
-keep class com.google.vr.** { *; }
