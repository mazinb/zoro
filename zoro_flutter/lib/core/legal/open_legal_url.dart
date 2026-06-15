import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens [url] in the system browser. Works on Android 11+ with manifest queries.
Future<bool> openExternalUrl(String url, {BuildContext? context}) async {
  final uri = Uri.tryParse(url.trim());
  if (uri == null) {
    _showFailure(context, 'Invalid link');
    return false;
  }
  try {
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (launched) return true;
    final fallback = await launchUrl(uri, mode: LaunchMode.platformDefault);
    if (fallback) return true;
  } catch (_) {}
  if (context != null && context.mounted) {
    _showFailure(context, 'Could not open link');
  }
  return false;
}

void _showFailure(BuildContext? context, String message) {
  if (context == null || !context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
  );
}
