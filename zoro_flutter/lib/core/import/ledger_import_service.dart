import 'dart:convert';

import '../api/api_exception.dart';
import '../llm/apple_foundation_channel.dart';
import '../llm/llm_client.dart';
import '../llm/llm_json.dart';
import '../state/app_model.dart';

/// Runs ledger import via Cloud AI (preferred) or on-device Apple (fallback).
class LedgerImportService {
  LedgerImportService._();

  static Future<Map<String, dynamic>> runStructured({
    required AppModel model,
    required String kind,
    required String system,
    required String user,
    List<LlmAttachment> attachments = const [],
  }) async {
    final hasImages = attachments.any((a) => a.isImage);

    if (hasImages && !model.canUseCloudImport) {
      throw StateError('Photo import needs Cloud AI. Turn it on in Settings → Usage.');
    }

    if (model.canUseCloudImport) {
      final deviceId = model.deviceId?.trim();
      if (deviceId == null || deviceId.isEmpty) {
        throw StateError('Missing device id. Restart the app.');
      }

      try {
        final body = await model.api.ledgerImport(
          deviceId: deviceId,
          kind: kind,
          system: system,
          user: user,
          attachments: attachments
              .map(
                (a) => {
                  'mimeType': a.mimeType,
                  'dataBase64': base64Encode(a.bytes),
                  if (a.fileName != null) 'fileName': a.fileName,
                },
              )
              .toList(),
        );
        model.recordImportRequest(cloud: true);
        final data = body['data'];
        if (data is! Map) throw const FormatException('Import returned invalid data');
        return Map<String, dynamic>.from(data);
      } catch (e) {
        final msg = e.toString();
        if (msg.contains('413') || msg.toLowerCase().contains('too long')) {
          throw StateError('File too long.');
        }
        throw StateError(_importErrorMessage(e));
      }
    }

    if (attachments.isNotEmpty) {
      throw StateError('Photo import needs Cloud AI. Turn it on in Settings → Usage.');
    }

    if (!model.appleFoundationRuntimeAvailable) {
      throw StateError(
        'Import needs Cloud AI or on-device AI. Turn on Cloud AI in Settings, or use a device with Apple Intelligence.',
      );
    }
    if (!model.appleFoundationEnabled) {
      model.setAppleFoundationEnabled(true);
    }

    final apple = AppleFoundationChannel();
    final budget = await apple.getContextBudget();
    if (budget.contextSize <= 0) {
      throw StateError('On-device AI is not available on this device.');
    }

    final tokens = await apple.countTokens(system: system, user: user);
    final maxInput = budget.contextSize - budget.reservedForOutput;
    if (tokens > maxInput) {
      throw StateError('File too long for on-device import.');
    }

    try {
      final raw = await apple.complete(
        system: system,
        user: user,
        maxOutputTokens: budget.reservedForOutput,
      );
      model.recordImportRequest(cloud: false);
      return decodeLlmJsonObject(raw);
    } catch (e) {
      throw StateError(_importErrorMessage(e));
    }
  }

  static String _importErrorMessage(Object e) {
    if (e is ApiException) return e.message;
    final msg = e.toString();
    if (msg.startsWith('ApiException')) {
      final idx = msg.indexOf(': ');
      if (idx >= 0) return msg.substring(idx + 2);
    }
    return 'Import failed. Try again or use a smaller file.';
  }
}
