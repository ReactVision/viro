//
//  VROSemantics.h
//  ViroRenderer
//
//  Copyright © 2024 Viro Media. All rights reserved.
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

#ifndef VROSemantics_h
#define VROSemantics_h

#include <string>
#include <map>
#include <vector>
#include <cstdint>

/*
 * Semantic labels for scene understanding.
 * These labels classify pixels in outdoor scenes into semantic categories.
 * Values match ARCore's ArSemanticLabel enum for compatibility.
 *
 * Reliability tiers:
 * - High: sky, building, tree, road, vehicle
 * - Medium: sidewalk, terrain, structure, water
 * - Low: object, person
 */
enum class VROSemanticLabel {
    Unlabeled = 0,   // Pixel could not be classified
    Sky = 1,         // Sky regions
    Building = 2,    // Building structures
    Tree = 3,        // Trees and large vegetation
    Road = 4,        // Road surfaces
    Sidewalk = 5,    // Pedestrian sidewalks
    Terrain = 6,     // Natural terrain/ground
    Structure = 7,   // General man-made structures
    Object = 8,      // Generic objects
    Vehicle = 9,     // Vehicles (cars, trucks, etc.)
    Person = 10,     // Human figures
    Water = 11       // Water bodies
};

// Total number of semantic labels
static const int VRO_SEMANTIC_LABEL_COUNT = 12;

/*
 * Semantic mode for AR session configuration.
 */
enum class VROSemanticMode {
    Disabled,  // Scene semantics is disabled
    Enabled    // Scene semantics is enabled (requires supported device)
};

/*
 * Mask mode for semantic material masking.
 * Controls whether fragments are shown or hidden based on label match.
 */
enum class VROSemanticMaskMode {
    ShowOnly    = 0,  // Only render fragments where the label matches
    Hide        = 1,  // Hide fragments where the label matches
    Debug       = 2,  // Color fragments by semantic label for debugging
    ShowOnlySky = 3   // ShowOnly + unlabeled pixels use viewport Y to decide:
                      // upper half → show sphere (sky context),
                      // lower half → hide sphere (ground/foreground context).
                      // Use this for Viro360Image skyEffect only.
};

/*
 * Semantic image data containing label IDs for each pixel.
 * The image is a single-channel buffer where each byte represents
 * a VROSemanticLabel value (0-11).
 */
struct VROSemanticImage {
    int width;
    int height;
    std::vector<uint8_t> data;  // Each byte is a VROSemanticLabel value (0-11)

    VROSemanticImage() : width(0), height(0) {}
    VROSemanticImage(int w, int h) : width(w), height(h), data(w * h, 0) {}

    bool isValid() const {
        return width > 0 && height > 0 && !data.empty();
    }

    size_t getPixelCount() const {
        return static_cast<size_t>(width) * static_cast<size_t>(height);
    }

    VROSemanticLabel getLabelAt(int x, int y) const {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return VROSemanticLabel::Unlabeled;
        }
        int index = y * width + x;
        if (index >= 0 && index < static_cast<int>(data.size())) {
            return static_cast<VROSemanticLabel>(data[index]);
        }
        return VROSemanticLabel::Unlabeled;
    }
};

/*
 * Semantic confidence image with per-pixel confidence values.
 * Higher values indicate higher confidence in the semantic label.
 */
struct VROSemanticConfidenceImage {
    int width;
    int height;
    std::vector<uint8_t> data;  // Each byte is confidence 0-255

    VROSemanticConfidenceImage() : width(0), height(0) {}
    VROSemanticConfidenceImage(int w, int h) : width(w), height(h), data(w * h, 0) {}

    bool isValid() const {
        return width > 0 && height > 0 && !data.empty();
    }

    // Get confidence as normalized float (0.0 - 1.0)
    float getConfidenceAt(int x, int y) const {
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return 0.0f;
        }
        int index = y * width + x;
        if (index >= 0 && index < static_cast<int>(data.size())) {
            return static_cast<float>(data[index]) / 255.0f;
        }
        return 0.0f;
    }
};

/*
 * Map of semantic labels to their fraction (0.0-1.0) in the current frame.
 * The fraction represents the percentage of pixels classified with each label.
 */
