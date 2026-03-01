package com.bydstats.app

import android.util.Log
import com.bydstats.app.BuildConfig
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

import android.content.Intent
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.FirebaseApp

class WearableMessageListenerService : WearableListenerService() {

    override fun onCreate() {
        super.onCreate()
        Log.d("WearableService", "Service created and listening...")
        // Ensure Firebase is ready even in background process
        try {
            FirebaseApp.initializeApp(this)
        } catch (e: Exception) {
            Log.w("WearableService", "Firebase already initialized or error: ${e.message}")
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        val path = messageEvent.path
        Log.d("WearableService", "Message received from wear device: $path")

        if (path.startsWith("/byd/action/")) {
            val action = path.substringAfterLast("/")
            Log.i("WearableService", "Action request received: $action")
            
            // 1. Notify the app via broadcast (if it's open)
            val intent = Intent("BYD_ACTION")
            intent.setPackage(packageName)
            intent.putExtra("action", action)
            sendBroadcast(intent)
            
            // 2. Independent execution (if app is closed)
            handleNativeAction(action)
        }
    }

    private fun getSecurePrefs(): android.content.SharedPreferences {
        return try {
            val masterKey = androidx.security.crypto.MasterKey.Builder(this)
                .setKeyScheme(androidx.security.crypto.MasterKey.KeyScheme.AES256_GCM)
                .build()
            androidx.security.crypto.EncryptedSharedPreferences.create(
                this,
                "WearSyncPrefs",
                masterKey,
                androidx.security.crypto.EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                androidx.security.crypto.EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.e("WearableService", "EncryptedSharedPreferences unavailable, falling back", e)
            getSharedPreferences("WearSyncPrefs", android.content.Context.MODE_PRIVATE)
        }
    }

    private fun handleNativeAction(action: String) {
        val prefs = getSecurePrefs()
        val vin = prefs.getString("last_vin", null)

        if (vin == null) {
            Log.e("WearableService", "NATIVE ACTION FAILED: No VIN stored")
            return
        }

        val auth = FirebaseAuth.getInstance()
        val user = auth.currentUser

        if (user == null) {
            Log.w("WearableService", "Auth user is null, waiting 500ms...")
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                val retriedUser = auth.currentUser
                if (retriedUser == null) {
                    Log.e("WearableService", "NATIVE ACTION FAILED: User still null after wait")
                    return@postDelayed
                }
                triggerCloudFunction(action, vin, retriedUser)
            }, 500)
            return
        }

        triggerCloudFunction(action, vin, user)
    }

    private fun triggerCloudFunction(
        action: String,
        vin: String,
        user: com.google.firebase.auth.FirebaseUser
    ) {
        val functionName = when (action) {
            "unlock" -> "bydUnlockV2"
            "flash" -> "bydFlashLightsV2"
            "climate" -> "bydStartClimateV2"
            else -> return
        }

        if (BuildConfig.DEBUG) Log.i("WearableService", "Triggering native $action ($functionName) for VIN: ***${vin.takeLast(4)} (User: ${user.uid.take(8)}...)")

        val functions = FirebaseFunctions.getInstance("europe-west1")
        val data = hashMapOf<String, Any>("vin" to vin)

        // For climate, we need to provide a temperature if we use startClimateV2
        if (action == "climate") {
            data["temperature"] = 21
        }

        functions.getHttpsCallable(functionName).call(data)
            .addOnSuccessListener { Log.i("WearableService", "NATIVE ACTION $action SUCCESSFUL") }
            .addOnFailureListener { e -> Log.e("WearableService", "NATIVE ACTION $action FAILED", e) }
    }
}
