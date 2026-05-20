import 'package:flutter/material.dart';

import '../../shared/widgets/liquid_glass.dart';

class StructuredGuideChoice {
  const StructuredGuideChoice({required this.id, required this.label});

  final String id;
  final String label;
}

class StructuredGuideStep {
  const StructuredGuideStep({
    required this.id,
    required this.prompt,
    required this.choices,
    this.allowMultiple = false,
    this.hint,
  });

  final String id;
  final String prompt;
  final List<StructuredGuideChoice> choices;
  final bool allowMultiple;
  final String? hint;
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
}

/// Fixed-question guide (no LLM planner). Optional note is returned for caller-side LLM synth.
class StructuredGuidePage extends StatefulWidget {
  const StructuredGuidePage({
    super.key,
    required this.title,
    required this.steps,
    this.optionalNoteHint = 'Add detail for the assistant (optional)',
  });

  final String title;
  final List<StructuredGuideStep> steps;
  final String optionalNoteHint;

  @override
  State<StructuredGuidePage> createState() => _StructuredGuidePageState();
}

class _StructuredGuidePageState extends State<StructuredGuidePage> {
  final _optionalNoteCtrl = TextEditingController();
  final List<StructuredGuideAnswer> _done = [];
  int _stepIndex = 0;
  final Set<String> _selected = {};

  StructuredGuideStep? get _current =>
      _stepIndex < widget.steps.length ? widget.steps[_stepIndex] : null;

  @override
  void dispose() {
    _optionalNoteCtrl.dispose();
    super.dispose();
  }

  void _onContinue() {
    final q = _current;
    if (q == null) return;
    if (_selected.isEmpty) return;

    setState(() {
      _done.add(StructuredGuideAnswer(questionId: q.id, selectedIds: Set<String>.from(_selected)));
      _selected.clear();
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
      _selected
        ..clear()
        ..addAll(_done[i].selectedIds);
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

  Widget _buildQuestionStep(BuildContext context, Color accent, ColorScheme cs) {
    final q = _current!;
    final stepNum = _done.length + 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LiquidGlassPanel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Text('Step $stepNum', style: TextStyle(fontWeight: FontWeight.w900, color: cs.onSurfaceVariant)),
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
          ),
          const SizedBox(height: 14),
          Text(q.prompt, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
          if (q.hint != null) ...[
            const SizedBox(height: 6),
            Text(q.hint!, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 6),
          Text(
            q.allowMultiple ? 'Select all that apply' : 'Pick one',
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView(
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
            onPressed: _selected.isEmpty ? null : _onContinue,
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Widget _buildNoteStep(BuildContext context, Color accent, ColorScheme cs) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LiquidGlassPanel(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ready to apply', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(
                  'Your choices are saved. Add a note only if you want the assistant to refine the result.',
                  style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13, height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          LiquidGlassPanel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: TextField(
              controller: _optionalNoteCtrl,
              minLines: 3,
              maxLines: 5,
              decoration: InputDecoration(
                labelText: 'Optional',
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
