import Flutter
import StoreKit
import SwiftUI
import UIKit

/// StoreKit 2 SubscriptionStoreView for Pro auto-renewable subscription (App Store Guideline 3.1.2).
@objc class AppleSubscriptionStorePlugin: NSObject {
  @objc static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: "zoro/apple_subscription_store",
      binaryMessenger: messenger
    )
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "isAvailable":
        if #available(iOS 17.0, *) {
          result(true)
        } else {
          result(false)
        }
      case "showManageSubscriptions":
        Self.showManageSubscriptions(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }

    let events = FlutterEventChannel(
      name: "zoro/apple_subscription_store/events",
      binaryMessenger: messenger
    )
    events.setStreamHandler(PurchaseEventStreamHandler())

    if #available(iOS 17.0, *) {
      startTransactionListener()
    }
  }

  /// Register the embedded SubscriptionStoreView (call from AppDelegate).
  static func registerEmbeddedStoreView(_ registrar: any FlutterApplicationRegistrar) {
    let messenger = registrar.messenger()
    registrar.register(
      SubscriptionStoreViewFactory(messenger: messenger),
      withId: "zoro/subscription_store_view"
    )
  }

  fileprivate static var purchaseEventSink: FlutterEventSink?
  private static var transactionTask: Task<Void, Never>?

  fileprivate static func setPurchaseEventSink(_ sink: FlutterEventSink?) {
    purchaseEventSink = sink
  }

  @available(iOS 17.0, *)
  private static func startTransactionListener() {
    transactionTask?.cancel()
    transactionTask = Task {
      for await update in Transaction.updates {
        guard case .verified(let transaction) = update else { continue }
        let productId = transaction.productID
        await MainActor.run {
          purchaseEventSink?(["productId": productId])
        }
      }
    }
  }

  private static func showManageSubscriptions(result: @escaping FlutterResult) {
    guard #available(iOS 15.0, *) else {
      result(FlutterError(code: "unsupported", message: "Requires iOS 15+", details: nil))
      return
    }
    guard let scene = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first(where: { $0.activationState == .foregroundActive })
    else {
      result(FlutterError(code: "no_scene", message: "No active window scene", details: nil))
      return
    }
    Task { @MainActor in
      do {
        try await AppStore.showManageSubscriptions(in: scene)
        result(nil)
      } catch {
        result(FlutterError(code: "manage_failed", message: error.localizedDescription, details: nil))
      }
    }
  }
}

private final class PurchaseEventStreamHandler: NSObject, FlutterStreamHandler {
  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    AppleSubscriptionStorePlugin.setPurchaseEventSink(events)
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    AppleSubscriptionStorePlugin.setPurchaseEventSink(nil)
    return nil
  }
}

@available(iOS 17.0, *)
private struct ProSubscriptionStoreContent: View {
  let productIds: [String]

  var body: some View {
    SubscriptionStoreView(productIDs: productIds) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Zoro Pro")
          .font(.title2.bold())
        Text("Unlimited imports, export, and helper edits.")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.vertical, 4)
    }
    .storeButton(.visible, for: .restorePurchases)
  }
}

private final class SubscriptionStoreViewFactory: NSObject, FlutterPlatformViewFactory {
  private let messenger: FlutterBinaryMessenger

  init(messenger: FlutterBinaryMessenger) {
    self.messenger = messenger
  }

  func create(
    withFrame frame: CGRect,
    viewIdentifier viewId: Int64,
    arguments args: Any?
  ) -> FlutterPlatformView {
    SubscriptionStorePlatformView(frame: frame, args: args)
  }

  func createArgsCodec() -> FlutterMessageCodec & NSObjectProtocol {
    FlutterStandardMessageCodec.sharedInstance()
  }
}

private final class SubscriptionStorePlatformView: NSObject, FlutterPlatformView {
  private let rootView: UIView

  init(frame: CGRect, args: Any?) {
    let productId = (args as? [String: Any])?["productId"] as? String ?? "com.getzoro.pro_monthly_sub"
    if #available(iOS 17.0, *) {
      let swiftView = ProSubscriptionStoreContent(productIds: [productId])
      let host = UIHostingController(rootView: swiftView)
      host.view.backgroundColor = .clear
      host.view.frame = frame
      host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      rootView = host.view
    } else {
      let label = UILabel(frame: frame)
      label.text = "Subscription store requires iOS 17+"
      label.textAlignment = .center
      label.numberOfLines = 0
      label.textColor = .secondaryLabel
      rootView = label
    }
    super.init()
  }

  func view() -> UIView {
    rootView
  }
}
