import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/llm/active_llm_completion.dart';
import '../../core/llm/prompt_context_budget.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/widgets/liquid_glass.dart';
import 'guided_mcq_config.dart';

class _Q {
  _Q({required this.questionId, required this.prompt, required this.choices, required this.allowMultiple});

  final String questionId;
  final String prompt;
  final List<Map<String, String>> choices;
  final bool allowMultiple;
}

class _Answered {
  _Answered({required this.q, required this.selectedIds, required this.freeText});

  final _Q q;
  final Set<String> selectedIds;
  final String freeText;
}

/// Reusable MCQ guide: one question at a time, optional free text, then synthesize.
class GuidedMcqPage extends StatefulWidget {
  const GuidedMcqPage({super.key, required this.model, required this.config});

  final AppModel model;
  final GuidedMcqConfig config;

  @override
  State<GuidedMcqPage> createState() => _GuidedMcqPageState();
}

class _GuidedMcqPageState extends State<GuidedMcqPage> with SingleTickerProviderStateMixin {
  final _done = <_Answered>[];
  _Q? _current;

  bool _loading = true;
  String? _error;
  bool _contextTrimmed = false;
  final _budgetService = PromptContextBudgetService();

  final _selected = <String>{};
  late final TextEditingController _optionalNoteCtrl;

  bool _success = false;
  late final AnimationController _tickController;
  late final Animation<double> _tickScale;

  @override
  void initState() {
    super.initState();
    _optionalNoteCtrl = TextEditingController();
    _tickController = AnimationController(vsync: this, duration: const Duration(milliseconds: 550));
    _tickScale = CurvedAnimation(parent: _tickController, curve: Curves.elasticOut);
    _runPlanner();
  }

  @override
  void dispose() {
    _optionalNoteCtrl.dispose();
    _tickController.dispose();
    super.dispose();
  }

  List<Map<String, Object?>> _qaHistory() {
    final out = <Map<String, Object?>>[];
    for (final s in _done) {
      final labels = <String>[];
      for (final c in s.q.choices) {
        if (s.selectedIds.contains(c['id'])) {
          labels.add(c['label'] ?? '');
        }
      }
      final m = <String, Object?>{
        'questionId': s.q.questionId,
        'prompt': s.q.prompt,
        'selectedIds': s.selectedIds.toList(),
        'selectedLabels': labels,
      };
      if (s.freeText.isNotEmpty) {
        m['freeText'] = s.freeText;
      }
      out.add(m);
    }
    return out;
  }

  static const _plannerOrchestrator = '''
You are a planning assistant inside a personal finance app. Reply with ONE JSON object only (no markdown outside JSON).

Next step — pick one:
{"kind":"question","questionId":"stable_id","prompt":"Short question","choices":[{"id":"a","label":"..."}],"allowMultiple":true}
{"kind":"done"}

Rules:
- If existing notes + subject data are enough, return {"kind":"done"}.
- One question per turn. 2–6 choices (single) or 3–8 (multi).
- Max 6 questions; then {"kind":"done"}.
- User may answer with chips, typed note, or both (qaHistory may include "freeText").
- Keep prompts short. No filler.
''';

  static const _synthOrchestrator = '''
You finish a guided session in a personal finance app. Reply with ONE JSON object only (no markdown fences).

Shape:
{
  "contextMarkdown": "<full note for the user>",
  "structured": { }
}

Merge subject data, existingContextMarkdown, and qaHistory. The structured block shape is defined by the user instructions below.
''';

