import 'dart:convert';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:pdf_struct_extractor/pdf_struct_extractor.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

/// Thrown inside the worker when Syncfusion needs a password (mirrors main isolate).
class _PdfPasswordRequiredInIsolate implements Exception {
  const _PdfPasswordRequiredInIsolate();
}

String _truncate(String value, int maxChars) {
  if (value.length <= maxChars) return value;
  return '${value.substring(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]';
}

/// Runs entirely inside a background isolate — keep logic self-contained.
Future<String> _pdfExtractSummaryInWorker(
  String fileName,
  Uint8List bytes,
  String? password,
) async {
  PdfDocument? document;
  try {
    document = PdfDocument(inputBytes: bytes, password: password);
  } catch (_) {
    if (password == null) throw const _PdfPasswordRequiredInIsolate();
    rethrow;
  }

  try {
    final extractor = PdfTextExtractor(document);
    final text = extractor.extractText().trim();
    final lines = extractor
        .extractTextLines()
        .take(250)
        .map((line) => line.text.trim())
        .where((line) => line.isNotEmpty)
        .toList();

    Map<String, Object?>? structured;
    try {
      final unlockedBytes = document.saveSync();
      final data = await PdfStructuredExtractor.extractFromBytes(
        Uint8List.fromList(unlockedBytes),
        sourceName: fileName,
      );
      structured = Map<String, Object?>.from(data);
    } catch (e) {
      structured = {
        'warning':
            'pdf_struct_extractor could not parse layout for this PDF: $e',
      };
    }

    final payload = {
      'fileName': fileName,
      'text': _truncate(text, 16000),
      'textLines': lines,
      'structuredLayout': structured,
    };

    return 'Local PDF extraction for $fileName:\n'
        '${const JsonEncoder.withIndent('  ').convert(payload)}';
  } finally {
    document.dispose();
  }
}

@pragma('vm:entry-point')
void _pdfIngestIsolateMain(List<Object?> message) async {
  final reply = message[0] as SendPort;
  final fileName = message[1] as String;
  final bytes = message[2] as Uint8List;
  final password = message[3] as String?;
  try {
    final summary = await _pdfExtractSummaryInWorker(fileName, bytes, password);
    reply.send(<String, Object?>{'t': 'ok', 'fileName': fileName, 'summary': summary});
  } on _PdfPasswordRequiredInIsolate {
    reply.send(<String, Object?>{'t': 'pwd'});
  } catch (e, st) {
    reply.send(<String, Object?>{
      't': 'err',
      'e': e.toString(),
      'st': st.toString(),
    });
  }
}

/// Heavy PDF parse + layout extraction off the UI isolate.
Future<String> runPdfTextExtractionInIsolate({
  required String fileName,
  required List<int> bytes,
  required String? password,
}) async {
  final copy = bytes is Uint8List ? bytes : Uint8List.fromList(bytes);
  final receivePort = ReceivePort();
  Isolate? isolate;
  try {
    isolate = await Isolate.spawn(
      _pdfIngestIsolateMain,
      <Object?>[receivePort.sendPort, fileName, copy, password],
      errorsAreFatal: false,
    );
    final raw = await receivePort.first;
    if (raw is! Map) {
      throw StateError('Unexpected isolate reply');
    }
    final m = Map<String, Object?>.from(raw);
    switch (m['t']) {
      case 'ok':
        return m['summary']! as String;
      case 'pwd':
        throw _PdfPasswordRequiredInIsolate();
      case 'err':
        throw Exception(m['e']?.toString() ?? 'PDF isolate error');
      default:
        throw StateError('Unknown isolate reply: $m');
    }
  } finally {
    receivePort.close();
    isolate?.kill(priority: Isolate.immediate);
  }
}

bool isPdfPasswordRequiredFromIsolate(Object e) =>
    e is _PdfPasswordRequiredInIsolate;
