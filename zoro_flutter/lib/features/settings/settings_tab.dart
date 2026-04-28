import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/state/app_model.dart';
import '../../dev/local_api_keys.dart';
import '../../shared/theme/app_theme.dart';

abstract class SettingsTabIndex {
  static const int reminders = 0;
  static const int agents = 1;
  static const int apiKeys = 2;
  // Back-compat for older callers.
  static const int permissions = apiKeys;
}

class SettingsTab extends StatefulWidget {
  const SettingsTab({super.key, required this.model, required this.tabIndexListenable});

  final AppModel model;
  final ValueListenable<int> tabIndexListenable;

  @override
  State<SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends State<SettingsTab> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this, initialIndex: widget.tabIndexListenable.value.clamp(0, 2));
    widget.tabIndexListenable.addListener(_onTabIndexRequested);
  }

  @override
  void didUpdateWidget(covariant SettingsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.tabIndexListenable != widget.tabIndexListenable) {
      oldWidget.tabIndexListenable.removeListener(_onTabIndexRequested);
      widget.tabIndexListenable.addListener(_onTabIndexRequested);
      _onTabIndexRequested();
    }
  }

  @override
  void dispose() {
    widget.tabIndexListenable.removeListener(_onTabIndexRequested);
    _tabs.dispose();
    super.dispose();
  }

  void _onTabIndexRequested() {
    final target = widget.tabIndexListenable.value.clamp(0, 2);
    if (_tabs.index == target) return;
    _tabs.animateTo(target);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(
            children: [
              Text(
                'Settings',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TabBar(
            controller: _tabs,
            labelStyle: const TextStyle(fontWeight: FontWeight.w900),
            tabs: const [
              Tab(text: 'Reminders'),
              Tab(text: 'Agents'),
              Tab(text: 'API keys'),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              _RemindersPane(model: widget.model),
              _AgentsPane(model: widget.model),
              _ApiKeysPane(model: widget.model),
            ],
          ),
        ),
      ],
    );
  }
}

class _RemindersPane extends StatelessWidget {
  const _RemindersPane({required this.model});

  final AppModel model;

  static int _daysInMonth(int year, int month) => DateTime(year, month + 1, 0).day;

