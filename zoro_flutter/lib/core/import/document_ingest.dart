import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:pdf_struct_extractor/pdf_struct_extractor.dart';
import 'package:syncfusion_flutter_pdf/pdf.dart';

import '../llm/llm_client.dart';

class PdfPasswordRequiredException implements Exception {
  const PdfPasswordRequiredException(this.fileName);

  final String fileName;

  @override
  String toString() => 'Password required for $fileName';
}

class IngestedDocument {
  const IngestedDocument({
    required this.fileName,
    required this.summary,
    this.attachment,
  });

  final String fileName;
  final String summary;
  final LlmAttachment? attachment;
}

class IngestBundle {
  const IngestBundle({required this.summaries, required this.attachments});

  final List<String> summaries;
  final List<LlmAttachment> attachments;

  String get promptText =>
      summaries.where((s) => s.trim().isNotEmpty).join('\n\n---\n\n');
}

String extensionLower(PlatformFile f) =>
    (f.extension ?? '').trim().toLowerCase();

String? mimeFromExtension(String ext) {
  return switch (ext) {
    'png' => 'image/png',
    'jpg' || 'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'pdf' => 'application/pdf',
    'csv' => 'text/csv',
    'txt' ||
    'md' ||
    'markdown' ||
    'json' ||
    'xml' ||
    'html' ||
    'htm' => 'text/plain',
    _ => null,
  };
}

bool isImageFile(PlatformFile f) =>
    mimeFromExtension(extensionLower(f))?.startsWith('image/') ?? false;

bool isPdfFile(PlatformFile f) => extensionLower(f) == 'pdf';

Future<IngestBundle> ingestPlatformFiles({
  required List<PlatformFile> files,
  required Future<String?> Function(String fileName) requestPdfPassword,
}) async {
  final summaries = <String>[];
  final attachments = <LlmAttachment>[];

  for (final f in files) {
    final doc = await ingestPlatformFile(
      f: f,
      requestPdfPassword: requestPdfPassword,
    );
    summaries.add(doc.summary);
    final attachment = doc.attachment;
    if (attachment != null) attachments.add(attachment);
  }

  return IngestBundle(summaries: summaries, attachments: attachments);
}

Future<IngestedDocument> ingestPlatformFile({
  required PlatformFile f,
  required Future<String?> Function(String fileName) requestPdfPassword,
}) async {
  final bytes = f.bytes;
  if (bytes == null || bytes.isEmpty) {
    return IngestedDocument(
      fileName: f.name,
      summary: 'File ${f.name}: no bytes available.',
    );
  }

  final ext = extensionLower(f);
  final mime = mimeFromExtension(ext);
  if (mime?.startsWith('image/') ?? false) {
    return IngestedDocument(
      fileName: f.name,
      summary: 'Image attached directly: ${f.name}',
      attachment: LlmAttachment(
        bytes: bytes,
        mimeType: mime!,
        fileName: f.name,
      ),
    );
  }

  if (ext == 'pdf') {
    try {
      return await _ingestPdf(f.name, bytes, password: null);
    } on PdfPasswordRequiredException {
      final password = await requestPdfPassword(f.name);
      if (password == null) rethrow;
      return _ingestPdf(f.name, bytes, password: password);
    }
  }

  final text = _decodeText(bytes);
  if (text.trim().isEmpty) {
    return IngestedDocument(
      fileName: f.name,
      summary:
          'File ${f.name}: accepted, but it is not an image/PDF/text-like file the local parser can read. Ask the user for a screenshot, PDF, CSV, or text export if the values are not visible elsewhere.',
    );
  }

  return IngestedDocument(
    fileName: f.name,
    summary: 'File ${f.name} text excerpt:\n${_truncate(text, 12000)}',
  );
}

Future<IngestedDocument> _ingestPdf(
  String fileName,
  List<int> bytes, {
  required String? password,
}) async {
  PdfDocument? document;
  try {
    document = PdfDocument(inputBytes: bytes, password: password);
  } catch (_) {
    if (password == null) throw PdfPasswordRequiredException(fileName);
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

    return IngestedDocument(
      fileName: fileName,
      summary:
          'Local PDF extraction for $fileName:\n${const JsonEncoder.withIndent('  ').convert(payload)}',
    );
  } finally {
    document.dispose();
  }
}

String _decodeText(List<int> bytes) {
  try {
    return utf8.decode(bytes, allowMalformed: true);
  } catch (_) {
    try {
      return latin1.decode(bytes, allowInvalid: true);
    } catch (_) {
      return '';
    }
  }
}

String _truncate(String value, int maxChars) {
  if (value.length <= maxChars) return value;
  return '${value.substring(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]';
}
