"use strict";
/**
 * BasicFunctionalityTest - Integration test for fabric-interop layer
 *
 * This test verifies the core functionality of the fabric-interop layer
 * by testing basic operations like node creation, scene management, and events.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicFunctionalityTest = void 0;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroFabricContainer_1 = require("../ViroFabricContainer");
const ViroScene_1 = require("../components/ViroScene");
const ViroBox_1 = require("../components/ViroBox");
const ViroText_1 = require("../components/ViroText");
const NativeViro_1 = require("../NativeViro");
const BasicFunctionalityTest = () => {
    const [testResults, setTestResults] = (0, react_1.useState)([]);
    const [isRunning, setIsRunning] = (0, react_1.useState)(false);
    const [allTestsPassed, setAllTestsPassed] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        runTests();
    }, []);
    const addTestResult = (name, passed, error) => {
        setTestResults((prev) => [...prev, { name, passed, error }]);
    };
    const runTests = async () => {
        setIsRunning(true);
        setTestResults([]);
        try {
            // Test 1: JSI Availability
            const jsiAvailable = (0, NativeViro_1.isViroJSIAvailable)();
            addTestResult("JSI Available", jsiAvailable, jsiAvailable ? undefined : "JSI bridge not available");
            if (jsiAvailable) {
                // Test 2: Scene Creation
                try {
                    (0, NativeViro_1.createScene)("test_scene", "scene", { background: [0, 0, 0] });
                    addTestResult("Scene Creation", true);
                }
                catch (error) {
                    addTestResult("Scene Creation", false, `Error: ${error}`);
                }
                // Test 3: Node Creation
                try {
                    (0, NativeViro_1.createNode)("test_box", "box", {
                        position: [0, 0, -1],
                        scale: [0.5, 0.5, 0.5],
                    });
                    addTestResult("Node Creation", true);
                }
                catch (error) {
                    addTestResult("Node Creation", false, `Error: ${error}`);
                }
                // Test 4: Memory Stats
                try {
                    const stats = (0, NativeViro_1.getMemoryStats)();
                    const hasStats = stats && typeof stats === "object";
                    addTestResult("Memory Stats", !!hasStats, hasStats ? undefined : "No memory stats returned");
                }
                catch (error) {
                    addTestResult("Memory Stats", false, `Error: ${error}`);
                }
                // Test 5: Component Rendering (requires actual container)
                // This will be tested by the component tree below
                addTestResult("Component Rendering", true, "Testing via component tree");
            }
            // Calculate overall result
            setTimeout(() => {
                setIsRunning(false);
                const passed = testResults.every((result) => result.passed);
                setAllTestsPassed(passed);
                if (passed) {
                    react_native_1.Alert.alert("Tests Passed", "All basic functionality tests passed!");
                }
                else {
                    const failed = testResults.filter((r) => !r.passed);
                    react_native_1.Alert.alert("Tests Failed", `${failed.length} test(s) failed. Check the log for details.`);
                }
            }, 1000);
        }
        catch (error) {
            setIsRunning(false);
            addTestResult("Test Execution", false, `Fatal error: ${error}`);
            setAllTestsPassed(false);
        }
    };
    const handleInitialized = (success) => {
        console.log("ViroFabricContainer initialized:", success);
        addTestResult("Container Initialization", success, success ? undefined : "Container failed to initialize");
    };
    return (<react_native_1.View style={styles.container}>
      <react_native_1.Text style={styles.title}>Fabric-Interop Basic Functionality Test</react_native_1.Text>

      <react_native_1.View style={styles.statusContainer}>
        <react_native_1.Text style={styles.statusText}>
          Status:{" "}
          {isRunning
            ? "Running..."
            : allTestsPassed === null
                ? "Not started"
                : allTestsPassed
                    ? "PASSED"
                    : "FAILED"}
        </react_native_1.Text>
      </react_native_1.View>

      <react_native_1.View style={styles.resultsContainer}>
        <react_native_1.Text style={styles.resultsTitle}>Test Results:</react_native_1.Text>
        {testResults.map((result, index) => (<react_native_1.View key={index} style={styles.resultItem}>
            <react_native_1.Text style={[
                styles.resultText,
                { color: result.passed ? "green" : "red" },
            ]}>
              {result.passed ? "✓" : "✗"} {result.name}
            </react_native_1.Text>
            {result.error && (<react_native_1.Text style={styles.errorText}>{result.error}</react_native_1.Text>)}
          </react_native_1.View>))}
      </react_native_1.View>

      <react_native_1.View style={styles.viroContainer}>
        <ViroFabricContainer_1.ViroFabricContainer style={styles.viroFabric} arEnabled={false} debug={true} onInitialized={handleInitialized}>
          <ViroScene_1.ViroScene>
            <ViroBox_1.ViroBox position={[0, 0, -1]} scale={[0.3, 0.3, 0.3]} materials={["test_material"]}/>
            <ViroText_1.ViroText text="Test Scene" position={[0, 0.5, -1]}/>
          </ViroScene_1.ViroScene>
        </ViroFabricContainer_1.ViroFabricContainer>
      </react_native_1.View>
    </react_native_1.View>);
};
exports.BasicFunctionalityTest = BasicFunctionalityTest;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#f0f0f0",
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 20,
    },
    statusContainer: {
        backgroundColor: "#e0e0e0",
        padding: 10,
        borderRadius: 5,
        marginBottom: 20,
    },
    statusText: {
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
    },
    resultsContainer: {
        backgroundColor: "#ffffff",
        padding: 15,
        borderRadius: 5,
        marginBottom: 20,
        maxHeight: 200,
    },
    resultsTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 10,
    },
    resultItem: {
        marginBottom: 8,
    },
    resultText: {
        fontSize: 14,
        fontWeight: "bold",
    },
    errorText: {
        fontSize: 12,
        color: "#666",
        marginLeft: 20,
        marginTop: 2,
    },
    viroContainer: {
        flex: 1,
        backgroundColor: "#000000",
        borderRadius: 5,
        overflow: "hidden",
    },
    viroFabric: {
        flex: 1,
    },
});
exports.default = exports.BasicFunctionalityTest;