using VROSemanticFractions = std::map<VROSemanticLabel, float>;

/*
 * Delegate for receiving semantic updates each frame.
 */
class VROSemanticsDelegate {
public:
    virtual ~VROSemanticsDelegate() {}

    /*
     * Called each frame with updated semantic fractions.
     * Fractions represent the percentage of pixels with each label.
     * Only called when semantic mode is enabled and data is available.
     */
    virtual void onSemanticFractionsUpdated(const VROSemanticFractions &fractions) = 0;
};

/*
 * Helper functions for enum conversion and debugging.
 */
inline std::string VROSemanticLabelToString(VROSemanticLabel label) {
    switch (label) {
        case VROSemanticLabel::Unlabeled: return "UNLABELED";
        case VROSemanticLabel::Sky: return "SKY";
        case VROSemanticLabel::Building: return "BUILDING";
        case VROSemanticLabel::Tree: return "TREE";
        case VROSemanticLabel::Road: return "ROAD";
        case VROSemanticLabel::Sidewalk: return "SIDEWALK";
        case VROSemanticLabel::Terrain: return "TERRAIN";
        case VROSemanticLabel::Structure: return "STRUCTURE";
        case VROSemanticLabel::Object: return "OBJECT";
        case VROSemanticLabel::Vehicle: return "VEHICLE";
        case VROSemanticLabel::Person: return "PERSON";
        case VROSemanticLabel::Water: return "WATER";
    }
    return "UNKNOWN";
}

inline std::string VROSemanticLabelToLowerString(VROSemanticLabel label) {
    switch (label) {
        case VROSemanticLabel::Unlabeled: return "unlabeled";
        case VROSemanticLabel::Sky: return "sky";
        case VROSemanticLabel::Building: return "building";
        case VROSemanticLabel::Tree: return "tree";
        case VROSemanticLabel::Road: return "road";
        case VROSemanticLabel::Sidewalk: return "sidewalk";
        case VROSemanticLabel::Terrain: return "terrain";
        case VROSemanticLabel::Structure: return "structure";
        case VROSemanticLabel::Object: return "object";
        case VROSemanticLabel::Vehicle: return "vehicle";
        case VROSemanticLabel::Person: return "person";
        case VROSemanticLabel::Water: return "water";
    }
    return "unknown";
}

inline VROSemanticLabel VROSemanticLabelFromInt(int value) {
    if (value >= 0 && value < VRO_SEMANTIC_LABEL_COUNT) {
        return static_cast<VROSemanticLabel>(value);
    }
    return VROSemanticLabel::Unlabeled;
}

inline VROSemanticLabel VROSemanticLabelFromString(const std::string &str) {
    if (str == "unlabeled" || str == "UNLABELED") return VROSemanticLabel::Unlabeled;
    if (str == "sky" || str == "SKY") return VROSemanticLabel::Sky;
    if (str == "building" || str == "BUILDING") return VROSemanticLabel::Building;
    if (str == "tree" || str == "TREE") return VROSemanticLabel::Tree;
    if (str == "road" || str == "ROAD") return VROSemanticLabel::Road;
    if (str == "sidewalk" || str == "SIDEWALK") return VROSemanticLabel::Sidewalk;
    if (str == "terrain" || str == "TERRAIN") return VROSemanticLabel::Terrain;
    if (str == "structure" || str == "STRUCTURE") return VROSemanticLabel::Structure;
    if (str == "object" || str == "OBJECT") return VROSemanticLabel::Object;
    if (str == "vehicle" || str == "VEHICLE") return VROSemanticLabel::Vehicle;
    if (str == "person" || str == "PERSON") return VROSemanticLabel::Person;
    if (str == "water" || str == "WATER") return VROSemanticLabel::Water;
    return VROSemanticLabel::Unlabeled;
}

inline std::string VROSemanticModeToString(VROSemanticMode mode) {
    switch (mode) {
        case VROSemanticMode::Disabled: return "DISABLED";
        case VROSemanticMode::Enabled: return "ENABLED";
    }
    return "UNKNOWN";
}

#endif /* VROSemantics_h */
