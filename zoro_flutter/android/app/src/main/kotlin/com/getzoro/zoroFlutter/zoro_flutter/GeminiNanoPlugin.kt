package com.getzoro.zoroFlutter.zoro_flutter

import android.content.Context
import android.os.Build
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

import com.google.ai.edge.aicore.DownloadCallback
import com.google.ai.edge.aicore.DownloadConfig
import com.google.ai.edge.aicore.GenerativeAIException
import com.google.ai.edge.aicore.GenerativeModel
import com.google.ai.edge.aicore.generationConfig

/// Method channel `zoro/android_gemini_nano` — on-device text via Gemini Nano / AICore.
object GeminiNanoPlugin {
    private const val CHANNEL = "zoro/android_gemini_nano"
    private const val CONTEXT_SIZE = 12_000
    private const val RESERVED_OUTPUT = 2048

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val inferenceMutex = Mutex()

    @Volatile
    private var appContext: Context? = null

    @Volatile
    private var cachedAvailable: Boolean? = null

    @Volatile
    private var cachedDisabledReason: String? = null

    fun register(flutterEngine: FlutterEngine, context: Context) {
        appContext = context.applicationContext
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getCapabilities" -> result.success(makeCapabilities())
                "getContextBudget" -> result.success(makeContextBudget())
                "countTokens" -> handleCountTokens(call, result)
                "complete" -> handleComplete(call, result)
                else -> result.notImplemented()
            }
        }
    }

    private fun makeContextBudget(): Map<String, Int> =
        mapOf("contextSize" to CONTEXT_SIZE, "reservedForOutput" to RESERVED_OUTPUT)

    private fun makeCapabilities(): Map<String, Any> {
        if (Build.VERSION.SDK_INT < 31) {
            return mapOf(
                "available" to false,
                "disabledReason" to "Requires Android 12+ with AICore",
                "minOsVersionMajor" to 12,
                "minOsVersionMinor" to 0,
            )
        }
        cachedAvailable?.let { available ->
            return if (available) {
                mapOf("available" to true)
            } else {
                mapOf(
                    "available" to false,
                    "disabledReason" to (cachedDisabledReason ?: "Gemini Nano unavailable on this device"),
                )
            }
        }
        return mapOf(
            "available" to false,
            "disabledReason" to "Checking on-device model… open Settings → Usage after a moment",
        )
    }

    private fun handleCountTokens(call: MethodCall, result: MethodChannel.Result) {
        val args = call.arguments as? Map<*, *> ?: run {
            result.error("bad_args", "Expected argument map", null)
            return
        }
        val system = args["system"] as? String ?: ""
        val user = args["user"] as? String ?: ""
        val combined = "$system\n\n$user"
        // Character estimate until AICore exposes tokenization on all builds.
        val tokens = (combined.length / 4.0).toInt().coerceAtLeast(1)
        result.success(mapOf("tokens" to tokens))
    }

    private fun handleComplete(call: MethodCall, result: MethodChannel.Result) {
        val args = call.arguments as? Map<*, *> ?: run {
            result.error("bad_args", "Expected argument map", null)
            return
        }
        val system = args["system"] as? String ?: ""
        val user = args["user"] as? String ?: ""
        val maxOutput = (args["maxOutputTokens"] as? Number)?.toInt() ?: RESERVED_OUTPUT
        val ctx = appContext ?: run {
            result.error("no_context", "Application context missing", null)
            return
        }

        scope.launch {
            try {
                val text = inferenceMutex.withLock {
                    withContext(Dispatchers.IO) {
                        runComplete(ctx, system, user, maxOutput)
                    }
                }
                cachedAvailable = true
                cachedDisabledReason = null
                result.success(text)
            } catch (e: GenerativeAIException) {
                val reason = humanizeException(e)
                cachedAvailable = false
                cachedDisabledReason = reason
                result.error("generation_failed", reason, null)
            } catch (e: Exception) {
                val reason = e.message ?: "On-device model failed"
                cachedAvailable = false
                cachedDisabledReason = reason
                result.error("generation_failed", reason, null)
            }
        }
    }

    private suspend fun runComplete(
        context: Context,
        system: String,
        user: String,
        maxOutputTokens: Int,
    ): String {
        val model = buildModel(context, maxOutputTokens)
        model.prepareInferenceEngine()
        cachedAvailable = true
        cachedDisabledReason = null

        val prompt = buildString {
            if (system.isNotBlank()) {
                append("System instructions:\n")
                append(system.trim())
                append("\n\n")
            }
            append("User:\n")
            append(user.trim())
        }

        val response = model.generateContent(prompt)
        val text = response.text?.trim().orEmpty()
        if (text.isEmpty()) {
            throw IllegalStateException("Model returned empty text")
        }
        return text
    }

    private fun buildModel(context: Context, maxOutputTokens: Int): GenerativeModel {
        val genConfig = generationConfig {
            this.context = context
            temperature = 0.2f
            topK = 16
            this.maxOutputTokens = maxOutputTokens.coerceIn(64, 4096)
        }
        val downloadConfig = DownloadConfig(object : DownloadCallback {
            override fun onDownloadStarted(bytesToDownload: Long) {}
            override fun onDownloadFailed(failureStatus: String, e: GenerativeAIException) {
                cachedAvailable = false
                cachedDisabledReason = humanizeException(e)
            }
            override fun onDownloadProgress(totalBytesDownloaded: Long) {}
            override fun onDownloadCompleted() {
                cachedAvailable = true
                cachedDisabledReason = null
            }
        })
        return GenerativeModel(generationConfig = genConfig, downloadConfig = downloadConfig)
    }

    private fun humanizeException(e: GenerativeAIException): String {
        val msg = e.message?.lowercase().orEmpty()
        return when {
            msg.contains("not_available") || msg.contains("feature is unavailable") ->
                "Gemini Nano is not available. Use a supported device with AICore and on-device GenAI enabled."
            msg.contains("binding_failure") || msg.contains("failed to bind") ->
                "Gemini Nano is unavailable on this device. Turn on Cloud AI in Settings → Usage."
            msg.contains("download") ->
                "On-device model is downloading. Try again in a few minutes."
            else -> e.message ?: "Gemini Nano unavailable"
        }
    }

    /// Proactively check availability (called from getCapabilities refresh path).
    fun refreshAvailability(context: Context) {
        if (Build.VERSION.SDK_INT < 31) return
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val model = buildModel(context.applicationContext, 256)
                    model.prepareInferenceEngine()
                }
                cachedAvailable = true
                cachedDisabledReason = null
            } catch (e: Exception) {
                cachedAvailable = false
                cachedDisabledReason = when (e) {
                    is GenerativeAIException -> humanizeException(e)
                    else -> e.message ?: "Gemini Nano unavailable on this device"
                }
            }
        }
    }
}
