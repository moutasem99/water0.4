import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appId = 'com.waterstation.pos';
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appVersionCode = Number(pkg.androidVersionCode) || 1;
const appVersionName = String(pkg.version || '1.0');
const javaDir = path.join(root, 'android', 'app', 'src', 'main', 'java', ...appId.split('.'));
const manifestPath = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const iconSourceDir = path.join(root, 'native-icons');

if (!fs.existsSync(manifestPath)) throw new Error(`AndroidManifest not found: ${manifestPath}`);
fs.mkdirSync(javaDir, { recursive: true });

const presets = [
  { key:'ocean', alias:'MainActivityOcean', enabled:true },
  { key:'navy', alias:'MainActivityNavy', enabled:false },
  { key:'emerald', alias:'MainActivityEmerald', enabled:false },
  { key:'purple', alias:'MainActivityPurple', enabled:false }
];

// Create density-specific launcher icon files.
// Using mipmap resources allows real launcher aliases to have different icons.
const densitySizes = {
  'mipmap-mdpi':48,
  'mipmap-hdpi':72,
  'mipmap-xhdpi':96,
  'mipmap-xxhdpi':144,
  'mipmap-xxxhdpi':192
};

// Source files are high resolution. Android can scale them; copying the
// high-resolution PNG into each mipmap folder is valid and avoids external tools.
for (const preset of presets) {
  const src = path.join(iconSourceDir, `${preset.key}.png`);
  if (!fs.existsSync(src)) throw new Error(`Missing launcher icon source ${src}`);
  for (const density of Object.keys(densitySizes)) {
    const dir = path.join(resDir, density);
    fs.mkdirSync(dir, { recursive:true });
    fs.copyFileSync(src, path.join(dir, `ic_launcher_${preset.key}.png`));
  }
}

// MainActivity registers our local Capacitor plugin BEFORE BridgeActivity
// creates the bridge.
const mainActivity = `package ${appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(IconSwitcherPlugin.class);
        registerPlugin(DocumentExporterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), mainActivity);

// Native plugin switches the enabled LAUNCHER activity-alias.
const pluginJava = `package ${appId};

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "IconSwitcher")
public class IconSwitcherPlugin extends Plugin {
    private static final String[] KEYS = {"ocean", "navy", "emerald", "purple"};
    private static final String[] ALIASES = {
        "MainActivityOcean",
        "MainActivityNavy",
        "MainActivityEmerald",
        "MainActivityPurple"
    };

    private int indexOf(String key) {
        if (key == null) return 0;
        for (int i = 0; i < KEYS.length; i++) {
            if (KEYS[i].equals(key)) return i;
        }
        return -1;
    }

    @PluginMethod
    public void setIcon(PluginCall call) {
        final String requested = call.getString("name", "ocean");
        final int selected = indexOf(requested);
        if (selected < 0) {
            call.reject("Unknown launcher icon");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                PackageManager pm = getContext().getPackageManager();
                String pkg = getContext().getPackageName();

                // Enable the requested alias first so a launcher entry always exists.
                ComponentName chosen = new ComponentName(pkg, pkg + "." + ALIASES[selected]);
                pm.setComponentEnabledSetting(
                    chosen,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );

                for (int i = 0; i < ALIASES.length; i++) {
                    if (i == selected) continue;
                    ComponentName component = new ComponentName(pkg, pkg + "." + ALIASES[i]);
                    pm.setComponentEnabledSetting(
                        component,
                        PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP
                    );
                }

                JSObject result = new JSObject();
                result.put("name", KEYS[selected]);
                result.put("changed", true);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject("Unable to change launcher icon", ex);
            }
        });
    }

    @PluginMethod
    public void getIcon(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            String current = "ocean";

            for (int i = 0; i < ALIASES.length; i++) {
                ComponentName component = new ComponentName(pkg, pkg + "." + ALIASES[i]);
                int state = pm.getComponentEnabledSetting(component);
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
                    (i == 0 && state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT)) {
                    current = KEYS[i];
                    break;
                }
            }

            JSObject result = new JSObject();
            result.put("name", current);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Unable to read launcher icon", ex);
        }
    }
}
`;
fs.writeFileSync(path.join(javaDir, 'IconSwitcherPlugin.java'), pluginJava);


// Native exporter writes user-visible files directly into Downloads/WaterStation.
const exporterJava = `package ${appId};

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "DocumentExporter")
public class DocumentExporterPlugin extends Plugin {

    private String safeFileName(String name) {
        if (name == null || name.trim().isEmpty()) return "WaterStation-file";
        return name.replaceAll("[\\\\/:*?\\\"<>|]", "_");
    }

