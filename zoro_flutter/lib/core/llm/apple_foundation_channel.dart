import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// On-device platform LLM: Apple Foundation Models (iOS) or Gemini Nano / AICore (Android).
class AppleFoundationCapabilities {
  const AppleFoundationCapabilities({
    required this.available,
    this.disabledReason,
    this.minOsVersionMajor,
    this.minOsVersionMinor,
  });

  final bool available;
  /// Short line when [available] is false; omit in UI when null.
  final String? disabledReason;
  final int? minOsVersionMajor;
  final int? minOsVersionMinor;

  static const AppleFoundationCapabilities unsupported = AppleFoundationCapabilities(available: false);

  static AppleFoundationCapabilities fromMethodResult(Object? raw) {
    if (raw is! Map) return unsupported;
    final m = Map<Object?, Object?>.from(raw);
    final available = m['available'] == true;
    if (available) {
      return const AppleFoundationCapabilities(available: true);
    }
    final reason = m['disabledReason']?.toString().trim();
    final maj = _parseInt(m['minOsVersionMajor']);
    final min = _parseInt(m['minOsVersionMinor']);
    return AppleFoundationCapabilities(
      available: false,
      disabledReason: (reason == null || reason.isEmpty) ? null : reason,
      minOsVersionMajor: maj,
      minOsVersionMinor: min,
    );
  }

  static int? _parseInt(Object? v) {
    if (v is int) return v;
    if (v is num) return v.round();
    return int.tryParse(v?.toString() ?? '');
  }
}

class AppleFoundationChannel {
  AppleFoundationChannel({
    MethodChannel? iosChannel,
    MethodChannel? androidChannel,
  })  : _iosChannel = iosChannel ?? const MethodChannel('zoro/apple_foundation_models'),
        _androidChannel = androidChannel ?? const MethodChannel('zoro/android_gemini_nano');

  final MethodChannel _iosChannel;
  final MethodChannel _androidChannel;

  MethodChannel get _channel => Platform.isIOS ? _iosChannel : _androidChannel;

  static int? _parseInt(Object? v) {
    if (v is int) return v;
    if (v is num) return v.round();
    return int.tryParse(v?.toString() ?? '');
  }

  Future<AppleFoundationCapabilities> getCapabilities() async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      return AppleFoundationCapabilities.unsupported;
    }
    try {
      var caps = AppleFoundationCapabilities.fromMethodResult(
        await _channel.invokeMethod<Object?>('getCapabilities'),
      );
      if (Platform.isAndroid &&
          !caps.available &&
          (caps.disabledReason?.contains('Checking') ?? false)) {
        await Future<void>.delayed(const Duration(seconds: 2));
        caps = AppleFoundationCapabilities.fromMethodResult(
          await _channel.invokeMethod<Object?>('getCapabilities'),
        );
      }
      return caps;
    } on MissingPluginException {
      return AppleFoundationCapabilities.unsupported;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[OnDeviceLLM] getCapabilities: $e');
      }
      return const AppleFoundationCapabilities(
        available: false,
        disabledReason: 'Could not check availability',
      );
    }
  }

  Future<({int contextSize, int reservedForOutput})> getContextBudget() async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      return (contextSize: 0, reservedForOutput: 2048);
    }
    try {
      final raw = await _channel.invokeMethod<Object?>('getContextBudget');
      if (raw is Map) {
        final m = Map<Object?, Object?>.from(raw);
        return (
          contextSize: _parseInt(m['contextSize']) ?? 0,
          reservedForOutput: _parseInt(m['reservedForOutput']) ?? 2048,
        );
      }
    } on MissingPluginException {
      return (contextSize: 0, reservedForOutput: 2048);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AppleFoundation] getContextBudget: $e');
      }
    }
    return (contextSize: 0, reservedForOutput: 2048);
  }

  Future<int> countTokens({required String system, required String user}) async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      return ((system.length + user.length) / 4).ceil();
    }
    try {
      final raw = await _channel.invokeMethod<Object?>(
        'countTokens',
        <String, Object?>{'system': system, 'user': user},
      );
      if (raw is Map) {
        final t = _parseInt(raw['tokens']);
        if (t != null) return t;
      }
    } on MissingPluginException {
      return ((system.length + user.length) / 4).ceil();
    } on PlatformException catch (e) {
      // Expected on iOS 26.0–26.3; Dart falls back to a character estimate.
      if (e.code != 'unsupported_os') {
        if (kDebugMode) {
          debugPrint('[AppleFoundation] countTokens: $e');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AppleFoundation] countTokens: $e');
      }
    }
    return ((system.length + user.length) / 4).ceil();
  }

  Future<String> complete({
    required String system,
    required String user,
    int? maxOutputTokens,
  }) async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      throw const AppleFoundationChannelException('On-device model is not available on this platform.');
    }
    try {
      final raw = await _channel.invokeMethod<String>(
        'complete',
        <String, Object?>{
          'system': system,
          'user': user,
          'maxOutputTokens': maxOutputTokens,
        }..removeWhere((_, v) => v == null),
      );
      final text = raw?.trim() ?? '';
      if (text.isEmpty) {
        throw const AppleFoundationChannelException('Model returned empty text.');
      }
      return text;
    } on MissingPluginException {
      throw const AppleFoundationChannelException('On-device model is not available in this build.');
    } on PlatformException catch (e) {
      throw AppleFoundationChannelException(e.message ?? e.code);
    }
  }
}

class AppleFoundationChannelException implements Exception {
  const AppleFoundationChannelException(this.message);

  final String message;

  @override
  String toString() => message;
}
