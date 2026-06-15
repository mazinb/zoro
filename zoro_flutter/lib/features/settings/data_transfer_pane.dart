import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/persistence/app_state_transfer.dart';
import '../../core/llm/llm_consent_gate.dart';
import '../../core/persistence/export_sanitizer.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import '../../shared/widgets/modal_sheet_insets.dart';
import 'data_json_viewer.dart';
import 'internal_agent_prompt_editor_page.dart';
import 'settings_tab.dart';

/// Settings → Agents → Data: export / import.
class DataTransferPane extends StatefulWidget {
  const DataTransferPane({super.key, required this.model});

  final AppModel model;

  @override
  State<DataTransferPane> createState() => _DataTransferPaneState();
}

class _DataTransferPaneState extends State<DataTransferPane> {
  static const _kPickerSheetThreshold = 10;

  bool _busy = false;
  String? _status;

  bool _redact = false;
  String _exportKind = DataExportKind.ledger;
  String _ledgerScope = LedgerExportScope.full;
  String _ledgerPartGroup = LedgerPartGroup.assets;
  String _contextGroup = ContextExportGroup.assets;
  String? _pickId;

  String? _exportJson;
  String? _exportCacheKey;
  bool _exportRedactionDone = false;

  String? _importText;
  String? _importLabel;
  Map<String, dynamic>? _importRoot;
  ImportAnalysis? _importAnalysis;

  AppModel get _m => widget.model;
  bool get _hasImport => _importRoot != null;

  String get _selectionCacheKey =>
      '$_exportKind|$_ledgerScope|$_ledgerPartGroup|$_pickId|$_contextGroup|$_redact';

  bool get _isLedger => _exportKind == DataExportKind.ledger;
  bool get _ledgerPart => _isLedger && _ledgerScope == LedgerExportScope.part;
  bool get _needsContextPick => _exportKind == DataExportKind.context;

  List<DataExportPick> get _ledgerPartItems =>
      AppStateTransfer.listLedgerPartPicksForGroup(_m, _ledgerPartGroup);

  List<DataExportPick> get _contextItems =>
      AppStateTransfer.listContextExportPicksForGroup(_m, _contextGroup);

  List<DataExportPick> get _activePicks => switch (_exportKind) {
        DataExportKind.ledger when _ledgerPart => _ledgerPartItems,
        DataExportKind.context => _contextItems,
        _ => const [],
      };

  bool get _needsItemPick => _ledgerPart || _needsContextPick;

  bool get _canExport {
    if (!_needsItemPick) return true;
    if (_pickId == null) return false;
    return _activePicks.any((p) => p.id == _pickId);
  }

  DataExportPick? get _selectedPick {
    if (_pickId == null) return null;
    for (final p in _activePicks) {
      if (p.id == _pickId) return p;
    }
    return null;
  }

  void _invalidateExportCache() {
    _exportJson = null;
    _exportCacheKey = null;
    _exportRedactionDone = false;
  }

  void _onExportKindChanged(String? kind) {
    if (kind == null) return;
    setState(() {
      _exportKind = kind;
      _pickId = null;
      _invalidateExportCache();
      if (kind == DataExportKind.ledger) {
        _ledgerScope = LedgerExportScope.full;
        _ledgerPartGroup = LedgerPartGroup.assets;
        _syncLedgerPartPick();
      } else if (kind == DataExportKind.context) {
        _contextGroup = ContextExportGroup.assets;
        _syncContextPick();
      }
    });
  }

  void _onLedgerScopeChanged(String? scope) {
    if (scope == null) return;
    setState(() {
      _ledgerScope = scope;
      _pickId = null;
      _invalidateExportCache();
      if (_ledgerPart) _syncLedgerPartPick();
    });
  }

  void _onLedgerPartGroupChanged(String? group) {
    if (group == null) return;
    setState(() {
      _ledgerPartGroup = group;
      _pickId = null;
      _invalidateExportCache();
      _syncLedgerPartPick();
    });
  }

