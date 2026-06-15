package com.getzoro.zoroFlutter.zoro_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        GeminiNanoPlugin.register(flutterEngine, this)
        GeminiNanoPlugin.refreshAvailability(this)
    }
}
