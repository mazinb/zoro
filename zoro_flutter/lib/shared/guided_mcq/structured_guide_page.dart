import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../shared/widgets/liquid_glass.dart';

class StructuredGuideChoice {
  const StructuredGuideChoice({required this.id, required this.label});

  final String id;
  final String label;
}

enum StructuredGuideStepKind { choice, numeric }

class StructuredGuideStep {
  const StructuredGuideStep({
    required this.id,
    required this.prompt,
    this.choices = const [],
    this.allowMultiple = false,
    this.hint,
    this.kind = StructuredGuideStepKind.choice,
    this.numericInitial,
    this.numericSuffix,
    this.numericMin,
    this.numericMax,
    this.bullets,
  });

  final String id;
  final String prompt;
  final List<StructuredGuideChoice> choices;
  final bool allowMultiple;
  final String? hint;
  final StructuredGuideStepKind kind;
  final double? numericInitial;
  final String? numericSuffix;
  final double? numericMin;
  final double? numericMax;
  final List<String>? bullets;
}

class StructuredGuideAnswer {
  const StructuredGuideAnswer({required this.questionId, required this.selectedIds});

  final String questionId;
  final Set<String> selectedIds;
}

class StructuredGuideResult {
  const StructuredGuideResult({required this.answers, this.optionalNote = ''});

  final List<StructuredGuideAnswer> answers;
  final String optionalNote;

  Set<String>? selectedFor(String questionId) {
    for (final a in answers) {
      if (a.questionId == questionId) return a.selectedIds;
    }
    return null;
  }

  String? singleFor(String questionId) {
    final s = selectedFor(questionId);
    if (s == null || s.isEmpty) return null;
    return s.first;
  }

  double? numericFor(String questionId) {
    final raw = singleFor(questionId);
    if (raw == null) return null;
    if (raw.startsWith('num:')) {
      return double.tryParse(raw.substring(4));
    }
    return double.tryParse(raw);
  }
}

/// Fixed-question guide (no LLM planner). Optional note is returned for caller-side LLM synth.
class StructuredGuidePage extends StatefulWidget {
  const StructuredGuidePage({
    super.key,
    required this.title,
    required this.steps,
    this.optionalNoteHint = 'Add detail for the assistant (optional)',
    this.previewLines,
    this.stepCountLabel,
  });

  final String title;
  final List<StructuredGuideStep> steps;
  final String optionalNoteHint;
  final List<String> Function(StructuredGuideResult partial)? previewLines;
  final String? stepCountLabel;

  @override
  State<StructuredGuidePage> createState() => _StructuredGuidePageState();
}

class _StructuredGuidePageState extends State<StructuredGuidePage> {
  final _optionalNoteCtrl = TextEditingController();
  final Map<String, TextEditingController> _numericCtrls = {};
  final List<StructuredGuideAnswer> _done = [];
  int _stepIndex = 0;
  final Set<String> _selected = {};

  StructuredGuideStep? get _current =>
      _stepIndex < widget.steps.length ? widget.steps[_stepIndex] : null;

  StructuredGuideResult get _partialResult => StructuredGuideResult(
        answers: List<StructuredGuideAnswer>.from(_done),
        optionalNote: _optionalNoteCtrl.text.trim(),
      );

  @override
  void dispose() {
    _optionalNoteCtrl.dispose();
    for (final c in _numericCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _numericController(StructuredGuideStep step) {
    return _numericCtrls.putIfAbsent(
      step.id,
      () => TextEditingController(
        text: step.numericInitial != null
            ? _formatNumeric(step.numericInitial!)
            : '',
      ),
    );
  }

  static String _formatNumeric(double v) {
    if (v == v.roundToDouble()) return v.round().toString();
    return v.toStringAsFixed(1);
  }

  bool _canContinue(StructuredGuideStep q) {
    if (q.kind == StructuredGuideStepKind.numeric) {
      final v = double.tryParse(_numericController(q).text.trim());
      if (v == null) return false;
      if (q.numericMin != null && v < q.numericMin!) return false;
      if (q.numericMax != null && v > q.numericMax!) return false;
      return true;
    }
    return _selected.isNotEmpty;
  }

  void _onContinue() {
    final q = _current;
    if (q == null || !_canContinue(q)) return;

    setState(() {
      if (q.kind == StructuredGuideStepKind.numeric) {
        final v = double.parse(_numericController(q).text.trim());
        _done.add(StructuredGuideAnswer(
          questionId: q.id,
          selectedIds: {'num:$v'},
        ));
      } else {
        _done.add(StructuredGuideAnswer(questionId: q.id, selectedIds: Set<String>.from(_selected)));
        _selected.clear();
      }
      _stepIndex++;
    });
  }

  void _finish() {
    final note = _optionalNoteCtrl.text.trim();
    Navigator.of(context).pop(
      StructuredGuideResult(answers: List<StructuredGuideAnswer>.from(_done), optionalNote: note),
    );
  }

  void _editStep(int i) {
    setState(() {
      _stepIndex = i;
      final step = widget.steps[i];
      _selected
        ..clear()
        ..addAll(_done[i].selectedIds);
      if (step.kind == StructuredGuideStepKind.choice) {
        _selected.removeWhere((id) => id.startsWith('num:'));
      }
      _done.removeRange(i, _done.length);
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final accent = Theme.of(context).colorScheme.primary;
    final onLast = _current == null;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(widget.title, style: const TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              cs.surface,
              cs.primary.withValues(alpha: 0.06),
            ],
          ),
        ),
        child: SafeArea(
          child: onLast ? _buildNoteStep(context, accent, cs) : _buildQuestionStep(context, accent, cs),
        ),
      ),
    );
  }

