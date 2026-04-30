import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/llm/llm_client.dart';
import '../../core/llm/llm_json.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/theme/app_theme.dart';
import 'context_planner_config.dart';

class ContextPlannerResult {
  const ContextPlannerResult({required this.contextMarkdown, required this.structured});

  final String contextMarkdown;
  final Map<String, Object?> structured;
}

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

class ContextPlannerPage extends StatefulWidget {
  const ContextPlannerPage({super.key, required this.model, required this.config});

  final AppModel model;
  final ContextPlannerConfig config;

  @override
  State<ContextPlannerPage> createState() => _ContextPlannerPageState();
}

class _ContextPlannerPageState extends State<ContextPlannerPage> with SingleTickerProviderStateMixin {
  final _llm = LlmClient();
  final _done = <_Answered>[];
  _Q? _current;

  bool _loading = true;
  String? _error;

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
You are a planning assistant inside a personal finance app. You must answer with ONE JSON object only (no markdown, no explanation outside the JSON).

Pick the next step:

1) Need another question (one at a time):
{"kind":"question","questionId":"stable_id","prompt":"Short clear question","choices":[{"id":"a","label":"..."}],"allowMultiple":true}

2) Already enough detail (existing note + answers are sufficient, or nothing important is missing):
{"kind":"done"}

Rules:
- If existingContextMarkdown together with the subject data already explains what a human needs, return {"kind":"done"} — do not ask for the sake of asking.
- One question per turn. 3–8 choices if allowMultiple is true; 2–6 if false.
- At most 6 questions in a row; if you would exceed that, return {"kind":"done"}.
- The user may answer with chips only, typed notes only, or both. qaHistory entries may include "freeText".
- contextLastUpdated is when the user last saved this note (ISO time) — use it to avoid re-asking what they recently confirmed.
''';

  static const _synthOrchestrator = '''
You help update a context note in a personal finance app. Reply with ONE JSON object only (no markdown fences, no extra text).

Shape:
{
  "contextMarkdown": "<full note>",
  "structured": {
    "summary": "<one short paragraph in plain language>",
    "warnings": ["optional strings"],
    "notes": "optional extra"
  }
}

Use the subject block, existingContextMarkdown, contextLastUpdated if present, and qaHistory. Merge new answers with the old note; keep useful old text unless it conflicts.
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
      if (hints.isNotEmpty) ...['---', 'Extra hints:', hints],
    ].join('\n');
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
      if (hints.isNotEmpty) ...['---', 'Extra hints:', hints],
    ].join('\n');
  }

  Future<void> _runPlanner() async {
    if (widget.config.isTargetMissing(widget.model)) {
      setState(() {
        _loading = false;
        _error = widget.config.missingTargetMessage;
      });
      return;
    }

    final provider = widget.model.activeLlmProvider;
    final key = widget.model.apiKeyFor(provider);
    if (key == null) {
      setState(() {
        _loading = false;
        _error = 'Add an API key in Settings → Permissions';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final userPayload = widget.config.buildPayload(widget.model, _qaHistory());

      final raw = await _llm.complete(
        provider: provider,
        apiKey: key,
        model: widget.model.modelFor(provider),
        system: _plannerSystem(),
        user: jsonEncode(userPayload),
        maxOutputTokens: 2048,
        preferJsonObjectOutput: provider == LlmProvider.openai,
      );

      final obj = decodeLlmJsonObject(raw);
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
          setState(() {
            _loading = false;
            _error = 'No options came back. Try again or pick another model.';
          });
          return;
        }
        _optionalNoteCtrl.clear();
        setState(() {
          _loading = false;
          _current = _Q(questionId: qid, prompt: prompt, choices: choices, allowMultiple: allowMulti);
          _selected.clear();
        });
        return;
      }
      setState(() {
        _loading = false;
        _error = 'Unexpected reply. Try again.';
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _runSynthesize() async {
    final provider = widget.model.activeLlmProvider;
    final key = widget.model.apiKeyFor(provider);
    if (key == null) {
      setState(() {
        _loading = false;
        _error = 'Add an API key in Settings → Permissions';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final userPayload = widget.config.buildPayload(widget.model, _qaHistory());

      final raw = await _llm.complete(
        provider: provider,
        apiKey: key,
        model: widget.model.modelFor(provider),
        system: _synthSystem(),
        user: jsonEncode(userPayload),
        maxOutputTokens: 8192,
        preferJsonObjectOutput: provider == LlmProvider.openai,
      );

      final obj = decodeLlmJsonObject(raw);
      final md = obj['contextMarkdown']?.toString().trim() ?? '';
      Map<String, Object?> structured = {};
      final s = obj['structured'];
      if (s is Map) {
        structured = Map<String, Object?>.from(s.map((k, v) => MapEntry(k.toString(), v)));
      }
      if (md.isEmpty) {
        setState(() {
          _loading = false;
          _error = 'Got an empty note. Try again.';
        });
        return;
      }

      setState(() => _loading = false);
      await _playSuccessAndPop(md, structured);
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _playSuccessAndPop(String md, Map<String, Object?> structured) async {
    setState(() {
      _success = true;
      _current = null;
    });
    _tickController.forward(from: 0);
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;
    Navigator.of(context).pop(ContextPlannerResult(contextMarkdown: md, structured: structured));
  }

  void _onContinue() {
    if (_current == null) return;
    final note = _optionalNoteCtrl.text.trim();
    if (_selected.isEmpty && note.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pick an option and/or add a note below'),
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
    final accent = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.config.title),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          _buildMainBody(context, accent),
          if (_success)
            ColoredBox(
              color: Colors.white.withValues(alpha: 0.92),
              child: Center(
                child: ScaleTransition(
                  scale: _tickScale,
                  child: Icon(
                    Icons.check_circle_rounded,
                    size: 96,
                    color: accent,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMainBody(BuildContext context, Color accent) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 16),
            FilledButton(onPressed: _runPlanner, child: const Text('Try again')),
          ],
        ),
      );
    }

    if (_current == null) {
      return const SizedBox.shrink();
    }

    final currentStepNum = _done.length + 1;
    final q = _current!;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Step $currentStepNum',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: AppTheme.slate600,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < _done.length; i++)
                InkWell(
                  onTap: () => _editStep(i),
                  borderRadius: BorderRadius.circular(20),
                  child: CircleAvatar(
                    radius: 18,
                    backgroundColor: accent.withValues(alpha: 0.15),
                    child: Text(
                      '${i + 1}',
                      style: TextStyle(color: accent, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              CircleAvatar(
                radius: 18,
                backgroundColor: accent,
                child: Text(
                  '$currentStepNum',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Tap a number to change an earlier answer.',
            style: TextStyle(color: AppTheme.slate500.withValues(alpha: 0.9), fontSize: 12),
          ),
          const SizedBox(height: 14),
          Text(q.prompt, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            q.allowMultiple ? 'Select all that fit' : 'Pick one',
            style: const TextStyle(color: AppTheme.slate600, fontSize: 13),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView(
              children: [
                for (final c in q.choices)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: FilterChip(
                      label: Text(c['label'] ?? ''),
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
          const SizedBox(height: 8),
          TextField(
            controller: _optionalNoteCtrl,
            minLines: 2,
            maxLines: 5,
            decoration: const InputDecoration(
              labelText: 'Add more (optional)',
              hintText: "Anything else to add…",
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(onPressed: _onContinue, child: const Text('Continue')),
        ],
      ),
    );
  }
}
