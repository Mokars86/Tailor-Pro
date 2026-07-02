package com.tailorpro.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(name = "SystemBars")
    public static class SystemBarsPlugin extends Plugin {
        @PluginMethod
        public void setColors(PluginCall call) {
            String statusBarColor = call.getString("statusBarColor");
            String navigationBarColor = call.getString("navigationBarColor");
            Boolean isDark = call.getBoolean("isDark", false);

            getActivity().runOnUiThread(() -> {
                Window window = getActivity().getWindow();
                if (statusBarColor != null) {
                    window.setStatusBarColor(Color.parseColor(statusBarColor));
                }
                if (navigationBarColor != null) {
                    window.setNavigationBarColor(Color.parseColor(navigationBarColor));
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        int appearance = 0;
                        if (!isDark) {
                            appearance |= WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS;
                            appearance |= WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        }
                        controller.setSystemBarsAppearance(appearance,
                                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    View decorView = window.getDecorView();
                    int flags = decorView.getSystemUiVisibility();
                    if (!isDark) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                    } else {
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                        }
                    }
                    decorView.setSystemUiVisibility(flags);
                }
            });
            call.resolve();
        }
    }
}

