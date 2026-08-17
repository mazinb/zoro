import 'package:syncfusion_flutter_pdf/pdf.dart';

/// Returns true when [bytes] open as a PDF with [password] (or none).
bool pdfOpensWithPassword(List<int> bytes, {String? password}) {
  try {
    final doc = PdfDocument(inputBytes: bytes, password: password);
    doc.dispose();
    return true;
  } catch (_) {
    return false;
  }
}

bool pdfLooksEncrypted(List<int> bytes) {
  if (pdfOpensWithPassword(bytes)) return false;
  return true;
}
