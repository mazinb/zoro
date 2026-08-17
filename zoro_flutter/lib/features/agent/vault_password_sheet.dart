import 'package:flutter/material.dart';

import '../../core/agent/vault_index.dart';

class VaultPasswordChoice {
  const VaultPasswordChoice({
    required this.typeId,
    this.password,
    this.savePassword = true,
  });

  final String typeId;
  final String? password;
  final bool savePassword;
}

Future<VaultPasswordChoice?> showVaultPasswordSheet({
  required BuildContext context,
  required List<VaultFileType> types,
  required String fileName,
  String? suggestedTypeId,
  bool unlockFailed = false,
}) {
  return showModalBottomSheet<VaultPasswordChoice>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) {
      return _VaultPasswordBody(
        types: types,
        fileName: fileName,
        suggestedTypeId: suggestedTypeId,
        unlockFailed: unlockFailed,
      );
    },
  );
}

class _VaultPasswordBody extends StatefulWidget {
  const _VaultPasswordBody({
    required this.types,
    required this.fileName,
    this.suggestedTypeId,
    this.unlockFailed = false,
  });

  final List<VaultFileType> types;
  final String fileName;
  final String? suggestedTypeId;
  final bool unlockFailed;

  @override
  State<_VaultPasswordBody> createState() => _VaultPasswordBodyState();
}

class _VaultPasswordBodyState extends State<_VaultPasswordBody> {
  late String _typeId;
  final _password = TextEditingController();
  bool _save = true;

  @override
  void initState() {
    super.initState();
    final suggested = widget.suggestedTypeId;
    _typeId = (suggested != null && widget.types.any((t) => t.id == suggested))
        ? suggested
        : (widget.types.isNotEmpty ? widget.types.first.id : 'other');
  }

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 8, 20, 20 + inset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.unlockFailed ? 'Update saved password' : 'Save password for this type of file',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17),
          ),
          const SizedBox(height: 6),
          Text(
            widget.fileName,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _typeId,
            decoration: const InputDecoration(labelText: 'File type', border: OutlineInputBorder()),
            items: [
              for (final t in widget.types)
                DropdownMenuItem(value: t.id, child: Text(t.label)),
            ],
            onChanged: (v) {
              if (v == null) return;
              setState(() => _typeId = v);
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'PDF password',
              helperText: 'Stored in the device keychain, not in backups.',
              border: OutlineInputBorder(),
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Save password for this type of file', style: TextStyle(fontWeight: FontWeight.w700)),
            value: _save,
            onChanged: (v) => setState(() => _save = v),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton(
                onPressed: () => Navigator.pop(
                  context,
                  VaultPasswordChoice(typeId: _typeId, password: null, savePassword: false),
                ),
                child: const Text('Skip'),
              ),
              const Spacer(),
              FilledButton(
                onPressed: () => Navigator.pop(
                  context,
                  VaultPasswordChoice(
                    typeId: _typeId,
                    password: _password.text.trim(),
                    savePassword: _save,
                  ),
                ),
                child: const Text('Save'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
