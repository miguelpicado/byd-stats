package com.bydstats.app.wear

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.launch

import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Icon

class MainActivity : ComponentActivity(), DataClient.OnDataChangedListener {
    
    private var rangeKm by mutableStateOf(0)
    private var soc by mutableStateOf(0f)
    private var climateActive by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WearApp(rangeKm, soc, climateActive)
        }
    }

    override fun onResume() {
        super.onResume()
        Wearable.getDataClient(this).addListener(this)
        Wearable.getDataClient(this).dataItems.addOnSuccessListener { buffer ->
            buffer.forEach { item ->
                if (item.uri.path == "/byd/vehicle_status") updateStateFromItem(item)
            }
            buffer.release()
        }
    }

    override fun onPause() {
        super.onPause()
        Wearable.getDataClient(this).removeListener(this)
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            if (event.type == com.google.android.gms.wearable.DataEvent.TYPE_CHANGED) {
                if (event.dataItem.uri.path == "/byd/vehicle_status") updateStateFromItem(event.dataItem)
            }
        }
    }

    private fun updateStateFromItem(item: com.google.android.gms.wearable.DataItem) {
        val dataMap = DataMapItem.fromDataItem(item).dataMap
        rangeKm = dataMap.getInt("range_km")
        soc = dataMap.getFloat("soc")
        climateActive = dataMap.getBoolean("climate_active")
        Log.i("WearApp", "UI Update: $rangeKm km, $soc%, Climate: $climateActive")
    }
}

@Composable
fun WearApp(rangeKm: Int, soc: Float, climateActive: Boolean) {
    MaterialTheme {
        val context = androidx.compose.ui.platform.LocalContext.current
        val coroutineScope = rememberCoroutineScope()
        val progress = (soc / 100f).coerceIn(0f, 1f)

        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            // Background Progress
            CircularProgressIndicator(
                progress = progress,
                modifier = Modifier.fillMaxSize().padding(2.dp),
                indicatorColor = Color(0xFF00E676),
                trackColor = Color.DarkGray,
                strokeWidth = 4.dp
            )

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 10.dp)
            ) {
                // Large Range at Top (Clickable for Unlock)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.clickable {
                        coroutineScope.launch { sendMessageToPhone(context, "/byd/action/unlock") }
                    }
                ) {
                    Text(
                        text = "$rangeKm",
                        fontSize = 42.sp,
                        color = Color.White,
                        style = MaterialTheme.typography.title1
                    )
                    Text(
                        text = "KM (IA)",
                        fontSize = 12.sp,
                        color = Color.LightGray
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Bottom Buttons
                Row {
                    // Flash Button
                    Button(
                        onClick = { coroutineScope.launch { sendMessageToPhone(context, "/byd/action/flash") } },
                        modifier = Modifier.size(ButtonDefaults.SmallButtonSize),
                        colors = ButtonDefaults.buttonColors(backgroundColor = Color.DarkGray)
                    ) {
                        Icon(
                            imageVector = Icons.Default.FlashlightOn,
                            contentDescription = "Flash",
                            modifier = Modifier.size(24.dp),
                            tint = Color.White
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Climate Button
                    Button(
                        onClick = { coroutineScope.launch { sendMessageToPhone(context, "/byd/action/climate") } },
                        modifier = Modifier.size(ButtonDefaults.SmallButtonSize),
                        colors = ButtonDefaults.buttonColors(
                            backgroundColor = if (climateActive) Color(0xFFFB8C00) else Color.DarkGray // Orange when active
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.AcUnit,
                            contentDescription = "Climate",
                            modifier = Modifier.size(24.dp),
                            tint = Color.White
                        )
                    }
                }
            }
        }
    }
}

private suspend fun sendMessageToPhone(context: android.content.Context, path: String) {
    try {
        Log.d("WearApp", "Attempting to send message: $path")
        val nodeClient = Wearable.getNodeClient(context)
        val messageClient = Wearable.getMessageClient(context)
        
        // Try capability first (cleaner)
        val capabilityInfo = Wearable.getCapabilityClient(context)
            .getCapability("byd_stats_phone_app", com.google.android.gms.wearable.CapabilityClient.FILTER_REACHABLE)
            .await()
        
        var nodes = capabilityInfo.nodes
        if (nodes.isEmpty()) {
            Log.w("WearApp", "No capability 'byd_stats_phone_app' found. Falling back to all connected nodes.")
            nodes = nodeClient.connectedNodes.await().toSet()
        }

        if (nodes.isEmpty()) {
            Log.e("WearApp", "CRITICAL: No nodes found at all. Check Bluetooth/Sync.")
            return
        }

        for (node in nodes) {
            Log.d("WearApp", "Sending message to node: ${node.displayName} (${node.id})")
            messageClient.sendMessage(node.id, path, ByteArray(0))
                .addOnSuccessListener { Log.i("WearApp", "SUCCESS: Message sent to ${node.displayName}") }
                .addOnFailureListener { e -> Log.e("WearApp", "FAIL: Could not send to ${node.displayName}", e) }
        }
    } catch (e: Exception) {
        Log.e("WearApp", "Error in sendMessageToPhone", e)
    }
}
