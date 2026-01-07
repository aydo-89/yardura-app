const { withMainActivity } = require('@expo/config-plugins');

const KOTLIN_IMPORTS = [
  'import android.view.KeyEvent',
  'import com.facebook.react.bridge.Arguments',
  'import com.facebook.react.modules.core.DeviceEventManagerModule',
  'import com.reactnativevolumemanager.VolumeManagerModule',
];

const JAVA_IMPORTS = [
  'import android.view.KeyEvent;',
  'import com.facebook.react.bridge.Arguments;',
  'import com.facebook.react.bridge.ReactContext;',
  'import com.facebook.react.bridge.WritableMap;',
  'import com.facebook.react.modules.core.DeviceEventManagerModule;',
  'import com.reactnativevolumemanager.VolumeManagerModule;',
];

const KOTLIN_METHOD = `
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      if (VolumeManagerModule.isShutterEnabled()) {
        val reactContext = reactInstanceManager.currentReactContext
        if (reactContext != null) {
          val payload = Arguments.createMap()
          payload.putString("direction", "up")
          reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("native-shutter", payload)
        }
        return true
      }
    }
    return super.onKeyDown(keyCode, event)
  }
`;

const JAVA_METHOD = `
  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      if (VolumeManagerModule.isShutterEnabled()) {
        ReactContext reactContext = getReactInstanceManager().getCurrentReactContext();
        if (reactContext != null) {
          WritableMap payload = Arguments.createMap();
          payload.putString("direction", "up");
          reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("native-shutter", payload);
        }
        return true;
      }
    }
    return super.onKeyDown(keyCode, event);
  }
`;

const withNativeShutter = (config) =>
  withMainActivity(config, (config) => {
    const { modResults } = config;
    const isKotlin = modResults.language === 'kt';
    const contents = modResults.contents;

    if (contents.includes('native-shutter') && contents.includes('onKeyDown')) {
      return config;
    }

    const importBlock = isKotlin
      ? KOTLIN_IMPORTS.filter((imp) => !contents.includes(imp)).join('\n')
      : JAVA_IMPORTS.filter((imp) => !contents.includes(imp)).join('\n');

    let updated = contents;
    if (importBlock) {
      const importAnchor = updated.match(/package\s+[\w.]+;\s*\n/) || updated.match(/package\s+[\w.]+\s*\n/);
      if (importAnchor) {
        updated = updated.replace(importAnchor[0], `${importAnchor[0]}${importBlock}\n`);
      } else {
        updated = `${importBlock}\n${updated}`;
      }
    }

    const methodBlock = isKotlin ? KOTLIN_METHOD : JAVA_METHOD;
    if (!updated.includes('onKeyDown')) {
      updated = updated.replace(/}\s*$/, `${methodBlock}\n}`);
    }

    modResults.contents = updated;
    return config;
  });

module.exports = withNativeShutter;
