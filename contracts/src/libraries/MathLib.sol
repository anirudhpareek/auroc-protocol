// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MathLib
/// @notice Fixed-point math utilities for WAD (1e18) precision
library MathLib {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant HALF_WAD = 5e17;
    int256 internal constant WAD_INT = 1e18;

    // ============================================
    // BASIC OPERATIONS
    // ============================================

    /// @notice Multiply two WAD values
    function mulWad(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b + HALF_WAD) / WAD;
    }

    /// @notice Multiply signed WAD values
    function mulWadInt(int256 a, int256 b) internal pure returns (int256) {
        return (a * b + (a * b >= 0 ? int256(HALF_WAD) : -int256(HALF_WAD))) / WAD_INT;
    }

    /// @notice Divide two WAD values
    function divWad(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "DIV_ZERO");
        return (a * WAD + b / 2) / b;
    }

    /// @notice Divide signed WAD values
    function divWadInt(int256 a, int256 b) internal pure returns (int256) {
        require(b != 0, "DIV_ZERO");
        return (a * WAD_INT + (a * b >= 0 ? b / 2 : -b / 2)) / b;
    }

    // ============================================
    // CLAMPING
    // ============================================

    /// @notice Clamp value between min and max
    function clamp(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    /// @notice Clamp signed value
    function clampInt(int256 value, int256 min, int256 max) internal pure returns (int256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    // ============================================
    // EXPONENTIALS (APPROXIMATIONS)
    // ============================================

    /// @notice Approximate e^(-x) for x in WAD, returns WAD
    /// @dev Uses Taylor series: 1 - x + x^2/2 - x^3/6 + x^4/24
    /// @dev Accurate for x < 2e18
    function expNeg(uint256 x) internal pure returns (uint256) {
        if (x == 0) return WAD;
        if (x >= 10 * WAD) return 0; // Very small result

        // Taylor series approximation
        uint256 x2 = mulWad(x, x);
        uint256 x3 = mulWad(x2, x);
        uint256 x4 = mulWad(x3, x);

        // 1 - x + x^2/2 - x^3/6 + x^4/24
        uint256 result = WAD;
        result = result > x ? result - x : 0;
        result = result + x2 / 2;
        result = result > x3 / 6 ? result - x3 / 6 : 0;
        result = result + x4 / 24;

        return result > WAD ? WAD : result;
    }

    /// @notice Natural log approximation for x in WAD
    /// @dev Uses ln(x) = 2 * sum((y^(2n+1))/(2n+1)) where y = (x-1)/(x+1)
    /// @dev Accurate for 0.5e18 < x < 2e18
    function ln(uint256 x) internal pure returns (int256) {
        require(x > 0, "LN_ZERO");

        // Normalize to range [0.5, 2]
        int256 exponent = 0;
        while (x < HALF_WAD) {
            x = x * 2;
            exponent -= WAD_INT;
        }
        while (x > 2 * WAD) {
            x = x / 2;
            exponent += WAD_INT;
        }

        // y = (x - 1) / (x + 1)
        int256 y = divWadInt(int256(x) - WAD_INT, int256(x) + WAD_INT);
        int256 y2 = mulWadInt(y, y);

        // Sum: 2 * (y + y^3/3 + y^5/5 + y^7/7)
        int256 y3 = mulWadInt(y2, y);
        int256 y5 = mulWadInt(y3, y2);
        int256 y7 = mulWadInt(y5, y2);

        int256 sum = y + y3 / 3 + y5 / 5 + y7 / 7;
        int256 result = 2 * sum;

        // Add back the exponent * ln(2)
        // ln(2) ~= 0.693147e18
        int256 ln2 = 693147180559945309;
        result = result + mulWadInt(exponent, ln2);

        return result;
    }

    /// @notice Exponential function for signed input
    /// @dev e^x for x in WAD
    function exp(int256 x) internal pure returns (uint256) {
        if (x < 0) {
            return expNeg(uint256(-x));
        }
        if (x == 0) return WAD;
        if (x > 130 * WAD_INT) return type(uint256).max; // Overflow protection

        // For positive x, use: e^x = e^(floor(x)) * e^(frac(x))
        // Approximate with Taylor series for small values
        uint256 ux = uint256(x);
        if (ux < WAD) {
            // Taylor series for small x
            uint256 x2 = mulWad(ux, ux);
            uint256 x3 = mulWad(x2, ux);
            return WAD + ux + x2 / 2 + x3 / 6;
        }

        // For larger x, use iterative squaring
        uint256 result = WAD;
        uint256 base = 2718281828459045235; // e in WAD

        while (ux >= WAD) {
            result = mulWad(result, base);
            ux -= WAD;
        }

        // Handle fractional part
        if (ux > 0) {
            uint256 frac = WAD + ux + mulWad(ux, ux) / 2;
            result = mulWad(result, frac);
        }

        return result;
    }

    // ============================================
    // STATISTICS
    // ============================================

    /// @notice Calculate median of an array (modifies array order)
    /// @param values Array of values (will be partially sorted)
    /// @return Median value
    function median(uint256[] memory values) internal pure returns (uint256) {
        require(values.length > 0, "EMPTY_ARRAY");
        if (values.length == 1) return values[0];

        // Partial quickselect for median
        uint256 mid = values.length / 2;
        quickSelect(values, 0, values.length - 1, mid);

        if (values.length % 2 == 1) {
            return values[mid];
        } else {
            // For even length, average of two middle values
            quickSelect(values, 0, values.length - 1, mid - 1);
            return (values[mid - 1] + values[mid]) / 2;
        }
    }

    /// @notice Calculate median of signed array
    function medianInt(int256[] memory values) internal pure returns (int256) {
        require(values.length > 0, "EMPTY_ARRAY");
        if (values.length == 1) return values[0];

        uint256 mid = values.length / 2;
        quickSelectInt(values, 0, values.length - 1, mid);

        if (values.length % 2 == 1) {
            return values[mid];
        } else {
            quickSelectInt(values, 0, values.length - 1, mid - 1);
            return (values[mid - 1] + values[mid]) / 2;
        }
    }

    /// @notice Quickselect algorithm for k-th smallest element
    function quickSelect(
        uint256[] memory arr,
        uint256 left,
        uint256 right,
        uint256 k
    ) internal pure {
        while (left < right) {
            uint256 pivotIndex = partition(arr, left, right);
            if (pivotIndex == k) {
                return;
            } else if (pivotIndex > k) {
                right = pivotIndex - 1;
            } else {
                left = pivotIndex + 1;
            }
        }
    }

    function partition(uint256[] memory arr, uint256 left, uint256 right) internal pure returns (uint256) {
        uint256 pivot = arr[right];
        uint256 i = left;
        for (uint256 j = left; j < right; j++) {
            if (arr[j] <= pivot) {
                (arr[i], arr[j]) = (arr[j], arr[i]);
                i++;
            }
        }
        (arr[i], arr[right]) = (arr[right], arr[i]);
        return i;
    }

    function quickSelectInt(
        int256[] memory arr,
        uint256 left,
        uint256 right,
        uint256 k
    ) internal pure {
        while (left < right) {
            uint256 pivotIndex = partitionInt(arr, left, right);
            if (pivotIndex == k) {
                return;
            } else if (pivotIndex > k) {
                right = pivotIndex - 1;
            } else {
                left = pivotIndex + 1;
            }
        }
    }

    function partitionInt(int256[] memory arr, uint256 left, uint256 right) internal pure returns (uint256) {
        int256 pivot = arr[right];
        uint256 i = left;
        for (uint256 j = left; j < right; j++) {
            if (arr[j] <= pivot) {
                (arr[i], arr[j]) = (arr[j], arr[i]);
                i++;
            }
        }
        (arr[i], arr[right]) = (arr[right], arr[i]);
        return i;
    }

    // ============================================
    // UTILITIES
    // ============================================

    /// @notice Absolute value
    function abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    /// @notice Sign of value (-1, 0, or 1)
    function sign(int256 x) internal pure returns (int256) {
        if (x > 0) return 1;
        if (x < 0) return -1;
        return 0;
    }

    /// @notice Min of two values
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    /// @notice Max of two values
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a : b;
    }

    /// @notice Min of two signed values
    function minInt(int256 a, int256 b) internal pure returns (int256) {
        return a < b ? a : b;
    }

    /// @notice Max of two signed values
    function maxInt(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }
}