  void _onContextGroupChanged(String? group) {
    if (group == null) return;
    setState(() {
      _contextGroup = group;
      _pickId = null;
      _invalidateExportCache();
      _syncContextPick();
    });
  }

  void _syncLedgerPartPick() => _syncPickIn(_ledgerPartItems);
  void _syncContextPick() => _syncPickIn(_contextItems);

  void _syncPickIn(List<DataExportPick> items) {
    if (items.isEmpty) {
      _pickId = null;
      return;
    }
    if (_pickId == null || !items.any((p) => p.id == _pickId)) {
      _pickId = items.first.id;
    }
  }

  Future<Map<String, dynamic>> _buildRawExportMap() {
    return Future.value(
      AppStateTransfer.buildExportMap(
        _m,
        exportKind: _exportKind,
        pickId: _pickId,
        ledgerScope: _ledgerScope,
        ledgerPartGroup: _ledgerPartGroup,
        ledgerPartPickId: _ledgerPart ? _pickId : null,
      ),
    );
  }

  /// Builds export JSON; runs redaction at most once until reset or selection changes.
  Future<String?> _ensureExportJson({bool forceRedact = false}) async {
    if (!_canExport) {
      setState(() => _status = 'Choose an item.');
      return null;
    }

    final key = _selectionCacheKey;
    if (!forceRedact &&
        _exportJson != null &&
        _exportCacheKey == key &&
        (!_redact || _exportRedactionDone)) {
      return _exportJson;
    }

    setState(() {
      _busy = true;
      _status = null;
    });

    try {
      var map = await _buildRawExportMap();
      if (_redact && (!_exportRedactionDone || forceRedact)) {
        if (!mounted) return null;
        final ready = await _m.prepareLlmForAssistant(
          requestConsent: LlmConsentGate.requester(context, _m),
        );
        if (!ready) {
          if (mounted) setState(() => _status = 'AI redaction needs a configured model and your permission.');
          return null;
        }
        map = await ExportSanitizer.sanitizeExportMap(_m, map);
        _exportRedactionDone = true;
      } else if (!_redact) {
        _exportRedactionDone = false;
      }

      final text = const JsonEncoder.withIndent('  ').convert(map);
      if (!mounted) return null;
      setState(() {
        _exportJson = text;
        _exportCacheKey = key;
      });
      return text;
    } catch (e) {
      if (mounted) setState(() => _status = '$e');
      return null;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _resetExportRedaction() {
    setState(() {
      _invalidateExportCache();
      _status = null;
    });
  }

  String? _pickLabelForFileName() => _selectedPick?.label;

  Future<void> _viewExport() async {
    final text = await _ensureExportJson();
    if (text == null || !mounted) return;
    showDataJsonViewer(context, title: 'Export', jsonText: text, subtitle: '${text.length} chars');
  }

  Future<void> _copyExport() async {
    final text = await _ensureExportJson();
    if (text == null) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    setState(() => _status = '${text.length} chars copied');
  }

  Future<void> _downloadExport() async {
    final text = await _ensureExportJson();
    if (text == null) return;
    setState(() => _busy = true);
    try {
      final path = await FilePicker.saveFile(
        dialogTitle: 'Export',
        fileName: AppStateTransfer.suggestedExportFileName(
          exportKind: _exportKind,
          pickLabel: _pickLabelForFileName(),
        ),
        type: FileType.custom,
        allowedExtensions: const ['json'],
        bytes: utf8.encode(text),
      );
      if (!mounted) return;
      setState(() => _status = path == null ? 'Cancelled' : 'Saved');
    } catch (e) {
      if (mounted) setState(() => _status = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickImportFile() async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['json'],
      withData: true,
    );
    if (picked == null || picked.files.isEmpty) return;
    final file = picked.files.single;
    final bytes = file.bytes;
    if (bytes == null || bytes.isEmpty) {
      if (!mounted) return;
      setState(() => _status = 'Empty file');
      return;
    }
    final text = utf8.decode(bytes);
    try {
      final root = AppStateTransfer.parseImportJson(text);
      final analysis = AppStateTransfer.analyzeImport(_m, root);
      if (!mounted) return;
      setState(() {
        _importText = text;
        _importLabel = file.name;
        _importRoot = root;
        _importAnalysis = analysis;
        _status = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _clearImport();
        _status = e is FormatException ? e.message : '$e';
      });
    }
  }

  void _clearImport() {
    _importText = null;
    _importLabel = null;
    _importRoot = null;
    _importAnalysis = null;
  }

  void _viewImport() {
    final text = _importText;
    if (text == null) return;
    showDataJsonViewer(
      context,
      title: 'Import',
      jsonText: text,
      subtitle: _importLabel,
    );
  }

  Future<void> _applyImport(ImportApplyMode mode) async {
    final root = _importRoot;
    if (root == null) return;
    if (mode == ImportApplyMode.merge && _importAnalysis?.supportsMerge != true) {
      setState(() => _status = 'Save not available');
      return;
    }
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      await AppStateTransfer.applyImport(_m, root, mode: mode);
      if (!mounted) return;
      setState(() {
        _status = 'Done';
        _clearImport();
      });
    } catch (e) {
      if (mounted) setState(() => _status = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openSanitizerPrompt() async {
    final def = internalAppAgentDefinitionById(InternalAppAgentIds.exportSanitizer);
    if (def == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (ctx) => InternalAgentPromptEditorPage(definition: def, model: _m),
      ),
    );
  }

  Future<void> _openItemPicker({
    required String title,
    required List<DataExportPick> items,
    required String? selectedId,
  }) async {
    if (items.isEmpty || _busy) return;
    final picked = await showAppModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _ExportItemPickerSheet(
        title: title,
        items: items,
        selectedId: selectedId,
      ),
    );
    if (picked != null && mounted) {
      setState(() {
        _pickId = picked;
        _invalidateExportCache();
      });
    }
  }

  Widget _threeButtonRow({
    required List<({String label, VoidCallback? onPressed, bool filled})> actions,
  }) {
    return Row(
      children: [
        for (var i = 0; i < actions.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: actions[i].filled
                ? FilledButton(
                    onPressed: actions[i].onPressed,
                    child: Text(actions[i].label),
                  )
                : OutlinedButton(
                    onPressed: actions[i].onPressed,
                    child: Text(actions[i].label),
                  ),
          ),
        ],
      ],
    );
  }

  Widget _exportKindDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _exportKind,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Export', border: OutlineInputBorder()),
      items: [
        for (final k in DataExportKind.all)
          DropdownMenuItem(value: k, child: Text(DataExportKind.label(k))),
      ],
      onChanged: _busy || _hasImport ? null : _onExportKindChanged,
    );
  }

