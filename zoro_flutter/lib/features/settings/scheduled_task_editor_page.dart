import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/schedule/scheduled_agent_runner.dart';
import '../../core/state/app_model.dart';
import '../../core/state/scheduled_agent_task.dart';
import '../../shared/theme/app_theme.dart';

/// Create or edit a recurring agent run (Settings → Agents → Schedule).
class ScheduledTaskEditorPage extends StatefulWidget {
  const ScheduledTaskEditorPage({
    super.key,
    required this.model,
    this.taskIndex,
    this.initialAgentId,
    this.initialRunMessage,
  });

  final AppModel model;
  final int? taskIndex;
  final String? initialAgentId;
  final String? initialRunMessage;

  bool get isEditing => taskIndex != null;

  @override
  State<ScheduledTaskEditorPage> createState() => _ScheduledTaskEditorPageState();
}

class _ScheduledTaskEditorPageState extends State<ScheduledTaskEditorPage> {
  late ScheduledAgentTask _task;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _messageCtrl;
  bool _running = false;

  @override
  void initState() {
    super.initState();
    if (widget.isEditing) {
      _task = widget.model.scheduledAgentTasks[widget.taskIndex!].clone();
    } else {
      final agentId = widget.initialAgentId ??
          (widget.model.agents.isNotEmpty ? widget.model.agents.first.id : '');
      _task = ScheduledAgentTask(
        id: 'sched-${DateTime.now().microsecondsSinceEpoch}',
        name: 'Scheduled agent',
        enabled: true,
        agentId: agentId,
        runUserMessage: widget.initialRunMessage ?? '',
        recurrence: ScheduleRecurrenceKind.daily,
        hour: 7,
        minute: 30,
        weeklyWeekdays: [1, 2, 3, 4, 5],
        monthlyDay: 1,
        yearlyMonth: 1,
        yearlyDay: 1,
      );
    }
    _nameCtrl = TextEditingController(text: _task.name);
    _messageCtrl = TextEditingController(text: _task.runUserMessage);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  void _syncFromCtrls() {
    _task.name = _nameCtrl.text.trim().isEmpty ? 'Scheduled agent' : _nameCtrl.text.trim();
    _task.runUserMessage = _messageCtrl.text;
  }

  void _save() {
    _syncFromCtrls();
    if (_task.agentId.isEmpty && widget.model.agents.isNotEmpty) {
      _task.agentId = widget.model.agents.first.id;
    }
    if (widget.model.agents.every((a) => a.id != _task.agentId)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pick an agent'), behavior: SnackBarBehavior.floating),
      );
      return;
    }
    if (widget.isEditing) {
      widget.model.updateScheduledTaskAt(widget.taskIndex!, _task);
    } else {
      widget.model.addScheduledTask(_task);
    }
    Navigator.of(context).pop();
  }

  void _delete() {
    if (!widget.isEditing) {
      Navigator.of(context).pop();
      return;
    }
    widget.model.removeScheduledTaskAt(widget.taskIndex!);
    Navigator.of(context).pop();
  }

