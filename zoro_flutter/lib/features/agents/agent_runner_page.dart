import 'package:flutter/material.dart';

import '../../core/state/app_model.dart';
import '../../core/state/ledger_rows.dart';
import '../../core/state/monthly_cashflow_entry.dart';
import '../../shared/theme/app_theme.dart';

enum AgentTargetKind { asset, liability, month }

class BuiltInAgentTemplate {
  const BuiltInAgentTemplate({
    required this.id,
    required this.name,
    required this.description,
    required this.targetKind,
  });

  final String id;
  final String name;
  final String description;
  final AgentTargetKind targetKind;
}

const builtInAgentTemplates = <BuiltInAgentTemplate>[
  BuiltInAgentTemplate(
    id: 'agent.asset.details',
    name: 'Asset details',
    description: 'Build context so totals are explainable.',
    targetKind: AgentTargetKind.asset,
  ),
  BuiltInAgentTemplate(
    id: 'agent.liability.details',
    name: 'Liability details',
    description: 'Capture terms, rates, and payoff plan.',
    targetKind: AgentTargetKind.liability,
  ),
  BuiltInAgentTemplate(
    id: 'agent.month.expenses',
    name: 'Monthly expenses',
    description: 'Explain what changed this month.',
    targetKind: AgentTargetKind.month,
  ),
];

class AgentRunnerPage extends StatefulWidget {
  const AgentRunnerPage({super.key, required this.model, required this.template});

  final AppModel model;
  final BuiltInAgentTemplate template;

  @override
  State<AgentRunnerPage> createState() => _AgentRunnerPageState();
}

class _AgentRunnerPageState extends State<AgentRunnerPage> {
  String? _assetId;
  String? _liabilityId;
  String? _monthKey;

  late final TextEditingController _mdCtrl = TextEditingController();

  @override
  void dispose() {
    _mdCtrl.dispose();
    super.dispose();
  }

  String _assetTitle(LedgerAssetRow a) {
    final name = a.name.trim().isEmpty ? a.type.label : a.name.trim();
    return '${a.type.label} • $name';
  }

  String _liabilityTitle(LedgerLiabilityRow l) {
    final name = l.name.trim().isEmpty ? l.type.label : l.name.trim();
    return '${l.type.label} • $name';
  }

  String _defaultContextForAsset(LedgerAssetRow a) {
    final type = a.type;
    final heading = _assetTitle(a);
    final bullets = switch (type) {
      LedgerAssetType.brokerage => const [
          '- Broker / platform',
          '- Account currency',
          '- Main holdings (top 5) + approx value',
          '- Cash balance',
          '- Any RSUs / options / restricted assets',
          '- How often this total is updated',
        ],
      LedgerAssetType.savings => const [
          '- Bank',
          '- Account type',
          '- Interest rate (if known)',
          '- Why this cash exists (emergency fund, taxes, etc.)',
          '- Update cadence',
        ],
      LedgerAssetType.property => const [
          '- Address / city',
          '- Ownership split',
          '- Valuation source (estimate vs appraisal)',
          '- If mortgaged: link to liability row',
          '- Update cadence',
        ],
      LedgerAssetType.crypto => const [
          '- Exchange / wallet',
          '- Major coins + approx value',
          '- Custody notes',
          '- Update cadence',
        ],
      LedgerAssetType.other => const [
          '- What is it?',
          '- How you value it',
          '- Update cadence',
        ],
    };
    return '## $heading\n\n### Notes\n${bullets.join('\n')}\n';
  }

  String _defaultContextForLiability(LedgerLiabilityRow l) {
    final heading = _liabilityTitle(l);
    const bullets = [
      '- Lender',
      '- Original amount',
      '- Current balance source',
      '- Interest rate',
      '- Payment amount + due date',
      '- Term / remaining months',
      '- Notes (variable rate, promo APR, etc.)',
    ];
    return '## $heading\n\n### Terms\n${bullets.join('\n')}\n';
  }

  String _defaultContextForMonth(String monthKey) {
    final heading = AppModel.formatMonthKeyLabel(monthKey);
    const bullets = [
      '- Big one-offs',
      '- Travel / medical / moving',
      '- Income changes',
      '- What to adjust next month',
    ];
    return '## $heading\n\n### What happened\n${bullets.join('\n')}\n';
  }