  Widget _ledgerScopeDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _ledgerScope,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Scope', border: OutlineInputBorder()),
      items: [
        for (final s in LedgerExportScope.all)
          DropdownMenuItem(value: s, child: Text(LedgerExportScope.label(s))),
      ],
      onChanged: _busy || _hasImport ? null : _onLedgerScopeChanged,
    );
  }

  Widget _ledgerPartGroupDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _ledgerPartGroup,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Area', border: OutlineInputBorder()),
      items: [
        for (final g in LedgerPartGroup.all)
          DropdownMenuItem(value: g, child: Text(LedgerPartGroup.label(g))),
      ],
      onChanged: _busy || _hasImport ? null : _onLedgerPartGroupChanged,
    );
  }

  Widget _contextGroupDropdown() {
    return DropdownButtonFormField<String>(
      initialValue: _contextGroup,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Area', border: OutlineInputBorder()),
      items: [
        for (final g in ContextExportGroup.all)
          DropdownMenuItem(value: g, child: Text(ContextExportGroup.label(g))),
      ],
      onChanged: _busy || _hasImport ? null : _onContextGroupChanged,
    );
  }

  Widget _itemPickerField({
    required String label,
    required List<DataExportPick> items,
    required String sheetTitle,
  }) {
    final selected = _selectedPick;
    final labelText = selected?.label ?? (items.isEmpty ? '—' : 'Choose…');
    final disabled = _busy || _hasImport;

    if (items.length <= _kPickerSheetThreshold) {
      return DropdownButtonFormField<String>(
        initialValue: items.isEmpty ? null : _pickId,
        isExpanded: true,
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
        items: [
          for (final p in items)
            DropdownMenuItem(
              value: p.id,
              child: Text(p.label, overflow: TextOverflow.ellipsis),
            ),
        ],
        onChanged: disabled || items.isEmpty
            ? null
            : (v) => setState(() {
                  _pickId = v;
                  _invalidateExportCache();
                }),
      );
    }

    return InputDecorator(
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      child: InkWell(
        onTap: disabled || items.isEmpty
            ? null
            : () => _openItemPicker(title: sheetTitle, items: items, selectedId: _pickId),
        child: Row(
          children: [
            Expanded(
              child: Text(
                labelText,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: items.isEmpty || disabled
                      ? Theme.of(context).colorScheme.onSurfaceVariant
                      : Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ),
            Icon(Icons.unfold_more, color: Theme.of(context).colorScheme.onSurfaceVariant, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _jsonPreviewPanel() {
    final text = _exportJson;
    if (text == null || _hasImport) return const SizedBox.shrink();
    final cs = Theme.of(context).colorScheme;
    final preview = text.length > 1200 ? '${text.substring(0, 1200)}\n…' : text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('${text.length} chars', style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
        const SizedBox(height: 6),
        Container(
          constraints: const BoxConstraints(maxHeight: 140),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: cs.outlineVariant),
          ),
          child: SingleChildScrollView(
            child: SelectableText(
              preview,
              style: TextStyle(fontFamily: 'Menlo', fontSize: 10, height: 1.35, color: cs.onSurface),
            ),
          ),
        ),
      ],
    );
  }

  Widget _redactRow() {
    final canReset = _redact && (_exportJson != null || _exportRedactionDone);
    return Row(
      children: [
        const Expanded(child: Text('Redact')),
        Switch(
          value: _redact,
          onChanged: _busy || _hasImport
              ? null
              : (v) => setState(() {
                    _redact = v;
                    _invalidateExportCache();
                  }),
        ),
        IconButton(
          icon: const Icon(Icons.info_outline, size: 22),
          tooltip: 'Instructions',
          onPressed: _busy || _hasImport ? null : _openSanitizerPrompt,
        ),
        IconButton(
          icon: const Icon(Icons.refresh, size: 22),
          tooltip: 'Re-run redaction',
          onPressed: !canReset || _busy || _hasImport
              ? null
              : () => _resetExportRedaction(),
        ),
      ],
    );
  }

  Widget _importFileRow() {
    if (!_hasImport) {
      return TextButton(
        onPressed: _busy ? null : _pickImportFile,
        child: const Text('Import file'),
      );
    }
    return Row(
      children: [
        Expanded(
          child: Text(
            _importLabel ?? 'File',
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.close, size: 20),
          tooltip: 'Clear',
          onPressed: _busy
              ? null
              : () => setState(() {
                    _clearImport();
                    _status = null;
                  }),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _m,
      builder: (context, _) => _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (!_m.isPro) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Material(
            color: cs.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(18),
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Export / import', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                  const SizedBox(height: 6),
                  Text(
                    'Locked on Free. Upgrade to Pro to upload/download and import/export your data.',
                    style: TextStyle(color: cs.onSurfaceVariant, height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () {
                      // Nudge users to Settings → Usage tab.
                      final tab = context.findAncestorWidgetOfExactType<SettingsTab>();
                      if (tab == null) return;
                      final l = tab.tabIndexListenable;
                      if (l is ValueNotifier<int>) {
                        l.value = SettingsTabIndex.usage;
                      }
                    },
                    child: const Text('View plans'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
    }
    if (_ledgerPart) _syncLedgerPartPick();
    if (_needsContextPick) _syncContextPick();

    final canSave = _hasImport && (_importAnalysis?.supportsMerge ?? false);
    final canReplace = _hasImport && (_importAnalysis?.supportsReplace ?? false);

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        if (!_hasImport) ...[
          _exportKindDropdown(),
          if (_isLedger) ...[
            const SizedBox(height: 12),
            _ledgerScopeDropdown(),
            if (_ledgerPart) ...[
              const SizedBox(height: 12),
              _ledgerPartGroupDropdown(),
              const SizedBox(height: 12),
              _itemPickerField(
                label: 'Item',
                items: _ledgerPartItems,
                sheetTitle: LedgerPartGroup.label(_ledgerPartGroup),
              ),
            ],
          ],
          if (_needsContextPick) ...[
            const SizedBox(height: 12),
            _contextGroupDropdown(),
            const SizedBox(height: 12),
            _itemPickerField(
              label: 'Item',
              items: _contextItems,
              sheetTitle: ContextExportGroup.label(_contextGroup),
            ),
          ],
          const SizedBox(height: 12),
          _redactRow(),
          const SizedBox(height: 12),
          _threeButtonRow(
            actions: [
              (label: 'View', onPressed: _busy || !_canExport ? null : _viewExport, filled: false),
              (label: 'Copy', onPressed: _busy || !_canExport ? null : _copyExport, filled: false),
              (label: 'Download', onPressed: _busy || !_canExport ? null : _downloadExport, filled: true),
            ],
          ),
          if (_exportJson != null) ...[
            const SizedBox(height: 12),
            _jsonPreviewPanel(),
          ],
        ],
        if (_hasImport) ...[
          _importFileRow(),
          const SizedBox(height: 12),
          _threeButtonRow(
            actions: [
              (label: 'View', onPressed: _busy ? null : _viewImport, filled: false),
              (label: 'Save', onPressed: canSave && !_busy ? () => _applyImport(ImportApplyMode.merge) : null, filled: true),
              (label: 'Replace', onPressed: canReplace && !_busy ? () => _applyImport(ImportApplyMode.replace) : null, filled: false),
            ],
          ),
        ],
        if (!_hasImport) ...[
          const SizedBox(height: 16),
          _importFileRow(),
        ],
        if (_busy) ...[
          const SizedBox(height: 20),
          const Center(child: CircularProgressIndicator()),
        ],
        if (_status != null) ...[
          const SizedBox(height: 12),
          Text(_status!, style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
        ],
      ],
    );
  }
}

class _ExportItemPickerSheet extends StatefulWidget {
  const _ExportItemPickerSheet({
    required this.title,
    required this.items,
    required this.selectedId,
  });

  final String title;
  final List<DataExportPick> items;
  final String? selectedId;

  @override
  State<_ExportItemPickerSheet> createState() => _ExportItemPickerSheetState();
}

class _ExportItemPickerSheetState extends State<_ExportItemPickerSheet> {
  late List<DataExportPick> _filtered;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _filtered = widget.items;
    _search.addListener(_applyFilter);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _applyFilter() {
    final q = _search.text.trim().toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? widget.items
          : widget.items.where((p) => p.label.toLowerCase().contains(q)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final maxH = MediaQuery.sizeOf(context).height * 0.65 - keyboard;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(widget.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          TextField(
            controller: _search,
            decoration: const InputDecoration(
              hintText: 'Search',
              prefixIcon: Icon(Icons.search, size: 20),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxH),
            child: _filtered.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('No matches', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    itemCount: _filtered.length,
                    itemBuilder: (context, i) {
                      final p = _filtered[i];
                      final selected = p.id == widget.selectedId;
                      return ListTile(
                        title: Text(p.label),
                        trailing: selected ? const Icon(Icons.check) : null,
                        selected: selected,
                        onTap: () => Navigator.pop(context, p.id),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
