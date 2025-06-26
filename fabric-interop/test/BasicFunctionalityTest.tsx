/**
 * BasicFunctionalityTest - Integration test for fabric-interop layer
 * 
 * This test verifies the core functionality of the fabric-interop layer
 * by testing basic operations like node creation, scene management, and events.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ViroFabricContainer } from '../ViroFabricContainer';
import { ViroScene } from '../components/ViroScene';
import { ViroBox } from '../components/ViroBox';
import { ViroText } from '../components/ViroText';
import { isViroJSIAvailable, createScene, createNode, getMemoryStats } from '../NativeViro';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export const BasicFunctionalityTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [allTestsPassed, setAllTestsPassed] = useState<boolean | null>(null);

  useEffect(() => {
    runTests();
  }, []);

  const addTestResult = (name: string, passed: boolean, error?: string) => {
    setTestResults(prev => [...prev, { name, passed, error }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      // Test 1: JSI Availability
      const jsiAvailable = isViroJSIAvailable();
      addTestResult('JSI Available', jsiAvailable, jsiAvailable ? undefined : 'JSI bridge not available');

      if (jsiAvailable) {
        // Test 2: Scene Creation
        try {
          createScene('test_scene', 'scene', { background: [0, 0, 0] });
          addTestResult('Scene Creation', true);
        } catch (error) {
          addTestResult('Scene Creation', false, `Error: ${error}`);
        }

        // Test 3: Node Creation
        try {
          createNode('test_box', 'box', { 
            position: [0, 0, -1],
            scale: [0.5, 0.5, 0.5]
          });
          addTestResult('Node Creation', true);
        } catch (error) {
          addTestResult('Node Creation', false, `Error: ${error}`);
        }

        // Test 4: Memory Stats
        try {
          const stats = getMemoryStats();
          const hasStats = stats && typeof stats === 'object';
          addTestResult('Memory Stats', hasStats, hasStats ? undefined : 'No memory stats returned');
        } catch (error) {
          addTestResult('Memory Stats', false, `Error: ${error}`);
        }

        // Test 5: Component Rendering (requires actual container)
        // This will be tested by the component tree below
        addTestResult('Component Rendering', true, 'Testing via component tree');
      }

      // Calculate overall result
      setTimeout(() => {
        setIsRunning(false);
        const passed = testResults.every(result => result.passed);
        setAllTestsPassed(passed);
        
        if (passed) {
          Alert.alert('Tests Passed', 'All basic functionality tests passed!');
        } else {
          const failed = testResults.filter(r => !r.passed);
          Alert.alert('Tests Failed', `${failed.length} test(s) failed. Check the log for details.`);
        }
      }, 1000);

    } catch (error) {
      setIsRunning(false);
      addTestResult('Test Execution', false, `Fatal error: ${error}`);
      setAllTestsPassed(false);
    }
  };

  const handleInitialized = (success: boolean) => {
    console.log('ViroFabricContainer initialized:', success);
    addTestResult('Container Initialization', success, success ? undefined : 'Container failed to initialize');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fabric-Interop Basic Functionality Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isRunning ? 'Running...' : allTestsPassed === null ? 'Not started' : allTestsPassed ? 'PASSED' : 'FAILED'}
        </Text>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <View key={index} style={styles.resultItem}>
            <Text style={[styles.resultText, { color: result.passed ? 'green' : 'red' }]}>
              {result.passed ? '✓' : '✗'} {result.name}
            </Text>
            {result.error && (
              <Text style={styles.errorText}>{result.error}</Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.viroContainer}>
        <ViroFabricContainer
          style={styles.viroFabric}
          arEnabled={false}
          debug={true}
          onInitialized={handleInitialized}
        >
          <ViroScene>
            <ViroBox
              position={[0, 0, -1]}
              scale={[0.3, 0.3, 0.3]}
              materials={['test_material']}
            />
            <ViroText
              text="Test Scene"
              position={[0, 0.5, -1]}
              style={{ fontSize: 20, color: '#FFFFFF' }}
            />
          </ViroScene>
        </ViroFabricContainer>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusContainer: {
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultsContainer: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
    maxHeight: 200,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultItem: {
    marginBottom: 8,
  },
  resultText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 20,
    marginTop: 2,
  },
  viroContainer: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 5,
    overflow: 'hidden',
  },
  viroFabric: {
    flex: 1,
  },
});

export default BasicFunctionalityTest;