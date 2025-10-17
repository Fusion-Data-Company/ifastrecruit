#!/bin/bash

# Test runner script for the enterprise collaboration platform

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Running Enterprise Platform Test Suite${NC}"
echo "=========================================="

# Function to run tests with proper error handling
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "\n${YELLOW}Running ${test_name}...${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ ${test_name} passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
        return 1
    fi
}

# Track test results
FAILED_TESTS=0

# Unit Tests
if [ "$1" == "unit" ] || [ -z "$1" ]; then
    run_test "Unit Tests" "npx jest --config jest.config.js --testPathPattern=__tests__ --coverage"
    FAILED_TESTS=$((FAILED_TESTS + $?))
fi

# Integration Tests
if [ "$1" == "integration" ] || [ -z "$1" ]; then
    run_test "Integration Tests" "npx jest --config jest.config.js --testPathPattern=integration --runInBand"
    FAILED_TESTS=$((FAILED_TESTS + $?))
fi

# E2E Tests
if [ "$1" == "e2e" ] || [ -z "$1" ]; then
    run_test "E2E Tests" "npx playwright test"
    FAILED_TESTS=$((FAILED_TESTS + $?))
fi

# Coverage Report
if [ "$1" == "coverage" ]; then
    echo -e "\n${YELLOW}Generating Coverage Report...${NC}"
    npx jest --coverage --coverageReporters=text --coverageReporters=html
    echo -e "${GREEN}Coverage report generated in coverage/ directory${NC}"
fi

# Summary
echo -e "\n=========================================="
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ ${FAILED_TESTS} test suite(s) failed${NC}"
    exit 1
fi