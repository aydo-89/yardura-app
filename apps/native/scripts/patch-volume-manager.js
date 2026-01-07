const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-volume-manager',
  'android',
  'src',
  'main',
  'java',
  'com',
  'reactnativevolumemanager',
  'VolumeManagerModule.java',
);

if (!fs.existsSync(targetPath)) {
  console.log('[patch-volume-manager] VolumeManagerModule.java not found. Skipping.');
  process.exit(0);
}

const original = fs.readFileSync(targetPath, 'utf8');
const hasNativeShutter = original.includes('native-shutter');
const hasShutterFlag = original.includes('isShutterEnabled');
const hasUiToggle = original.includes('shutterEnabled = !showNativeVolumeUI');
const hasEnableToggle = original.includes('shutterEnabled = enabled');
const hasActivityGuard = original.includes('currentActivity == null');

if (hasNativeShutter && hasShutterFlag && hasUiToggle && hasEnableToggle && hasActivityGuard && original.includes('emitVolumeKeyEvent')) {
  console.log('[patch-volume-manager] Patch already applied.');
  process.exit(0);
}

const flagSnippet = `  private static volatile boolean shutterEnabled = false;\n\n` +
  `  public static boolean isShutterEnabled() {\n` +
  `    return shutterEnabled;\n` +
  `  }\n\n`;

const helperMethod = `  private void emitVolumeKeyEvent(String direction) {\n` +
  `    WritableMap payload = Arguments.createMap();\n` +
  `    payload.putString("direction", direction);\n` +
  `    try {\n` +
  `      mContext\n` +
  `        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)\n` +
  `        .emit("native-shutter", payload);\n` +
  `    } catch (RuntimeException e) {\n` +
  `      // Ignore events before the JS bridge is ready.\n` +
  `    }\n` +
  `  }\n\n`;

let updated = original;

if (!updated.includes('emitVolumeKeyEvent')) {
  updated = updated.replace(
    '  private void setupKeyListener() {',
    flagSnippet + helperMethod + '  private void setupKeyListener() {',
  );
}

if (!updated.includes('isShutterEnabled') && updated.includes('emitVolumeKeyEvent')) {
  updated = updated.replace(
    '  private void emitVolumeKeyEvent(String direction) {',
    flagSnippet + '  private void emitVolumeKeyEvent(String direction) {',
  );
}

if (!updated.includes('isShutterEnabled')) {
  console.warn('[patch-volume-manager] Unable to add shutterEnabled flag.');
}

if (!updated.includes('shutterEnabled = !showNativeVolumeUI')) {
  updated = updated.replace(
    '    showNativeVolumeUI = config.getBoolean("enabled");',
    '    showNativeVolumeUI = config.getBoolean("enabled");\n    shutterEnabled = !showNativeVolumeUI;',
  );
}

const enableRegex = /@ReactMethod\s+public void enable\(final Boolean enabled\)\s*\{[\s\S]*?\}/;
if (!updated.includes('shutterEnabled = enabled') && enableRegex.test(updated)) {
  updated = updated.replace(
    enableRegex,
    '  @ReactMethod\n  public void enable(final Boolean enabled) {\n    shutterEnabled = enabled != null && enabled;\n  }',
  );
} else if (!updated.includes('shutterEnabled = enabled')) {
  console.warn('[patch-volume-manager] Unable to patch enable() for shutterEnabled.');
}

const listenerRegex =
  /rootView\.setOnKeyListener\(\(v, keyCode, event\) -> \{[\s\S]*?\}\);/;
const listenerReplacement =
  `rootView.setOnKeyListener((v, keyCode, event) -> {\n` +
  `        hardwareButtonListenerRegistered = true;\n` +
  `        if (showNativeVolumeUI) return false;\n` +
  `\n` +
  `        if (event.getAction() != KeyEvent.ACTION_DOWN) {\n` +
  `          return true;\n` +
  `        }\n` +
  `\n` +
  `        switch (event.getKeyCode()) {\n` +
  `          case KeyEvent.KEYCODE_VOLUME_UP:\n` +
  `            emitVolumeKeyEvent("up");\n` +
  `            return true;\n` +
  `          case KeyEvent.KEYCODE_VOLUME_DOWN:\n` +
  `            emitVolumeKeyEvent("down");\n` +
  `            return true;\n` +
  `          default:\n` +
  `            return false;\n` +
  `        }\n` +
  `      });`;

if (!listenerRegex.test(updated)) {
  console.warn('[patch-volume-manager] Could not find key listener block to replace.');
  process.exit(1);
}

updated = updated.replace(listenerRegex, listenerReplacement);

if (!updated.includes('currentActivity == null') && updated.includes('getCurrentActivity().getWindow().getDecorView()')) {
  updated = updated.replace(
    '      View rootView =\n        ((ViewGroup) mContext.getCurrentActivity().getWindow().getDecorView());',
    '      Activity currentActivity = mContext.getCurrentActivity();\n' +
      '      if (currentActivity == null) {\n' +
      '        return;\n' +
      '      }\n' +
      '      View rootView =\n' +
      '        ((ViewGroup) currentActivity.getWindow().getDecorView());',
  );
}

fs.writeFileSync(targetPath, updated, 'utf8');
console.log('[patch-volume-manager] Patch applied.');
