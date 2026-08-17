import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'hermes_home_paths.dart';

class InboxItem {
  InboxItem({
    required this.id,
    required this.fileName,
    required this.receivedAt,
    this.from = '',
    this.subject = '',
    this.localRelPath = '',
    this.confirmed = false,
    this.fileTypeId = '',
    this.remoteId = '',
  });

  final String id;
  String fileName;
  DateTime receivedAt;
  String from;
  String subject;
  String localRelPath;
  bool confirmed;
  String fileTypeId;
  String remoteId;

  Map<String, dynamic> toJson() => {
    'id': id,
    'fileName': fileName,
    'receivedAt': receivedAt.toUtc().toIso8601String(),
    'from': from,
    'subject': subject,
    'localRelPath': localRelPath,
    'confirmed': confirmed,
    'fileTypeId': fileTypeId,
    'remoteId': remoteId,
  };

  static InboxItem fromJson(Map<String, dynamic> m) => InboxItem(
    id: m['id']?.toString() ?? '',
    fileName: m['fileName']?.toString() ?? '',
    receivedAt:
        DateTime.tryParse(m['receivedAt']?.toString() ?? '')?.toUtc() ??
        DateTime.now().toUtc(),
    from: m['from']?.toString() ?? '',
    subject: m['subject']?.toString() ?? '',
    localRelPath: m['localRelPath']?.toString() ?? '',
    confirmed: m['confirmed'] == true,
    fileTypeId: m['fileTypeId']?.toString() ?? '',
    remoteId: m['remoteId']?.toString() ?? '',
  );
}

class InboxStore {
  InboxStore(this.home);

  final Directory home;

  Directory get _files =>
      Directory('${home.path}/${HermesHomePaths.inboxFilesDir}');
  File get _messages =>
      File('${home.path}/${HermesHomePaths.inboxMessagesFile}');

  Future<void> ensure() async {
    await _files.create(recursive: true);
    if (!await _messages.exists()) {
      await _writeAll([]);
    }
  }

  Future<List<InboxItem>> list() async {
    await ensure();
    try {
      final raw = jsonDecode(await _messages.readAsString());
      if (raw is! Map) return [];
      final items = raw['items'];
      if (items is! List) return [];
      return [
        for (final e in items)
          if (e is Map) InboxItem.fromJson(Map<String, dynamic>.from(e)),
      ]..sort((a, b) => b.receivedAt.compareTo(a.receivedAt));
    } catch (_) {
      return [];
    }
  }

  Future<InboxItem> addFile({
    required String fileName,
    required List<int> bytes,
    String from = '',
    String subject = '',
    String fileTypeId = '',
    String remoteId = '',
  }) async {
    await ensure();
    final id = DateTime.now().toUtc().microsecondsSinceEpoch.toString();
    final safe = fileName.replaceAll(RegExp(r'[^a-zA-Z0-9_.\-]'), '_');
    final rel = '${HermesHomePaths.inboxFilesDir}/$id-$safe';
    final dest = File('${home.path}/$rel');
    await dest.writeAsBytes(Uint8List.fromList(bytes), flush: true);
    final item = InboxItem(
      id: id,
      fileName: fileName,
      receivedAt: DateTime.now().toUtc(),
      from: from,
      subject: subject,
      localRelPath: rel,
      fileTypeId: fileTypeId,
      remoteId: remoteId,
    );
    final all = await list();
    all.insert(0, item);
    await _writeAll(all);
    return item;
  }

  Future<void> markConfirmed(String id) async {
    final all = await list();
    for (final i in all) {
      if (i.id == id) i.confirmed = true;
    }
    await _writeAll(all);
  }

  File? fileFor(InboxItem item) {
    if (item.localRelPath.isEmpty) return null;
    return File('${home.path}/${item.localRelPath}');
  }

  Future<void> _writeAll(List<InboxItem> items) async {
    await _messages.parent.create(recursive: true);
    await _messages.writeAsString(
      const JsonEncoder.withIndent(
        '  ',
      ).convert({'items': items.map((e) => e.toJson()).toList()}),
      flush: true,
    );
  }
}