  String _plannerSystem() {
    final def = internalAppAgentDefinitionById(widget.config.internalAgentId);
    final user = widget.model.internalAgentSystemPrompt(widget.config.internalAgentId).trim();
    final hints = def?.modelDomainHints.trim() ?? '';
    return [
      _plannerOrchestrator,
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  Future<String> _userPayloadJson(
    AppModel m, {
    required String system,
    required Map<String, Object?> payload,
  }) async {
    if (m.activeLlmProvider != LlmProvider.appleFoundation) {
      return jsonEncode(payload);
    }
    final prepared = await _budgetService.prepareUserPayload(system: system, payload: payload);
    if (prepared.trimmed) {
      _setStateIfMounted(() => _contextTrimmed = true);
    }
    return prepared.userJson;
  }

  String _synthSystem() {
    final def = internalAppAgentDefinitionById(widget.config.internalAgentId);
    final user = widget.model.internalAgentSystemPrompt(widget.config.internalAgentId).trim();
    final hints = def?.modelDomainHints.trim() ?? '';
    return [
      _synthOrchestrator,
      '---',
      'User instructions:',
      user,
      if (hints.isNotEmpty) ...['---', 'Hints:', hints],
    ].join('\n');
  }

  void _setStateIfMounted(VoidCallback fn) {
    if (!mounted) return;
    setState(fn);
  }

  Future<void> _runPlanner() async {
    final missing = widget.config.isTargetMissing;
    if (missing != null && missing(widget.model)) {
      _setStateIfMounted(() {
        _loading = false;
        _error = widget.config.missingTargetMessage;
      });
      return;
    }

    final m = widget.model;
    _setStateIfMounted(() {
      _loading = true;
      _error = null;
    });

    final ready = await m.prepareLlmForAssistant();
    if (!mounted) return;
    if (!ready) {
      _setStateIfMounted(() {
        _loading = false;
        _error = m.llmAssistantUnavailableMessage;
      });
      return;
    }

    try {
      final system = _plannerSystem();
      final payload = widget.config.buildPayload(m, _qaHistory());
      final user = await _userPayloadJson(m, system: system, payload: payload);
      if (!mounted) return;

      final raw = await completeForActiveProvider(
        m,
        system: system,
        user: user,
        maxOutputTokens: 2048,
        preferJsonObjectOutput: m.activeLlmProvider == LlmProvider.openai,
      );
      if (!mounted) return;

      final obj = await decodeActiveProviderJsonWithRepair(m, raw);
      if (!mounted) return;

      final kind = obj['kind']?.toString();
      if (kind == 'done') {
        await _runSynthesize();
        return;
      }
      if (kind == 'question') {
        final qid = obj['questionId']?.toString() ?? 'q';
        final prompt = obj['prompt']?.toString() ?? '';
        final am = obj['allowMultiple'];
        final allowMulti = am is bool ? am : true;
        final choicesRaw = obj['choices'];
        final choices = <Map<String, String>>[];
        if (choicesRaw is List) {
          for (final c in choicesRaw) {
            if (c is Map) {
              final id = c['id']?.toString() ?? '';
              final label = c['label']?.toString() ?? '';
              if (id.isNotEmpty && label.isNotEmpty) {
                choices.add({'id': id, 'label': label});
              }
            }
          }
        }
        if (choices.isEmpty) {
          _setStateIfMounted(() {
            _loading = false;
            _error = 'No options returned. Try again.';
          });
          return;
        }
        _optionalNoteCtrl.clear();
        _setStateIfMounted(() {
          _loading = false;
          _current = _Q(questionId: qid, prompt: prompt, choices: choices, allowMultiple: allowMulti);
          _selected.clear();
        });
        return;
      }
      _setStateIfMounted(() {
        _loading = false;
        _error = 'Unexpected reply. Try again.';
      });
    } catch (e) {
      if (!mounted) return;
      _setStateIfMounted(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _runSynthesize() async {
    final m = widget.model;
    _setStateIfMounted(() {
      _loading = true;
      _error = null;
    });

    final ready = await m.prepareLlmForAssistant();
    if (!mounted) return;
    if (!ready) {
      _setStateIfMounted(() {
        _loading = false;
        _error = m.llmAssistantUnavailableMessage;
      });
      return;
    }

    try {
      final system = _synthSystem();
      final payload = widget.config.buildPayload(m, _qaHistory());
      final user = await _userPayloadJson(m, system: system, payload: payload);
      if (!mounted) return;

      final raw = await completeForActiveProvider(
        m,
        system: system,
        user: user,
        maxOutputTokens: 8192,
        preferJsonObjectOutput: m.activeLlmProvider == LlmProvider.openai,
      );
      if (!mounted) return;

      final obj = await decodeActiveProviderJsonWithRepair(m, raw);
      if (!mounted) return;

      final md = obj['contextMarkdown']?.toString().trim() ?? '';
      Map<String, Object?> structured = {};
      final s = obj['structured'];
      if (s is Map) {
        structured = Map<String, Object?>.from(s.map((k, v) => MapEntry(k.toString(), v)));
      }
      if (md.isEmpty) {
        _setStateIfMounted(() {
          _loading = false;
          _error = 'Empty result. Try again.';
        });
        return;
      }

      _setStateIfMounted(() => _loading = false);
      if (!mounted) return;
      await _playSuccessAndPop(md, structured);
    } catch (e) {
      if (!mounted) return;
      _setStateIfMounted(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _playSuccessAndPop(String md, Map<String, Object?> structured) async {
    _setStateIfMounted(() {
      _success = true;
      _current = null;
    });
    _tickController.forward(from: 0);
    await Future<void>.delayed(const Duration(milliseconds: 1100));
    if (!mounted) return;
    widget.model.recordInternalAgentRun(widget.config.internalAgentId, structured);
    if (!mounted) return;
    Navigator.of(context).pop(GuidedMcqResult(contextMarkdown: md, structured: structured));
  }

  void _onContinue() {
    if (_current == null) return;
    final note = _optionalNoteCtrl.text.trim();
    if (_selected.isEmpty && note.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pick an option and/or add a note'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    _done.add(_Answered(
      q: _current!,
      selectedIds: Set<String>.from(_selected),
      freeText: note,
    ));
    setState(() {
      _current = null;
      _selected.clear();
      _optionalNoteCtrl.clear();
      _loading = true;
    });
    _runPlanner();
  }

  void _editStep(int index) {
    if (index < 0 || index >= _done.length) return;
    final step = _done[index];
    setState(() {
      _done.removeRange(index, _done.length);
      _current = step.q;
      _selected
        ..clear()
        ..addAll(step.selectedIds);
      _optionalNoteCtrl.text = step.freeText;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.model.accent;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.config.title, style: const TextStyle(fontWeight: FontWeight.w900)),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
      ),
      body: Stack(
        children: [
          _buildMainBody(context, accent, cs),
          if (_success)
            ColoredBox(
              color: cs.surface.withValues(alpha: 0.92),
              child: Center(
                child: ScaleTransition(
                  scale: _tickScale,
                  child: Icon(Icons.check_circle_rounded, size: 88, color: accent),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMainBody(BuildContext context, Color accent, ColorScheme cs) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_error!, style: TextStyle(color: cs.error)),
            const SizedBox(height: 16),
            FilledButton(onPressed: _runPlanner, child: const Text('Try again')),
          ],
        ),
      );
    }

    if (_current == null) return const SizedBox.shrink();

    final stepNum = _done.length + 1;
    final q = _current!;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_contextTrimmed) ...[
            Text(
              'Context trimmed for on-device model',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
          ],
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
                        child: Text('${i + 1}', style: TextStyle(color: accent, fontSize: 12, fontWeight: FontWeight.w900)),
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: CircleAvatar(
                    radius: 14,
                    backgroundColor: accent,
                    child: Text('$stepNum', style: TextStyle(color: cs.onPrimary, fontSize: 12, fontWeight: FontWeight.w900)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(q.prompt, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
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
                    child: FilterChip(
                      label: Text(c['label'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                      selected: _selected.contains(c['id']),
                      onSelected: (on) {
                        setState(() {
                          final id = c['id']!;
                          if (q.allowMultiple) {
                            if (on) {
                              _selected.add(id);
                            } else {
                              _selected.remove(id);
                            }
                          } else {
                            _selected.clear();
                            if (on) _selected.add(id);
                          }
                        });
                      },
                    ),
                  ),
              ],
            ),
          ),
          TextField(
            controller: _optionalNoteCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Optional',
              hintText: 'Add detail…',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: _onContinue, child: const Text('Continue')),
        ],
      ),
    );
  }
}
