import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:url_launcher/url_launcher.dart';

/// Read-only markdown tuned for context notes (assets, liabilities, months, etc.).
class ContextMarkdownView extends StatelessWidget {
  const ContextMarkdownView({super.key, required this.markdown});

  final String markdown;

  static MarkdownStyleSheet _styleSheet(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final tt = theme.textTheme;
    final base = MarkdownStyleSheet.fromTheme(theme);
    return base.copyWith(
      p: tt.bodyLarge?.copyWith(height: 1.55, color: cs.onSurface),
      pPadding: const EdgeInsets.only(bottom: 10),
      h1: tt.headlineSmall?.copyWith(
        fontWeight: FontWeight.w900,
        color: cs.onSurface,
      ),
      h1Padding: const EdgeInsets.only(top: 8, bottom: 8),
      h2: tt.titleLarge?.copyWith(
        fontWeight: FontWeight.w800,
        color: cs.onSurface,
      ),
      h2Padding: const EdgeInsets.only(top: 16, bottom: 8),
      h3: tt.titleMedium?.copyWith(
        fontWeight: FontWeight.w800,
        color: cs.onSurface,
      ),
      h3Padding: const EdgeInsets.only(top: 12, bottom: 6),
      h4: tt.titleSmall?.copyWith(
        fontWeight: FontWeight.w800,
        color: cs.onSurface,
      ),
      listBullet: tt.bodyLarge?.copyWith(color: cs.onSurface),
      listIndent: 24,
      blockSpacing: 8,
      code: TextStyle(
        fontFamily: 'monospace',
        fontSize: 13,
        height: 1.4,
        color: cs.onSurface,
        backgroundColor: cs.surfaceContainerHighest.withValues(alpha: 0.85),
      ),
      codeblockDecoration: BoxDecoration(
        color: cs.surfaceContainerHighest.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      codeblockPadding: const EdgeInsets.all(12),
      blockquote: tt.bodyMedium?.copyWith(
        height: 1.5,
        color: cs.onSurfaceVariant,
        fontStyle: FontStyle.italic,
      ),
      blockquoteDecoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: cs.primary.withValues(alpha: 0.75), width: 4),
        ),
      ),
      blockquotePadding: const EdgeInsets.only(left: 12, top: 4, bottom: 4),
      a: TextStyle(
        color: cs.primary,
        fontWeight: FontWeight.w700,
        decoration: TextDecoration.underline,
        decorationColor: cs.primary,
      ),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: cs.outlineVariant.withValues(alpha: 0.6)),
        ),
      ),
    );
  }

  static Future<void> _openLink(String? href) async {
    if (href == null || href.isEmpty) return;
    final uri = Uri.tryParse(href);
    if (uri == null) return;
    if (!await canLaunchUrl(uri)) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return MarkdownBody(
      data: markdown,
      selectable: true,
      styleSheet: _styleSheet(context),
      onTapLink: (text, href, title) => _openLink(href),
    );
  }
}
