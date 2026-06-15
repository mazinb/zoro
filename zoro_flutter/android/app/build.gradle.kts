plugins {
    id("com.android.application")
    id("kotlin-android")
    id("com.google.gms.google-services")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

import java.util.Properties
import java.io.FileInputStream

android {
    namespace = "com.getzoro.zoroFlutter.zoro_flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Base id; dev flavor adds ".dev" so you can install both.
        applicationId = "com.getzoro.zoroFlutter"
        // Gemini Nano / AICore requires API 31+.
        minSdk = maxOf(flutter.minSdkVersion, 31)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    val keystoreProperties = Properties()
    val keystorePropertiesFile = rootProject.file("key.properties")
    val hasReleaseKeys = keystorePropertiesFile.exists()
    if (hasReleaseKeys) {
        keystoreProperties.load(FileInputStream(keystorePropertiesFile))
    }

    signingConfigs {
        if (hasReleaseKeys) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    flavorDimensions += "env"
    productFlavors {
        create("dev") {
            dimension = "env"
            applicationIdSuffix = ".dev"
            resValue("string", "app_name", "Zoro Dev")
        }
        create("prod") {
            dimension = "env"
            resValue("string", "app_name", "Zoro")
        }
    }

    buildTypes {
        release {
            // Release signing: uses android/key.properties when present (do NOT ship
            // to the Play Store with debug keys). Local `flutter run --release`
            // still works without keys by falling back to debug signing.
            signingConfig = signingConfigs.getByName(if (hasReleaseKeys) "release" else "debug")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation("com.google.ai.edge.aicore:aicore:0.0.1-exp01")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
