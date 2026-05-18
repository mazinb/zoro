import 'package:flutter/material.dart';

/// Temporary full-screen JSON preview (export / import).
void showDataJsonViewer(
  BuildContext context, {
  required String title,
  required String jsonText,
  String? subtitle,
}) {
  Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (ctx) => _DataJsonViewerPage(
        title: title,
        jsonText: jsonText,
        subtitle: subtitle,
      ),
    ),
  );
}

class _DataJsonViewerPage extends StatelessWidget {
  const _DataJsonViewerPage({
    required this.title,
    required this.jsonText,
    this.subtitle,
  });

  final String title;
  final String jsonText;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Text(
                subtitle!,
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '${jsonText.length} chars',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
            ),
          ),
          Expanded(
            child: Scrollbar(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: SelectableText(
                  jsonText,
                  style: TextStyle(
                    fontFamily: 'Menlo',
                    fontSize: 12,
                    height: 1.4,
                    color: cs.onSurface,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