  Future<void> _runNow() async {
    _syncFromCtrls();
    if (kDebugMode) {
      debugPrint(
        '[ZoroSchedule] Run now from editor taskId=${_task.id} editing=${widget.isEditing} '
        'agentId=${_task.agentId}',
      );
    }
    final runner = ScheduledAgentRunner();
    setState(() => _running = true);
    final result = await runner.runOneTask(widget.model, _task);
    if (!mounted) return;
    setState(() => _running = false);
    if (widget.isEditing) {
      widget.model.updateScheduledTaskAt(widget.taskIndex!, _task);
    } else {
      // New (unsaved) task: still persist lastRun / error on the draft so the editor shows them.
      setState(() {});
    }
    final String message;
    if (!result.ok) {
      message = 'Run failed: ${_task.lastError ?? result.error ?? "unknown"}';
    } else if (!result.homeSummaryUpdated) {
      message =
          'Run finished, but nothing was written to Home. Turn on “Home summary tool” for this agent or pick a different agent.';
    } else if (result.usedVisibleTextFallback) {
      message = 'Run finished — Home summary updated from the model reply (no zoro_actions block).';
    } else {
      message = 'Run finished — Home summary updated.';
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  void _toggleWeekday(int weekday) {
    setState(() {
      final s = {..._task.weeklyWeekdays};
      if (s.contains(weekday)) {
        s.remove(weekday);
      } else {
        s.add(weekday);
      }
      _task.weeklyWeekdays = s.toList()..sort();
      if (_task.weeklyWeekdays.isEmpty) {
        _task.weeklyWeekdays = [weekday];
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final next = computeNextRunLocal(_task, notBefore: DateTime.now());
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEditing ? 'Edit schedule' : 'New schedule'),
        actions: [
          if (widget.isEditing)
            IconButton(
              tooltip: 'Delete',
              icon: const Icon(Icons.delete_outline),
              onPressed: _delete,
            ),
          TextButton(onPressed: _save, child: const Text('Save')),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Enabled', style: TextStyle(fontWeight: FontWeight.w900)),
            value: _task.enabled,
            onChanged: (v) => setState(() => _task.enabled = v),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: 'Name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _resolvedAgentIdForDropdown(),
            decoration: const InputDecoration(
              labelText: 'Target output',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final a in widget.model.agents)
                DropdownMenuItem<String>(
                  value: a.id,
                  child: Text(_targetOutputLabel(a)),
                ),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _task.agentId = v);
            },
          ),
          const SizedBox(height: 16),
          const Text('Recurrence', style: TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          DropdownButtonFormField<ScheduleRecurrenceKind>(
            initialValue: _task.recurrence,
            decoration: const InputDecoration(border: OutlineInputBorder()),
            items: [
              for (final k in ScheduleRecurrenceKind.values)
                DropdownMenuItem(value: k, child: Text(scheduleRecurrenceLabel(k))),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _task.recurrence = v);
            },
          ),
          if (_task.recurrence == ScheduleRecurrenceKind.weekly) ...[
            const SizedBox(height: 12),
            const Text('Weekdays', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final e in _weekdayLabels.entries)
                  FilterChip(
                    label: Text(e.value),
                    selected: _task.weeklyWeekdays.contains(e.key),
                    onSelected: (_) => _toggleWeekday(e.key),
                  ),
              ],
            ),
          ],
          if (_task.recurrence == ScheduleRecurrenceKind.monthly) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('Day of month'),
                const Spacer(),
                DropdownButton<int>(
                  value: _task.monthlyDay.clamp(1, 28),
                  items: [for (var d = 1; d <= 28; d++) DropdownMenuItem(value: d, child: Text('$d'))],
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _task.monthlyDay = v);
                  },
                ),
              ],
            ),
          ],
          if (_task.recurrence == ScheduleRecurrenceKind.yearly) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _task.yearlyMonth.clamp(1, 12),
                    decoration: const InputDecoration(labelText: 'Month', border: OutlineInputBorder()),
                    items: [
                      for (var m = 1; m <= 12; m++)
                        DropdownMenuItem(
                          value: m,
                          child: Text(_monthName(m)),
                        ),
                    ],
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() => _task.yearlyMonth = v);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _task.yearlyDay.clamp(1, 28),
                    decoration: const InputDecoration(labelText: 'Day', border: OutlineInputBorder()),
                    items: [
                      for (var d = 1; d <= 28; d++)
                        DropdownMenuItem(value: d, child: Text('$d')),
                    ],
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() => _task.yearlyDay = v);
                    },
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Local time', style: TextStyle(fontWeight: FontWeight.w900)),
            subtitle: Text(
              '${_task.hour.toString().padLeft(2, '0')}:${_task.minute.toString().padLeft(2, '0')}',
              style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.slate900),
            ),
            trailing: const Icon(Icons.schedule),
            onTap: () async {
              final tod = TimeOfDay(hour: _task.hour, minute: _task.minute);
              final picked = await showTimePicker(context: context, initialTime: tod);
              if (picked == null) return;
              setState(() {
                _task.hour = picked.hour;
                _task.minute = picked.minute;
              });
            },
          ),
          Text(
            'Next run (approx.): ${next.toLocal().toString().split(".").first}',
            style: const TextStyle(color: AppTheme.slate600, fontSize: 13, fontWeight: FontWeight.w600),
          ),
          if (_task.lastRunAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Last run: ${_task.lastRunAt!.toLocal().toString().split(".").first}',
                style: const TextStyle(color: AppTheme.slate500, fontSize: 12),
              ),
            ),
          const SizedBox(height: 16),
          const Text('Run instruction', style: TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          TextField(
            controller: _messageCtrl,
            minLines: 5,
            maxLines: 14,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'What the model should do each time (same as a chat message you would send).',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton(
            onPressed: _running ? null : _runNow,
            child: Text(_running ? 'Running…' : 'Run now'),
          ),
        ],
      ),
    );
  }

  static const _weekdayLabels = {
    DateTime.monday: 'Mon',
    DateTime.tuesday: 'Tue',
    DateTime.wednesday: 'Wed',
    DateTime.thursday: 'Thu',
    DateTime.friday: 'Fri',
    DateTime.saturday: 'Sat',
    DateTime.sunday: 'Sun',
  };

  static String _monthName(int m) {
    const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[m];
  }

  String _resolvedAgentIdForDropdown() {
    final ids = widget.model.agents.map((a) => a.id).toSet();
    if (ids.contains(_task.agentId)) return _task.agentId;
    return widget.model.agents.isNotEmpty ? widget.model.agents.first.id : _task.agentId;
  }

  static String _targetOutputLabel(AppAgent a) {
    if (a.id == AppModel.morningBriefingAgentId) {
      return 'Home summary (daily briefing)';
    }
    if (a.id == 'agent-rates-fx') {
      return 'Rates & projections (Settings)';
    }
    return a.name;
  }
}
