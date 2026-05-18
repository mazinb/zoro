import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/persistence/app_state_transfer.dart';
import '../../core/persistence/export_sanitizer.dart';
import '../../core/state/app_model.dart';
import '../../core/state/internal_app_agent_definition.dart';
import 'data_json_viewer.dart';
import 'import_review_sheet.dart';
import 'internal_agent_prompt_editor_page.dart';

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

  String? _lastJson;
  int? _lastJsonChars;

  String? _importText;
  String? _importLabel;
  Map<String, dynamic>? _importRoot;
  ImportAnalysis? _importAnalysis;

  AppModel get _m => widget.model;

  bool get _isLedger => _exportKind == DataExportKind.ledger;
  bool get _ledgerPart => _isLedger && _ledgerScope == LedgerExportScope.part;
  bool get _needsContextPick => _exportKind == DataExportKind.context;
  bool get _needsAgentPick => _exportKind == DataExportKind.agent;

  List<DataExportPick> get _ledgerPartItems =>
      AppStateTransfer.listLedgerPartPicksForGroup(_m, _ledgerPartGroup);

  List<DataExportPick> get _contextItems =>
      AppStateTransfer.listContextExportPicksForGroup(_m, _contextGroup);

  List<DataExportPick> get _agentItems => AppStateTransfer.listAgentExportPicks(_m);

  List<DataExportPick> get _activePicks => switch (_exportKind) {
        DataExportKind.ledger when _ledgerPart => _ledgerPartItems,
        DataExportKind.context => _contextItems,
        DataExportKind.agent => _agentItems,
        _ => const [],
      };

  bool get _needsItemPick => _ledgerPart || _needsContextPick || _needsAgentPick;

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

  void _onExportKindChanged(String? kind) {
    if (kind == null) return;
    setState(() {
      _exportKind = kind;
      _pickId = null;
      if (kind == DataExportKind.ledger) {
        _ledgerScope = LedgerExportScope.full;
        _ledgerPartGroup = LedgerPartGroup.assets;
        _syncLedgerPartPick();
      } else if (kind == DataExportKind.context) {
        _contextGroup = ContextExportGroup.assets;
        _syncContextPick();
      } else if (kind == DataExportKind.agent) {
        _syncAgentPick();
      }
    });
  }

  void _onLedgerScopeChanged(String? scope) {
    if (scope == null) return;
    setState(() {
      _ledgerScope = scope;
      _pickId = null;
      if (_ledgerPart) _syncLedgerPartPick();
    });
  }

  void _onLedgerPartGroupChanged(String? group) {
    if (group == null) return;
    setState(() {
      _ledgerPartGroup = group;
      _pickId = null;
      _syncLedgerPartPick();
    });
  }

  void _onContextGroupChanged(String? group) {
    if (group == null) return;
    setState(() {
      _contextGroup = group;
      _pickId = null;
      _syncContextPick();
    });
  }

  void _syncLedgerPartPick() {
    _syncPickIn(_ledgerPartItems);
  }

  void _syncContextPick() {
    _syncPickIn(_contextItems);
  }

  void _syncAgentPick() {
    _syncPickIn(_agentItems);
  }

  void _syncPickIn(List<DataExportPick> items) {
    if (items.isEmpty) {
      _pickId = null;
      return;
    }
    if (_pickId == null || !items.any((p) => p.id == _pickId)) {
      _pickId = items.first.id;
    }
  }

  Future<Map<String, dynamic>> _buildExportMap() async {
    var map = AppStateTransfer.buildExportMap(
      _m,
      exportKind: _exportKind,
      pickId: _pickId,
      ledgerScope: _ledgerScope,
      ledgerPartGroup: _ledgerPartGroup,
      ledgerPartPickId: _ledgerPart ? _pickId : null,
    );
    if (_redact) {
      map = await ExportSanitizer.sanitizeExportMap(_m, map);
    }
    return map;
  }

  Future<String> _encodeExport() async {
    final map = await _buildExportMap();
    return const JsonEncoder.withIndent('  ').convert(map);
  }

  Future<String?> _prepareExportJson() async {
    if (!_canExport) {
      setState(() => _status = 'Choose an item.');
      return null;
    }
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      final text = await _encodeExport();
      setState(() {
        _lastJson = text;
        _lastJsonChars = text.length;
      });
      return text;
    } catch (e) {
      if (mounted) setState(() => _status = '$e');
      return null;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _pickLabelForFileName() {
    if (_ledgerPart && _pickId != null && _pickId != LedgerPartGroup.allItemsId) {
      return _selectedPick?.label;
    }
    return _selectedPick?.label;
  }

  Future<void> _viewExport() async {
    final text = _lastJson ?? await _prepareExportJson();
    if (text == null || !mounted) return;
    showDataJsonViewer(context, title: 'Export', jsonText: text);
  }

  Future<void> _copyExport() async {
    final text = _lastJson ?? await _prepareExportJson();
    if (text == null) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    setState(() => _status = '${text.length} chars copied');
  }

  Future<void> _downloadExport() async {
    final text = _lastJson ?? await _prepareExportJson();
    if (text == null) return;
    setState(() => _busy = true);
    try {
      final bytes = utf8.encode(text);
      final path = await FilePicker.saveFile(
        dialogTitle: 'Export',
        fileName: AppStateTransfer.suggestedExportFileName(
          exportKind: _exportKind,
          pickLabel: _pickLabelForFileName(),
        ),
        type: FileType.custom,
        allowedExtensions: const ['json'],
        bytes: bytes,
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
        _importText = null;
        _importRoot = null;
        _importAnalysis = null;
        _status = e is FormatException ? e.message : '$e';
      });
    }
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

  Future<void> _runImport(ImportApplyMode mode) async {
    final root = _importRoot;
    if (root == null) {
      setState(() => _status = 'Choose a file');
      return;
    }
    if (mode == ImportApplyMode.merge && _importAnalysis?.supportsMerge != true) {
      setState(() => _status = 'Run not available');
      return;
    }
    setState(() {
      _busy = true;
      _status = null;
    });
    try {
      await AppStateTransfer.applyImport(_m, root, mode: mode);
      if (!mounted) return;
      setState(() => _status = 'Done');
    } catch (e) {
      if (mounted) setState(() => _status = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reviewImport() async {
    final root = _importRoot;
    final text = _importText;
    final analysis = _importAnalysis;
    final label = _importLabel;
    if (root == null || text == null || analysis == null || label == null) return;

    final mode = await showImportReviewSheet(
      context,
      analysis: analysis,
      sourceLabel: label,
      jsonText: text,
    );
    if (mode == null || !mounted) return;
    await _runImport(mode);
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
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _ExportItemPickerSheet(
        title: title,
        items: items,
        selectedId: selectedId,
      ),
    );
    if (picked != null && mounted) setState(() => _pickId = picked);
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
      value: _exportKind,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Export', border: OutlineInputBorder()),
      items: [
        for (final k in DataExportKind.all)
          DropdownMenuItem(value: k, child: Text(DataExportKind.label(k))),
      ],
      onChanged: _busy ? null : _onExportKindChanged,
    );
  }

  Widget _ledgerScopeDropdown() {
    return DropdownButtonFormField<String>(
      value: _ledgerScope,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Scope', border: OutlineInputBorder()),
      items: [
        for (final s in LedgerExportScope.all)
          DropdownMenuItem(value: s, child: Text(LedgerExportScope.label(s))),
      ],
      onChanged: _busy ? null : _onLedgerScopeChanged,
    );
  }

  Widget _ledgerPartGroupDropdown() {
    return DropdownButtonFormField<String>(
      value: _ledgerPartGroup,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Area', border: OutlineInputBorder()),
      items: [
        for (final g in LedgerPartGroup.all)
          DropdownMenuItem(value: g, child: Text(LedgerPartGroup.label(g))),
      ],
      onChanged: _busy ? null : _onLedgerPartGroupChanged,
    );
  }

  Widget _contextGroupDropdown() {
    return DropdownButtonFormField<String>(
      value: _contextGroup,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Area', border: OutlineInputBorder()),
      items: [
        for (final g in ContextExportGroup.all)
          DropdownMenuItem(value: g, child: Text(ContextExportGroup.label(g))),
      ],
      onChanged: _busy ? null : _onContextGroupChanged,
    );
  }

  Widget _itemPickerField({
    required String label,
    required List<DataExportPick> items,
    required String sheetTitle,
  }) {
    final selected = _selectedPick;
    final labelText = selected?.label ?? (items.isEmpty ? '—' : 'Choose…');

    if (items.length <= _kPickerSheetThreshold) {
      return DropdownButtonFormField<String>(
        value: items.isEmpty ? null : _pickId,
        isExpanded: true,
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
        items: [
          for (final p in items)
            DropdownMenuItem(
              value: p.id,
              child: Text(p.label, overflow: TextOverflow.ellipsis),
            ),
        ],
        onChanged: items.isEmpty || _busy ? null : (v) => setState(() => _pickId = v),
      );
    }

    return InputDecorator(
      decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      child: InkWell(
        onTap: items.isEmpty || _busy
            ? null
            : () => _openItemPicker(title: sheetTitle, items: items, selectedId: _pickId),
        child: Row(
          children: [
            Expanded(
              child: Text(
                labelText,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: items.isEmpty
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
    final text = _lastJson;
    if (text == null) return const SizedBox.shrink();
    final cs = Theme.of(context).colorScheme;
    final preview = text.length > 1200 ? '${text.substring(0, 1200)}\n…' : text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_lastJsonChars != null)
          Text(
            '$_lastJsonChars chars',
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
          ),
        const SizedBox(height: 6),
        Container(
          constraints: const BoxConstraints(maxHeight: 160),
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

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (_ledgerPart) _syncLedgerPartPick();
    if (_needsContextPick) _syncContextPick();
    if (_needsAgentPick) _syncAgentPick();

    final hasImport = _importRoot != null;
    final canRun = hasImport && (_importAnalysis?.supportsMerge ?? false);
    final canReplace = hasImport && (_importAnalysis?.supportsReplace ?? false);

    return ListView(
      padding: EdgeInsets.zero,
      children: [
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
        if (_needsAgentPick) ...[
          const SizedBox(height: 12),
          _itemPickerField(label: 'Agent', items: _agentItems, sheetTitle: 'Agents'),
        ],
        const SizedBox(height: 12),
        Row(
          children: [
            const Expanded(child: Text('Redact')),
            Switch(
              value: _redact,
              onChanged: _busy ? null : (v) => setState(() => _redact = v),
            ),
            IconButton(
              icon: const Icon(Icons.info_outline, size: 22),
              tooltip: 'Instructions',
              onPressed: _busy ? null : _openSanitizerPrompt,
            ),
          ],
        ),
        const SizedBox(height: 12),
        _threeButtonRow(
          actions: [
            (label: 'View', onPressed: _busy || !_canExport ? null : _viewExport, filled: false),
            (label: 'Copy', onPressed: _busy || !_canExport ? null : _copyExport, filled: false),
            (label: 'Download', onPressed: _busy || !_canExport ? null : _downloadExport, filled: true),
          ],
        ),
        if (_lastJson != null) ...[
          const SizedBox(height: 12),
          _jsonPreviewPanel(),
        ],
        const SizedBox(height: 24),
        OutlinedButton(
          onPressed: _busy ? null : _pickImportFile,
          child: Text(hasImport ? (_importLabel ?? 'File') : 'Choose file'),
        ),
        const SizedBox(height: 12),
        _threeButtonRow(
          actions: [
            (label: 'View', onPressed: hasImport && !_busy ? _viewImport : null, filled: false),
            (
              label: 'Run',
              onPressed: canRun && !_busy ? () => _runImport(ImportApplyMode.merge) : null,
              filled: true,
            ),
            (
              label: 'Replace',
              onPressed: canReplace && !_busy ? () => _runImport(ImportApplyMode.replace) : null,
              filled: false,
            ),
          ],
        ),
        if (hasImport)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: TextButton(
              onPressed: _busy ? null : _reviewImport,
              child: const Text('Summary'),
            ),
          ),
        if (_busy) ...[
          const SizedBox(height: 20),
          const Center(child: CircularProgressIndicator()),
        ],
        if (_status != null) ...[
          const SizedBox(height: 12),
          Text(
            _status!,
            style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
          ),
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
    final bottom = MediaQuery.paddingOf(context).bottom;
    final maxH = MediaQuery.sizeOf(context).height * 0.65;

    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 12 + bottom),
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
