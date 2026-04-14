import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/api/api_exception.dart';
import '../../core/session/session_controller.dart';
import '../../shared/theme/app_theme.dart';
import '../../util/month_options.dart';

class ExpensesAiCard extends StatefulWidget {
  const ExpensesAiCard({super.key, required this.session});

  final SessionController session;

  @override
  State<ExpensesAiCard> createState() => _ExpensesAiCardState();
}

class _ExpensesAiCardState extends State<ExpensesAiCard> {
  final _labelCtrl = TextEditingController();
  bool _busy = false;
  String? _message;
  String? _error;

  late String _month;
  late final List<MonthOption> _months;

  @override
  void initState() {
    super.initState();
    _months = recentMonths();
    _month = _months.first.value;
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAndUpload() async {
    final token = widget.session.token;
    if (token == null || token.isEmpty) {
      setState(() => _error = 'Not signed in');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });

    try {
      final pick = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf'],
        withData: false,
      );
      if (pick == null || pick.files.isEmpty) {
        setState(() => _busy = false);
        return;
      }
      final f = pick.files.single;
      final path = f.path;
      if (path == null || path.isEmpty) {
        setState(() {
          _busy = false;
          _error = 'Could not read file path';
        });
        return;
      }

      final label =
          _labelCtrl.text.trim().isEmpty ? 'Statement' : _labelCtrl.text.trim();

      final json = await widget.session.api.parseExpenseFile(
        token: token,
        filePath: path,
        fileName: label,
        month: _month,
      );

      final data = json['data'];
      setState(() {
        _message = data != null
            ? 'Imported. Review data on web or extend this screen to show buckets.'
            : 'Import finished.';
      });
    } on ApiException catch (e) {
      final code = e.statusCode;
      if (code == 403 || code == 402 || code == 409) {
        setState(() {
          _error =
              '${e.message} — AI import may require a paid tier or be rate-limited.';
        });
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'AI statement import',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Uses the same /api/expenses/parse-one-file endpoint as the web app. Server enforces subscription and usage rules.',
              style: TextStyle(color: AppTheme.slate600, fontSize: 13),
            ),
            const SizedBox(height: 16),
            DropdownMenu<String>(
              key: ValueKey(_month),
              initialSelection: _month,
              label: const Text('Month'),
              onSelected: _busy
                  ? null
                  : (v) {
                      if (v != null) setState(() => _month = v);
                    },
              dropdownMenuEntries: _months
                  .map(
                    (m) => DropdownMenuEntry<String>(
                      value: m.value,
                      label: m.label,
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _labelCtrl,
              decoration: const InputDecoration(
                labelText: 'Label (optional)',
                border: OutlineInputBorder(),
                hintText: 'e.g. Chase checking',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _busy ? null : _pickAndUpload,
              icon: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.upload_file),
              label: Text(_busy ? 'Working…' : 'Choose PDF & import'),
            ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              Text(_message!, style: const TextStyle(color: AppTheme.slate600)),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}
