import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let registrar = engineBridge.applicationRegistrar
    AppleFoundationModelsPlugin.register(with: registrar.messenger())
    AppleSubscriptionStorePlugin.register(with: registrar.messenger())
    AppleSubscriptionStorePlugin.registerEmbeddedStoreView(registrar)
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self
    }
  }
}
