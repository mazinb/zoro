import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../shared/theme/app_theme.dart';

abstract class SettingsTabIndex {
  static const int reminders = 0;
  static const int agents = 1;
  static const int permissions = 2;
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
              Tab(text: 'Permissions'),
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
              _PermissionsPane(model: widget.model),
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
                const Text('Reminders', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                const Text(
                  'Pick how often to review. Home only shows what’s overdue.',
                  style: TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 16),
                _CadenceRow(
                  label: 'Expenses (estimates)',
                  value: model.remindersExpensesCadence,
                  onChanged: model.setReminderCadenceExpenses,
                ),
                const SizedBox(height: 10),
                _CadenceRow(
                  label: 'Cash flow (monthly entry)',
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
                const Text('Schedule', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                Text(
                  'Defaults: monthly on day 1, quarterly on quarter-end.',
                  style: const TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Monthly review day',
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
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Use quarter-end dates', style: TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: const Text('Mar 31 • Jun 30 • Sep 30 • Dec 31', style: TextStyle(color: AppTheme.slate600)),
                  value: model.remindersUseQuarterEnds,
                  onChanged: model.setRemindersUseQuarterEnds,
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Yearly review date',
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
        Card(
          elevation: 0,
          color: AppTheme.slate50,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('What shows on Home', style: TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(
                  'Only items that are out of date show up as action cards. Nothing else moves onto Home.',
                  style: TextStyle(color: AppTheme.slate600),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _AgentsPane extends StatelessWidget {
  const _AgentsPane({required this.model});

  final AppModel model;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Agents', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                const Text(
                  'Agents can use app context plus your custom JSON (e.g. stocks, mutual funds). Permissions/tools will be enforced later — for now this is UI-only.',
                  style: TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => _openAgentEditor(context),
                  icon: const Icon(Icons.add),
                  label: const Text('Create agent'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...model.agents.asMap().entries.map((e) {
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
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: model.accent.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(Icons.smart_toy, color: model.accent),
                      ),
                      const SizedBox(width: 12),
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

class _PermissionsPane extends StatefulWidget {
  const _PermissionsPane({required this.model});

  final AppModel model;

  @override
  State<_PermissionsPane> createState() => _PermissionsPaneState();
}

class _PermissionsPaneState extends State<_PermissionsPane> {
  var _showKey = false;

  @override
  Widget build(BuildContext context) {
    final m = widget.model;
    final provider = m.activeLlmProvider;
    final key = m.apiKeyFor(provider) ?? '';

    String providerLabel(LlmProvider p) => switch (p) {
          LlmProvider.openai => 'OpenAI',
          LlmProvider.anthropic => 'Anthropic',
          LlmProvider.gemini => 'Gemini',
        };

    final modelName = m.modelFor(provider);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('Permissions', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 6),
                const Text(
                  'Add API keys for chat (and later agents). Keys stay on-device for now (UI-only).',
                  style: TextStyle(color: AppTheme.slate600),
                ),
                const SizedBox(height: 12),
                SegmentedButton<LlmProvider>(
                  segments: [
                    ButtonSegment(value: LlmProvider.openai, label: Text(providerLabel(LlmProvider.openai))),
                    ButtonSegment(value: LlmProvider.anthropic, label: Text(providerLabel(LlmProvider.anthropic))),
                    ButtonSegment(value: LlmProvider.gemini, label: Text(providerLabel(LlmProvider.gemini))),
                  ],
                  selected: {provider},
                  onSelectionChanged: (s) => m.setActiveLlmProvider(s.first),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: key,
                  obscureText: !_showKey,
                  onChanged: (v) => m.setApiKey(provider: provider, key: v),
                  decoration: InputDecoration(
                    labelText: '${providerLabel(provider)} API key',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      onPressed: () => setState(() => _showKey = !_showKey),
                      icon: Icon(_showKey ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                      tooltip: _showKey ? 'Hide' : 'Show',
                    ),
                  ),
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
                const Text('Chat defaults', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                const SizedBox(height: 10),
                TextFormField(
                  initialValue: modelName,
                  onChanged: (v) => m.setModelFor(provider, v),
                  decoration: const InputDecoration(
                    labelText: 'Model',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                ExpansionTile(
                  tilePadding: EdgeInsets.zero,
                  title: const Text('More', style: TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: const Text('Optional tuning', style: TextStyle(color: AppTheme.slate600)),
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text('Temperature', style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        Text(m.temperature.toStringAsFixed(2), style: const TextStyle(color: AppTheme.slate600)),
                      ],
                    ),
                    Slider(
                      min: 0,
                      max: 1,
                      divisions: 20,
                      value: m.temperature,
                      onChanged: m.setTemperature,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          elevation: 0,
          color: AppTheme.slate50,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: const [
                Text('Coming soon', style: TextStyle(fontWeight: FontWeight.w900)),
                SizedBox(height: 6),
                Text(
                  'Share app data to external users via a token (UI-only for now).',
                  style: TextStyle(color: AppTheme.slate600),
                ),
              ],
            ),
          ),
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
            const SizedBox(height: 2),
            const Text(
              'Write access is UI-only for now (enforcement later).',
              style: TextStyle(color: AppTheme.slate600, fontSize: 12),
            ),
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