  Widget _buildStepBar(BuildContext context, Color accent, ColorScheme cs, int stepNum) {
    if (widget.steps.length <= 1) return const SizedBox.shrink();

    return LiquidGlassPanel(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Text(
            widget.stepCountLabel ?? 'Step $stepNum of ${widget.steps.length}',
            style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurfaceVariant),
          ),
          const Spacer(),
          for (var i = 0; i < _done.length; i++)
            Padding(
              padding: const EdgeInsets.only(left: 6),
              child: InkWell(
                onTap: () => _editStep(i),
                borderRadius: BorderRadius.circular(16),
                child: CircleAvatar(
                  radius: 14,
                  backgroundColor: accent.withValues(alpha: 0.15),
                  child: Text(
                    '${i + 1}',
                    style: TextStyle(color: accent, fontSize: 12, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(left: 6),
            child: CircleAvatar(
              radius: 14,
              backgroundColor: accent,
              child: Text(
                '$stepNum',
                style: TextStyle(color: cs.onPrimary, fontSize: 12, fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionStep(BuildContext context, Color accent, ColorScheme cs) {
    final q = _current!;
    final stepNum = _done.length + 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildStepBar(context, accent, cs, stepNum),
          if (widget.steps.length > 1) const SizedBox(height: 14),
          Text(q.prompt, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
          if (q.hint != null) ...[
            const SizedBox(height: 6),
            Text(q.hint!, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
          if (q.bullets != null && q.bullets!.isNotEmpty) ...[
            const SizedBox(height: 8),
            for (final b in q.bullets!)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('• ', style: TextStyle(color: cs.onSurfaceVariant, fontWeight: FontWeight.w800)),
                    Expanded(
                      child: Text(
                        b,
                        style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w600, height: 1.35),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          const SizedBox(height: 6),
          if (q.kind == StructuredGuideStepKind.choice)
            Text(
              q.allowMultiple ? 'Select all that apply' : 'Pick one',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          const SizedBox(height: 12),
          Expanded(
            child: q.kind == StructuredGuideStepKind.numeric
                ? _buildNumericStep(context, q, accent, cs)
                : ListView(
                    children: [
                      for (final c in q.choices)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _GlassChoiceTile(
                            label: c.label,
                            selected: _selected.contains(c.id),
                            accent: accent,
                            onTap: () {
                              setState(() {
                                if (q.allowMultiple) {
                                  if (_selected.contains(c.id)) {
                                    _selected.remove(c.id);
                                  } else {
                                    _selected.add(c.id);
                                  }
                                } else {
                                  _selected
                                    ..clear()
                                    ..add(c.id);
                                }
                              });
                            },
                          ),
                        ),
                    ],
                  ),
          ),
          FilledButton(
            onPressed: _canContinue(q) ? _onContinue : null,
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Widget _buildNumericStep(BuildContext context, StructuredGuideStep q, Color accent, ColorScheme cs) {
    final ctrl = _numericController(q);
    return ListView(
      children: [
        LiquidGlassPanel(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: TextField(
            controller: ctrl,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22),
            decoration: InputDecoration(
              border: InputBorder.none,
              suffixText: q.numericSuffix,
              suffixStyle: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurfaceVariant),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }

  Widget _buildNoteStep(BuildContext context, Color accent, ColorScheme cs) {
    final preview = widget.previewLines?.call(_partialResult) ?? const <String>[];

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (preview.isNotEmpty) ...[
            LiquidGlassPanel(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Preview',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  for (final line in preview)
                    if (line.trim().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          line,
                          style: const TextStyle(fontWeight: FontWeight.w700, height: 1.35),
                        ),
                      ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          LiquidGlassPanel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: TextField(
              controller: _optionalNoteCtrl,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: 'Optional note',
                hintText: widget.optionalNoteHint,
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
          const Spacer(),
          FilledButton(onPressed: _finish, child: const Text('Apply')),
        ],
      ),
    );
  }
}

class _GlassChoiceTile extends StatelessWidget {
  const _GlassChoiceTile({
    required this.label,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: LiquidGlassPanel(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(
                selected ? Icons.check_circle : Icons.circle_outlined,
                color: selected ? accent : cs.onSurfaceVariant,
                size: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: cs.onSurface)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
