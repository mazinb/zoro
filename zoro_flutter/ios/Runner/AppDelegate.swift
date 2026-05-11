import Flutter
import UIKit
import workmanager_apple

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // CRITICAL: workmanager_apple requires BGTaskScheduler launch handlers to be
    // registered BEFORE the app finishes launching. Without this, iOS raises
    // NSInternalInconsistencyException ("All launch handlers must be registered
    // before application finishes launching") and the process is killed.
    //
    // Identifier must match BGTaskSchedulerPermittedIdentifiers in Info.plist
    // and the `zoroBackgroundTaskName` constant in lib/core/notifications/background_dispatcher.dart.
    WorkmanagerPlugin.setPluginRegistrantCallback { registry in
      GeneratedPluginRegistrant.register(with: registry)
    }
    if #available(iOS 13.0, *) {
      WorkmanagerPlugin.registerPeriodicTask(
        withIdentifier: "com.getzoro.zoroFlutter.refresh",
        frequency: NSNumber(value: 15 * 60) // seconds; 15 min is the iOS floor.
      )
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