  static String _monthName(int m) {
    const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[m];
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final yearlyDayMax = _daysInMonth(now.year, model.remindersYearlyMonth);
    final safeYearlyDay = model.remindersYearlyDay.clamp(1, yearlyDayMax);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _CadenceRow(
                  label: 'Expenses',
                  value: model.remindersExpensesCadence,
                  onChanged: model.setReminderCadenceExpenses,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Cash flow',
                  value: model.remindersCashflowCadence,
                  onChanged: model.setReminderCadenceCashflow,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Income',
                  value: model.remindersIncomeCadence,
                  onChanged: model.setReminderCadenceIncome,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Assets',
                  value: model.remindersAssetsCadence,
                  onChanged: model.setReminderCadenceAssets,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Liabilities',
                  value: model.remindersLiabilitiesCadence,
                  onChanged: model.setReminderCadenceLiabilities,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Monthly',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    DropdownButton<int>(
                      value: model.remindersMonthlyDayOfMonth.clamp(1, 28),
                      items: [for (var d = 1; d <= 28; d++) DropdownMenuItem(value: d, child: Text('Day $d'))],
                      onChanged: (v) {
                        if (v == null) return;
                        model.setRemindersMonthlyDayOfMonth(v);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Expanded(
                      child: Text('Quarterly', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                    DropdownButton<int>(
                      value: model.remindersQuarterMonthInQuarter.clamp(1, 3),
                      items: const [
                        DropdownMenuItem(value: 1, child: Text('First')),
                        DropdownMenuItem(value: 2, child: Text('Second')),
                        DropdownMenuItem(value: 3, child: Text('Third')),
                      ],
                      onChanged: (m) {
                        if (m == null) return;
                        model.setRemindersQuarterlySchedule(monthInQuarter: m, day: 1);
                      },
                    ),
                    const SizedBox(width: 10),
                    DropdownButton<int>(
                      value: 1,
                      items: [for (var d = 1; d <= 28; d++) DropdownMenuItem(value: d, child: Text(d.toString()))],
                      onChanged: (d) {
                        if (d == null) return;
                        model.setRemindersQuarterlySchedule(monthInQuarter: model.remindersQuarterMonthInQuarter, day: d);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Yearly',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                    DropdownButton<int>(
                      value: model.remindersYearlyMonth.clamp(1, 12),
                      items: [
                        for (var m = 1; m <= 12; m++)
                          DropdownMenuItem(
                            value: m,
                            child: Text(_monthName(m)),
                          ),
                      ],
                      onChanged: (m) {
                        if (m == null) return;
                        final maxDay = _daysInMonth(now.year, m);
                        final nextDay = safeYearlyDay.clamp(1, maxDay);
                        model.setRemindersYearlyDate(month: m, day: nextDay);
                      },
                    ),
                    const SizedBox(width: 10),
                    DropdownButton<int>(
                      value: safeYearlyDay,
                      items: [
                        for (var d = 1; d <= yearlyDayMax; d++)
                          DropdownMenuItem(
                            value: d,
                            child: Text(d.toString()),
                          ),
                      ],
                      onChanged: (d) {
                        if (d == null) return;
                        model.setRemindersYearlyDate(month: model.remindersYearlyMonth, day: d);
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const SizedBox.shrink(),
      ],
    );
  }
}

class _AgentsPane extends StatefulWidget {
  const _AgentsPane({required this.model});

  final AppModel model;

  @override
  State<_AgentsPane> createState() => _AgentsPaneState();
}

class _AgentsPaneState extends State<_AgentsPane> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.model;
    final q = _query.trim().toLowerCase();
    final filtered = q.isEmpty
        ? model.agents
        : model.agents.where((a) {
            final hay = '${a.name}\n${a.description}\n${a.systemPrompt}\n${a.contextMarkdown}'.toLowerCase();
            return hay.contains(q);
          }).toList();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _searchCtrl,
                decoration: const InputDecoration(
                  hintText: 'Search',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            const SizedBox(width: 10),
            FilledButton.icon(
              onPressed: () => _openAgentEditor(context),
              icon: const Icon(Icons.add),
              label: const Text('Create'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...filtered.asMap().entries.map((e) {
          final i = e.key;
          final a = e.value;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _openAgentEditor(context, index: i),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(a.name, style: const TextStyle(fontWeight: FontWeight.w900)),
                            const SizedBox(height: 2),
                            Text(a.description, style: const TextStyle(color: AppTheme.slate600)),
                            const SizedBox(height: 6),
                            Text(
                              'Permissions: ${a.permissions.isEmpty ? 'none' : a.permissions.length}',
                              style: const TextStyle(color: AppTheme.slate500, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: AppTheme.slate500),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Future<void> _openAgentEditor(BuildContext context, {int? index}) async {
    final model = widget.model;
    final isNew = index == null;
    final draft = isNew
        ? AppAgent(
            id: 'agent-${DateTime.now().microsecondsSinceEpoch}',
            name: '',
            description: '',
            systemPrompt: '',
            permissions: const [],
            contextMarkdown: '',
          )
        : model.agents[index].clone();

    final outcome = await showModalBottomSheet<_AgentEditorOutcome>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _AgentEditorSheet(model: model, draft: draft, canDelete: !isNew),
    );
    if (!context.mounted || outcome == null) return;
    if (outcome.delete && index != null) {
      model.removeAgentAt(index);
      return;
    }
    final next = outcome.agent;
    if (next == null) return;
    if (isNew) {
      model.addAgent(next);
    } else {
      model.updateAgent(index, next);
    }
  }
}

class _ApiKeysPane extends StatefulWidget {
  const _ApiKeysPane({required this.model});

  final AppModel model;

  @override
  State<_ApiKeysPane> createState() => _ApiKeysPaneState();
}

class _ApiKeysPaneState extends State<_ApiKeysPane> {
  late final TextEditingController _openAiCtrl;
  late final TextEditingController _anthropicCtrl;
  late final TextEditingController _geminiCtrl;
  bool _didAutofill = false;
  bool _revealOpenAi = false;
  bool _revealAnthropic = false;
  bool _revealGemini = false;

  late final TextEditingController _openAiModelCtrl;
  late final TextEditingController _anthropicModelCtrl;
  late final TextEditingController _geminiModelCtrl;

  static const _openAiModelOptions = <String>[
    'gpt-4.1-mini',
    'gpt-4.1',
    'gpt-4.1-nano',
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-5.5',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
  ];

  static const _anthropicModelOptions = <String>[
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-opus-4-7',
    'claude-sonnet-4-5',
  ];

  static const _geminiModelOptions = <String>[
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
  ];

  @override
  void initState() {
    super.initState();
    final m = widget.model;

    final openAi = (m.openAiApiKey ?? '').trim();
    final anthropic = (m.anthropicApiKey ?? '').trim();
    final gemini = (m.geminiApiKey ?? '').trim();

    final shouldPrefill = kDebugMode;
    final looksLikeOpenAiKey = openAi.startsWith('sk-');
    final nextOpenAi = ((!looksLikeOpenAiKey || openAi.isEmpty) && shouldPrefill) ? LocalApiKeys.openAiApiKey : openAi;
    final nextGemini = (gemini.isEmpty && shouldPrefill) ? LocalApiKeys.geminiApiKey : gemini;

    _openAiCtrl = TextEditingController(text: nextOpenAi);
    _anthropicCtrl = TextEditingController(text: anthropic);
    _geminiCtrl = TextEditingController(text: nextGemini);

    _openAiModelCtrl = TextEditingController(text: m.openAiModel);
    _anthropicModelCtrl = TextEditingController(text: m.anthropicModel);
    _geminiModelCtrl = TextEditingController(text: m.geminiModel);

    _maybeAutofill();

    // Normalize model selections to dropdown options in debug builds.
    if (kDebugMode) {
      if (!_openAiModelOptions.contains(_openAiModelCtrl.text.trim())) {
        final next = _openAiModelOptions.first;
        _openAiModelCtrl.text = next;
        m.setModelFor(LlmProvider.openai, next);
      }
      if (!_anthropicModelOptions.contains(_anthropicModelCtrl.text.trim())) {
        final next = _anthropicModelOptions.first;
        _anthropicModelCtrl.text = next;
        m.setModelFor(LlmProvider.anthropic, next);
      }
      if (!_geminiModelOptions.contains(_geminiModelCtrl.text.trim())) {
        final next = _geminiModelOptions.first;
        _geminiModelCtrl.text = next;
        m.setModelFor(LlmProvider.gemini, next);
      }
    }
  }

  void _maybeAutofill() {
    if (_didAutofill) return;
    if (!kDebugMode) return;

    final m = widget.model;
    final openAiExisting = (m.openAiApiKey ?? '').trim();
    final geminiExisting = (m.geminiApiKey ?? '').trim();

    final openAiKey = LocalApiKeys.openAiApiKey.trim();
    final geminiKey = LocalApiKeys.geminiApiKey.trim();

    var changed = false;
    final openAiLooksValid = openAiExisting.startsWith('sk-');
    if ((!openAiLooksValid || _openAiCtrl.text.trim().isEmpty) && openAiKey.isNotEmpty) {
      _openAiCtrl.text = openAiKey;
      _openAiCtrl.selection = TextSelection.collapsed(offset: _openAiCtrl.text.length);
      changed = true;
    }
    if (_geminiCtrl.text.trim().isEmpty && geminiKey.isNotEmpty) {
      _geminiCtrl.text = geminiKey;
      _geminiCtrl.selection = TextSelection.collapsed(offset: _geminiCtrl.text.length);
      changed = true;
    }

    // Persist the prefill so other screens can use it immediately.
    if ((!openAiLooksValid || openAiExisting.isEmpty) && _openAiCtrl.text.trim().isNotEmpty) {
      m.setApiKey(provider: LlmProvider.openai, key: _openAiCtrl.text.trim());
    }
    if (geminiExisting.isEmpty && _geminiCtrl.text.trim().isNotEmpty) {
      m.setApiKey(provider: LlmProvider.gemini, key: _geminiCtrl.text.trim());
    }

    _didAutofill = true;
    if (changed && mounted) setState(() {});
  }

  @override
  void reassemble() {
    super.reassemble();
    // Hot reload keeps State; reapply debug autofill.
    _didAutofill = false;
    _maybeAutofill();
  }

  @override
  void dispose() {
    _openAiCtrl.dispose();
    _anthropicCtrl.dispose();
    _geminiCtrl.dispose();
    _openAiModelCtrl.dispose();
    _anthropicModelCtrl.dispose();
    _geminiModelCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _maybeAutofill();
    });

    Future<void> openExternal(String url) async {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Opening…'), behavior: SnackBarBehavior.floating, duration: Duration(milliseconds: 900)),
      );
      try {
        final uri = Uri.parse(url);
        final ok = await launchUrl(uri, mode: LaunchMode.platformDefault);
        if (!ok && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Could not open $url'), behavior: SnackBarBehavior.floating),
          );
        }
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Open failed: $e'), behavior: SnackBarBehavior.floating),
        );
      }
    }

    Future<void> pasteKey({
      required TextEditingController controller,
      required LlmProvider provider,
    }) async {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text?.trim();
      if (text == null || text.isEmpty) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Clipboard is empty'), behavior: SnackBarBehavior.floating),
        );
        return;
      }
      controller.text = text;
      controller.selection = TextSelection.collapsed(offset: controller.text.length);
      m.setApiKey(provider: provider, key: text);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pasted'), behavior: SnackBarBehavior.floating, duration: Duration(milliseconds: 800)),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('API keys', style: TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                TextField(
                  controller: _openAiCtrl,
                  obscureText: !_revealOpenAi,
                  keyboardType: TextInputType.visiblePassword,
                  autocorrect: false,
                  enableSuggestions: false,
                  smartDashesType: SmartDashesType.disabled,
                  smartQuotesType: SmartQuotesType.disabled,
                  onChanged: (v) => m.setApiKey(provider: LlmProvider.openai, key: v),
                  decoration: InputDecoration(
                    labelText: 'OpenAI API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: _revealOpenAi ? 'Hide' : 'Reveal',
                          onPressed: () => setState(() => _revealOpenAi = !_revealOpenAi),
                          icon: Icon(_revealOpenAi ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                        IconButton(
                          tooltip: 'Paste',
                          onPressed: () => pasteKey(controller: _openAiCtrl, provider: LlmProvider.openai),
                          icon: const Icon(Icons.content_paste_outlined),
                        ),
                        IconButton(
                          tooltip: 'Get key',
                          onPressed: () => openExternal('https://platform.openai.com/api-keys'),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Key length: ${_openAiCtrl.text.trim().length}',
                  style: const TextStyle(color: AppTheme.slate500, fontSize: 12, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 10),
                _ModelPicker(
                  label: 'OpenAI model',
                  controller: _openAiModelCtrl,
                  options: _openAiModelOptions,
                  onChanged: (v) => m.setModelFor(LlmProvider.openai, v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _anthropicCtrl,
                  obscureText: !_revealAnthropic,
                  keyboardType: TextInputType.visiblePassword,
                  autocorrect: false,
                  enableSuggestions: false,
                  smartDashesType: SmartDashesType.disabled,
                  smartQuotesType: SmartQuotesType.disabled,
                  onChanged: (v) => m.setApiKey(provider: LlmProvider.anthropic, key: v),
                  decoration: InputDecoration(
                    labelText: 'Anthropic API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: _revealAnthropic ? 'Hide' : 'Reveal',
                          onPressed: () => setState(() => _revealAnthropic = !_revealAnthropic),
                          icon: Icon(_revealAnthropic ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                        IconButton(
                          tooltip: 'Paste',
                          onPressed: () => pasteKey(controller: _anthropicCtrl, provider: LlmProvider.anthropic),
                          icon: const Icon(Icons.content_paste_outlined),
                        ),
                        IconButton(
                          tooltip: 'Get key',
                          onPressed: () => openExternal('https://console.anthropic.com/settings/keys'),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _ModelPicker(
                  label: 'Anthropic model',
                  controller: _anthropicModelCtrl,
                  options: _anthropicModelOptions,
                  onChanged: (v) => m.setModelFor(LlmProvider.anthropic, v),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _geminiCtrl,
                  obscureText: !_revealGemini,
                  keyboardType: TextInputType.visiblePassword,
                  autocorrect: false,
                  enableSuggestions: false,
                  smartDashesType: SmartDashesType.disabled,
                  smartQuotesType: SmartQuotesType.disabled,
                  onChanged: (v) => m.setApiKey(provider: LlmProvider.gemini, key: v),
                  decoration: InputDecoration(
                    labelText: 'Gemini API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: _revealGemini ? 'Hide' : 'Reveal',
                          onPressed: () => setState(() => _revealGemini = !_revealGemini),
                          icon: Icon(_revealGemini ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                        IconButton(
                          tooltip: 'Paste',
                          onPressed: () => pasteKey(controller: _geminiCtrl, provider: LlmProvider.gemini),
                          icon: const Icon(Icons.content_paste_outlined),
                        ),
                        IconButton(
                          tooltip: 'Get key',
                          onPressed: () => openExternal('https://aistudio.google.com/app/apikey'),
                          icon: const Icon(Icons.open_in_new),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _ModelPicker(
                  label: 'Gemini model',
                  controller: _geminiModelCtrl,
                  options: _geminiModelOptions,
                  onChanged: (v) => m.setModelFor(LlmProvider.gemini, v),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ModelPicker extends StatelessWidget {
  const _ModelPicker({
    required this.label,
    required this.controller,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final current = controller.text.trim();
    final normalizedOptions = options.toSet().toList();
    final selected = normalizedOptions.contains(current) ? current : normalizedOptions.first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          key: ValueKey('$label:$selected'),
          initialValue: selected,
          decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
          items: [
            for (final m in normalizedOptions) DropdownMenuItem(value: m, child: Text(m)),
          ],
          onChanged: (v) {
            if (v == null) return;
            controller.text = v;
            controller.selection = TextSelection.collapsed(offset: controller.text.length);
            onChanged(v);
          },
        ),
      ],
    );
  }
}

class _CadenceRow extends StatelessWidget {
  const _CadenceRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final ReminderCadence value;
  final ValueChanged<ReminderCadence> onChanged;

  static String _cadenceLabel(ReminderCadence c) => switch (c) {
        ReminderCadence.off => 'Off',
        ReminderCadence.monthly => 'Monthly',
        ReminderCadence.quarterly => 'Quarterly',
        ReminderCadence.yearly => 'Yearly',
      };

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        DropdownButton<ReminderCadence>(
          value: value,
          items: [
            for (final c in ReminderCadence.values)
              DropdownMenuItem(
                value: c,
                child: Text(_cadenceLabel(c)),
              ),
          ],
          onChanged: (v) {
            if (v == null) return;
            onChanged(v);
          },
        ),
      ],
    );
  }
}

class _AgentEditorOutcome {
  const _AgentEditorOutcome({this.agent, this.delete = false});

  final AppAgent? agent;
  final bool delete;
}

class _AgentEditorSheet extends StatefulWidget {
  const _AgentEditorSheet({required this.model, required this.draft, required this.canDelete});

  final AppModel model;
  final AppAgent draft;
  final bool canDelete;

  @override
  State<_AgentEditorSheet> createState() => _AgentEditorSheetState();
}

class _AgentEditorSheetState extends State<_AgentEditorSheet> {
  late AppAgent _agent;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _promptCtrl;
  late final TextEditingController _mdCtrl;

  IconData _domainIcon(AgentDomain d) => switch (d) {
        AgentDomain.expenses => Icons.pie_chart_outline,
        AgentDomain.cashflow => Icons.swap_vert,
        AgentDomain.income => Icons.payments_outlined,
        AgentDomain.assets => Icons.savings_outlined,
        AgentDomain.liabilities => Icons.credit_card,
      };

  String _domainLabel(AgentDomain d) => switch (d) {
        AgentDomain.expenses => 'Expenses',
        AgentDomain.cashflow => 'Cash flow',
        AgentDomain.income => 'Income',
        AgentDomain.assets => 'Assets',
        AgentDomain.liabilities => 'Liabilities',
      };

  bool _hasPerm(AgentDomain d, AgentAccess a) => _agent.permissions.contains(AgentPermission(domain: d, access: a));

  void _setPerm(AgentDomain d, AgentAccess a, bool on) {
    setState(() {
      final next = [..._agent.permissions];
      final p = AgentPermission(domain: d, access: a);
      if (on) {
        if (!next.contains(p)) next.add(p);
      } else {
        next.remove(p);
      }
      _agent.permissions = next;
    });
  }

  @override
  void initState() {
    super.initState();
    _agent = widget.draft.clone();
    _nameCtrl = TextEditingController(text: _agent.name);
    _descCtrl = TextEditingController(text: _agent.description);
    _promptCtrl = TextEditingController(text: _agent.systemPrompt);
    _mdCtrl = TextEditingController(text: _agent.contextMarkdown);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _promptCtrl.dispose();
    _mdCtrl.dispose();
    super.dispose();
  }

  void _save() {
    _agent.name = _nameCtrl.text.trim();
    _agent.description = _descCtrl.text.trim();
    _agent.systemPrompt = _promptCtrl.text.trim();
    _agent.contextMarkdown = _mdCtrl.text.trim();
    if (_agent.name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agent name is required'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    Navigator.of(context).pop(_AgentEditorOutcome(agent: _agent));
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 6, 16, 16 + bottom + safeBottom),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Agent',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _promptCtrl,
              maxLines: 5,
              decoration: const InputDecoration(
                labelText: 'System prompt',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            const Text('Permissions', style: TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            ...AgentDomain.values.map((d) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.slate50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.slate100),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppTheme.slate100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(_domainIcon(d), color: AppTheme.slate600, size: 18),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(_domainLabel(d), style: const TextStyle(fontWeight: FontWeight.w900)),
                      ),
                      FilterChip(
                        label: const Text('Read'),
                        selected: _hasPerm(d, AgentAccess.read),
                        onSelected: (on) => _setPerm(d, AgentAccess.read, on),
                      ),
                      const SizedBox(width: 8),
                      FilterChip(
                        label: const Text('Write'),
                        selected: _hasPerm(d, AgentAccess.write),
                        onSelected: (on) => _setPerm(d, AgentAccess.write, on),
                      ),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            TextField(
              controller: _mdCtrl,
              maxLines: 10,
              decoration: const InputDecoration(
                labelText: 'Context note (Markdown)',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if (widget.canDelete)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(const _AgentEditorOutcome(delete: true)),
                    child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                const Spacer(),
                OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
                const SizedBox(width: 8),
                FilledButton(onPressed: _save, child: const Text('Save')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// (Linking assets/liabilities into agent context removed for now.)

