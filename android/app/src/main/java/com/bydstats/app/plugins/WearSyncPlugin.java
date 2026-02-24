package com.bydstats.app.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.bydstats.app.MainActivity;

import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;
import com.google.android.gms.tasks.Task;
import android.util.Log;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

@CapacitorPlugin(name = "WearSync")
public class WearSyncPlugin extends Plugin {

    private BroadcastReceiver actionReceiver;

    @Override
    public void load() {
        super.load();
        Log.i("WearSync", "--- WEAR SYNC PLUGIN LOADED ---");
        
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getStringExtra("action");
                Log.i("WearSync", "NATIVE BROADCAST RECEIVED IN PLUGIN: " + action);
                if (action != null) {
                    JSObject ret = new JSObject();
                    ret.put("action", action);
                    notifyListeners("onWatchAction", ret);
                }
            }
        };
        
        IntentFilter filter = new IntentFilter("BYD_ACTION");
        // Using getContext() instead of just registering to ensure it's on the right context
        getContext().registerReceiver(actionReceiver, filter, Context.RECEIVER_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        if (actionReceiver != null) {
            try {
                getContext().unregisterReceiver(actionReceiver);
            } catch (Exception e) {
                Log.w("WearSync", "Error unregistering: " + e.getMessage());
            }
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void syncVehicleData(PluginCall call) {
        Integer rangeKm = call.getInt("rangeKm");
        Double soc = call.getDouble("soc");
        String vin = call.getString("vin");
        Boolean climateActive = call.getBoolean("climateActive", false);

        if (rangeKm == null || soc == null) {
            call.reject("Must provide rangeKm and soc");
            return;
        }

        // Persist VIN for background service use
        if (vin != null) {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("WearSyncPrefs", Context.MODE_PRIVATE);
            prefs.edit().putString("last_vin", vin).apply();
            Log.d("WearSync", "VIN persisted for background use: " + vin);
        }

        try {
            PutDataMapRequest dataMap = PutDataMapRequest.create("/byd/vehicle_status");
            dataMap.getDataMap().putInt("range_km", rangeKm);
            dataMap.getDataMap().putFloat("soc", soc.floatValue());
            dataMap.getDataMap().putBoolean("climate_active", climateActive);
            dataMap.getDataMap().putLong("timestamp", System.currentTimeMillis());
            
            PutDataRequest request = dataMap.asPutDataRequest();
            request.setUrgent();
            
            Wearable.getDataClient(getContext()).putDataItem(request)
                .addOnSuccessListener(dataItem -> {
                    Log.d("WearSync", "Data synced to watch from Plugin: " + rangeKm + "km");
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> {
                    Log.e("WearSync", "Failed to sync data from Plugin", e);
                    call.reject("Sync failed: " + e.getMessage());
                });
        } catch (Exception e) {
            Log.e("WearSync", "Error in syncVehicleData", e);
            call.reject(e.getMessage());
        }
    }
}
