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

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WearApp()
        }
    }
}

@Composable
fun WearApp() {
    MaterialTheme {
        val context = androidx.compose.ui.platform.LocalContext.current
        val coroutineScope = rememberCoroutineScope()
        
        // Mock data for Phase 3 (will be connected to phone data later)
        val currentChargeKWh = 65.0
        val totalCapacityKWh = 82.5
        val progress = (currentChargeKWh / totalCapacityKWh).toFloat()
        val rangeKm = 410

        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable {
                    coroutineScope.launch {
                        sendMessageToPhone(context, "/byd/action/unlock")
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            // Perimetric Circular Progress
            CircularProgressIndicator(
                progress = progress,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(4.dp),
                startAngle = 270f,
                indicatorColor = Color(0xFF00E676), // Vibrant Green
                trackColor = Color.DarkGray,
                strokeWidth = 6.dp
            )

            // Central Content
            Text(
                text = "${rangeKm} km",
                fontSize = 24.sp,
                textAlign = TextAlign.Center,
                color = Color.White
            )
            
            Text(
                text = "Autonomía IA",
                fontSize = 10.sp,
                modifier = Modifier.padding(top = 40.dp),
                color = Color.LightGray
            )
        }
    }
}

private suspend fun sendMessageToPhone(context: android.content.Context, path: String) {
    try {
        val nodes = Wearable.getNodeClient(context).connectedNodes.await()
        if (nodes.isEmpty()) {
            Log.w("WearApp", "No connected nodes found to send message: $path")
            return
        }

        for (node in nodes) {
            Wearable.getMessageClient(context).sendMessage(
                node.id,
                path,
                ByteArray(0)
            ).await()
            Log.i("WearApp", "Message sent to node ${node.displayName}: $path")
        }
    } catch (e: Exception) {
        Log.e("WearApp", "Error sending message to phone", e)
    }
}
