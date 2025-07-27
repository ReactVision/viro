cmake_minimum_required(VERSION 3.13.0)

set(CMAKE_VERBOSE_MAKEFILE on)

add_library(virofabricjsi
            SHARED
            fabric/ViroFabricContainerJSI.cpp)

# Configure C++17
set_target_properties(
        virofabricjsi PROPERTIES
        CXX_STANDARD 17
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)

# Find required packages
find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)

target_link_libraries(
        virofabricjsi
        fbjni::fbjni
        ReactAndroid::jsi
        ReactAndroid::reactnativejni
        android
        log
)

# Include directories
target_include_directories(virofabricjsi PRIVATE
        "${REACT_NATIVE_DIR}/ReactCommon"
        "${REACT_NATIVE_DIR}/ReactCommon/jsi"
        "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni"
        "${REACT_NATIVE_DIR}/ReactAndroid/src/main/jni/react/jni"
)
