const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

// Adds Android 16 KB page-size alignment support required for Android 15+ devices.
// AGP 8.3+ automatically aligns uncompressed .so files, but we need:
//   1. useLegacyPackaging = false  (ensures .so files are uncompressed in the AAB)
//   2. android.nativeLibraries.pageSizeAligned in gradle.properties  (AGP 8.3+ opt-in)
const withAndroid16kbPageSize = (config) => {
  // Step 1: Add gradle.properties entry (AGP 8.3+)
  config = withGradleProperties(config, (config) => {
    const hasAlready = config.modResults.some(
      (item) => item.type === 'property' && item.key === 'android.nativeLibraries.pageSizeAligned'
    );
    if (!hasAlready) {
      config.modResults.push({
        type: 'property',
        key: 'android.nativeLibraries.pageSizeAligned',
        value: 'true',
      });
    }
    return config;
  });

  // Step 2: Explicitly set useLegacyPackaging false in app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('useLegacyPackaging') || contents.includes('pageSize')) {
      return config;
    }
    // Insert packaging block immediately after "android {" opener
    config.modResults.contents = contents.replace(
      /^(android\s*\{)/m,
      `$1\n    packaging {\n        jniLibs {\n            useLegacyPackaging false\n        }\n    }`
    );
    return config;
  });

  return config;
};

module.exports = withAndroid16kbPageSize;
