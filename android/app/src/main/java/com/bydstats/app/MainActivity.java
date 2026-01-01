package com.bydstats.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private void configureStatusBar() {
        Window window = getWindow();

        // Enable edge-to-edge display
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFF0F172A); // #0f172a dark background
        }

        // CRITICAL: Use WindowInsetsControllerCompat for consistent behavior across Android versions
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        if (insetsController != null) {
            // FALSE = white icons (for dark background)
            // TRUE = dark icons (for light background)
            insetsController.setAppearanceLightStatusBars(false);
        }

        // Additional approach for Android M to Q (API 23-29) - deprecated but still works
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            View decorView = window.getDecorView();
            int flags = decorView.getSystemUiVisibility();
            // Ensure LIGHT_STATUS_BAR flag is NOT set (makes icons white)
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            decorView.setSystemUiVisibility(flags);
        }

        // Modern approach for Android R+ (API 30+) - Samsung Android 16 should use this
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Clear the light status bars appearance flag (0 = white icons)
            window.getInsetsController().setSystemBarsAppearance(
                0, // value: 0 means white icons
                android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS // mask
            );
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable WebView debugging for troubleshooting
        WebView.setWebContentsDebuggingEnabled(true);

        // Configure status bar
        configureStatusBar();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply status bar configuration in case something overrode it
        configureStatusBar();
    }
}