    @PluginMethod
    public void saveBase64(PluginCall call) {
        String base64 = call.getString("base64");
        String requestedName = safeFileName(call.getString("fileName", "WaterStation-file"));
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (base64 == null || base64.isEmpty()) {
            call.reject("No file data supplied");
            return;
        }

        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            JSObject result = new JSObject();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, requestedName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/WaterStation");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Unable to create download entry");

                try (OutputStream out = resolver.openOutputStream(uri, "w")) {
                    if (out == null) throw new IllegalStateException("Unable to open download stream");
                    out.write(data);
                    out.flush();
                } catch (Exception writeError) {
                    resolver.delete(uri, null, null);
                    throw writeError;
                }

                ContentValues ready = new ContentValues();
                ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, ready, null, null);

                result.put("name", requestedName);
                result.put("uri", uri.toString());
                result.put("directory", "Downloads/WaterStation");
                result.put("visible", true);
                call.resolve(result);
                return;
            }

            // Legacy Android fallback.
            File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File folder = new File(downloads, "WaterStation");
            if (!folder.exists() && !folder.mkdirs()) {
                throw new IllegalStateException("Unable to create WaterStation downloads folder");
            }
            File target = new File(folder, requestedName);
            int suffix = 1;
            String baseName = requestedName;
            String extension = "";
            int dot = requestedName.lastIndexOf('.');
            if (dot > 0) {
                baseName = requestedName.substring(0, dot);
                extension = requestedName.substring(dot);
            }
            while (target.exists()) {
                target = new File(folder, baseName + " (" + suffix++ + ")" + extension);
            }
            try (FileOutputStream out = new FileOutputStream(target)) {
                out.write(data);
                out.flush();
            }

            result.put("name", target.getName());
            result.put("uri", Uri.fromFile(target).toString());
            result.put("directory", target.getParent());
            result.put("visible", true);
            call.resolve(result);

        } catch (Exception ex) {
            call.reject("Unable to save file to Downloads", ex);
        }
    }
}
`;
fs.writeFileSync(path.join(javaDir, 'DocumentExporterPlugin.java'), exporterJava);

// Patch launcher intent from MainActivity to independent activity-alias entries.
let manifest = fs.readFileSync(manifestPath, 'utf8');

if (!manifest.includes('android.permission.WRITE_EXTERNAL_STORAGE')) {
  manifest = manifest.replace(
    /<manifest\b([^>]*)>/,
    '<manifest$1>\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />'
  );
}

if (!manifest.includes('MainActivityOcean')) {
  const activityRegex = /<activity\b(?=[^>]*android:name="\.MainActivity")[\s\S]*?<\/activity>/m;
  const match = manifest.match(activityRegex);
  if (!match) throw new Error('MainActivity block not found in AndroidManifest.xml');

  let activity = match[0];

  // Remove only the MAIN/LAUNCHER intent-filter from the target activity.
  activity = activity.replace(
    /<intent-filter>[\s\S]*?<action\s+android:name="android\.intent\.action\.MAIN"\s*\/>[\s\S]*?<category\s+android:name="android\.intent\.category\.LAUNCHER"\s*\/>[\s\S]*?<\/intent-filter>/m,
    ''
  );

  const aliases = presets.map(p => `
        <activity-alias
            android:name=".${p.alias}"
            android:enabled="${p.enabled ? 'true' : 'false'}"
            android:exported="true"
            android:icon="@mipmap/ic_launcher_${p.key}"
            android:label="@string/app_name"
            android:targetActivity=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`).join('\n');

  const replacement = activity + aliases;
  manifest = manifest.replace(match[0], replacement);
  fs.writeFileSync(manifestPath, manifest);
}

fs.writeFileSync(manifestPath, manifest);

// Keep versionCode/versionName in sync with package.json instead of the
// Capacitor template's static "versionCode 1" / 'versionName "1.0"', so each
// release is distinguishable and future updates can install over an older one.
const buildGradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (!fs.existsSync(buildGradlePath)) throw new Error(`build.gradle not found: ${buildGradlePath}`);
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle.replace(/versionCode\s+\d+/, `versionCode ${appVersionCode}`);
buildGradle = buildGradle.replace(/versionName\s+"[^"]*"/, `versionName "${appVersionName}"`);
fs.writeFileSync(buildGradlePath, buildGradle);

console.log(`Android launcher aliases, icon switcher, and Downloads exporter installed. App version set to ${appVersionName} (code ${appVersionCode}).`);
