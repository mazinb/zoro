import Flutter
import UIKit

#if canImport(FoundationModels)
import FoundationModels
#endif

/// Method channel `zoro/apple_foundation_models` — on-device text generation via Apple Foundation Models when the SDK and OS support it.
@objc class AppleFoundationModelsPlugin: NSObject {
  @objc static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: "zoro/apple_foundation_models",
      binaryMessenger: messenger
    )
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "getCapabilities":
        result(Self.makeCapabilities())
      case "complete":
        Self.handleComplete(call: call, result: result)
      case "getContextBudget":
        result(Self.makeContextBudget())
      case "countTokens":
        Self.handleCountTokens(call: call, result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  private static func makeCapabilities() -> [String: Any] {
    #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return capabilitiesMap26()
      }
      return [
        "available": false,
        "disabledReason": "Requires iOS 26+",
        "minOsVersionMajor": 26,
        "minOsVersionMinor": 0,
      ]
    #else
      return [
        "available": false,
        "disabledReason": "Not available in this app build",
      ]
    #endif
  }

  private static func makeContextBudget() -> [String: Any] {
    #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return contextBudgetMap26()
      }
    #endif
    return ["contextSize": 0, "reservedForOutput": 2048]
  }

  private static func handleCountTokens(call: FlutterMethodCall, result: @escaping FlutterResult) {
    #if canImport(FoundationModels)
      guard let args = call.arguments as? [String: Any] else {
        result(
          FlutterError(code: "bad_args", message: "Expected argument map", details: nil))
        return
      }
      let system = (args["system"] as? String) ?? ""
      let user = (args["user"] as? String) ?? ""
      let combined = system + "\n\n" + user

      if #available(iOS 26.4, *) {
        Task {
          do {
            let tokens = try await countTokens26_4(combined)
            DispatchQueue.main.async {
              result(["tokens": tokens])
            }
          } catch {
            DispatchQueue.main.async {
              result(
                FlutterError(
                  code: "token_count_failed",
                  message: error.localizedDescription,
                  details: nil))
            }
          }
        }
        return
      }

      if #available(iOS 26.0, *) {
        result(
          FlutterError(
            code: "unsupported_os",
            message: "Token counting requires iOS 26.4+",
            details: nil))
        return
      }
      result(
        FlutterError(code: "unsupported_os", message: "Requires iOS 26+", details: nil))
    #else
      result(
        FlutterError(code: "no_sdk", message: "Foundation Models not linked", details: nil))
    #endif
  }

  private static func handleComplete(call: FlutterMethodCall, result: @escaping FlutterResult) {
    #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        guard let args = call.arguments as? [String: Any] else {
          result(
            FlutterError(code: "bad_args", message: "Expected argument map", details: nil))
          return
        }
        Task {
          do {
            let text = try await runComplete26(args: args)
            DispatchQueue.main.async {
              result(text)
            }
          } catch {
            DispatchQueue.main.async {
              result(
                FlutterError(
                  code: "generation_failed", message: error.localizedDescription, details: nil))
            }
          }
        }
        return
      }
      result(
        FlutterError(code: "unsupported_os", message: "Requires iOS 26+", details: nil))
    #else
      result(
        FlutterError(code: "no_sdk", message: "Foundation Models not linked", details: nil))
    #endif
  }

  #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func capabilitiesMap26() -> [String: Any] {
      let model = SystemLanguageModel.default
      switch model.availability {
      case .available:
        return ["available": true]
      case .unavailable(let reason):
        return [
          "available": false,
          "disabledReason": humanizeUnavailable(reason),
        ]
      }
    }

    @available(iOS 26.0, *)
    private static func humanizeUnavailable(
      _ reason: SystemLanguageModel.Availability.UnavailableReason
    ) -> String {
      switch reason {
      case .deviceNotEligible:
        return "Requires a supported device with Apple Intelligence"
      case .appleIntelligenceNotEnabled:
        return "Turn on Apple Intelligence in Settings"
      case .modelNotReady:
        return "On-device model is not ready yet"
      @unknown default:
        return "Apple on-device model unavailable"
      }
    }

    @available(iOS 26.0, *)
    private static func contextBudgetMap26() -> [String: Any] {
      let model = SystemLanguageModel.default
      return [
        "contextSize": model.contextSize,
        "reservedForOutput": 2048,
      ]
    }

    /// Exact token footprint; API added in iOS 26.4.
    @available(iOS 26.4, *)
    private static func countTokens26_4(_ text: String) async throws -> Int {
      let model = SystemLanguageModel.default
      return try await model.tokenCount(for: text)
    }

    @available(iOS 26.0, *)
    private static func runComplete26(args: [String: Any]) async throws -> String {
      let system = (args["system"] as? String) ?? ""
      let user = (args["user"] as? String) ?? ""
      let session = LanguageModelSession(instructions: system)
      let response = try await session.respond(to: user)
      let text = response.content
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmed.isEmpty {
        throw NSError(
          domain: "AppleFoundationModels", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Empty model response"])
      }
      return trimmed
    }
  #endif
}