  void _loadContextForSelection() {
    final m = widget.model;
    switch (widget.template.targetKind) {
      case AgentTargetKind.asset:
        final a = _assetId == null ? null : m.assetById(_assetId!);
        if (a == null) return;
        final existing = a.contextMarkdown.trim();
        _mdCtrl.text = existing.isNotEmpty ? existing : _defaultContextForAsset(a);
      case AgentTargetKind.liability:
        final l = _liabilityId == null ? null : m.liabilityById(_liabilityId!);
        if (l == null) return;
        final existing = l.contextMarkdown.trim();
        _mdCtrl.text = existing.isNotEmpty ? existing : _defaultContextForLiability(l);
      case AgentTargetKind.month:
        final mk = _monthKey;
        if (mk == null) return;
        final e = m.monthlyEntryFor(mk);
        final existing = (e?.contextMarkdown ?? '').trim();
        _mdCtrl.text = existing.isNotEmpty ? existing : _defaultContextForMonth(mk);
    }
  }

  void _save() {
    final m = widget.model;
    final md = _mdCtrl.text.trim();
    switch (widget.template.targetKind) {
      case AgentTargetKind.asset:
        final id = _assetId;
        if (id == null) return;
        m.setAssetContextMarkdown(assetId: id, markdown: md);
      case AgentTargetKind.liability:
        final id = _liabilityId;
        if (id == null) return;
        m.setLiabilityContextMarkdown(liabilityId: id, markdown: md);
      case AgentTargetKind.month:
        final mk = _monthKey;
        if (mk == null) return;
        // Create the month row if it doesn't exist yet so context can be stored.
        final existing = m.monthlyEntryFor(mk);
        if (existing == null) {
          m.upsertMonthlyCashflow(
            MonthlyCashflowEntry(
              monthKey: mk,
              outflowToCashFd: 0,
              outflowToInvested: 0,
              monthlySpending: 0,
              comment: '',
              contextMarkdown: md,
            ),
          );
        } else {
          m.setMonthlyEntryContextMarkdown(monthKey: mk, markdown: md);
        }
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Saved'), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final template = widget.template;
    final m = widget.model;

    final months = AppModel.recentMonthKeys();

    Widget targetPicker() {
      switch (template.targetKind) {
        case AgentTargetKind.asset:
          return DropdownButtonFormField<String>(
            value: _assetId,
            decoration: const InputDecoration(labelText: 'Asset', border: OutlineInputBorder()),
            items: [
              for (final a in m.assets)
                DropdownMenuItem(
                  value: a.id,
                  child: Text(_assetTitle(a), overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (v) {
              setState(() => _assetId = v);
              _loadContextForSelection();
            },
          );
        case AgentTargetKind.liability:
          return DropdownButtonFormField<String>(
            value: _liabilityId,
            decoration: const InputDecoration(labelText: 'Liability', border: OutlineInputBorder()),
            items: [
              for (final l in m.liabilities)
                DropdownMenuItem(
                  value: l.id,
                  child: Text(_liabilityTitle(l), overflow: TextOverflow.ellipsis),
                ),
            ],
            onChanged: (v) {
              setState(() => _liabilityId = v);
              _loadContextForSelection();
            },
          );
        case AgentTargetKind.month:
          return DropdownButtonFormField<String>(
            value: _monthKey,
            decoration: const InputDecoration(labelText: 'Month', border: OutlineInputBorder()),
            items: [
              for (final mk in months) DropdownMenuItem(value: mk, child: Text(AppModel.formatMonthKeyLabel(mk))),
            ],
            onChanged: (v) {
              setState(() => _monthKey = v);
              _loadContextForSelection();
            },
          );
      }
    }

    final hasTarget = switch (template.targetKind) {
      AgentTargetKind.asset => _assetId != null,
      AgentTargetKind.liability => _liabilityId != null,
      AgentTargetKind.month => _monthKey != null,
    };

    return Scaffold(
      appBar: AppBar(
        title: Text(template.name),
        actions: [
          TextButton(
            onPressed: hasTarget ? _save : null,
            child: const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(template.description, style: const TextStyle(color: AppTheme.slate600)),
          const SizedBox(height: 16),
          targetPicker(),
          const SizedBox(height: 16),
          TextField(
            controller: _mdCtrl,
            enabled: hasTarget,
            maxLines: 18,
            decoration: const InputDecoration(
              labelText: 'Context (Markdown)',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: hasTarget ? _save : null,
            icon: const Icon(Icons.save),
            label: const Text('Save context'),
          ),
        ],
      ),
    );
  }
}

