import 'package:flutter/material.dart';
import 'package:sankey_flutter/sankey_painter.dart';

import '../../shared/theme/app_theme.dart';

String _sankeyNodeHeadLabel(String displayLabel) {
  final t = displayLabel.trim();
  if (t.isEmpty) return '';
  return t.split(RegExp(r'\s{2,}')).first.trim();
}

Color? _glassBaseColorForSinkHead(String head) {
  final h = head.toLowerCase();
  if (h == 'investments' || h == 'savings') return const Color(0xFF10B981);
  if (h == 'expenses') return const Color(0xFFEF4444);
  if (h == 'taxes') return const Color(0xFF94A3B8);
  return null;
}

/// Same as package [InteractiveSankeyPainter], but sink (right-column) labels use
/// grey on the light chart background instead of white (which matched the dark bar fill).
class ZoroInteractiveSankeyPainter extends SankeyPainter {
  ZoroInteractiveSankeyPainter({
    required super.nodes,
    required super.links,
    required this.nodeColors,
    this.selectedNodeId,
    super.showLabels = true,
    this.showTexture = true,
    super.nodeColor = Colors.blue,
    super.linkColor = Colors.grey,
  });

  final Map<String, Color> nodeColors;
  final int? selectedNodeId;
  final bool showTexture;

  Color blendColors(Color a, Color b) => Color.lerp(a, b, 0.5) ?? a;

  /// Apple-like translucent “glass” pill. Stronger stroke only when [isSelected].
  void _paintGlassNode(Canvas canvas, Rect rect, {required Color base, required bool isSelected}) {
    final r = RRect.fromRectAndRadius(rect, const Radius.circular(3));

    canvas.drawRRect(
      r,
      Paint()..color = base.withValues(alpha: 0.12),
    );

    final sheen = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Colors.white.withValues(alpha: 0.52),
        Colors.white.withValues(alpha: 0.10),
        base.withValues(alpha: 0.18),
      ],
      stops: const [0.0, 0.42, 1.0],
    );
    canvas.drawRRect(
      r,
      Paint()..shader = sheen.createShader(rect),
    );

    final specH = (rect.height * 0.28).clamp(1.0, 12.0);
    final spec = RRect.fromRectAndRadius(
      Rect.fromLTWH(rect.left + 1.5, rect.top + 1.5, rect.width - 3, specH),
      const Radius.circular(2),
    );
    canvas.drawRRect(
      spec,
      Paint()..color = Colors.white.withValues(alpha: 0.35),
    );

    if (isSelected) {
      canvas.drawRRect(
        r,
        Paint()
          ..color = base
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.5,
      );
    } else {
      canvas.drawRRect(
        r.deflate(0.5),
        Paint()
          ..color = Colors.white.withValues(alpha: 0.55)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (final link in links) {
      final source = link.source;
      final target = link.target;

      var sourceColor = nodeColors[source.displayLabel] ?? Colors.blue;
      var targetColor = nodeColors[target.displayLabel] ?? Colors.blue;

      final isConnected = (selectedNodeId != null) &&
          (source.id == selectedNodeId || target.id == selectedNodeId);
      sourceColor = sourceColor.withAlpha(isConnected ? 225 : 80);
      targetColor = targetColor.withAlpha(isConnected ? 225 : 80);

      final gradient = LinearGradient(
        colors: [sourceColor, targetColor],
        stops: const [0.2, 0.8],
      );

      final linkPaint = Paint()
        ..shader = gradient.createShader(
          Rect.fromLTWH(source.right, source.bottom, target.left - source.right, target.top - source.bottom),
        )
        ..style = PaintingStyle.stroke
        ..strokeWidth = link.width;

      var path = Path();
      final xMid = (source.right + target.left) / 2;
      path.moveTo(source.right, link.ySourceStart);
      path.cubicTo(xMid, link.ySourceStart, xMid, link.yTargetEnd, target.left, link.yTargetEnd);
      canvas.drawPath(path, linkPaint);

      if (showTexture) {
        final texturePaint = Paint()
          ..color = Colors.white30
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1;
        for (var i = link.width / -2; i < link.width; i = i + 10) {
          path = Path();
          path.moveTo(source.right, link.ySourceStart + i);
          path.cubicTo(xMid, link.ySourceStart + i, xMid, link.yTargetEnd + i, target.left, link.yTargetEnd + i);
          canvas.drawPath(path, texturePaint);
        }
      }
    }

    for (final node in nodes) {
      final color = nodeColors[node.displayLabel] ?? Colors.blue;
      final rect = Rect.fromLTWH(node.left, node.top, node.right - node.left, node.bottom - node.top);
      final isSelected = selectedNodeId != null && node.id == selectedNodeId;
      final head = _sankeyNodeHeadLabel(node.displayLabel);
      final glassBase = _glassBaseColorForSinkHead(head);
      final isGlass = glassBase != null;

      if (isGlass) {
        _paintGlassNode(canvas, rect, base: glassBase, isSelected: isSelected);
      } else {
        canvas.drawRect(rect, Paint()..color = color);

        if (isSelected) {
          final hsl = HSLColor.fromColor(color);
          final contrast = hsl.withHue(hsl.hue > 180 ? hsl.hue - 180 : hsl.hue + 180);
          final borderPaint = Paint()
            ..color = contrast.toColor()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 4;
          canvas.drawRect(rect, borderPaint);
        } else {
          final borderPaint = Paint()
            ..color = Colors.white24
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2;
          canvas.drawRect(rect.deflate(2), borderPaint);
        }
      }

      if (showLabels) {
        final cx = (node.left + node.right) / 2;
        final isRightColumn = cx > size.width * 0.56;

        final Color textColor;
        if (isRightColumn) {
          textColor = isSelected ? AppTheme.slate900 : AppTheme.slate600;
        } else {
          final fillForContrast = isGlass ? glassBase : color;
          final isDark = fillForContrast.computeLuminance() < 0.05;
          textColor = isDark ? Colors.white : Colors.black;
        }

        final textSpan = TextSpan(
          text: node.displayLabel,
          style: TextStyle(
            color: textColor,
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        );

        final textPainter = TextPainter(
          text: textSpan,
          textDirection: TextDirection.ltr,
          maxLines: 1,
        );
        textPainter.layout(minWidth: 0, maxWidth: size.width);

        const margin = 6.0;
        final labelY = rect.top + (rect.height - textPainter.height) / 2;
        final labelOffsetRight = Offset(rect.right + margin, labelY);
        final labelOffsetLeft = Offset(rect.left - margin - textPainter.width, labelY);

        final labelOffset = (rect.right + margin + textPainter.width <= size.width)
            ? labelOffsetRight
            : (rect.left - margin - textPainter.width >= 0)
                ? labelOffsetLeft
                : labelOffsetRight;

        textPainter.paint(canvas, labelOffset);
      }
    }
  }

  @override
  bool shouldRepaint(covariant ZoroInteractiveSankeyPainter oldDelegate) {
    return oldDelegate.selectedNodeId != selectedNodeId ||
        oldDelegate.showLabels != showLabels ||
        oldDelegate.showTexture != showTexture ||
        oldDelegate.nodeColors != nodeColors ||
        super.shouldRepaint(oldDelegate);
  }
}
